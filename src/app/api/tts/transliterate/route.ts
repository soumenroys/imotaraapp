// src/app/api/tts/transliterate/route.ts
// Called ONCE per reply, before chunking, by playChunkedTTS (web) and
// speakMessage (mobile) — never per chunk. See src/lib/azure-tts/transliterate.ts
// for the full root-cause writeup (2026-08-15 romanized-pronunciation bug).
// Same auth + rate-limit shape as /api/tts, and deliberately shares its
// rate-limit bucket ("tts") rather than a separate one — this adds at most
// one extra call per reply on top of the existing per-chunk /api/tts calls,
// not a new unbounded cost surface.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";
import { needsTtsTransliteration, transliterateForTts } from "@/lib/azure-tts/transliterate";

export const runtime = "nodejs";
export const maxDuration = 30;

const RATE_LIMIT_PER_MIN = 40;

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    if (!(await checkPersistentIpRateLimit("tts", ip, RATE_LIMIT_PER_MIN, 60))) {
        return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

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

    let body: { text?: string; lang?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { text, lang } = body;
    if (!text || typeof text !== "string" || !lang || typeof lang !== "string") {
        return NextResponse.json({ error: "text and lang are required" }, { status: 400 });
    }
    if (text.length > 8000) {
        return NextResponse.json({ error: "text too long (max 8000 chars)" }, { status: 400 });
    }

    // Not a language this fix applies to, or the text already has native
    // script — return it unchanged rather than erroring, so callers can
    // always safely call this without pre-checking themselves.
    if (!needsTtsTransliteration(text, lang)) {
        return NextResponse.json({ text, transliterated: false });
    }

    const result = await transliterateForTts(text, lang);
    if (!result) {
        // Fails open: caller keeps using the original romanized text.
        return NextResponse.json({ text, transliterated: false });
    }
    return NextResponse.json({ text: result, transliterated: true });
}
