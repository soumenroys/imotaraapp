// src/app/api/tts/route.ts
// Azure Neural TTS endpoint — streams audio/mpeg back to the client.
// Called only when the user's device lacks a native TTS voice for the selected language.
// English always uses the browser/device native TTS and never reaches this route.

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

    // Use mstts:express-as for voices that support emotional styles.
    // For Indian-language and other standard Neural voices, plain text is used.
    const bodyXml = style
        ? `<mstts:express-as style="${style}" styledegree="1.4">${escapeXml(text.trim())}</mstts:express-as>`
        : escapeXml(text.trim());

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
