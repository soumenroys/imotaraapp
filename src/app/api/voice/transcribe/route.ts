// src/app/api/voice/transcribe/route.ts
// Speech-to-text for mobile voice input — forwards audio to OpenAI Whisper.
// Accepts a multipart/form-data POST with a single "file" field (audio/m4a).
// Returns { text: string }.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const whisperForm = new FormData();
    whisperForm.append("file", file, "voice.m4a");
    whisperForm.append("model", "whisper-1");
    if (lang && typeof lang === "string") {
        whisperForm.append("language", lang.split("-")[0]); // whisper wants ISO-639-1
    }

    let whisperRes: Response;
    try {
        whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: whisperForm,
        });
    } catch (err) {
        console.error("[voice/transcribe] Whisper fetch failed:", err);
        return NextResponse.json({ error: "STT service unavailable" }, { status: 502 });
    }

    if (!whisperRes.ok) {
        const errText = await whisperRes.text().catch(() => "");
        console.error(`[voice/transcribe] Whisper ${whisperRes.status}:`, errText);
        return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    const json = await whisperRes.json().catch(() => null);
    return NextResponse.json({ text: (json?.text ?? "").trim() });
}
