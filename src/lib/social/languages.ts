// src/lib/social/languages.ts
// Which languages a social post may be written in, and which may go out
// without a person reading it first.
//
// 🔑 THE DISTINCTION THIS FILE EXISTS FOR. A reply inside the app is read by
// one person and then gone. A post on a public page is permanent, quotable and
// screenshot. So the bar for publishing UNATTENDED in a language is higher than
// the bar for supporting it, and those two facts need separate names.
//
// ⛔ All 22 may be selected, written, pictured and queued. The tiers below gate
// exactly one thing: whether a schedule may post in that language with nobody
// reading it.

import { CONNECT_LANGUAGES } from "@/lib/connect/languages";

/**
 * The canonical 22. ⚠️ Imported, never re-typed — the file it comes from
 * exists because this list had been copied by hand four times and one copy had
 * drifted to 16 entries, printing a raw "or" where a language name belonged.
 * A fifth copy here would be the same mistake with a different filename.
 */
export const SOCIAL_LANGUAGES = CONNECT_LANGUAGES;
export const SOCIAL_LANGUAGE_CODES = SOCIAL_LANGUAGES.map((l) => l.code);

/**
 * The brand in each language's own script, for the wordmark on a composed
 * picture.
 *
 * ⛔ TAKEN FROM THE SHIPPED PRODUCT, NEVER TRANSLITERATED HERE. Two of these
 * were spelled two different ways until 17 Oct 2026 — Urdu lost its و and
 * Kannada a vowel, in voice-preview maps written separately from the copy. In
 * both cases sixteen written occurrences agreed and nobody compared them,
 * because nobody here reads either language.
 * ⇒ src/__tests__/theBrandIsSpelledTheSameEverywhere.test.ts asserts that
 * every surface agrees, and a guard in this module's test asserts that this map
 * agrees with it too. Adding a surface without adding it there is how the next
 * one drifts.
 */
export const BRAND_IN_SCRIPT: Record<string, string> = {
  en: "Imotara",
  es: "Imotara",
  fr: "Imotara",
  pt: "Imotara",
  de: "Imotara",
  ru: "Imotara",
  id: "Imotara",
  zh: "Imotara",
  hi: "इमोतारा",
  mr: "इमोतारा",
  bn: "ইমোতারা",
  ta: "இமோதாரா",
  te: "ఇమోతారా",
  gu: "ઇમોતારા",
  pa: "ਇਮੋਤਾਰਾ",
  kn: "ಇಮೋತಾರಾ",
  ml: "ഇമോതാര",
  or: "ଇମୋତାରା",
  ur: "اموتارا",
  ar: "إيموتارا",
  he: "אימוטרה",
  ja: "イモタラ",
};

/** Languages that read right-to-left, which the composer must lay out mirrored. */
export const RTL_LANGUAGES = new Set(["ur", "ar", "he"]);

/**
 * Languages somebody on this side can actually read.
 *
 * 🔑 This is NOT a judgement about the languages or about how well the product
 * speaks them. It records one fact about US: whether anyone here could tell a
 * post that sounds like a person from one that sounds like a translation.
 *
 * ▶️ A language moves into this set the moment a speaker reads a run of real
 * drafts ⇒ native_speakers_should_audit_real_replies. In production the set
 * lives in `social_language_tiers` so that can happen without a deploy; this
 * constant is the seed and the value the tests pin.
 */
export const REVIEWED_LANGUAGES = new Set(["en", "bn", "hi"]);

export function languageName(code: string): string {
  return SOCIAL_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}

export function isSupportedLanguage(code: string): boolean {
  return SOCIAL_LANGUAGE_CODES.includes(code);
}

/**
 * ⛔ There is deliberately no `resolveLanguage()` and no default.
 *
 * `concreteLang('auto')` resolves to 'en' elsewhere in this codebase, and that
 * is correct there — a reply has to come out in some language. It would be
 * wrong here: a schedule whose language went missing would post in English for
 * months, on brand channels, and look entirely healthy while doing it.
 * ⇒ trap_concretelang_turns_auto_into_en
 *
 * A missing or unknown language is an error, not a case to handle.
 */
export function assertPostableLanguage(code: string | null | undefined): string {
  if (!code) {
    throw new Error(
      "social: a post has no language. There is no default here — " +
        "falling back to English would post the wrong language silently.",
    );
  }
  if (!isSupportedLanguage(code)) {
    throw new Error(`social: ${code} is not one of the 22 languages this product speaks.`);
  }
  return code;
}
