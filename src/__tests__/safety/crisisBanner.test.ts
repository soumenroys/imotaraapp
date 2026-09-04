// src/__tests__/safety/crisisBanner.test.ts
// The web crisis banner is the highest-stakes text on the site. Seven of the
// 22 shipped languages quietly fell through to English until 2026-09-04, which
// is the kind of gap that never shows up in review because the page still
// renders perfectly.
//
// The map lives inside a "use client" page component, so it is read as source
// rather than imported — importing the page would drag React and the whole
// chat screen into a test about strings.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");

const BLOCK = (() => {
  const m = /const CRISIS_BANNER_BY_LANG[^{]*\{([\s\S]*?)\n\};/.exec(SRC);
  if (!m) throw new Error("CRISIS_BANNER_BY_LANG not found — did it move or get renamed?");
  return m[1];
})();

function entry(lang: string) {
  const re = new RegExp(`^\\s{2}${lang}: \\{ tier2: "(.*?)", tier1: "(.*?)", link: "(.*?)" \\},$`, "m");
  const m = re.exec(BLOCK);
  return m ? { tier2: m[1], tier1: m[2], link: m[3] } : null;
}

// The 22 languages Imotara actually offers.
const SHIPPED = [
  "en", "bn", "gu", "hi", "kn", "ml", "mr", "or", "pa", "ta", "te", "ur",
  "ar", "zh", "fr", "de", "he", "id", "ja", "pt", "ru", "es",
];

describe("crisis banner covers every shipped language", () => {
  for (const lang of SHIPPED) {
    it(`${lang} has all three strings, none empty`, () => {
      const e = entry(lang);
      expect(e, `${lang} is missing from CRISIS_BANNER_BY_LANG`).not.toBeNull();
      expect(e!.tier2.trim().length).toBeGreaterThan(0);
      expect(e!.tier1.trim().length).toBeGreaterThan(0);
      expect(e!.link.trim().length).toBeGreaterThan(0);
    });
  }

  it("has no entry for a language the app does not offer", () => {
    const present = [...BLOCK.matchAll(/^\s{2}([a-z]{2}):/gm)].map((m) => m[1]);
    expect(present.filter((l) => !SHIPPED.includes(l))).toEqual([]);
  });
});

describe("no language is silently English", () => {
  const en = entry("en")!;
  for (const lang of SHIPPED.filter((l) => l !== "en")) {
    it(`${lang} is translated, not copied`, () => {
      const e = entry(lang)!;
      expect(e.tier2).not.toBe(en.tier2);
      expect(e.tier1).not.toBe(en.tier1);
      expect(e.link).not.toBe(en.link);
    });
  }
});

describe("each translation is in its own script", () => {
  const SCRIPT: Record<string, RegExp> = {
    hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, bn: /[ঀ-৿]/,
    gu: /[઀-૿]/, pa: /[਀-੿]/, or: /[଀-୿]/,
    ta: /[஀-௿]/, te: /[ఀ-౿]/, kn: /[ಀ-೿]/,
    ml: /[ഀ-ൿ]/, ur: /[؀-ۿ]/, ar: /[؀-ۿ]/,
    he: /[֐-׿]/, ru: /[Ѐ-ӿ]/, zh: /[一-鿿]/,
  };
  for (const [lang, re] of Object.entries(SCRIPT)) {
    it(`${lang} uses its own script`, () => {
      const e = entry(lang)!;
      expect(re.test(e.tier2)).toBe(true);
      expect(re.test(e.tier1)).toBe(true);
    });
  }
});
