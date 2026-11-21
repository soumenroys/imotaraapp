/**
 * 🔴 #131, 21 Nov 2026 — the gate was strict on the right spelling and blind
 * to the wrong one.
 *
 * A LinkedIn draft for 28 Nov said:
 *   "There is a word in Tamil — ‘solamal puriyum’ — for what someone
 *    understands without it being said."
 * It passed, because the only pattern was "Tamil word|phrase" (adjective
 * order). The phrase was misspelt; the reviewer caught it by reading. The
 * corrected spelling was then REFUSED by the same gate.
 */

import { describe, it, expect } from "vitest";
import { checkWordClaim, claimedLanguage } from "@/lib/social/untranslatableWords";

describe("a claim about a word, in any order, is caught", () => {
  const claims: [string, string][] = [
    // ⛔ the real sentence that got through
    ["There is a word in Tamil — ‘solamal puriyum’ — for what someone understands without it being said.", "Tamil"],
    ["The Tamil word urchagam means the quiet lift you feel.", "Tamil"],
    ["Tamil has a word for this: solamal puriyum.", "Tamil"],
    ["Bengali has its own word for it.", "Bengali"],
    ["In Hindi, people say apnapan.", "Hindi"],
    ["In Bengali we call it mon kharap.", "Bengali"],
    ["Tamil speakers say it differently.", "Tamil"],
    ["It is what we call in Bengali adda.", "Bengali"],
    ["There's a phrase from Marathi that fits.", "Marathi"],
  ];
  for (const [text, lang] of claims) {
    it(`catches: ${text.slice(0, 50)}`, () => {
      expect(claimedLanguage(text)).toBe(lang);
      expect(checkWordClaim(text, "en").ok).toBe(false);
    });
  }
});

describe("⛔ merely mentioning a language is NOT a claim — our real posts still pass", () => {
  const fine = [
    // real published / queued posts
    "If you think in Tamil, you shouldn’t have to translate yourself before you can say how you feel.",
    "You can speak or type in Hindi, Bengali, Tamil or any of 22 languages.",
    "The first thing you type after a long day might come out in Marathi, Tamil, or Hindi, not English.",
    // product lines that must keep working
    "Say it in Tamil — Imotara understands.",
    "Write your own words in Bengali, no translating.",
    "In Tamil, you can say exactly what you mean.",
  ];
  for (const text of fine) {
    it(`passes: ${text.slice(0, 50)}`, () => {
      expect(claimedLanguage(text)).toBeNull();
      expect(checkWordClaim(text, "en").ok).toBe(true);
    });
  }
});

describe("a confirmed word may still be explained", () => {
  it("abhimaan (confirmed) passes in the reversed order too", () => {
    expect(checkWordClaim("There is a word in Bengali — abhimaan — for a hurt only love can cause.", "en").ok).toBe(true);
  });
});
