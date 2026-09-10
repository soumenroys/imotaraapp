// src/app/api/tts/route.ts
// Azure Neural TTS endpoint — synthesizes the full request text, then returns
// one complete audio/mpeg response (buffered server-side via arrayBuffer(),
// not streamed). Callers wanting to start playback before a long reply
// finishes synthesizing should chunk the text into multiple requests
// themselves and pipeline them (see mobileTTS.ts's speakMessage()).
// Web: called only when the browser lacks a native voice for the selected language.
// Mobile: speakMessage() (chat-reply playback) always calls this route first,
// for every language including English, then falls back to native on-device
// TTS only if this request fails — so English does reach this route on mobile.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { getAzureConfig } from "@/lib/azure-tts/regionRouter";
import { resolveVoice, resolveStyle, resolveProsody, AZURE_LOCALE } from "@/lib/azure-tts/voices";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";

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
const RATE_LIMIT_PER_MIN = 40;

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
        checkPersistentIpRateLimit("tts", ip, RATE_LIMIT_PER_MIN, 60),
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

    let body: { text?: string; lang?: string; gender?: string; emotion?: string };
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
    const ssml = `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts"><voice name="${voice}"><mstts:silence type="Leading-exact" value="0ms"/><mstts:silence type="Tailing-exact" value="0ms"/>${bodyXml}</voice></speak>`;

    const azureUrl = `https://${azureConfig.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    let azureRes: Response;
    try {
        azureRes = await fetch(azureUrl, {
            method:  "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": azureConfig.key,
                "Content-Type":              "application/ssml+xml",
                "X-Microsoft-OutputFormat":  "audio-24khz-48kbitrate-mono-mp3",
                "User-Agent":                "ImotaraApp",
            },
            body: ssml,
        });
    } catch (err) {
        console.error("[tts] Azure fetch failed:", err);
        return NextResponse.json({ error: "TTS service unavailable" }, { status: 502 });
    }
    console.log(`[tts] azure fetch done at +${Date.now() - tStart}ms status=${azureRes.status} region=${azureConfig.region} textLen=${text.length}`);

    if (!azureRes.ok) {
        const errText = await azureRes.text().catch(() => "");
        console.error(`[tts] Azure error ${azureRes.status}:`, errText);
        return NextResponse.json({ error: "TTS synthesis failed" }, { status: 502 });
    }

    const audioBuffer = await azureRes.arrayBuffer();
    console.log(`[tts] total done at +${Date.now() - tStart}ms bytes=${audioBuffer.byteLength}`);

    // Fire-and-forget usage tracking — only for anonymous identities, since
    // that's the only tier this route quota-gates. Mirrors chat-reply's
    // post-success usage_events insert.
    if (user.is_anonymous) {
        void Promise.resolve(
            getSupabaseAdmin().from("usage_events").insert({
                user_id:    user.id,
                event_type: "tts",
            })
        ).catch(() => {});
    }

    return new NextResponse(audioBuffer, {
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
