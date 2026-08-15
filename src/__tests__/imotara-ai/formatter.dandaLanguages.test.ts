/**
 * src/__tests__/imotara-ai/formatter.dandaLanguages.test.ts
 *
 * Regression tests for a 2026-08-14 bug report: users hearing punctuation
 * marks read aloud by TTS, particularly in Indian languages. Two related
 * root causes found in formatImotaraReply's sentence-terminator logic
 * (responseFormatter.ts), both now fixed:
 *
 * 1. endPunct force-inserted the Devanagari danda (।) into every reply for
 *    hi/bn/ta/te/mr/gu/kn/ml/pa/or — but confirmed against this file's own
 *    native-language reactionBank() content, only Hindi/Bengali/Punjabi/Odia
 *    actually use danda; Marathi, Gujarati, Tamil, Telugu, Kannada, and
 *    Malayalam all use a plain period natively (even Marathi, despite
 *    sharing Devanagari script with Hindi).
 * 2. Every terminator-recognition character class in the file (sentenceEndRe,
 *    ensureEndsLikeSentence, splitIntoSentences, and 4 dedup normalizers)
 *    was missing the CJK full-width terminators 。and ！— so a Japanese/
 *    Chinese reply ending correctly in 。wasn't recognized as already
 *    complete, and got a stray Latin "." appended (reproduced live:
 *    "...部分。."). endPunct now also gives ja/zh their own native 。
 *    instead of ".".
 *
 * In both cases, Azure's TTS voices for the affected languages would
 * sometimes vocalize the foreign punctuation character literally instead of
 * treating it as a silent pause.
 *
 * Uses multi-question raw input (like formatter.en.test.ts's own pattern)
 * to deterministically exercise the endPunct-substitution code path,
 * independent of language-specific reactionBank content.
 */

import { describe, it, expect } from "vitest";
import { formatImotaraReply } from "@/lib/imotara/response/responseFormatter";

const DANDA = "।";
const RAW_MULTIPLE_QUESTIONS = "How are you feeling? What happened? Have you tried talking to someone?";

const DANDA_LANGUAGES = ["hi", "bn", "pa", "or"];
const PERIOD_LANGUAGES = ["mr", "gu", "ta", "te", "kn", "ml"];

describe("formatImotaraReply — danda (।) only applies to languages that actually use it", () => {
  for (const lang of DANDA_LANGUAGES) {
    it(`uses danda for ${lang}`, () => {
      const out = formatImotaraReply({
        raw: RAW_MULTIPLE_QUESTIONS,
        lang,
        tone: "close_friend",
        seed: `test-danda-${lang}`,
        intent: "emotional",
        userMessage: "I feel so overwhelmed and lost lately",
      });
      expect(out).toContain(DANDA);
    });
  }

  for (const lang of PERIOD_LANGUAGES) {
    it(`does NOT use danda for ${lang} (uses a plain period natively)`, () => {
      const out = formatImotaraReply({
        raw: RAW_MULTIPLE_QUESTIONS,
        lang,
        tone: "close_friend",
        seed: `test-period-${lang}`,
        intent: "emotional",
        userMessage: "I feel so overwhelmed and lost lately",
      });
      expect(out).not.toContain(DANDA);
    });
  }

  it("Urdu still uses its own full stop (۔), not danda", () => {
    const out = formatImotaraReply({
      raw: RAW_MULTIPLE_QUESTIONS,
      lang: "ur",
      tone: "close_friend",
      seed: "test-ur",
      intent: "emotional",
      userMessage: "I feel so overwhelmed and lost lately",
    });
    expect(out).not.toContain(DANDA);
  });
});

describe("formatImotaraReply — Japanese/Chinese use 。, never a stray Latin period", () => {
  for (const lang of ["ja", "zh"]) {
    it(`${lang} reply never contains 。. (native terminator + stray period)`, () => {
      const out = formatImotaraReply({
        raw: RAW_MULTIPLE_QUESTIONS,
        lang,
        tone: "close_friend",
        seed: `test-cjk-${lang}`,
        intent: "emotional",
        userMessage: "I feel so overwhelmed and lost lately",
      });
      expect(out).not.toContain("。.");
    });

    it(`${lang} uses 。 as its sentence terminator, not a Latin period`, () => {
      const out = formatImotaraReply({
        raw: RAW_MULTIPLE_QUESTIONS,
        lang,
        tone: "close_friend",
        seed: `test-cjk-period-${lang}`,
        intent: "emotional",
        userMessage: "I feel so overwhelmed and lost lately",
      });
      expect(out).toContain("。");
    });
  }
});

// Completes coverage across all 22 Imotara-supported languages: these 9 were
// never in the buggy danda list and don't take the CJK branch either, so
// they were never expected to be affected — asserted here anyway so the full
// language matrix has real test coverage, not just the languages that had
// bugs (per user request, 2026-08-14: "have you checked all 22 languages").
const STANDARD_LATIN_PUNCTUATION_LANGUAGES = ["en", "de", "es", "fr", "pt", "ru", "ar", "he", "id"];

describe("formatImotaraReply — remaining languages use a plain Latin period, never danda or 。", () => {
  for (const lang of STANDARD_LATIN_PUNCTUATION_LANGUAGES) {
    it(`${lang} never contains danda or 。`, () => {
      const out = formatImotaraReply({
        raw: RAW_MULTIPLE_QUESTIONS,
        lang,
        tone: "close_friend",
        seed: `test-latin-${lang}`,
        intent: "emotional",
        userMessage: "I feel so overwhelmed and lost lately",
      });
      expect(out).not.toContain(DANDA);
      expect(out).not.toContain("。");
    });
  }
});
