// src/app/api/tts/route.ts
// Azure Neural TTS endpoint — synthesizes the full request text, then returns
// one complete audio/mpeg response, STREAMED from Azure rather than buffered
// here (see the note above the return). Callers wanting to start playback before a long reply
// finishes synthesizing should chunk the text into multiple requests
// themselves and pipeline them (see mobileTTS.ts's speakMessage()).
// Web: called only when the browser lacks a native voice for the selected language.
// Mobile: speakMessage() (chat-reply playback) always calls this route first,
// for every language including English, then falls back to native on-device
// TTS only if this request fails — so English does reach this route on mobile.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { getAzureConfig } from "@/lib/azure-tts/regionRouter";
import { resolveVoice, resolveStyle, resolveProsody, AZURE_LOCALE, AZURE_VOICES } from "@/lib/azure-tts/voices";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";
import { resolvePlatform } from "@/lib/imotara/clientPlatform";

export const runtime = "nodejs";
export const maxDuration = 60;

// Anonymous Supabase identities (signed-out mobile users) get real Azure
// Neural TTS instead of no identity at all, but — unlike real signed-in
// accounts, which still have zero quota here by design (any authenticated
// user always had unlimited Azure spend; anonymous auth just removes the
// email-signup friction that used to be the only thing bounding who could
// reach this) — anonymous identities are cheap to create, so this quota is
// the mandatory prerequisite for enabling anonymous sign-ins at all. Mirrors
// the usage_events daily-quota pattern already used in chat-reply/route.ts.
const ANONYMOUS_TTS_DAILY_LIMIT = 15;

// This route already requires SOME identity (401 below) and caps anonymous
// identities per-day, but had no defense against one script minting many
// cheap anonymous identities from a single IP — see
// code_review_audit_2026_08_14 (P0-2). Checked first, before any auth work,
// so obviously-abusive traffic is rejected at the cheapest possible point.
// 🔴 ONE SPOKEN REPLY IS NOT ONE REQUEST.
//
// /api/tts is called PER CHUNK, and /api/tts/transliterate shares this very
// bucket, so a single reply legitimately costs 3–6 of the allowance. At 40/min
// that is roughly 7–13 replies per minute — FOR THE WHOLE IP.
//
// ⚠️ And on carrier-grade NAT (most Indian mobile networks, school and office
// networks) hundreds of unrelated people share one public IP. A paying user
// could be denied voice because strangers on the same carrier used it first,
// and the client surfaces that 429 as "Couldn't connect — using offline
// reply", which blames the network for a quota decision. (U14 of the
// 2026-10-09 audit.)
//
// 🔑 The limit's own comment says what it is FOR: "one script minting many
// cheap anonymous identities from a single IP". A signed-in, non-anonymous
// person is not that threat — they are already bounded by their account.
// So apply the strict number where the threat actually is, and keep a
// generous absolute ceiling as the cheap pre-auth DoS guard.
//
// ⛔ NOT simply "raise the number". That would weaken the guard for the
// traffic it was written to stop.

/** Pre-auth, cheapest possible rejection. Sized for shared NAT, not one user. */
const IP_CEILING_PER_MIN = 300;
/** The real guard, applied AFTER auth and only to anonymous identities. */
const ANON_IP_RATE_LIMIT_PER_MIN = 40;

/**
 * The `sub` and `is_anonymous` claims, read WITHOUT verifying the signature.
 *
 * ⚠️ READ THIS BEFORE USING THE RETURN VALUE FOR ANYTHING.
 *
 * These claims are attacker-controlled until getUser() has verified the token.
 * They exist here for exactly one purpose: to let the read-only quota COUNT
 * start early, alongside the auth round trip, instead of after it. That count
 * is thrown away unless verified auth comes back with the same user id.
 *
 * They must never decide anything. Imotara has already had one incident of
 * precisely this shape — chat-reply trusted an unverified `sub` to decrement a
 * paid token balance (see the token-drain fix, web ebe5cb8). The distinction
 * that makes this safe is narrow and worth stating: that code ACTED on the
 * claim; this only lets a read begin, and discards it on any mismatch.
 */
