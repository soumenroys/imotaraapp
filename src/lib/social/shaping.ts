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
 * The scripts that need reordering or joining to be drawn correctly.
 *
 * ⚠️ NOT "non-Latin". Greek, Cyrillic, Hebrew letters, Han, Kana and Hangul
 * all draw correctly left-to-right with no glyph reordering, and blocking
 * them would cost the product languages for nothing. ⛔ The test is whether
 * the glyphs must MOVE or CHANGE SHAPE, not whether the script is familiar.
 */
const COMPLEX: { name: string; range: RegExp }[] = [
  // Indic and Brahmic — all reorder pre-base vowel signs.
  { name: "Devanagari (Hindi, Marathi)", range: /[ऀ-ॿ]/u },
  { name: "Bengali", range: /[ঀ-৿]/u },
  { name: "Gurmukhi (Punjabi)", range: /[਀-੿]/u },
  { name: "Gujarati", range: /[઀-૿]/u },
  { name: "Odia", range: /[଀-୿]/u },
  { name: "Tamil", range: /[஀-௿]/u },
  { name: "Telugu", range: /[ఀ-౿]/u },
  { name: "Kannada", range: /[ಀ-೿]/u },
  { name: "Malayalam", range: /[ഀ-ൿ]/u },
  { name: "Sinhala", range: /[඀-෿]/u },
  // Cursive joining scripts — every letter changes shape by position.
  { name: "Arabic (incl. Urdu)", range: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/u },
  // Clustering scripts.
  { name: "Thai", range: /[฀-๿]/u },
  { name: "Khmer", range: /[ក-៿]/u },
  { name: "Myanmar", range: /[က-႟]/u },
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
  return COMPLEX.filter((s) => s.range.test(text)).map((s) => s.name);
}

/** ⚠️ The sentence shown to whoever has to act on it. */
export function unshapableNote(scripts: string[], what: string): string {
  return (
    `${what} contains ${scripts.join(" and ")}, which this renderer cannot draw correctly: ` +
    `the vowel signs do not reorder, so the word comes out misspelt. ⛔ Refused rather than drawn ` +
    `wrong — a misspelling in somebody's own language insults exactly the readers it is for.`
  );
}
