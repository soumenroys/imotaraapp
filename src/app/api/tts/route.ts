// src/app/api/tts/route.ts
// Azure Neural TTS endpoint — streams audio/mpeg back to the client.
// Web: called only when the browser lacks a native voice for the selected language.
// Mobile: speakMessage() (chat-reply playback) always calls this route first,
// for every language including English, then falls back to native on-device
// TTS only if this request fails — so English does reach this route on mobile.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAzureConfig } from "@/lib/azure-tts/regionRouter";
import { resolveVoice, resolveStyle, AZURE_LOCALE } from "@/lib/azure-tts/voices";
import { supabaseUserServer } from "@/lib/supabase/userServer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    // Try cookie auth (web), then Bearer token (mobile).
    const supabase = await supabaseUserServer();
    const { data: { user: cookieUser } } = await supabase.auth.getUser();
    let user = cookieUser;

    if (!user) {
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
    }

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const style  = resolveStyle(lang, gender);

    // Use mstts:express-as for voices that support emotional styles (currently
    // en/zh/ja/fr/de/pt/es — see AZURE_VOICE_STYLES). For Indian-language,
    // Arabic, and Russian voices, no express-as style exists yet, so a plain
    // <prosody> pass adds a lighter-weight warmth/pacing pass instead of
    // sending completely flat, unadorned text — a slightly slower rate reads
    // as more considered and less clipped/rushed than default-rate neutral
    // synthesis, without any voice-specific style support required.
    const escapedText = escapeXml(text.trim());
    const bodyXml = style
        ? `<mstts:express-as style="${style}" styledegree="1.4">${escapedText}</mstts:express-as>`
        : `<prosody rate="-8%" pitch="+1%">${escapedText}</prosody>`;

    const msttsNs = style ? ` xmlns:mstts="http://www.w3.org/2001/mstts"` : "";

    const ssml = `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis"${msttsNs}><voice name="${voice}">${bodyXml}</voice></speak>`;

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
