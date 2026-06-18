// Shared translation utility — used by both /api/connect/translate (client-initiated)
// and /api/connect/sessions/[id]/messages (server-side auto-translation).

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY ?? "";

// Detect the dominant script from Unicode code point ranges.
// Covers all 16 languages supported by Imotara Connect.
export function detectScript(text: string): string {
  const counts: Record<string, number> = {};
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if      (cp >= 0x0900 && cp <= 0x097F) counts.hi = (counts.hi ?? 0) + 1;
    else if (cp >= 0x0980 && cp <= 0x09FF) counts.bn = (counts.bn ?? 0) + 1;
    else if (cp >= 0x0A00 && cp <= 0x0A7F) counts.pa = (counts.pa ?? 0) + 1;
    else if (cp >= 0x0A80 && cp <= 0x0AFF) counts.gu = (counts.gu ?? 0) + 1;
    else if (cp >= 0x0B80 && cp <= 0x0BFF) counts.ta = (counts.ta ?? 0) + 1;
    else if (cp >= 0x0C00 && cp <= 0x0C7F) counts.te = (counts.te ?? 0) + 1;
    else if (cp >= 0x0C80 && cp <= 0x0CFF) counts.kn = (counts.kn ?? 0) + 1;
    else if (cp >= 0x0D00 && cp <= 0x0D7F) counts.ml = (counts.ml ?? 0) + 1;
    else if (cp >= 0x0600 && cp <= 0x06FF) counts.ur = (counts.ur ?? 0) + 1;
    else if (cp >= 0x0040 && cp <= 0x007E) counts.en = (counts.en ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "en";
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
  const res  = await fetch(url, { headers: { "User-Agent": "Imotara/1.0" } });
  const data = await res.json();
  const translated: string = data?.responseData?.translatedText ?? "";
  if (!translated || translated.toUpperCase().includes("INVALID") || translated.toUpperCase().includes("QUERY LENGTH")) {
    return null;
  }
  return translated;
}

async function googleTranslate(text: string, targetLang: string, sourceLang: string): Promise<string | null> {
  const params = new URLSearchParams({ q: text, target: targetLang, key: GOOGLE_API_KEY, format: "text", source: sourceLang });
  const res  = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`);
  const data = await res.json();
  return data?.data?.translations?.[0]?.translatedText ?? null;
}