function unverifiedClaims(token: string): { sub: string | null; isAnonymous: boolean } {
    try {
        const payload = JSON.parse(
            Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
        );
        return {
            sub: typeof payload?.sub === "string" ? payload.sub : null,
            isAnonymous: payload?.is_anonymous === true,
        };
    } catch {
        return { sub: null, isAnonymous: false };
    }
}

/**
 * THE DISCARD RULE, as a function so it can be tested rather than merely read.
 *
 * A count fetched speculatively from an unverified `sub` may be used only when
 * verified auth produced that exact same user id. Anything else — no
 * speculative result, no claim, a different user, a cookie-auth request —
 * means it is discarded and the count is fetched for the user we actually
 * authenticated.
 *
 * Exported for ttsSpeculativeQuota.test.ts. If this ever returns true for a
 * mismatch, one user's quota is read for another.
 */
export function canUseSpeculativeCount(
    claimedSub: string | null,
    verifiedUserId: string,
    speculative: number | null,
): boolean {
    if (speculative === null) return false;
    if (!claimedSub) return false;
    return claimedSub === verifiedUserId;
}

/** Today's TTS event count for a user. Read-only. */
async function ttsCountToday(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await getSupabaseAdmin()
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "tts")
        .gte("created_at", todayStart.toISOString());
    return count ?? 0;
}

// Bearer lookups are NOT cached, deliberately.
//
// Caching them was tried and measured on 2026-09-10: brand-new token 0.447s,
// same token again 0.429s — identical within noise. The reason is that the
// rate-limit check now runs alongside getUser (see POST below) and takes about
// the same time, so the auth call is entirely hidden behind it. Caching
// something that costs nothing saves nothing, and it would have bought a
// window where a revoked token still worked.
//
// Worth revisiting only if that changes: if Supabase Auth gets slower, or the
// rate-limit check gets faster, the auth cost stops being hidden and a cache
// starts to pay for itself.

