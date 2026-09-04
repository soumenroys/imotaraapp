// src/lib/connect/languages.ts
// The languages Connect knows about, in one place.
//
// There were four copies of this list in the Connect UI and one of them —
// ConsultantCard's LANGUAGE_MAP — held 16 of the 22, so a companion who speaks
// Odia, Hebrew, Russian, Chinese, Japanese or Indonesian had a raw "or" or "ja"
// printed on their card where a language name belonged. That is what a list
// copied by hand does eventually: the copies stop agreeing and only one of them
// is wrong in a way anyone notices.
//
// Order follows SUPPORTED_LANGS in the consultant profile API, which is the
// list the backend validates against.

export const CONNECT_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "gu", label: "Gujarati" },
  { code: "pa", label: "Punjabi" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "or", label: "Odia" },
  { code: "ur", label: "Urdu" },
  { code: "ar", label: "Arabic" },
  { code: "he", label: "Hebrew" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "id", label: "Indonesian" },
];

export const CONNECT_LANGUAGE_CODES = CONNECT_LANGUAGES.map((l) => l.code);

const BY_CODE: Record<string, string> = Object.fromEntries(
  CONNECT_LANGUAGES.map((l) => [l.code, l.label]),
);

/**
 * A language's name, falling back to the code itself.
 *
 * The fallback is uppercase so an unknown code reads as a deliberate
 * abbreviation rather than a broken lowercase word — "JA" looks like a label,
 * "ja" looks like a bug. Which it would be.
 */
export function languageLabel(code: string): string {
  return BY_CODE[code] ?? code.toUpperCase();
}
