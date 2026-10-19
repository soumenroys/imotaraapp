import { SCRIPT_FONTS } from "@/lib/social/fonts";

// src/lib/social/shaping.ts
// Which scripts this renderer cannot draw correctly.
//
// 🔴 FOUND ON A LIVE POST, 18 Oct. A published Instagram card carried
// `অভিমান` and rendered it **অভমিান** — the ি landed after ম instead of
// attaching to ভ. The caption was perfect, the database was perfect, the
// owner-confirmed word table was perfect. Only the IMAGE was wrong.
//
// 🔑 WHY. Bengali ি is a PRE-BASE vowel sign: stored after its consonant in
// logical order, drawn before it. Putting it in the right place is complex
// script shaping, and Satori — which `next/og` uses to draw these cards —
// does not do it. Arabic needs contextual joining, which it also does not do.
//
// ⛔ THE RULE WAS ALREADY IN renderPicture.ts: *"no full complex-script
// shaping, which is why a wordmark is set in Latin until somebody who reads
// the script has confirmed a rendered picture."* It was applied to the
// wordmark and not to the body text, so one use of the renderer was protected
// and the other was not.
//
// ⚠️ THE HONEST CONSEQUENCE, written here so nobody rediscovers it as a bug:
// Imotara cannot currently put an Indic or Arabic headline on a card. Those
// posts go out as text where a channel allows it, and on Instagram — which has
// no text-only post — they do not go out at all until a shaping-capable
// renderer exists.

/**
 * 🔴 THE VERDICT LIVES IN fonts.ts, NOT HERE — corrected 19 Oct.
 *
 * `fonts.ts` already carried exactly this concern, as a per-script
 * `shapingVerified` flag gated on *"somebody who READS this script has looked
 * at a rendered picture and said it is right"*. It governs the WORDMARK.
 *
 * ⛔ I wrote this module hours later without noticing, which made two
 * independent detectors for one question ⇒
 * trap_crisis_card_two_detectors_two_platforms, the same shape as the defect
 * this file was created to fix. They agree today because every complex script
 * is unverified. They would disagree the moment somebody verifies one: the
 * wordmark would switch to Bengali while the headline stayed refused.
 *
 * ✅ So the split is now: this file detects WHICH scripts a string contains;
 * `fonts.ts` decides whether each may be drawn. One switch unlocks both.
 *
 * ⚠️ The ranges below are still needed and are NOT in fonts.ts, which maps a
 * LANGUAGE to a script. This maps arbitrary TEXT to the scripts inside it —
 * a different question, because a post written in English can quote a Bengali
 * word, which is exactly what happened on the first Instagram card.
 */
/** ⚠️ What a PERSON reading the note should see. The keys match fonts.ts; a
 *  reader should not have to know that Odia is keyed "oriya". */
const SCRIPT_LABELS: Record<string, string> = {
  devanagari: "Devanagari (Hindi, Marathi)",
  bengali: "Bengali",
  gurmukhi: "Gurmukhi (Punjabi)",
  gujarati: "Gujarati",
  oriya: "Odia",
  tamil: "Tamil",
  telugu: "Telugu",
  kannada: "Kannada",
  malayalam: "Malayalam",
  sinhala: "Sinhala",
  arabic: "Arabic (incl. Urdu)",
  thai: "Thai",
  khmer: "Khmer",
  myanmar: "Myanmar",
};

const SCRIPT_RANGES: { script: string; range: RegExp }[] = [
  // Indic and Brahmic — all reorder pre-base vowel signs.
  { script: "devanagari", range: /[ऀ-ॿ]/u },
  { script: "bengali", range: /[ঀ-৿]/u },
  { script: "gurmukhi", range: /[਀-੿]/u },
  { script: "gujarati", range: /[઀-૿]/u },
  { script: "oriya", range: /[଀-୿]/u },
  { script: "tamil", range: /[஀-௿]/u },
  { script: "telugu", range: /[ఀ-౿]/u },
  { script: "kannada", range: /[ಀ-೿]/u },
  { script: "malayalam", range: /[ഀ-ൿ]/u },
  { script: "sinhala", range: /[඀-෿]/u },
  // Cursive joining scripts — every letter changes shape by position.
  { script: "arabic", range: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/u },
  // Clustering scripts.
  { script: "thai", range: /[฀-๿]/u },
  { script: "khmer", range: /[ក-៿]/u },
  { script: "myanmar", range: /[က-႟]/u },
];

/**
 * Which unshapable scripts appear in this text. Empty means it is safe to draw.
 *
 * ⛔ Returns the NAMES, not a boolean, because the note a human reads has to
 * say which script and therefore which post — "this card cannot be drawn" with
 * no reason sends somebody looking at the fonts.
 */
export function unshapableScripts(text: string): string[] {
  if (!text) return [];
  return SCRIPT_RANGES.filter((s) => {
    if (!s.range.test(text)) return false;
    /**
     * 🔴 THIS ASKS ABOUT SATORI, AND ONLY ABOUT SATORI.
     *
     * ⛔ IT USED TO READ `shapingVerified`, AND THAT WAS WRONG THE MOMENT A
     * SECOND RENDERER EXISTED. On 19 Oct a Bengali reader confirmed a card
     * drawn by a BROWSER, the flag flipped — and this function immediately
     * claimed Satori could draw Bengali. It cannot, and never will: Satori
     * does no pre-base vowel reordering, no conjunct formation and no Arabic
     * joining. Bengali posts would have gone straight back down the Satori
     * path and published অভমিান a second time, with a green suite.
     *
     * ⇒ Two questions, two fields. `complexScript` is a property of the
     * SCRIPT and nothing we do changes it. `shapingVerified` is a property of
     * our EVIDENCE and decides whether the shaped path may be used at all
     * ⇒ needsShaping.cardPlan.
     *
     * ⛔ A script with NO entry in fonts.ts — Thai, Khmer, Myanmar, Sinhala;
     * none of the 22 languages use them — is treated as complex. An unknown
     * script is not a safe one.
     */
    return SCRIPT_FONTS[s.script]?.complexScript !== false;
  }).map((s) => SCRIPT_LABELS[s.script] ?? s.script);
}

/** ⚠️ The sentence shown to whoever has to act on it. */
export function unshapableNote(scripts: string[], what: string): string {
  return (
    `${what} contains ${scripts.join(" and ")}, which this renderer cannot draw correctly: ` +
    `the vowel signs do not reorder, so the word comes out misspelt. ⛔ Refused rather than drawn ` +
    `wrong — a misspelling in somebody's own language insults exactly the readers it is for.`
  );
}
