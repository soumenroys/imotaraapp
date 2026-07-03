// src/app/api/voice/transcribe/route.ts
// Speech-to-text for mobile voice input — forwards audio to OpenAI Whisper.
// Accepts a multipart/form-data POST with a single "file" field (audio/m4a).
// Returns { text: string }.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Max audio size: 10 MB (Whisper limit is 25 MB; 60s m4a ≈ 1 MB in practice)
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "STT not configured" }, { status: 503 });
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
    return NextResponse.json({ text: (json?.text ?? "").trim() });
}
