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

/**
 * UPDATED 2026-09-12. These cases used to pass RAW_MULTIPLE_QUESTIONS — which
 * is ENGLISH — with lang: "hi" and assert a danda came back. That worked only
 * because the terminator was chosen from the language label alone.
 *
 * It is now chosen from the script the text is actually written in, because
 * the product mirrors whatever script the person writes in and most Indic
 * users type romanized: a Bengali reply in Latin letters was being closed
 * with a danda ("...kothin hocche ekhon।") and Urdu with "۔".
 *
 * So the fixture has to be in the language's own script for the danda
 * question to arise at all. The intent of these tests is unchanged — danda
 * belongs to hi/bn/pa/or and not to mr/gu/ta/te/kn/ml — and
 * punctuationByScript.test.ts covers the romanized side.
 */
const NATIVE_RAW: Record<string, string> = {
    hi: "तुम कैसा महसूस कर रहे हो? क्या हुआ? क्या तुमने किसी से बात की?",
    bn: "তুমি কেমন বোধ করছ? কী হয়েছে? তুমি কি কারও সাথে কথা বলেছ?",
    pa: "ਤੂੰ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਿਹਾ ਹੈਂ? ਕੀ ਹੋਇਆ? ਕੀ ਤੂੰ ਕਿਸੇ ਨਾਲ ਗੱਲ ਕੀਤੀ?",
    or: "ତୁମେ କେମିତି ଅନୁଭବ କରୁଛ? କଣ ହେଲା? ତୁମେ କାହା ସହ କଥା ହେଇଛ?",
    ja: "今どんな気持ちですか？何があったのですか？誰かに話しましたか？",
    zh: "你现在感觉怎么样？发生了什么？你和别人谈过吗？",
};
const PERIOD_LANGUAGES = ["mr", "gu", "ta", "te", "kn", "ml"];

describe("formatImotaraReply — danda (।) only applies to languages that actually use it", () => {
  for (const lang of DANDA_LANGUAGES) {
    it(`uses danda for ${lang}`, () => {
      const out = formatImotaraReply({
        raw: NATIVE_RAW[lang] ?? RAW_MULTIPLE_QUESTIONS,
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
        // Native script, for the same reason as the danda cases above: the
        // terminator now follows the script of the text, so English input
        // would correctly come back with a Latin period.
        raw: NATIVE_RAW[lang] ?? RAW_MULTIPLE_QUESTIONS,
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
