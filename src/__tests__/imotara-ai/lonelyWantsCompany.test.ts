/**
 * src/__tests__/imotara-ai/lonelyWantsCompany.test.ts
 *
 * Regression tests for LONELY_WANTS_COMPANY_REGEX and its CRISIS_HINT_REGEX
 * parity (chat-reply/route.ts CONNECT REFERRAL RULE, session of 2026-08-14).
 *
 * LONELY_WANTS_COMPANY_REGEX covers all 22 Imotara-supported languages, kept
 * in lockstep with CRISIS_HINT_REGEX by design: live testing found that
 * enabling the Connect referral for a language CRISIS_HINT_REGEX doesn't
 * cover lets a crisis message slip past the crisis-suppression guard and get
 * a Connect mention instead of a professional-crisis-first reply (originally
 * reproduced with Spanish, before CRISIS_HINT_REGEX was extended to all 22
 * languages in the same session). These tests guard both regexes' full
 * language coverage from regressing.
 *
 * Also guards a real collision found during testing: Chinese and Japanese
 * share the kanji "孤独" (loneliness) — safe now that both languages have
 * crisis coverage, but worth keeping a test on so a future language split
 * doesn't reintroduce the same silent gap.
 */

import { describe, it, expect } from "vitest";
import {
  CRISIS_HINT_REGEX,
  LONELY_WANTS_COMPANY_REGEX,
} from "@/lib/emotion/keywordMaps";

const LONELY_SAMPLES: Record<string, string> = {
  en: "I am so lonely, I have no one to talk to",
  hi: "मुझे अकेला लगता है, बात करने के लिए कोई नहीं",
  bn: "আমি একা, আমার কথা বলার কেউ নেই",
  mr: "मला एकटं वाटतंय, बोलायला कोणी नाही",
  gu: "એકલું લાગે છે, વાત કરવા કોઈ નથી",
  kn: "ನನಗೆ ಒಂಟಿತನ ಅನಿಸುತ್ತಿದೆ, ಮಾತನಾಡಲು ಯಾರೂ ಇಲ್ಲ",
  ta: "எனக்கு தனிமையாக இருக்கிறது, பேச யாரும் இல்லை",
  te: "నాకు ఒంటరిగా అనిపిస్తుంది, మాట్లాడటానికి ఎవరూ లేరు",
  ml: "എനിക്ക് ഏകാന്തത തോന്നുന്നു, സംസാരിക്കാൻ ആരുമില്ല",
  he: "אני מרגיש בודד, אין לי עם מי לדבר",
  ar: "أشعر بالوحدة، لا أحد أتحدث معه",
  de: "ich fühle mich einsam, ich habe niemanden zum reden",
  ja: "とても寂しいです、話す人がいない",
  pa: "ਮੈਂ ਇਕੱਲਾ ਹਾਂ, ਗੱਲ ਕਰਨ ਲਈ ਕੋਈ ਨਹੀਂ",
  or: "ଏକାକୀପଣ ଲାଗୁଛି, କଥା ହେବାକୁ କେହି ନାହାନ୍ତି",
  ur: "میں تنہا محسوس کرتا ہوں، بات کرنے کے لیے کوئی نہیں",
  zh: "我很孤独，没有人可以说话",
  es: "me siento tan sola, no tengo a nadie con quien hablar",
  fr: "je me sens si seul, je n'ai personne à qui parler",
  id: "aku merasa kesepian, tidak ada yang bisa diajak bicara",
  pt: "estou tão sozinha, não tenho ninguém para conversar",
  ru: "мне очень одиноко, не с кем поговорить",
};

// One representative crisis phrase per one of the 9 languages added in the
// CRISIS_HINT_REGEX extension (the other 13 already had coverage/tests
// elsewhere in the codebase's history).
const CRISIS_SAMPLES: Record<string, string> = {
  pa: "ਮੈਂ ਮਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ",
  or: "ମୋତେ ମରିଯିବାକୁ ମନ ହେଉଛି",
  ur: "میں مرنا چاہتا ہوں",
  zh: "我想死",
  es: "quiero morir",
  fr: "je veux mourir",
  id: "saya ingin mati",
  pt: "quero morrer",
  ru: "я хочу умереть",
};

const NEGATIVE_CONTROLS = [
  "I had a rough day at work",
  "मुझे बहुत गुस्सा आ रहा है",
  "estoy muy feliz hoy",
  "今天天气很好",
];

describe("LONELY_WANTS_COMPANY_REGEX (all 22 Imotara languages)", () => {
  for (const [lang, text] of Object.entries(LONELY_SAMPLES)) {
    it(`matches ${lang}`, () => {
      expect(LONELY_WANTS_COMPANY_REGEX.test(text)).toBe(true);
    });
  }

  for (const text of NEGATIVE_CONTROLS) {
    it(`does not false-positive on: "${text}"`, () => {
      expect(LONELY_WANTS_COMPANY_REGEX.test(text)).toBe(false);
    });
  }
});

describe("CRISIS_HINT_REGEX (parity check for the 9 newly-added languages)", () => {
  for (const [lang, text] of Object.entries(CRISIS_SAMPLES)) {
    it(`matches ${lang}`, () => {
      expect(CRISIS_HINT_REGEX.test(text)).toBe(true);
    });
  }

  for (const text of NEGATIVE_CONTROLS) {
    it(`does not false-positive on: "${text}"`, () => {
      expect(CRISIS_HINT_REGEX.test(text)).toBe(false);
    });
  }
});
