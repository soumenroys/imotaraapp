/**
 * "Identical" is not the same as "not translated".
 *
 * 🔴 U21 of the 2026-10-09 audit, VERIFIED 2026-10-10 at both cited sites.
 *
 *     if (translated.toLowerCase() === text.trim().toLowerCase()) return null;
 *
 * The observation behind it is REAL — models sometimes echo romanized Indic
 * text back unchanged instead of translating it. But the test for it was far
 * too broad and fired on perfectly good translations: "OK", "WhatsApp", a
 * person's name, a number, a cognate. Each was declared an engine failure and
 * pushed down the chain toward MyMemory — which this very file calls
 * "confidently wrong".
 *
 * 🔑 A SHARPER TEST. For the 15 target languages using a non-Latin script, a
 * result containing NONE of that script was definitely not translated —
 * whether or not it equals the input. That catches the echo failure MORE
 * reliably than string equality ever did, because a partial echo ("ami valo
 * nei, I think") slipped straight through the old check.
 *
 * And for a Latin-script target, identical is usually legitimate: that is
 * precisely where names, loanwords and cognates survive translation.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const T = "src/lib/connect/translate.ts";

/** Mirror of looksTranslated, so the DECISIONS are asserted. */
const SCRIPT: Record<string, RegExp> = {
  hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, bn: /[ঀ-৿]/,
  pa: /[਀-੿]/, gu: /[઀-૿]/, or: /[଀-୿]/,
  ta: /[஀-௿]/, te: /[ఀ-౿]/, kn: /[ಀ-೿]/,
  ml: /[ഀ-ൿ]/, ur: /[؀-ۿ]/, ar: /[؀-ۿ]/,
  he: /[֐-׿]/, ru: /[Ѐ-ӿ]/,
  zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/,
};
function looksTranslated(translated: string, text: string, targetLang: string): boolean {
  const s = SCRIPT[targetLang];
  if (s) return s.test(translated);
  if (translated.toLowerCase() !== text.trim().toLowerCase()) return true;
  return text.trim().split(/\s+/).length < 4;
}

describe("🔴 the echo failure is still caught — more reliably than before", () => {
  it.each([
    ["bn", "ami valo nei", "ami valo nei"],
    ["hi", "mera dil bhari hai", "mera dil bhari hai"],
    ["ta", "enakku kashtama irukku", "enakku kashtama irukku"],
  ])("%s: a romanized echo is rejected", (lang, src, out) => {
    expect(looksTranslated(out, src, lang)).toBe(false);
  });

  it("🔑 …and a PARTIAL echo too, which string-equality missed entirely", () => {
    // The old check compared for exact equality, so this walked straight
    // through and was served to the user as a translation.
    expect(looksTranslated("ami valo nei, I think", "ami valo nei", "bn")).toBe(false);
  });

  it("a real translation into the target script is accepted", () => {
    expect(looksTranslated("আমি ভালো নেই", "ami valo nei", "bn")).toBe(true);
    expect(looksTranslated("मेरा दिल भारी है", "mera dil bhari hai", "hi")).toBe(true);
    expect(looksTranslated("我在这里", "I am here", "zh")).toBe(true);
  });
});

describe("⚖️ …without punishing translations that are legitimately identical", () => {
  it.each([
    ["OK", "es"],
    ["WhatsApp", "fr"],
    ["42", "de"],
    ["Imotara", "pt"],
  ])("%s → %s stays accepted", (word, lang) => {
    expect(looksTranslated(word, word, lang)).toBe(true);
  });

  it("⚠️ but a LONG identical Latin result is still suspicious", () => {
    // Four or more words rarely translate to themselves between languages.
    expect(looksTranslated(
      "I have been feeling very low lately",
      "I have been feeling very low lately",
      "es",
    )).toBe(false);
  });
});

describe("the source does this, not just the mirror", () => {
  const s = raw(T);

  it("⛔ the blunt equality check is gone from BOTH providers", () => {
    expect(s).not.toMatch(/if \(translated\.toLowerCase\(\) === text\.trim\(\)\.toLowerCase\(\)\) return null;/);
    expect([...s.matchAll(/if \(!looksTranslated\(translated, text, targetLang\)\) return null;/g)].length).toBe(2);
  });

  it("🔑 every non-Latin target language has a script range", () => {
    // ⚠️ SCOPED TO THE MAP. The first version searched the whole file and
    // passed when `bn` was deleted — because an UNRELATED map
    // (NATIVE_SCRIPT_RANGES) also contains `bn: /[`. A mutation survived
    // because the assertion matched the wrong thing entirely.
    const i = s.indexOf("const TARGET_SCRIPT");
    expect(i).toBeGreaterThan(-1);
    const map = s.slice(i, s.indexOf("};", i));
    // the ten shared with routing come from the spread, and must stay a spread
    expect(map).toMatch(/\.\.\.NATIVE_SCRIPT_RANGES,/);
    const spread = s.slice(s.indexOf("const NATIVE_SCRIPT_RANGES"), s.indexOf("};", s.indexOf("const NATIVE_SCRIPT_RANGES")));
    for (const l of "mr bn pa gu or ta te kn ml ur".split(" ")) {
      expect(spread, `${l} missing from NATIVE_SCRIPT_RANGES`).toMatch(new RegExp(`\\b${l}:\\s*/\\[`));
    }
    // and the six this check adds itself
    for (const l of "hi ar he ru zh ja".split(" ")) {
      expect(map, `${l} missing from TARGET_SCRIPT`).toMatch(new RegExp(`\\b${l}:\\s*/\\[`));
    }
  });

  it("🔑 the Latin rule lives in the SOURCE, not just this file's mirror", () => {
    // A mutation changing it to `return true` survived, because every Latin
    // assertion above runs against the mirror. Pin the real line.
    expect(s).toMatch(/return text\.trim\(\)\.split\(\/\\s\+\/\)\.length < 4;/);
    expect(s).toMatch(/if \(translated\.toLowerCase\(\) !== text\.trim\(\)\.toLowerCase\(\)\) return true;/);
  });

  it("⚠️ MyMemory is still downstream — this keeps traffic AWAY from it", () => {
    // The whole point: fewer false failures means fewer calls to the engine
    // the file itself describes as confidently wrong.
    expect(s).toMatch(/myMemoryTranslate/);
  });
});
