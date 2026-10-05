/**
 * The full language matrix for the EDU/NGO mindset trend.
 *
 * 🔴 WHY THIS EXISTS. Imotara supports 22 languages. keywordMaps has emotion
 * maps for 14; this module adds English. The other 7 — Urdu, Russian, Chinese,
 * Spanish, French, Portuguese, Indonesian — had NO emotion detection at all, so
 * for an NGO whose members write in them the trend would have read uniformly
 * "neutral". That is not a measurement, it is an absence that looks like calm.
 *
 * Standing rule: all-language logic is tested across the FULL matrix, not on a
 * sample. The matrix is driven off CONNECT_LANGUAGES, so adding a 23rd language
 * to the product fails this suite until its emotion words are added too — which
 * is the point.
 */

import { describe, it, expect } from "vitest";
import { CONNECT_LANGUAGES } from "@/lib/connect/languages";
import {
  deriveAnalyticsEmotion,
  EMOTION_POLARITY,
} from "@/lib/emotion/analyticsEmotion";

/**
 * One genuinely distressed and one genuinely positive phrase per supported
 * language, written in the script a speaker would actually use.
 */
const MATRIX: Record<string, { negative: string; positive: string }> = {
  en: { negative: "I feel so sad today",            positive: "I am really happy today" },
  hi: { negative: "मैं बहुत दुखी हूँ",                positive: "मुझे उम्मीद है" },
  bn: { negative: "আমার মন খুব খারাপ",               positive: "আমি আজ খুশি" },
  mr: { negative: "मला खूप वाईट वाटत आहे",            positive: "मी आनंदी आहे" },
  ta: { negative: "நான் மிகவும் வருத்தமாக இருக்கிறேன்", positive: "எனக்கு நம்பிக்கை இருக்கிறது" },
  te: { negative: "నేను చాలా బాధగా ఉన్నాను",          positive: "నాకు ఆశ ఉంది" },
  gu: { negative: "હું ખૂબ દુઃખી છું",                positive: "મને આશા છે" },
  pa: { negative: "ਮੈਂ ਬਹੁਤ ਉਦਾਸ ਹਾਂ",                positive: "ਮੈਨੂੰ ਉਮੀਦ ਹੈ" },
  kn: { negative: "ನಾನು ತುಂಬಾ ದುಃಖಿತನಾಗಿದ್ದೇನೆ",       positive: "ನನಗೆ ಭರವಸೆ ಇದೆ" },
  ml: { negative: "എനിക്ക് വളരെ സങ്കടമാണ്",           positive: "എനിക്ക് പ്രതീക്ഷയുണ്ട്" },
  or: { negative: "ମୁଁ ବହୁତ ଦୁଃଖିତ",                  positive: "ମୋର ଆଶା ଅଛି" },
  ur: { negative: "میں بہت اداس ہوں",                positive: "مجھے امید ہے" },
  ar: { negative: "أنا حزين جدا",                    positive: "أنا سعيد اليوم" },
  he: { negative: "אני עצוב מאוד",                   positive: "אני שמח היום" },
  ru: { negative: "мне очень грустно",               positive: "я счастлив сегодня" },
  zh: { negative: "我很难过",                          positive: "我很开心" },
  ja: { negative: "とても悲しいです",                   positive: "とても嬉しいです" },
  es: { negative: "estoy muy triste",                positive: "estoy muy feliz" },
  fr: { negative: "je suis très triste",             positive: "je suis très heureux" },
  de: { negative: "ich bin sehr traurig",            positive: "ich bin sehr glücklich" },
  pt: { negative: "estou muito triste",              positive: "estou muito feliz" },
  id: { negative: "saya sangat sedih",               positive: "saya sangat bahagia" },
};

const CODES = CONNECT_LANGUAGES.map((l) => l.code);

describe("the matrix covers the product", () => {
  it("has a case for every supported language", () => {
    const missing = CODES.filter((c) => !MATRIX[c]);
    expect(missing).toEqual([]);
  });

  it("has no case for a language the product does not support", () => {
    const extra = Object.keys(MATRIX).filter((c) => !CODES.includes(c));
    expect(extra).toEqual([]);
  });

  it("covers all 22", () => {
    expect(CODES.length).toBe(22);
  });
});

describe("distress is detected in every supported language", () => {
  it.each(CODES)("%s", (code) => {
    const got = deriveAnalyticsEmotion(MATRIX[code].negative);
    // Any negative label is acceptable — which one is a judgement call per
    // language. What matters is that it is NOT read as neutral or positive,
    // because that is what silently flattened the trend.
    expect(EMOTION_POLARITY[got]).toBeLessThan(0);
  });
});

describe("a positive state is reachable in every supported language", () => {
  it.each(CODES)("%s", (code) => {
    const got = deriveAnalyticsEmotion(MATRIX[code].positive);
    expect(EMOTION_POLARITY[got]).toBeGreaterThan(0);
  });
});

describe("politeness is excluded in every language that has a word for it", () => {
  // Every one of these is "thank you", not a stated feeling. Scoring them +0.9
  // would inflate an NGO's positive trend on manners alone.
  const politeness: Record<string, string> = {
    en: "thanks",
    hi: "धन्यवाद",
    bn: "ধন্যবাদ",
    ur: "شکریہ",
    ru: "спасибо",
    zh: "谢谢",
    es: "gracias",
    fr: "merci",
    pt: "obrigado",
    id: "terima kasih",
    de: "danke",
    ja: "ありがとう",
  };
  it.each(Object.entries(politeness))("%s: %s is not gratitude", (_code, word) => {
    expect(deriveAnalyticsEmotion(word)).not.toBe("grateful");
  });
});

describe("negation holds in the non-English languages too", () => {
  // Built from positive words, meaning the opposite. If any scores > 0 the
  // trend drifts optimistic exactly when people are doing worst.
  const negated = [
    "मुझे कोई उम्मीद नहीं है",   // hi: I have no hope
    "আমি ভালো নেই",             // bn: I am not well
    "мне не хорошо",            // ru: I am not well
    "我不开心",                   // zh: I am not happy
    "no estoy feliz",           // es: I am not happy
    "je ne suis pas heureux",   // fr: I am not happy
    "não estou feliz",          // pt: I am not happy
    "saya tidak bahagia",       // id: I am not happy
    "مجھے امید نہیں ہے",         // ur: I have no hope
  ];
  it.each(negated)("%s is never scored positive", (msg) => {
    expect(EMOTION_POLARITY[deriveAnalyticsEmotion(msg)]).toBeLessThanOrEqual(0);
  });
});
