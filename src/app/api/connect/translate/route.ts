// POST /api/connect/translate
// Translates text using MyMemory (free, no key) or Google Cloud Translation (if key set).
// Body: { text: string; targetLang: string; sourceLang?: string }
// Response: { ok: true; translatedText: string } | { ok: false; error: string }

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text: string       = typeof body?.text === "string" ? body.text.trim() : "";
  const targetLang: string = typeof body?.targetLang === "string" ? body.targetLang.trim() : "";
  const sourceLang: string = typeof body?.sourceLang === "string" ? body.sourceLang.trim() : "auto";

  if (!text)       return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  if (!targetLang) return NextResponse.json({ ok: false, error: "targetLang is required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ ok: false, error: "text too long (max 2000 chars)" }, { status: 400 });

  try {
    if (GOOGLE_API_KEY) {
      return await translateGoogle(text, targetLang, sourceLang);
    }
    return await translateMyMemory(text, targetLang, sourceLang);
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Translation service unavailable" }, { status: 502 });
  }
}

async function translateMyMemory(text: string, targetLang: string, sourceLang: string) {
  const langpair = `${sourceLang}|${targetLang}`;
  const email    = process.env.MYMEMORY_EMAIL ?? "";
  const url      = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}${email ? `&de=${encodeURIComponent(email)}` : ""}`;

  const res  = await fetch(url, { headers: { "User-Agent": "Imotara/1.0" } });
  const data = await res.json();

  const translated: string = data?.responseData?.translatedText ?? "";
  // MyMemory returns error strings in the translation field
  if (!translated || translated.toUpperCase().includes("INVALID") || translated.toUpperCase().includes("QUERY LENGTH")) {
    return NextResponse.json({ ok: false, error: "Translation failed" }, { status: 502 });
  }
  // If MyMemory can't detect and returns original text, still return it (caller filters same-text)
  return NextResponse.json({ ok: true, translatedText: translated });
}

async function translateGoogle(text: string, targetLang: string, sourceLang: string) {
  const params = new URLSearchParams({
    q:      text,
    target: targetLang,
    key:    GOOGLE_API_KEY,
    format: "text",
  });
  if (sourceLang !== "auto") params.set("source", sourceLang);

  const res  = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`);
  const data = await res.json();

  const translated: string = data?.data?.translations?.[0]?.translatedText ?? "";
  if (!translated) return NextResponse.json({ ok: false, error: "Translation failed" }, { status: 502 });
  return NextResponse.json({ ok: true, translatedText: translated });
}
