// src/app/api/tts/route.ts
// Azure Neural TTS endpoint — streams audio/mpeg back to the client.
// Called only when the user's device lacks a native TTS voice for the selected language.
// English always uses the browser/device native TTS and never reaches this route.

import { NextRequest, NextResponse } from "next/server";
import { getAzureConfig } from "@/lib/azure-tts/regionRouter";
import { resolveVoice, AZURE_LOCALE } from "@/lib/azure-tts/voices";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    let body: { text?: string; lang?: string; gender?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { text, lang = "en", gender = "neutral" } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Hard cap — prevent abuse
    if (text.length > 3000) {
        return NextResponse.json({ error: "text too long (max 3000 chars)" }, { status: 400 });
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

    const voice  = resolveVoice(lang, gender);
    const locale = AZURE_LOCALE[lang] ?? "en-US";

    const ssml = `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="${voice}">${escapeXml(text.trim())}</voice>
</speak>`;

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

    if (!azureRes.ok) {
        const errText = await azureRes.text().catch(() => "");
        console.error(`[tts] Azure error ${azureRes.status}:`, errText);
        return NextResponse.json({ error: "TTS synthesis failed" }, { status: 502 });
    }

    const audioBuffer = await azureRes.arrayBuffer();

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