export async function POST(req: NextRequest) {
    const tStart = Date.now();

    const ip = getClientIp(req);

    // The rate limit and the bearer lookup do not depend on each other, and
    // each is a network round trip. Run them together: awaiting them in
    // sequence made every chunk of every reply wait for the sum rather than
    // the slower of the two.
    //
    // Mobile always sends a Bearer token and never a Supabase session cookie,
    // so checking cookie auth first wasted a full round trip to Supabase Auth
    // (getUser() re-validates against the server every call, unlike
    // getSession()) that was guaranteed to fail on every mobile request.
    // Check Bearer first when present; only fall back to cookie auth (web) otherwise.
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const lookupBearer = async (): Promise<User | null> => {
        if (!bearerToken) return null;
        const anon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: { user } } = await anon.auth.getUser(bearerToken);
        return user ?? null;
    };

    // Start the quota count early, from the UNVERIFIED sub claim. It is a
    // read; nothing is decided by it here. Below, it is used only if verified
    // auth returns that same user id — otherwise it is discarded and the real
    // query runs. See unverifiedClaims' doc comment for why that distinction
    // matters on this particular codebase.
    const claimed = bearerToken ? unverifiedClaims(bearerToken) : { sub: null, isAnonymous: false };
    const speculativeQuota =
        claimed.sub && claimed.isAnonymous
            ? ttsCountToday(claimed.sub).catch(() => null)
            : Promise.resolve(null);

    const [withinRateLimit, bearerUser] = await Promise.all([
        checkPersistentIpRateLimit("tts", ip, IP_CEILING_PER_MIN, 60),
        lookupBearer(),
    ]);

    // Still checked first, and still on every request — running the lookup
    // alongside it does not mean an over-limit caller gets served.
    if (!withinRateLimit) {
        return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    let user: User | null = bearerUser;
    console.log(`[tts] rate-limit + bearer auth done at +${Date.now() - tStart}ms user=${!!user}`);

    if (!user) {
        const supabase = await supabaseUserServer();
        const { data: { user: cookieUser } } = await supabase.auth.getUser();
        user = cookieUser;
        console.log(`[tts] cookie auth done at +${Date.now() - tStart}ms user=${!!user}`);
    }

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.is_anonymous) {
        // 🔑 The strict per-IP limit lives HERE, where the threat is: an
        // anonymous identity from this IP. A signed-in person never reaches
        // this branch and so is no longer rationed by what strangers sharing
        // their carrier NAT happen to be doing.
        if (!(await checkPersistentIpRateLimit("tts-anon", ip, ANON_IP_RATE_LIMIT_PER_MIN, 60))) {
            return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
        }

        // THE DISCARD RULE. The speculative count is usable only when verified
        // auth produced the very same user id the unverified claim named. Any
        // mismatch — a forged or swapped token, a cookie-auth request, a failed
        // speculative query — and it is thrown away and the count is fetched
        // for the user we actually authenticated.
        const speculative = await speculativeQuota;
        const count = canUseSpeculativeCount(claimed.sub, user.id, speculative)
            ? (speculative as number)
            : await ttsCountToday(user.id);

        if (count >= ANONYMOUS_TTS_DAILY_LIMIT) {
            return NextResponse.json(
                { error: "Daily voice limit reached. Sign in for unlimited voice.", code: "quota_exceeded" },
                { status: 429 },
            );
        }
    }

    console.log(`[tts] quota check done at +${Date.now() - tStart}ms anon=${!!user.is_anonymous}`);

    let body: { text?: string; lang?: string; gender?: string; emotion?: string; chunkIndex?: number };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // emotion (optional): the user's detected emotional state — see
    // resolveStyle in voices.ts for how this shapes the reply's delivery
    // style, and why it's not a 1:1 mirror of the emotion itself.
    const { text, lang = "en", gender = "neutral", emotion } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Hard cap — prevent abuse. Actual replies are capped server-side at
    // roughly 1200-2500 chars (see chat-reply's maxTokens), so 8000 leaves
    // generous headroom for legitimate long-form replies without ever being
    // the reason a real reply gets rejected outright and dropped to the
    // native-voice fallback.
    if (text.length > 8000) {
        return NextResponse.json({ error: "text too long (max 8000 chars)" }, { status: 400 });
    }

    let azureConfig;
    try {
        const country = req.headers.get("x-vercel-ip-country");
        azureConfig = getAzureConfig(country);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Azure not configured";
        console.error("[tts] config error:", message);
        return NextResponse.json({ error: message }, { status: 503 });
    }

    // 🔴 DO NOT READ ONE LANGUAGE ALOUD IN ANOTHER LANGUAGE'S VOICE.
    //
    // resolveVoice falls back to English for any unknown key
    // (`AZURE_VOICES[lang] ?? AZURE_VOICES["en"]`), and AZURE_LOCALE does the
    // same. So Korean — the obvious case, since `resolveTTSLang` really does
    // return "ko-KR" for Hangul — came back as `en-US-Olivia` reading Hangul
    // inside `xml:lang="en-US"`, and the route answered **200 with audio**.
    //
    // ⚠️ The 200 is the harmful part. Both clients fall back to their own
    // device voice on a non-OK response, and a phone or browser very often
    // HAS a Korean voice. By succeeding with gibberish we guaranteed the one
    // outcome worse than failing. (U18 of the 2026-10-09 audit.)
    //
    // ✅ Safe for every supported language: all 22 are present in
    // AZURE_VOICES (verified), so this can only fire for a language Imotara
    // does not claim to support — exactly where the device voice is the best
    // available answer.
    const baseLang = String(lang).slice(0, 2).toLowerCase();
    if (!(baseLang in AZURE_VOICES)) {
        console.warn(
            `[tts] no Azure voice for "${lang}" — refusing to read it in an English voice; ` +
            "the client's device voice is the better answer",
        );
        return NextResponse.json(
            { error: "unsupported_language", lang: String(lang) },
            { status: 415 },
        );
    }

    const voice   = resolveVoice(lang, gender);
    const locale  = AZURE_LOCALE[lang] ?? "en-US";
    const style   = resolveStyle(lang, gender, emotion);
    const prosody = style ? undefined : resolveProsody(lang, gender, emotion);

    // Three cases: a named mstts:express-as style (languages with a real
    // Azure StyleList — see EMOTION_STYLE_MAP in voices.ts), a conservative
    // <prosody> rate/pitch nudge (languages with no style-capable voice at
    // all — see resolveProsody), or plain text (no emotion detected, or a
    // manual "read aloud" tap that never sends one). A standard Neural
    // voice's default, unstyled delivery already sounds natural — the
    // now-removed blanket -8%/+1% wrapper (2026-08-13) fought the model's
    // own learned prosody and read as the wrong tone, not a warmer one;
    // resolveProsody's much smaller deltas only ever apply when a real
    // emotion was actually detected, never unconditionally.
    const escapedText = escapeXml(text.trim());
    const bodyXml = style
        ? `<mstts:express-as style="${style}" styledegree="1.4">${escapedText}</mstts:express-as>`
        : prosody
        ? `<prosody rate="${prosody.rate}" pitch="${prosody.pitch}">${escapedText}</prosody>`
        : escapedText;

    // Reply audio is synthesized one sentence-chunk at a time (see
    // splitIntoSpeechChunks / playChunkedTTS-style pipelined playback on both
    // platforms) — Azure Neural voices pad every clip with leading/trailing
    // silence by default, and how much varies a lot by voice: measured
    // ~0.85-0.87s trailing silence for bn-IN-TanishaaNeural alone (confirmed
    // via ffmpeg silencedetect), versus ~0.15-0.3s for most other tested
    // voices. Stacked once per chunk, this produced an audible pause between
    // every sentence — reported by a user, "very prominent in Bengali" but
    // present in every language tested (2026-08-15 investigation). These
    // mstts:silence tags ask Azure to omit that padding at the source rather
    // than trying to trim it client-side after the fact; live-verified
    // across bn/hi/en/ta/ja with ffprobe — every voice shed 0.3-1.0s per
    // clip with no distortion.
    const buildSsml = (inner: string) =>
        `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts"><voice name="${voice}"><mstts:silence type="Leading-exact" value="0ms"/><mstts:silence type="Tailing-exact" value="0ms"/>${inner}</voice></speak>`;

    const azureUrl = `https://${azureConfig.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const synthesize = (inner: string) =>
        fetch(azureUrl, {
            method:  "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": azureConfig.key,
                "Content-Type":              "application/ssml+xml",
                "X-Microsoft-OutputFormat":  "audio-24khz-48kbitrate-mono-mp3",
                "User-Agent":                "ImotaraApp",
            },
            body: buildSsml(inner),
        });

    let azureRes: Response;
    try {
        azureRes = await synthesize(bodyXml);
    } catch (err) {
        console.error("[tts] Azure fetch failed:", err);
        return NextResponse.json({ error: "TTS service unavailable" }, { status: 502 });
    }
    console.log(`[tts] azure fetch done at +${Date.now() - tStart}ms status=${azureRes.status} region=${azureConfig.region} textLen=${text.length}`);

    // 🔴 ONE RETRY WITHOUT THE EMOTION WRAPPER BEFORE GIVING UP.
    //
    // The styled body is the fragile part of this request. `mstts:express-as`
    // only accepts styles that the SPECIFIC voice supports, and Azure rejects
    // the whole request — not just the style — when it does not. Azure also
    // retires and renames voices periodically. Either way the old code went
    // straight to 502 and the person dropped to their device's own voice for
    // the rest of the reply, when the plain Azure voice would have worked.
    // (U12 of the 2026-10-09 audit.)
    //
    // ⚠️ Severity is real but bounded: a 502 does NOT leave them silent,
    // because both clients fall back to the device voice — verified tonight.
    // This recovers the BETTER voice, it does not rescue a dead feature.
    //
    // ⛔ Only retried when there was a wrapper to drop. A plain request that
    // failed will fail again, and retrying it would double the latency of
    // every genuine outage for nothing.
    if (!azureRes.ok && bodyXml !== escapedText) {
        const firstErr = await azureRes.text().catch(() => "");
        console.warn(
            `[tts] Azure ${azureRes.status} with the emotion wrapper (voice=${voice} style=${style ?? "none"}) — ` +
            `retrying plain: ${firstErr.slice(0, 200)}`,
        );
        try {
            azureRes = await synthesize(escapedText);
        } catch (err) {
            console.error("[tts] Azure retry fetch failed:", err);
            return NextResponse.json({ error: "TTS service unavailable" }, { status: 502 });
        }
        if (azureRes.ok) {
            console.warn(`[tts] plain retry SUCCEEDED — the style "${style ?? ""}" is not valid for ${voice}`);
        }
    }

    if (!azureRes.ok) {
        const errText = await azureRes.text().catch(() => "");
        console.error(`[tts] Azure error ${azureRes.status}:`, errText);
        return NextResponse.json({ error: "TTS synthesis failed" }, { status: 502 });
    }

    // Fire-and-forget usage tracking — only for anonymous identities, since
    // that's the only tier this route quota-gates. Mirrors chat-reply's
    // post-success usage_events insert. Runs BEFORE the response is returned
    // now that the body streams: there is no post-download moment to hook.
    // 🔴 ONE UNIT PER REPLY, NOT PER CHUNK.
    //
    // A reply is split into 3-4 chunks and each chunk is its own request, so
    // counting every request made ANONYMOUS_TTS_DAILY_LIMIT = 15 mean three
    // to five spoken replies a day, not fifteen. Reported 2026-10-10: the
    // voice went faint and badly pronounced after a handful of replies —
    // that was this quota being exhausted and the client silently dropping to
    // the device voice.
    //
    // Owner decision the same day: "make it 15 replies per free user for now."
    //
    // ⚖️ FAILS SAFE. A client that does not send chunkIndex — every build
    // already in the wild — is counted exactly as before, so nothing becomes
    // cheaper by accident. Only a client that explicitly says "this is chunk
    // 3 of a reply I already started" is skipped.
    const isFirstChunkOfReply =
        typeof body.chunkIndex === "number" ? body.chunkIndex === 0 : true;

    if (user.is_anonymous && isFirstChunkOfReply) {
        void Promise.resolve(
            getSupabaseAdmin().from("usage_events").insert({
                user_id:    user.id,
                event_type: "tts",
                platform:   resolvePlatform(req),
            })
        ).catch(() => {});
    }

    // STREAM Azure's body straight through instead of buffering it here.
    //
    // This used to be `await azureRes.arrayBuffer()`, which made the audio
    // cross the network twice in series: Azure -> this function, and only then
    // this function -> the caller. Measured against production 2026-09-12,
    // one English chunk:
    //
    //   rate-limit + bearer auth   713ms
    //   quota check                 +40ms
    //   Azure synthesis           3,106ms
    //   Azure -> Vercel download    928ms   <- this leg, removed
    //   total                     4,787ms
    //
    // The caller still buffers (mobileTTS does res.arrayBuffer() before
    // Audio.Sound.createAsync), so this does NOT let playback start early —
    // what it removes is the serialisation: bytes now reach the caller as
    // Azure produces them rather than after this function has the last one.
    //
    // Trade-off accepted: an Azure failure PART WAY through the body now
    // arrives as truncated audio rather than a 502, because the status line is
    // already sent. Azure sets its status before any body, so the common
    // failures (401, 429, bad SSML) are still caught above by azureRes.ok.
    //
    // No Content-Length is set, so this goes out chunked. That is fine for
    // every current caller — all of them read the whole body before playing.
    console.log(`[tts] streaming response at +${Date.now() - tStart}ms`);
    return new NextResponse(azureRes.body, {
        status:  200,
        headers: {
            "Content-Type":  "audio/mpeg",
            "Cache-Control": "public, max-age=86400", // 24h — same text+voice = same audio
        },
    });
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&apos;");
}
