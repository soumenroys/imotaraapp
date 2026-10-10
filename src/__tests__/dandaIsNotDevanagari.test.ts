/**
 * 🔴 Bengali was being read aloud in a HINDI voice.
 *
 * Measured on the live site 2026-10-10. `detectScriptLang` tested the whole
 * Devanagari block, `ऀ-ॿ`, before testing Bengali — and U+0964
 * DANDA (।) lives in that block while being shared punctuation used routinely
 * in Bengali, Punjabi, Odia and Gujarati.
 *
 * A real reply from the product contained exactly one character in that
 * range — the danda — and resolved to `hi-IN`.
 *
 * ⚠️ Blast radius: `resolveTTSLang` shares this function to pick the speech
 * voice, so any Bengali sentence ending in । was spoken by a Hindi voice.
 * That is a reply-quality defect that was live, not something introduced by
 * the speech-recognition work that found it.
 *
 * 🔑 The MOBILE app already had this right — `aiClient.detectLangFromScript`
 * uses the same letters-only range and tests Bengali first. Two copies of one
 * decision; only one was ever fixed. See
 * trap_blunt_fix_trades_one_failure_for_its_opposite.
 */

import { describe, it, expect } from "vitest";
import { recognitionLangFor } from "../app/chat/page";

/** The exact danda character at the centre of this. */
const DANDA = "।";
const DOUBLE_DANDA = "॥";

describe("🔴 shared Indic punctuation is not evidence of Devanagari", () => {
  it("Bengali ending in a danda is Bengali, not Hindi", () => {
    // The live case, reduced.
    expect(recognitionLangFor("auto", [`আমি আজ ভালো নেই${DANDA}`])).toBe("bn-IN");
  });

  it("…and with a double danda too", () => {
    expect(recognitionLangFor("auto", [`আমি ভালো নেই${DOUBLE_DANDA}`])).toBe("bn-IN");
  });

  it("the real reply that exposed it resolves to Bengali", () => {
    const live = "তোর আজকের এই \"খুব ভালো নেই\"টা আগের কয়েকদিনের কথার সঙ্গে মিলে যাচ্ছে, Soumen" + DANDA;
    expect(recognitionLangFor("auto", [live])).toBe("bn-IN");
  });

  it("every danda-using Indic script keeps its own identity", () => {
    const cases: Array<[string, string]> = [
      ["ਮੈਨੂੰ ਅੱਜ ਚੰਗਾ ਨਹੀਂ ਲੱਗ ਰਿਹਾ" + DANDA, "pa-IN"],   // Punjabi
      ["ମୁଁ ଆଜି ଭଲ ନାହିଁ" + DANDA, "or-IN"],                 // Odia
      ["મને આજે સારું નથી" + DANDA, "gu-IN"],                // Gujarati
      ["আমি ভালো নেই" + DANDA, "bn-IN"],                      // Bengali
    ];
    for (const [text, want] of cases) {
      expect(recognitionLangFor("auto", [text]), text).toBe(want);
    }
  });
});

describe("⚖️ Devanagari itself must still be detected — no regression", () => {
  it("Hindi is still Hindi", () => {
    expect(recognitionLangFor("auto", ["मैं आज ठीक नहीं हूँ"])).toBe("hi-IN");
  });

  it("…including when it ends in a danda", () => {
    expect(recognitionLangFor("auto", [`मैं आज ठीक नहीं हूँ${DANDA}`])).toBe("hi-IN");
  });

  it("Devanagari digits do not break it", () => {
    expect(recognitionLangFor("auto", ["मुझे २ दिन से नींद नहीं आई"])).toBe("hi-IN");
  });

  it("the other scripts are untouched", () => {
    const cases: Array<[string, string]> = [
      ["எனக்கு இன்று நல்லா இல்ல", "ta-IN"],
      ["నాకు ఈ రోజు బాగాలేదు", "te-IN"],
      ["ನನಗೆ ಇವತ್ತು ಬೇಸರ", "kn-IN"],
      ["എനിക്ക് ഇന്ന് സുഖമില്ല", "ml-IN"],
      ["אני לא מרגיש טוב", "he-IL"],
      ["我今天感觉不好", "zh-CN"],
      ["今日は気分が悪い", "ja-JP"],
    ];
    for (const [text, want] of cases) {
      expect(recognitionLangFor("auto", [text]), text).toBe(want);
    }
  });

  it("⛔ a danda ALONE is not a language signal", () => {
    // Nothing but punctuation is the absence of evidence.
    expect(recognitionLangFor("auto", [DANDA])).toBe("en-US");
  });
});
