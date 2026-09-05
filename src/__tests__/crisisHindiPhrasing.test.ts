// Hindi says "I don't feel like living" in more than one way.
//
// Found on the iPhone simulator, 2026-09-05, while verifying the v1.3.3 mobile
// changes. CRISIS_HINT_REGEX carried only the "...है" form of this sentence, so
// "मुझे जीने का मन नहीं करता" — at least as common in ordinary Hindi — matched
// nothing and produced no crisis card and no helpline number.
//
// This regex is hand-synced into imotara-mobile (there is no shared package),
// so the same test lives in that repo's src/__tests__/crisisDetection.test.ts.
// If you widen or narrow the Hindi patterns, change both.

import { describe, it, expect } from "vitest";
import { CRISIS_HINT_REGEX } from "@/lib/emotion/keywordMaps";

describe("Hindi crisis phrasing", () => {
  const SAME_MEANING = [
    "जीने का मन नहीं है",
    "मुझे जीने का मन नहीं करता",
    "मुझे जीने का मन नहीं करती",
    "अब जीने का मन नहीं",
    "मुझे जीने की इच्छा नहीं",
  ];
  for (const text of SAME_MEANING) {
    it(`detects: ${text}`, () => {
      expect(CRISIS_HINT_REGEX.test(text)).toBe(true);
    });
  }

  // Widening the pattern must not turn ordinary reluctance into a crisis.
  // "मन नहीं" on its own is everyday Hindi — it is only the "जीने"/"living"
  // that makes it what it is.
  const ORDINARY_HINDI = [
    "आज मौसम बहुत अच्छा है",
    "मुझे यह फिल्म देखने का मन नहीं है",
    "मुझे आज बाहर जाने का मन नहीं करता",
    "खाने का मन नहीं है",
    "मैं ठीक हूँ",
  ];
  for (const text of ORDINARY_HINDI) {
    it(`does not fire on: ${text}`, () => {
      expect(CRISIS_HINT_REGEX.test(text)).toBe(false);
    });
  }
});
