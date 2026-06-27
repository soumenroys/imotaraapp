export const preferredRegion = ["sin1"];
export const maxDuration = 15;

// POST /api/connect/translate
// Translates text using MyMemory (free, no key) or Google Cloud Translation (if key set).
// Auth required — prevents open-proxy abuse of the translation API key.
// Body: { text: string; targetLang: string; sourceLang?: string }
// Response: { ok: true; translatedText: string } | { ok: false; error: string }

import { NextRequest, NextResponse } from "next/server";
import { getConnectUser } from "@/lib/connect/auth";
import { translateText, detectScript } from "@/lib/connect/translate";

// Per-user rate limit: max 60 translation requests per 60-second window.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now    = Date.now();
  const entry  = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ ok: false, error: "Too many translation requests — please wait a moment" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const text: string       = typeof body?.text === "string" ? body.text.trim() : "";
  const targetLang: string = typeof body?.targetLang === "string" ? body.targetLang.trim() : "";
  const rawSource: string  = typeof body?.sourceLang === "string" ? body.sourceLang.trim() : "auto";

  if (!text)       return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  if (!targetLang) return NextResponse.json({ ok: false, error: "targetLang is required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ ok: false, error: "text too long (max 2000 chars)" }, { status: 400 });

  const SUPPORTED_LANGS = ["en","hi","bn","mr","ta","te","gu","pa","kn","ml","or","ur","ar","he","ru","zh","ja","es","fr","de","pt"];
  if (!SUPPORTED_LANGS.includes(targetLang)) {
    return NextResponse.json({ ok: false, error: "Unsupported targetLang" }, { status: 400 });
  }
  if (rawSource !== "auto" && !SUPPORTED_LANGS.includes(rawSource)) {
    return NextResponse.json({ ok: false, error: "Unsupported sourceLang" }, { status: 400 });
  }

  const sourceLang = rawSource === "auto" ? detectScript(text) : rawSource;

  if (sourceLang === targetLang) {
    return NextResponse.json({ ok: true, translatedText: text });
  }

  const translatedText = await translateText(text, targetLang, sourceLang);
  if (!translatedText) {
    return NextResponse.json({ ok: false, error: "Translation service unavailable" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, translatedText });
}
