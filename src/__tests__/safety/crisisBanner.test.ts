// src/__tests__/safety/crisisBanner.test.ts
// The web crisis banner is the highest-stakes text on the site. Seven of the
// 22 shipped languages quietly fell through to English until 2026-09-04, which
// is the kind of gap that never shows up in review because the page still
// renders perfectly.
//
// This used to read app/chat/page.tsx as source text and pick the map apart
// with a regex, because the map lived inside a "use client" page component.
// The map now has its own module, so it is imported. The language list is read
// from CONNECT_LANGUAGE_CODES rather than copied here — a hand-copied list of
// these 22 has already drifted twice in this repo.

import { describe, it, expect } from "vitest";
import { CRISIS_BANNER_BY_LANG } from "@/lib/safety/crisisCopy";
import { CONNECT_LANGUAGE_CODES } from "@/lib/connect/languages";

const SHIPPED = CONNECT_LANGUAGE_CODES;

describe("the fixture itself is real", () => {
  it("reads 22 languages from the canonical list", () => {
    expect(SHIPPED.length).toBe(22);
    expect(SHIPPED).toContain("en");
  });
});

describe("crisis banner covers every shipped language", () => {
  for (const lang of SHIPPED) {
    it(`${lang} has all three strings, none empty`, () => {
      const e = CRISIS_BANNER_BY_LANG[lang];
      expect(e, `${lang} is missing from CRISIS_BANNER_BY_LANG`).toBeTruthy();
      expect(e.tier2.trim().length).toBeGreaterThan(0);
      expect(e.tier1.trim().length).toBeGreaterThan(0);
      expect(e.link.trim().length).toBeGreaterThan(0);
    });
  }

  it("has no entry for a language the app does not offer", () => {
    const present = Object.keys(CRISIS_BANNER_BY_LANG);
    expect(present.filter((l) => !SHIPPED.includes(l))).toEqual([]);
  });
});

describe("no language is silently English", () => {
  const en = CRISIS_BANNER_BY_LANG.en;
  for (const lang of SHIPPED.filter((l) => l !== "en")) {
    it(`${lang} is translated, not copied`, () => {
      const e = CRISIS_BANNER_BY_LANG[lang];
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
      const e = CRISIS_BANNER_BY_LANG[lang];
      expect(re.test(e.tier2)).toBe(true);
      expect(re.test(e.tier1)).toBe(true);
    });
  }
});
