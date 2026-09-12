// src/app/api/voice/transcribe/route.ts
// Speech-to-text for mobile voice input — forwards audio to OpenAI Whisper.
// Accepts a multipart/form-data POST with a single "file" field (audio/m4a).
// Returns { text: string }.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Max audio size: 10 MB (Whisper limit is 25 MB; 60s m4a ≈ 1 MB in practice)
const MAX_BYTES = 10 * 1024 * 1024;

// Same quota shape as /api/tts — anonymous identities get real Whisper STT
// instead of no identity at all, but need a bound since they're cheap to
// create. Real signed-in accounts remain unlimited, unchanged.
const ANONYMOUS_TRANSCRIBE_DAILY_LIMIT = 20;

// Defense against one script minting many cheap anonymous identities from a
// single IP — see code_review_audit_2026_08_14 (P0-2).
const RATE_LIMIT_PER_MIN = 30;

/**
 * Whisper invents speech when it hears none.
 *
 * Fed a silent or noisy recording it does not return "" — it returns fluent,
 * confident sentences lifted from its training data, overwhelmingly YouTube
 * outro boilerplate. Observed on a real phone 2026-09-12, three recordings of
 * a quiet room in a row:
 *
 *   "If you liked it, give it a thumbs up. If you have any questions or
 *    suggestions, feel free to comment below . ... ....."
 *   "This is a video of a cat that was trapped by a dog. It's a dog. It's a dog…"
 *   "Okay. Okay. Okay."
 *
 * Each landed in the message box, and with "send voice notes automatically"
 * switched on it would have been sent to the companion as the person's own
 * words. For an app someone talks to about how they feel, putting invented
 * sentences in their mouth and then replying to them warmly is the worst
 * failure this route has.
 *
 * TWO INDEPENDENT CHECKS, deliberately biased towards letting speech through.
 * A false reject means someone spoke and the app ignored them, which is its own
 * small betrayal — so each check only fires on strong evidence.
 */

/** Phrases Whisper emits from silence. None is plausible in this app. */
const HALLUCINATION_PATTERNS: RegExp[] = [
    /thanks? (?:for|you for) watching/i,
    /(?:don'?t forget to |please )?(?:like,? )?(?:and )?subscribe/i,
    /(?:give it a |leave a )?thumbs? up/i,
    /comment (?:below|down below)/i,
    /(?:see|catch) you (?:in the )?next (?:video|time)/i,
    /this is a video of/i,
    /(?:copyright|transcription|subtitles?) (?:by|©)/i,
    /amara\.org/i,
    /^(?:you|bye|thank you)[.!\s]*$/i,
];

/** A single short word or phrase repeated — "It's a dog. It's a dog. It's a dog." */
function isDegenerateRepetition(text: string): boolean {
    const parts = text.split(/[.!?]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length < 3) return false;
    const unique = new Set(parts);
    // Three or more sentences, and at most a third of them distinct.
    return unique.size <= Math.max(1, Math.floor(parts.length / 3));
}

/**
 * Whisper ANNOTATING non-speech audio — a second failure mode, found on the
 * same phone a day later (2026-09-13). Hands-free, quiet room, auto-sent:
 *
 *     "**Scary music starts playing** keep an eye out.."
 *     "Wheeze"
 *
 * Neither is boilerplate and neither repeats, so both checks above let them
 * straight through. This is not Whisper inventing a sentence; it is Whisper
 * truthfully describing the room and the transport handing that to the
 * companion as something the person said.
 *
 * The signal is the MARKUP, not the vocabulary. Someone speaking into a
 * microphone cannot produce an asterisk, a square bracket or a musical note —
 * those characters only ever come from Whisper marking audio it heard and did
 * not treat as speech. So their presence condemns the whole transcription,
 * trailing residue included: the residue came out of the same decode of the
 * same non-speech audio, which is exactly how "keep an eye out.." arrived.
 *
 * Anything talking ABOUT music, coughing or sighing is left alone — this app
 * exists for those sentences.
 */
const ANNOTATION_MARKUP = /\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]*\]|[\u266a\u266b\u266c\u2669]/;

/**
 * Involuntary sounds Whisper labels. Deliberately narrow: every word here is
 * one nobody offers as their entire reply to "how are you feeling?".
 *
 * "silence", "breathing", "music" and "noise" are NOT here on purpose — each
 * is a plausible one-word answer in this app, and the bracket rule already
 * catches them in their annotated forms.
 */
