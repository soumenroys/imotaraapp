// Shared translation utility — used by both /api/connect/translate (client-initiated)
// and /api/connect/sessions/[id]/messages (server-side auto-translation).

import { detectLangFromRomanHints } from "@/lib/imotara/respondRemote";

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY ?? "";

// Marathi shares Devanagari with Hindi (no character is Marathi-exclusive —
// only common function words distinguish it); Urdu shares the Arabic block
// with Arabic but adds extension letters Arabic doesn't use. Same hint
// patterns already proven correct on web (chat/page.tsx detectScriptLang)
// and mobile (mobileTTS.ts) — mirrored here rather than imported since
// those live in very different layers (client component / RN module).
const MARATHI_HINT = /आहे|नाही|माझ[ेा]|तुझ[ेा]|होत[ेी]|मी |तुम्ही/;
const URDU_HINT    = /[ٹڈڑںے]/;

// Detect the dominant script from Unicode code point ranges, with a
// Roman-hint word-list fallback (detectLangFromRomanHints, already proven
// for TTS voice routing) for transliterated Indic text typed in pure Latin
// script — previously any Latin input, real English or romanized Hindi
// alike, fell into the same bucket and was misdetected as English. Also
// fixes: Marathi was previously indistinguishable from Hindi (no dedicated
// check), and Odia/Hebrew/Russian/Chinese/Japanese had no script range at
// all (the old comment claimed "16 languages" but only explicitly handled
// 11) — all 22 Imotara Connect languages (LANG_OPTIONS in
// connect/session/new/page.tsx) are covered now.
export function detectScript(text: string): string {
  if (!text) return "en";
  if (MARATHI_HINT.test(text)) return "mr";
  if (/[ऀ-ॿ]/.test(text)) return "hi";  // Devanagari — Hindi (default when not Marathi)
  if (/[ঀ-৿]/.test(text)) return "bn";  // Bengali
  if (/[਀-੿]/.test(text)) return "pa";  // Gurmukhi (Punjabi)
  if (/[઀-૿]/.test(text)) return "gu";  // Gujarati
  if (/[଀-୿]/.test(text)) return "or";  // Odia
  if (/[஀-௿]/.test(text)) return "ta";  // Tamil
  if (/[ఀ-౿]/.test(text)) return "te";  // Telugu
  if (/[ಀ-೿]/.test(text)) return "kn";  // Kannada
  if (/[ഀ-ൿ]/.test(text)) return "ml";  // Malayalam
  if (URDU_HINT.test(text)) return "ur";
  if (/[؀-ۿ]/.test(text)) return "ar";  // Arabic (default when not Urdu)
  if (/[֐-׿]/.test(text)) return "he";  // Hebrew
  if (/[Ѐ-ӿ]/.test(text)) return "ru";  // Cyrillic
  if (/[぀-ヿ]/.test(text)) return "ja";  // Hiragana/Katakana (checked before CJK)
  if (/[一-鿿]/.test(text)) return "zh";  // CJK
  // Pure Latin script — could be real English/Spanish/French/German/
  // Portuguese/Indonesian, or romanized/transliterated Indic text (a very
  // common typing style in this user base). The word-hint detector catches
  // the Indic case; anything it doesn't recognize genuinely is Latin-script
  // text, so falling through to "en" there is correct, not a bug.
  return detectLangFromRomanHints(text);
}

// Translate text to targetLang. Returns translated string or null on failure.
// sourceLang defaults to auto-detection via detectScript.
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<string | null> {
  const src = sourceLang && sourceLang !== "auto" ? sourceLang : detectScript(text);
  if (src === targetLang) return text;

  try {
    if (GOOGLE_API_KEY) return await googleTranslate(text, targetLang, src);
    return await myMemoryTranslate(text, targetLang, src);
  } catch {
    return null;
  }
}

async function myMemoryTranslate(text: string, targetLang: string, sourceLang: string): Promise<string | null> {
  const langpair = `${sourceLang}|${targetLang}`;
  const email    = process.env.MYMEMORY_EMAIL ?? "";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}${email ? `&de=${encodeURIComponent(email)}` : ""}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const res  = await fetch(url, { headers: { "User-Agent": "Imotara/1.0" }, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  const data = await res.json();
  // MyMemory returns HTTP 200 even when the free-tier daily quota is exhausted — the
  // warning text lands in translatedText instead of an error status. quotaFinished is
  // the reliable machine-readable signal; the string checks below are a redundant
  // backstop in case that field is ever absent from a response.
  if (data?.quotaFinished) return null;
  const translated: string = data?.responseData?.translatedText ?? "";
  if (
    !translated ||
    translated.toUpperCase().includes("INVALID") ||
    translated.toUpperCase().includes("QUERY LENGTH") ||
    translated.toUpperCase().includes("MYMEMORY WARNING")
  ) {
    return null;
  }
  return translated;
}

async function googleTranslate(text: string, targetLang: string, sourceLang: string): Promise<string | null> {
  const params = new URLSearchParams({ q: text, target: targetLang, key: GOOGLE_API_KEY, format: "text", source: sourceLang });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const res  = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  const data = await res.json();
  return data?.data?.translations?.[0]?.translatedText ?? null;
}
