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
  const rawSource: string  = typeof body?.sourceLang === "string" ? body.sourceLang.trim() : "auto";

  if (!text)       return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  if (!targetLang) return NextResponse.json({ ok: false, error: "targetLang is required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ ok: false, error: "text too long (max 2000 chars)" }, { status: 400 });

  // MyMemory does not support "auto" — detect from Unicode script ranges
  const sourceLang = rawSource === "auto" ? detectScript(text) : rawSource;

  // Skip translation if source and target are the same language
  if (sourceLang === targetLang) {
    return NextResponse.json({ ok: true, translatedText: text });
  }

  try {
    if (GOOGLE_API_KEY) {
      return await translateGoogle(text, targetLang, sourceLang);
    }
    return await translateMyMemory(text, targetLang, sourceLang);
  } catch {
    return NextResponse.json({ ok: false, error: "Translation service unavailable" }, { status: 502 });
  }
}

// Detect script from Unicode code point ranges — covers all 16 app languages
function detectScript(text: string): string {
  const counts: Record<string, number> = {};
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if      (cp >= 0x0900 && cp <= 0x097F) counts.hi  = (counts.hi  ?? 0) + 1; // Devanagari → Hindi/Marathi
    else if (cp >= 0x0980 && cp <= 0x09FF) counts.bn  = (counts.bn  ?? 0) + 1; // Bengali
    else if (cp >= 0x0A00 && cp <= 0x0A7F) counts.pa  = (counts.pa  ?? 0) + 1; // Gurmukhi → Punjabi
    else if (cp >= 0x0A80 && cp <= 0x0AFF) counts.gu  = (counts.gu  ?? 0) + 1; // Gujarati
    else if (cp >= 0x0B80 && cp <= 0x0BFF) counts.ta  = (counts.ta  ?? 0) + 1; // Tamil
    else if (cp >= 0x0C00 && cp <= 0x0C7F) counts.te  = (counts.te  ?? 0) + 1; // Telugu
    else if (cp >= 0x0C80 && cp <= 0x0CFF) counts.kn  = (counts.kn  ?? 0) + 1; // Kannada
    else if (cp >= 0x0D00 && cp <= 0x0D7F) counts.ml  = (counts.ml  ?? 0) + 1; // Malayalam
    else if (cp >= 0x0600 && cp <= 0x06FF) counts.ur  = (counts.ur  ?? 0) + 1; // Arabic/Urdu
    else if (cp >= 0x0040 && cp <= 0x007E) counts.en  = (counts.en  ?? 0) + 1; // Basic Latin → English/European
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  // "en" covers Latin-script languages (en, es, fr, de, pt) — good enough for chat context
  return top ? top[0] : "en";
}

async function translateMyMemory(text: string, targetLang: string, sourceLang: string) {
  const langpair = `${sourceLang}|${targetLang}`;
  const email    = process.env.MYMEMORY_EMAIL ?? "";
  const url      = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}${email ? `&de=${encodeURIComponent(email)}` : ""}`;

  const res  = await fetch(url, { headers: { "User-Agent": "Imotara/1.0" } });
  const data = await res.json();

  const translated: string = data?.responseData?.translatedText ?? "";
  if (!translated || translated.toUpperCase().includes("INVALID") || translated.toUpperCase().includes("QUERY LENGTH")) {
    return NextResponse.json({ ok: false, error: "Translation failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, translatedText: translated });
}

async function translateGoogle(text: string, targetLang: string, sourceLang: string) {
  const params = new URLSearchParams({
    q:      text,
    target: targetLang,
    key:    GOOGLE_API_KEY,
    format: "text",
    source: sourceLang,
  });

  const res  = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`);
  const data = await res.json();

  const translated: string = data?.data?.translations?.[0]?.translatedText ?? "";
  if (!translated) return NextResponse.json({ ok: false, error: "Translation failed" }, { status: 502 });
  return NextResponse.json({ ok: true, translatedText: translated });
}