const SOUND_EVENT_WORDS = new Set([
    "wheeze", "wheezes", "wheezing",
    "cough", "coughs", "coughing",
    "sneeze", "sneezes", "sneezing",
    "sniffle", "sniffles", "sniffling",
    "gasp", "gasps", "gasping",
    "grunt", "grunts", "groan", "groans",
    "chuckle", "chuckles", "chuckling",
    "laughter", "applause", "clapping",
    "clattering", "rustling", "creaking", "squeaking",
    "static", "beeping", "buzzing", "humming", "ticking", "whirring", "rumbling",
    "snoring", "whimper", "whimpers", "gurgling", "clanging", "footsteps",
    "inaudible", "unintelligible",
]);

/**
 * A wider vocabulary, safe ONLY inside brackets.
 *
 * "(sighs)", "(wind blowing)" and "(soft music)" cannot be speech, but the
 * bare words sigh, wind and music can all be someone's whole answer here — so
 * these are trusted only when the brackets have already told us the span is an
 * annotation. The narrow set above is the one allowed to stand on its own.
 */
const BRACKETED_SOUND_WORDS = new Set([
    ...SOUND_EVENT_WORDS,
    "sigh", "sighs", "sighing", "exhales", "inhales", "breathing", "breathes",
    "silence", "music", "noise", "wind", "blowing", "rain", "thunder",
    "laughing", "laughs", "crying", "sobbing", "sniffing", "whispering",
    "indistinct", "chatter", "mumbling", "beep", "bell", "ringing",
    "door", "engine", "traffic", "birds", "barking", "playing", "creaks",
]);

/**
 * Round brackets are the one ambiguous delimiter — Whisper does use them for
 * real parenthetical speech ("he said (and I quote) ..."), so they only count
 * as an annotation when what they hold is short AND names a sound.
 */
function hasParentheticalSoundEvent(text: string): boolean {
    for (const m of text.matchAll(/\(([^)]*)\)/g)) {
        const words = m[1].toLowerCase().split(/[^a-z]+/).filter(Boolean);
        if (words.length && words.length <= 4 && words.some((w) => BRACKETED_SOUND_WORDS.has(w))) {
            return true;
        }
    }
    return false;
}

/** The whole utterance is nothing but a sound label — "Wheeze", "Coughing". */
function isBareSoundEvent(text: string): boolean {
    const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (words.length === 0 || words.length > 2) return false;
    return words.every((w) => SOUND_EVENT_WORDS.has(w));
}

/** Exported for tests: is this Whisper describing audio rather than speech? */
export function isSoundEventAnnotation(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    return ANNOTATION_MARKUP.test(t) || hasParentheticalSoundEvent(t) || isBareSoundEvent(t);
}

/** Exported for tests: does this look like something Whisper made up? */
export function isLikelyHallucination(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    if (HALLUCINATION_PATTERNS.some((re) => re.test(t))) return true;
    if (isSoundEventAnnotation(t)) return true;
    return isDegenerateRepetition(t);
}

type WhisperSegment = { no_speech_prob?: number; avg_logprob?: number };

/**
 * Exported for tests: did Whisper itself think there was no speech?
 *
 * Both conditions must hold, on EVERY segment — OpenAI's own decoder uses the
 * same pairing, because no_speech_prob alone is noisy on quiet speech. A
 * recording where any segment looks like real speech is kept whole.
 */
