// Mirrors imotara-mobile's src/__tests__/emotionLanguageWiring.test.ts.
//
// The recurring bug in keywordMaps.ts's history is not a bad regex — it is a
// good regex nobody wired up. On THIS repo the chat page's sad list had lost
// Hindi entirely (HI_SAD_REGEX defined, exported, and simply not in the list)
// and its stress list had lost Odia, while other call sites had both. Tamil's
// sad and stress patterns carried no Tamil script at all, and Telugu had no
// emotion pattern of any kind.
//
// So this test reads the module's OWN exports rather than a list of languages
// someone typed here — that list is the thing that keeps drifting.

import { describe, it, expect } from "vitest";
import * as KM from "@/lib/emotion/keywordMaps";

function sampleFor(re: RegExp): string {
  return re.source
    .replace(/^[/(]+/, "")
    .split("|")[0]
    .replace(/[()\\^$?*+\[\]{}]/g, "")
    .replace(/\bb\b/g, "")
    .trim();
}

// Defined but deliberately not wired into the shared sad path — see UX-38.
// Measured 2026-09-05: the Japanese pattern reads 4 of 6 neutral sentences as
// sadness (bare うつ and 一人 match inside ordinary words) and German matches
// "Ich gehe allein einkaufen". Listed so the exclusion stays a decision.
const DELIBERATELY_UNWIRED_SAD = new Set(["JP", "HE", "AR", "DE"]);

function langsWith(suffix: string): string[] {
  return Object.keys(KM)
    .filter((k) => k.endsWith(suffix))
    .map((k) => k.slice(0, k.length - suffix.length));
}

describe("every SAD pattern defined is reachable from isSadText", () => {
  const langs = langsWith("_SAD_REGEX").filter((l) => !DELIBERATELY_UNWIRED_SAD.has(l));
  it("finds the languages at all", () => {
    expect(langs.length).toBeGreaterThanOrEqual(10);
    expect(langs).toContain("HI"); // the bug that was live on web
    expect(langs).toContain("TE"); // UX-41
  });
  for (const L of langs) {
    it(`${L}`, () => {
      const re = (KM as unknown as Record<string, RegExp>)[`${L}_SAD_REGEX`];
      const sample = sampleFor(re);
      expect(re.test(sample)).toBe(true);
      expect(KM.isSadText(sample)).toBe(true);
    });
  }
});

describe("every wired STRESS pattern is reachable from isStressText", () => {
  const WIRED = ["HI", "BN", "TA", "TE", "GU", "KN", "ML", "PA", "OR", "MR"];
  for (const L of WIRED) {
    it(`${L}`, () => {
      const re = (KM as unknown as Record<string, RegExp>)[`${L}_STRESS_REGEX`];
      expect(re).toBeDefined();
      const sample = sampleFor(re);
      expect(re.test(sample)).toBe(true);
      expect(KM.isStressText(sample)).toBe(true);
    });
  }
});

describe("UX-40 — Tamil in Tamil script", () => {
  for (const s of ["நான் மிகவும் சோகமாக இருக்கிறேன்", "ரொம்ப வருத்தமா இருக்கு", "மனசு வலிக்குது"]) {
    it(`sad: ${s}`, () => expect(KM.isSadText(s)).toBe(true));
  }
  for (const s of ["ரொம்ப கவலையா இருக்கு", "மன அழுத்தம் அதிகமா இருக்கு", "பதட்டமா இருக்கு"]) {
    it(`stress: ${s}`, () => expect(KM.isStressText(s)).toBe(true));
  }
  for (const s of ["இன்று வானிலை நன்றாக உள்ளது", "நான் மகிழ்ச்சியாக இருக்கிறேன்"]) {
    it(`neutral stays neutral: ${s}`, () => {
      expect(KM.isSadText(s)).toBe(false);
      expect(KM.isStressText(s)).toBe(false);
    });
  }
});

describe("UX-41 — Telugu", () => {
  for (const s of ["నేను చాలా బాధగా ఉన్నాను", "మనసు బాగోలేదు", "ఏడుపు వస్తోంది"]) {
    it(`sad: ${s}`, () => expect(KM.isSadText(s)).toBe(true));
  }
  for (const s of ["చాలా ఒత్తిడిగా ఉంది", "ఆందోళనగా ఉంది"]) {
    it(`stress: ${s}`, () => expect(KM.isStressText(s)).toBe(true));
  }
  for (const s of ["ఏం చేయాలో తెలియట్లేదు", "అర్థం కావట్లేదు"]) {
    it(`confused: ${s}`, () => expect(KM.isConfusedText(s)).toBe(true));
  }
  for (const s of ["ఈ రోజు వాతావరణం బాగుంది", "నేను చాలా సంతోషంగా ఉన్నాను"]) {
    it(`neutral stays neutral: ${s}`, () => {
      expect(KM.isSadText(s)).toBe(false);
      expect(KM.isStressText(s)).toBe(false);
      expect(KM.isConfusedText(s)).toBe(false);
    });
  }
});

describe("no cross-language bleed from the new patterns", () => {
  for (const s of ["I had a rough day at work", "आज मौसम बहुत अच्छा है", "আজ আবহাওয়া ভালো"]) {
    it(`${s}`, () => {
      expect(KM.TE_SAD_REGEX.test(s)).toBe(false);
      expect(KM.TE_STRESS_REGEX.test(s)).toBe(false);
      expect(KM.TA_SAD_REGEX.test(s)).toBe(false);
      expect(KM.TA_STRESS_REGEX.test(s)).toBe(false);
    });
  }
});