export function hasNoSpeech(segments: WhisperSegment[] | undefined): boolean {
    if (!segments || segments.length === 0) return false; // no data — never reject
    return segments.every(
        (seg) =>
            typeof seg.no_speech_prob === "number" &&
            typeof seg.avg_logprob === "number" &&
            seg.no_speech_prob > 0.6 &&
            seg.avg_logprob < -0.4,
    );
}

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    if (!(await checkPersistentIpRateLimit("voice-transcribe", ip, RATE_LIMIT_PER_MIN, 60))) {
        return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "STT not configured" }, { status: 503 });
    }

    // This route had NO auth check at all — any anonymous caller could POST
    // audio and have it transcribed on the app's own OpenAI key, with no
    // rate limiting either. Same pattern as /api/tts's fix.
    let user = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const anon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: { user: bearerUser } } = await anon.auth.getUser(token);
        user = bearerUser;
    }
    if (!user) {
        const supabase = await supabaseUserServer();
        const { data: { user: cookieUser } } = await supabase.auth.getUser();
        user = cookieUser;
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.is_anonymous) {
        const quotaAdmin = getSupabaseAdmin();
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const { count } = await quotaAdmin
            .from("usage_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("event_type", "voice_transcribe")
            .gte("created_at", todayStart.toISOString());

        if ((count ?? 0) >= ANONYMOUS_TRANSCRIBE_DAILY_LIMIT) {
            // Same { error: "quota_exceeded" } / 503 shape the client already
            // handles for Whisper's own quota exhaustion below — reuses the
            // existing "Voice unavailable" alert rather than needing a new one.
            return NextResponse.json({ error: "quota_exceeded" }, { status: 503 });
        }
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
    }

    const file = formData.get("file") as Blob | null;
    if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }

    // Optional language hint (BCP-47 or ISO-639-1) — helps Whisper accuracy
    const lang = formData.get("lang");

    // Whisper supported language codes (ISO-639-1). Sending an unsupported code
    // causes a 400 from Whisper — omitting the param lets Whisper auto-detect instead.
    // Odia ("or"), for example, is not in Whisper's list and would silently fail.
    // Full Whisper v1 supported language set (ISO-639-1).
    // bn/te/ml/gu/pa added — Whisper supports all five; previously missing, causing
    // auto-detection that mislabels short Indic utterances as Hindi/Arabic.
    // "or" (Odia) remains absent — not in Whisper's supported list.
    const WHISPER_LANGS = new Set(["af","ar","hy","az","be","bs","bg","bn","ca","zh","hr","cs","da","nl","en","et","fi","fr","gl","gu","de","el","he","hi","hu","is","id","it","ja","kn","kk","ko","lv","lt","mk","ml","ms","mr","mi","ne","no","fa","pl","pt","pa","ro","ru","sr","sk","sl","es","sw","sv","tl","ta","te","th","tr","uk","ur","vi","cy"]);

    const whisperForm = new FormData();
    // All mobile recordings are MPEG_4/AAC (.m4a) — Android LOW_QUALITY is
    // overridden at record time to avoid THREE_GPP which Whisper does not accept.
    whisperForm.append("file", file, "voice.m4a");
    whisperForm.append("model", "whisper-1");
    // verbose_json carries per-segment no_speech_prob and avg_logprob. Plain
    // text does not, which is why this route could not tell a real sentence
    // from one Whisper invented out of silence — see rejectHallucination below.
    // The `.text` field is present in both formats, so nothing downstream
    // changes.
    whisperForm.append("response_format", "verbose_json");
    if (lang && typeof lang === "string") {
        const code = lang.split("-")[0];
        if (WHISPER_LANGS.has(code)) {
            whisperForm.append("language", code); // whisper wants ISO-639-1
        }
        // else: unsupported code — omit language and let Whisper auto-detect
    }

    let whisperRes: Response;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 55_000); // 55s — Vercel limit is 60s
        try {
            whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: { Authorization: `Bearer ${apiKey}` },
                body: whisperForm,
                signal: ctrl.signal,
            });
        } finally {
            clearTimeout(timer);
        }
    } catch (err) {
        console.error("[voice/transcribe] Whisper fetch failed:", err);
        return NextResponse.json({ error: "STT service unavailable" }, { status: 502 });
    }

    if (!whisperRes.ok) {
        const errText = await whisperRes.text().catch(() => "");
        console.error(`[voice/transcribe] Whisper ${whisperRes.status}:`, errText);
        // Detect quota exhaustion so the client can show a clearer message
        if (whisperRes.status === 429) {
            try {
                const errJson = JSON.parse(errText);
                if (errJson?.error?.code === "insufficient_quota") {
                    return NextResponse.json({ error: "quota_exceeded" }, { status: 503 });
                }
            } catch { /* not JSON — fall through */ }
        }
        return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    const json = await whisperRes.json().catch(() => null);

    if (user.is_anonymous) {
        void Promise.resolve(
            getSupabaseAdmin().from("usage_events").insert({
                user_id:    user.id,
                event_type: "voice_transcribe",
            })
        ).catch(() => {});
    }

    const rawText = (json?.text ?? "").trim();

    // Returning "" routes the client to its existing "didn't catch that" path
    // (useVoiceInput's onNoSpeech), so nothing new has to be handled on mobile.
    if (rawText && (hasNoSpeech(json?.segments) || isLikelyHallucination(rawText))) {
        console.warn("[voice/transcribe] discarded likely hallucination:", rawText.slice(0, 120));
        return NextResponse.json({ text: "", discarded: "no_speech" });
    }

    return NextResponse.json({ text: rawText });
}
