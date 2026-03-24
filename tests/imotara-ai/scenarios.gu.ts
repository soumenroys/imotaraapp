/**
 * tests/imotara-ai/scenarios.gu.ts
 *
 * E2E test scenarios for Gujarati (gu) language support.
 * Categories:
 *   A: Native Script (12) — Gujarati script input/output
 *   B: Romanized Gujarati (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Gujarati notes:
 *  - Script: Gujarati (U+0A80–U+0AFF) — distinct from Devanagari
 *  - Address: "tu" (informal), "tame" (polite), "aap" (formal/elder)
 *  - Gender: Masculine/feminine verb agreement ("gayo"/"gai", "karo"/"kari")
 *  - Romanized markers: hun, mane, chhe, nathi, pan, ane, kem, tamne, tame
 */

import type { TestScenario } from "./types";

export const guScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "gu-native-lang-01",
    category: "A: Native Script",
    name: "Native Gujarati: reply must stay in Gujarati script",
    description: "User writes in Gujarati script. Reply must stay in Gujarati — not switch to Hindi or English.",
    messages: [
      { role: "user", content: "મને ખૂબ થાક લાગ્યો છે. કશુ સૂઝ નથી." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "gu-native-lang-01",
      description: "Language fidelity in Gujarati",
      passCondition: "Reply is in Gujarati script — warm, emotionally present. Not in Hindi or English.",
      failExpectedOutcome: "Reply switches to Hindi or English instead of staying in Gujarati.",
    },
  },

  {
    id: "gu-native-ctx-01",
    category: "A: Native Script",
    name: "Native Gujarati: references the specific situation",
    description: "User shares a specific situation. Reply should reference it, not give a generic response.",
    messages: [
      { role: "user", content: "આજે boss એ બધાની સામે મને ઠપકો આપ્યો. ખૂબ ખરાબ લાગ્યું." },
    ],
    config: {
      lang: "gu", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was scolded by their boss in front of everyone — public humiliation. Reference this specifically ('boss એ ઠપકો આપ્યો', 'બધાની સામે').",
    },
    criteria: {
      id: "gu-native-ctx-01",
      description: "Context specificity in Gujarati",
      passCondition: "Reply references being scolded in front of everyone ('બધાની સામે' or 'boss ઠપકો') — not generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the specific public humiliation.",
    },
  },

  {
    id: "gu-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Gujarati: close_friend tone",
    description: "close_friend tone — casual, warm, informal 'તું' address.",
    messages: [
      { role: "user", content: "યાર, આજ મન ઉદાસ છે. કઈ ગમ્યું નહિ." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "gu-native-tone-friend-01",
      description: "close_friend tone in Gujarati",
      passCondition: "Reply uses informal address ('તું', 'તારો', 'તને') or casual romanized forms — warm and friendly, not using 'તમે' or 'આપ'. Language stays Gujarati.",
      failExpectedOutcome: "Reply uses formal 'તમે' or 'આપ', or switches to Hindi/English.",
    },
  },

  {
    id: "gu-native-tone-calm-01",
    category: "A: Native Script",
    name: "Native Gujarati: calm_companion tone",
    description: "calm_companion tone — patient, unhurried, no pressure.",
    messages: [
      { role: "user", content: "મને સમજ નથી પડ઼ती. બધું ગૂંચવાઈ ગયું છે." },
    ],
    config: { lang: "gu", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "gu-native-tone-calm-01",
      description: "calm_companion tone in Gujarati",
      passCondition: "Reply is gentle and unhurried — acknowledges confusion ('ગૂંચવાઈ') without rushing to fix it. Warm and patient.",
      failExpectedOutcome: "Reply pushes for solutions or is too energetic.",
    },
  },

  {
    id: "gu-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Gujarati: coach tone",
    description: "coach tone — practical, action-oriented.",
    messages: [
      { role: "user", content: "કાલ interview છે. તૈયારી નથી. ડર લાગ્યો." },
    ],
    config: { lang: "gu", tone: "coach", inputModality: "native" },
    criteria: {
      id: "gu-native-tone-coach-01",
      description: "coach tone in Gujarati",
      passCondition: "Reply acknowledges fear briefly then asks a practical question — 'ક્યો ભાગ weak લાગ્યો?' Not just soothing.",
      failExpectedOutcome: "Reply only soothes without any practical forward direction.",
    },
  },

  {
    id: "gu-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Gujarati: teen register",
    description: "Teen user — reply should use casual peer-level Gujarati, not adult counselling language.",
    messages: [
      { role: "user", content: "school ma કોઈ friend નથી. ખૂબ lonely feel થ઼ाय." },
    ],
    config: { lang: "gu", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "gu-native-age-teen-01",
      description: "Teen register in Gujarati",
      passCondition: "Reply is warm, peer-level Gujarati — acknowledges loneliness without lecturing. Casual 'તું' tone. Not preachy.",
      failExpectedOutcome: "Reply is preachy, uses adult counselling phrases, or switches to English/Hindi.",
    },
  },

  {
    id: "gu-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Gujarati: elder register",
    description: "Older adult user — reply should be warm and respectful, use 'આપ/તમે' address.",
    messages: [
      { role: "user", content: "ઉંમર થઈ ગઈ, એકલાપણું ખૂબ સ઼ाले. છોકરા-છોકરી બધા બહાર ગઈ ગઈ." },
    ],
    config: { lang: "gu", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "gu-native-age-elder-01",
      description: "Elder register in Gujarati",
      passCondition: "Reply uses respectful 'આપ' or 'તમે' address — warm, patient, acknowledges loneliness without rushing to solutions.",
      failExpectedOutcome: "Reply uses informal 'તું', feels dismissive, or switches to English/Hindi.",
    },
  },

  {
    id: "gu-native-emotion-sad-01",
    category: "A: Native Script",
    name: "Native Gujarati: sadness acknowledged with depth",
    description: "User shares grief (father passed). Reply should sit with the pain.",
    messages: [
      { role: "user", content: "પિતાજી ગઈ ગઈ. બે અઠ઼ाडियां थ఼ईं. હજ઼ी विश्वास नहीं थ़ाय." },
    ],
    config: { lang: "gu", tone: "close_friend", emotion: "sad", inputModality: "native" },
    criteria: {
      id: "gu-native-emotion-sad-01",
      description: "Grief depth in Gujarati",
      passCondition: "Reply in Gujarati sits with the grief — acknowledges 'પિતાજી' and the disbelief. Does NOT rush to 'બધું ઠીક થઈ જ઼ाशे'.",
      failExpectedOutcome: "Reply rushes to comfort with 'everything will be okay' or is generic.",
    },
  },

  {
    id: "gu-native-emotion-anxiety-01",
    category: "A: Native Script",
    name: "Native Gujarati: anxiety acknowledged specifically",
    description: "User describes physical anxiety symptoms. Reply should name them specifically.",
    messages: [
      { role: "user", content: "છাتीमां ઘ઼ભ਼ਰ਼ਾਹਟ ਰਹ਼े ਛे. ਨੀਂਦ਼ ਨਥ਼ੀ, ਜ਼ਮ਼ਾਡ਼ੁ਼ਂ ਪਣ਼ ਖ਼਼ਾਧ਼ੁ਼ਂ ਨ਼ਥ਼ੀ." },
    ],
    config: { lang: "gu", tone: "calm_companion", emotion: "anxious", inputModality: "native" },
    criteria: {
      id: "gu-native-emotion-anxiety-01",
      description: "Specific anxiety acknowledgement in Gujarati",
      passCondition: "Reply names specific symptoms — chest discomfort, sleeplessness, not eating. Not a generic 'anxiety is hard'.",
      failExpectedOutcome: "Reply is generic without referencing the specific physical symptoms.",
    },
  },

  {
    id: "gu-native-gender-verb-01",
    category: "A: Native Script",
    name: "Native Gujarati: gendered verb forms for female user",
    description: "Gujarati verbs are gendered. Female user = 'gayi', 'kari', 'thaki' not 'gayo', 'karo', 'thako'.",
    messages: [
      { role: "user", content: "હ઼ुઁ ઘ਼ণ਼ੀ ਥ਼ਾਕ਼ੀ ਗ਼ਈ ਛ਼ੁਂ. ਕ਼ਾਮ਼ ਅ਼ਨ਼ੇ ਘ਼ਰ਼, ਬ਼ਧ਼ੁਂ ਸ਼਼ਾਂਭ਼ਾਲ਼ਤ਼ੀ ਥ਼ਾਕ਼ੀ ਗ਼ਈ ਛ਼ੁਂ." },
    ],
    config: { lang: "gu", tone: "close_friend", userGender: "female", inputModality: "native" },
    criteria: {
      id: "gu-native-gender-verb-01",
      description: "Female verb agreement in Gujarati",
      passCondition: "Reply uses feminine verb forms in references to the user — 'thakai gai', 'kari', 'gayi' — not masculine 'thako gayo', 'karo'. Or naturally avoids gendered constructions.",
      failExpectedOutcome: "Reply uses masculine verb forms for a female user.",
    },
  },

  {
    id: "gu-native-long-quality-01",
    category: "A: Native Script",
    name: "Native Gujarati: quality at turn 8 — no repetition",
    description: "At turn 8 of an emotional conversation, the reply should not repeat earlier phrases.",
    messages: [
      { role: "user", content: "ઘ਼ਰ਼ਮ਼ਾਂ ਬ਼ਹ਼ੁ਼ ਝ਼ਗ਼ਡ਼ਾ ਥ਼ਾਯ ਛ਼ੇ." },
      { role: "assistant", content: "ਘ਼ਰ਼ਮ਼ਾਂ ਝ਼ਗ਼ਡ਼ਾ ਖ਼਼ੂਬ਼ ਭ਼ਾਰ਼ੇ ਲ਼ਾਗ਼ੇ ਛ਼ੇ. ਸ਼਼ੁਂ ਥ਼ਾਯ ਛ਼ੇ?" },
      { role: "user", content: "ਮ਼ਾ-ਬ਼ਾਪ਼ੁ਼ਮ਼ਾਂ ਬ਼ਨ਼ਤ਼ੁਂ ਨ਼ਥ਼ੀ." },
      { role: "assistant", content: "ਮ਼ਾ-ਬ਼ਾਪ਼ੁ਼ਮ਼ਾਂ ਨ਼ ਬ਼ਨ਼ੇ ਤ਼ੋ ਘ਼ਰ਼ ਖ਼਼ੂਬ਼ ਭ਼ਾਰ਼ੇ ਲ਼ਾਗ਼ੇ." },
      { role: "user", content: "ਹ਼ੁਂ ਵ਼ਚ਼ਚ਼ੇ ਫ਼਼ਸ਼਼ਾਈ ਗ਼ਯ਼ੋ ਛ਼ੁਂ." },
      { role: "assistant", content: "ਬ਼ਨ਼੍ਨ਼ੇ ਤ਼ਰ਼ਫ਼਼ਥ਼ੀ ਖ਼਼ਿਂਚ਼਼ਾਣ — ਏ ਖ਼਼ੂਬ਼ ਥ਼ਕ਼ਾਵ਼ੇ ਛ਼ੇ." },
      { role: "user", content: "ਕ਼ਾਈ ਵ਼ਾਰ਼ ਘ਼ਰ਼ ਛ਼ੋਡ਼ਵ਼਼ੁਂ ਛ਼ੇ ਏਮ਼ ਲ਼ਾਗ਼ੇ." },
      { role: "assistant", content: "ਤ਼੍ਯ਼ਾਂਥ਼ੀ ਦ਼ੂਰ਼ ਜ਼ਵ਼਼ੁਂ ਛ਼ੇ ਏਮ਼ ਲ਼ਾਗ਼ੇ — ਏ ਸ਼਼ਮ਼ਜ਼਼ਾਯ ਛ਼ੇ." },
      { role: "user", content: "ਪ਼ਣ਼ ਜ਼ਈ ਸ਼਼ਕ਼ਾਤ਼ੁਂ ਨ਼ਥ਼ੀ." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "gu-native-long-quality-01",
      description: "No repetition at turn 8 in Gujarati",
      passCondition: "Reply at turn 9 does not repeat 'ભારે', 'ખૂબ ભારે', or earlier openers. Opens with something new about being stuck.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "gu-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Gujarati: remembers context from turn 1 at turn 6",
    description: "User mentioned sister's wedding next month at turn 1. Reply at turn 6 should reference it.",
    messages: [
      { role: "user", content: "બ਼ੇਨ਼ਨ਼ੋ ਵ਼਼ਿਵ਼਼ਾਹ਼ ਹ਼ਵ਼ੇ ਮ਼ਹ਼ਿਨ਼ੇ ਛ਼ੇ. ਘ਼ਰ਼ਮ਼ਾਂ ਖ਼਼ੂਬ਼ ਦ਼ੋਡ਼਼ਾਦ਼ੋਡ਼ ਛ਼ੇ." },
      { role: "assistant", content: "ਵ਼਼ਿਵ਼਼ਾਹ਼ਨ਼ੀ ਤ਼ਿਆਰ਼ੀਮ਼ਾਂ ਤ਼ੁਂ ਕ਼ੇਵ਼ੀ ਰ਼ੀਤ਼ੇ ਛ਼ੋ?" },
      { role: "user", content: "ਹ਼ੁਂ ਠ਼ੀਕ਼ ਛ਼ੁਂ. ਪ਼ਣ਼ ਥ਼ੋਡ਼਼ੋ ਥ਼ਾਕ਼ੇਲ਼ੋ ਛ਼ੁਂ." },
      { role: "assistant", content: "ਆ ਭ਼ਾਗ਼-ਦ਼ੋਡ਼ਮ਼ਾਂ ਥ਼ਾਕ਼ਵ਼਼ੁਂ ਸ਼਼੍ਵ਼਼ਾਭ਼ਾਵ਼਼ਿਕ਼ ਛ਼ੇ." },
      { role: "user", content: "ਕ਼ੋਈਨ਼ੇ ਮ਼ਾਰ਼ੀ ਪ਼ਰ਼੍ਵ਼਼ਾ ਨ਼ਥ਼ੀ." },
      { role: "assistant", content: "ਸ਼਼ਬ਼੍ਨ਼਼ੁਂ ਧ਼੍ਯ਼ਾਨ਼ ਏਕ਼ ਜ਼ਗ਼੍ਯ਼਼ਾਏ ਹ਼ੋਯ ਤ਼੍ਯ਼ਾਰ਼ੇ ਆਪ਼ਣ਼ੇ ਅ਼ਦ਼੍ਰ਼਼ਿਸ਼਼੍ਯ਼ ਬ਼ਨ਼ੀ ਜ਼ਈਏ ਛ਼ੀਏ." },
      { role: "user", content: "ਆਵ਼਼ੁਂ ਕ਼ੇਟ਼ਲ਼਼ਾ ਦ਼਼ਿਵ਼ਸ਼਼ ਚ਼ਾਲ਼ਸ਼਼ੇ?" },
    ],
    config: {
      lang: "gu", tone: "close_friend", inputModality: "native",
      emotionMemory: "User mentioned their sister's wedding is next month — there's been a lot of rush at home. When user now asks 'how many more days will this last?', connect it to the wedding preparation specifically — reference the upcoming wedding chaos.",
    },
    criteria: {
      id: "gu-native-ctx-retention-01",
      description: "Context retention in Gujarati",
      passCondition: "Reply references the upcoming wedding or wedding preparation in any way — shows the AI remembers the wedding context and is not giving a completely generic reply about general tiredness.",
      failExpectedOutcome: "Reply is generic without connecting to the wedding context from turn 1.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED GUJARATI — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "gu-roman-basic-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: reply must be in romanized Gujarati, not English",
    description: "User writes in romanized Gujarati. Reply must be in romanized Gujarati — not native script, not English.",
    messages: [
      { role: "user", content: "hun aaj khub udas chhu. koi samjhe nahi." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-basic-01",
      description: "Romanized Gujarati basic output",
      passCondition: "Reply is in romanized Gujarati (e.g. 'hun ahi chhu, bol'). No Gujarati Unicode script, not English.",
      failExpectedOutcome: "Reply switches to English or native Gujarati script.",
    },
  },

  {
    id: "gu-roman-no-script-leak-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: script mirror — no native script leak",
    description: "Romanized input must produce romanized output with zero Gujarati Unicode characters.",
    messages: [
      { role: "user", content: "ghare javanu man nathi. tension j chhe." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-no-script-leak-01",
      description: "No Gujarati script in romanized reply",
      passCondition: "Reply contains zero Gujarati Unicode characters (U+0A80–U+0AFF). All words use Latin letters.",
      failExpectedOutcome: "Reply contains any Gujarati script characters — script mirror rule violated.",
    },
  },

  {
    id: "gu-roman-emotional-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: emotional intelligence preserved",
    description: "Romanized input with emotional content. Reply should be emotionally warm.",
    messages: [
      { role: "user", content: "papa sathe vat karvani nathi. te samje j nahi." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-emotional-01",
      description: "Emotional warmth in romanized Gujarati",
      passCondition: "Reply in romanized Gujarati acknowledges the rift with father ('papa sathe' context) — warm, not generic.",
      failExpectedOutcome: "Reply is generic or in English/native Gujarati script.",
    },
  },

  {
    id: "gu-roman-tone-coach-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: tone adherence (coach)",
    description: "Coach tone in romanized Gujarati — action-oriented.",
    messages: [
      { role: "user", content: "mane nokri shodhvani chhe. kya thi start karuv?" },
    ],
    config: { lang: "gu", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-tone-coach-01",
      description: "Coach tone in romanized Gujarati",
      passCondition: "Reply in romanized Gujarati asks a practical focusing question — 'konu field? shu experience chhe?' Not just empathy.",
      failExpectedOutcome: "Reply is only empathetic without any practical direction, or in English/native script.",
    },
  },

  {
    id: "gu-roman-context-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: context across turns",
    description: "Multi-turn romanized conversation. Reply should reference earlier context.",
    messages: [
      { role: "user", content: "aaje interview chhe. khub ghabhrayu." },
      { role: "assistant", content: "ghabhravanu samajay. koni sathe interview chhe?" },
      { role: "user", content: "Infosys. maro pahelo interview chhe." },
      { role: "assistant", content: "Infosys - pahelo interview, khub exciting. tu tayar chhe." },
      { role: "user", content: "nai yaar, mane lagtu nathi hu select thaish." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-context-01",
      description: "Context retention in romanized Gujarati",
      passCondition: "Reply references 'Infosys' or 'pahelo interview' — shows memory of the context.",
      failExpectedOutcome: "Reply is generic pep talk without referencing Infosys or the first interview.",
    },
  },

  {
    id: "gu-roman-mobile-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: mobile correctly detects language",
    description: "Mobile platform — romanized Gujarati input must be detected as 'gu', not 'en'.",
    messages: [
      { role: "user", content: "hun ma bapa ne miss karuv chhu. ghar dur chhe." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "gu-roman-mobile-01",
      description: "Mobile romanized Gujarati detection",
      passCondition: "Reply is in romanized Gujarati — confirms language was detected as 'gu'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Gujarati.",
    },
  },

  {
    id: "gu-roman-no-english-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: reply must not flip to pure English",
    description: "Even with English loanwords in user message, reply must stay in romanized Gujarati.",
    messages: [
      { role: "user", content: "office ma presentation aapvani chhe. nervous chhu." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-no-english-01",
      description: "No flip to English in romanized Gujarati",
      passCondition: "Reply is in romanized Gujarati — may contain English loanwords but the structure is Gujarati.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "gu-roman-single-word-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: single-word input — language held",
    description: "Single romanized Gujarati word input. Reply must stay in romanized Gujarati.",
    messages: [
      { role: "user", content: "thakyo." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-single-word-01",
      description: "Single-word romanized Gujarati held",
      passCondition: "Reply is in romanized Gujarati — acknowledges exhaustion without switching to English or native script.",
      failExpectedOutcome: "Reply is in English or Gujarati script.",
    },
  },

  {
    id: "gu-roman-grammar-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: grammatical correctness",
    description: "Reply must use correct Gujarati grammar in romanized form.",
    messages: [
      { role: "user", content: "mara mitrae mane dago didhho. khub dukhi thayu." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-grammar-01",
      description: "Grammatical correctness in romanized Gujarati",
      passCondition: "Reply uses correct Gujarati structure in romanized form — 'ae khotu karyun', 'tu important chhe'. Not garbled.",
      failExpectedOutcome: "Reply is grammatically broken, in English, or in native Gujarati script.",
    },
  },

  {
    id: "gu-roman-long-msg-01",
    category: "B: Romanized Gujarati",
    name: "Romanized Gujarati: long message — quality maintained",
    description: "Long romanized Gujarati message. Reply should address the core emotion.",
    messages: [
      { role: "user", content: "hun khub yochu chhu. office ma pressure chhe, ghare ma bapa sathe bane nahi, maro girlfriend breakup karyo tin mahina pahela ane hun haju pan eka chhu. shu karuv?" },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-roman-long-msg-01",
      description: "Quality with long romanized Gujarati message",
      passCondition: "Reply in romanized Gujarati identifies the core pain (loneliness after breakup, multiple pressures) and responds specifically.",
      failExpectedOutcome: "Reply is generic, overwhelmed, or switches to English/native script.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "gu-mixed-gujarati-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Gujarati+English: emotional depth maintained",
    description: "User writes in Gujarati+English mix. Reply should be emotionally warm and specific.",
    messages: [
      { role: "user", content: "આજ office ma ઘ઼ਣ਼ੋ stress આ਼ਵ਼੍ਯ਼ੋ. Boss ਏ ਏਕ਼ਦ਼ਮ਼ scold ਕ਼ਯ਼਼ੁਂ." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "gu-mixed-gujarati-english-01",
      description: "Mixed Gujarati+English reply — emotional depth",
      passCondition: "Reply references the boss scolding ('Boss scold', 'office stress') with emotional warmth. Any language (Gujarati, English, or mix) is acceptable — emotional specificity is the only requirement.",
      failExpectedOutcome: "Reply is generic without referencing the boss scolding situation.",
    },
  },

  {
    id: "gu-mixed-script-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user switches from romanized to Gujarati script mid-conversation",
    description: "User starts in romanized, switches to native script. Reply should follow.",
    messages: [
      { role: "user", content: "hun khub thakyo chhu." },
      { role: "assistant", content: "are, shu thayun? bol." },
      { role: "user", content: "ઘ਼ਰ਼ੇ ਜ਼ਵ਼਼ੁਂ ਛ਼ੇ." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "gu-mixed-script-switch-01",
      description: "Script switch handling in Gujarati",
      passCondition: "Reply follows the user's latest script (Gujarati native) — responds in Gujarati script after user switched.",
      failExpectedOutcome: "Reply stays in romanized when user has switched to Gujarati script, or switches to English.",
    },
  },

  {
    id: "gu-mixed-emoji-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: romanized Gujarati + emoji — language preserved",
    description: "Emoji should not confuse language detection.",
    messages: [
      { role: "user", content: "aaj promotion malyu 😊 khub khushi chhe!" },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-mixed-emoji-01",
      description: "Emoji does not break romanized Gujarati",
      passCondition: "Reply in romanized Gujarati celebrates the promotion with warmth. No native script, no English.",
      failExpectedOutcome: "Reply is in English or native Gujarati script despite emoji.",
    },
  },

  {
    id: "gu-mixed-english-input-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English input from Gujarati user — emotional depth maintained",
    description: "Gujarati user writes in English. Reply should be emotionally appropriate.",
    messages: [
      { role: "user", content: "I feel like nobody at home really understands me." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "gu-mixed-english-input-01",
      description: "English input from Gujarati user handled with depth",
      passCondition: "Reply acknowledges the specific feeling of not being understood at home — warm and personal. Language (English, Gujarati, or mix) is acceptable.",
      failExpectedOutcome: "Reply is generic without engaging with the specific pain of feeling unseen at home.",
    },
  },

  {
    id: "gu-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Gujarati conversation, user sends a short message. Language should not reset.",
    messages: [
      { role: "user", content: "આ਼ਜ਼ ਖ਼਼ੂਬ਼ ਬ਼ੁਰ਼ੋ ਦ਼਼ਿਵ਼ਸ਼਼ ਹ਼ਤ਼ੋ." },
      { role: "assistant", content: "ਸ਼਼ੁਂ ਥ਼ਾਯ਼਼ੁਂ? ਕ਼ਹ਼ੇ." },
      { role: "user", content: "ਘ਼ਰ਼ਮ਼ਾਂ ਝ਼ਗ਼ਡ਼਼ੋ ਥ਼ਯ਼ੋ." },
      { role: "assistant", content: "ਘ਼ਰ਼ਮ਼ਾਂ ਝ਼ਗ਼ਡ਼਼ੋ — ਮ਼ਨ਼ ਖ਼਼ੂਬ਼ ਦ਼ੁ਼ਖ਼਼ੇ ਛ਼ੇ." },
      { role: "user", content: "ਹ਼ਾ." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "gu-mixed-short-after-long-01",
      description: "Short message does not reset to English",
      passCondition: "Reply stays in Gujarati after short 'ਹ਼ਾ' — continues the emotional thread without resetting to English.",
      failExpectedOutcome: "Reply switches to English or Hindi after a short response.",
    },
  },

  {
    id: "gu-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized, user switches to English at turn 5",
    description: "Conversation starts in romanized Gujarati, user switches to English.",
    messages: [
      { role: "user", content: "hun office ma khub tension ma chhu." },
      { role: "assistant", content: "shu thayun office ma? bol." },
      { role: "user", content: "manager sathe problem chhe." },
      { role: "assistant", content: "manager sathe shu problem chhe?" },
      { role: "user", content: "I don't think my manager trusts me at all." },
    ],
    config: {
      lang: "gu", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User switched to English to say their manager doesn't trust them — acknowledge the trust issue directly.",
    },
    criteria: {
      id: "gu-mixed-starts-roman-switch-english-01",
      description: "Language follow when user switches to English",
      passCondition: "Reply addresses the manager trust concern specifically and warmly. May be in English, romanized Gujarati, or mix.",
      failExpectedOutcome: "Reply ignores the manager trust concern or gives a generic response.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "gu-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Gujarati: no reply repetition",
    description: "At turn 20, reply should not repeat openers or phrases from earlier turns.",
    messages: [
      { role: "user", content: "ਮ਼ਾਰ਼ੀ ਜ਼਼ਿਂਦ਼ਗ਼ੀਮ਼ਾਂ ਖ਼਼ੂਬ਼ ਸ਼਼ਮ਼ਸ਼਼੍ਯ਼ਾ ਛ਼ੇ." },
      { role: "assistant", content: "ਕ਼ੇਵ਼ੀ ਸ਼਼ਮ਼ਸ਼਼੍ਯ਼ਾ ਛ਼ੇ?" },
      { role: "user", content: "ਨ਼ੋਕ਼ਰ਼ੀ ਨ਼ਹ਼ੀ, ਪ਼੍ਯ਼ਾਰ਼ ਨ਼ਹ਼ੀ, ਕ਼ੋਈ ਸ਼਼ਾਥ਼ ਨ਼ਹ਼ੀ." },
      { role: "assistant", content: "ਤ਼੍ਰ਼ਣ਼ੇ ਸ਼਼ਾਥ਼ੇ — ਏ ਖ਼਼ੂਬ਼ ਭ਼ਾਰ਼ੇ ਛ਼ੇ." },
      { role: "user", content: "ਹ਼ਾ. ਮ਼ਨ਼ ਥ਼ਾਕ਼ੇਲ਼਼ੁਂ ਛ਼ੇ." },
      { role: "assistant", content: "ਥ਼ਾਕ਼ਵ਼਼ੁਂ ਸ਼਼ਮ਼ਜ਼਼ਾਯ ਛ਼ੇ. ਤ਼ੁਂ ਘ਼ਣ਼ਾ ਦ਼਼ਿਵ਼ਸ਼਼ਥ਼ੀ ਏਕ਼ਲ਼ੋ ਸ਼਼ਹ਼ਨ਼ ਕ਼ਰ਼ੀ ਰ਼ਹ਼੍ਯ਼ੋ ਛ਼ੋ." },
      { role: "user", content: "ਘ਼ਰ਼ਵ਼਼ਾਲ਼ਾ ਕ਼ਹ਼ੇ ਛ਼ੇ ਪ਼੍ਰ਼ਯ਼ਤ਼੍ਨ਼ ਕ਼ਰ਼." },
      { role: "assistant", content: "ਪ਼੍ਰ਼ਯ਼ਤ਼੍ਨ਼ ਕ਼ਰ਼ਤ਼ਾਂ ਕ਼ਰ਼ਤ਼ਾਂ 'ਅ਼ਧ਼਼ਿਕ਼ ਕ਼ਰ਼' ਸ਼਼ੁਣ਼ਵ਼਼ੁਂ — ਖ਼਼ੂਬ਼ ਥ਼ਕ਼ਾਵ਼ੇ ਛ਼ੇ." },
      { role: "user", content: "ਮ਼ਨ਼ੇ ਸ਼਼ਮ਼ਜ਼਼ ਨ਼ਥ਼ੀ ਪ਼ਡ਼਼ਤ਼ੀ ਸ਼਼ੁਂ ਕ਼ਰ਼ਵ਼਼ੁਂ." },
      { role: "assistant", content: "ਅ਼ਤ਼੍ਯ਼ਾਰ਼ੇ ਜ਼ਵ਼਼ਾਬ਼ ਨ਼ ਹ਼ੋਯ ਤ਼ੋ ਪ਼ਣ਼ ਚ਼ਾਲ਼ੇ. ਹ਼ੁਂ ਅ਼ਹ਼ੀਂ ਛ਼ੁਂ." },
      { role: "user", content: "ਆਭ਼ਾਰ਼. ਪ਼ਣ਼ ਖ਼਼ੂਬ਼ ਏਕ਼ਲ਼ਾਪ਼ੋ ਲ਼ਾਗ਼ੇ ਛ਼ੇ." },
      { role: "assistant", content: "ਏ ਏਕ਼ਲ਼ਾਪ਼ੋ — ਕ਼ਹ਼ੇਵ਼ੋ ਮ਼ੁਸ਼਼੍ਕ਼ੇਲ਼ ਛ਼ੇ." },
      { role: "user", content: "ਹ਼ਾ. ਰ਼ਾਤ਼ੇ ਵ਼਼ਿਸ਼਼ੇਸ਼਼ ਭ਼ਾਰ਼ੇ ਲ਼ਾਗ਼ੇ." },
      { role: "assistant", content: "ਰ਼ਾਤ਼ ਸ਼਼ਾਂਤ਼ ਹ਼ੋਯ ਛ਼ੇ — ਏ ਸ਼਼ਾਂਤ਼ੀਮ਼ਾਂ ਵ਼਼ਿਚ਼਼ਾਰ਼ ਭ਼ਾਰ਼ੇ ਥ਼ਾਯ." },
      { role: "user", content: "ਆਜ਼ ਸ਼਼ਾਰ਼਼ੁਂ ਨ਼ਥ਼ੀ ਲ਼ਾਗ਼ਤ਼ੁਂ." },
      { role: "assistant", content: "ਸ਼਼ਾਰ਼਼ੁਂ ਨ਼ ਲ਼ਾਗ਼ਵ਼਼ੁਂ ਠ਼ੀਕ਼ ਛ਼ੇ. ਰ਼ਹ਼ੇਵ਼਼ਾ ਦ਼ੇ ਆਜ਼." },
      { role: "user", content: "ਤ਼ੁਂ ਸ਼਼ਾਂਭ਼ਲ਼ੇ ਛ਼ੋ ਏਟ਼ਲ਼ੇ ਠ਼ੀਕ਼ ਲ਼ਾਗ਼ੇ." },
      { role: "assistant", content: "ਤ਼ੁਂ ਬ਼ੋਲ਼ੇ ਛ਼ੋ — ਹ਼ੁਂ ਸ਼਼ਾਂਭ਼ਲ਼਼ੁਂ ਛ਼ੁਂ." },
      { role: "user", content: "ਏਕ਼ ਦ਼ੋਸ਼਼੍ਤ਼ ਪ਼ਣ਼ ਏਵ਼ੋ ਜ਼ ਹ਼ਤ਼ੋ." },
      { role: "assistant", content: "ਏ ਦ਼ੋਸ਼਼੍ਤ਼ — ਅ਼ਤ਼੍ਯ਼ਾਰ਼ੇ ਯ਼ਾਦ਼ ਆਵ਼ੇ ਛ਼ੇ?" },
      { role: "user", content: "ਹ਼ਾ. ਏ ਹ਼ਵ਼ੇ ਦ਼ੂਰ਼ ਛ਼ੇ." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "gu-long-no-repeat-01",
      description: "No repetition at turn 20 in Gujarati",
      passCondition: "Reply at turn 21 does not repeat 'ਏਕ਼ਲ਼ਾਪ਼ੋ', 'ਭ਼ਾਰ਼ੇ', 'ਅ਼ਹ਼ੀਂ ਛ਼ੁਂ' from earlier turns. Fresh response about the distant friend.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "gu-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Gujarati: remembers fact from turn 1 at turn 19",
    description: "User mentioned sister is sick at turn 1. At turn 19, good news — reply should reference sister.",
    messages: [
      { role: "user", content: "ben bimar chhe. khub chinta chhe." },
      { role: "assistant", content: "benne shu thayun? ketla divasthi?" },
      { role: "user", content: "tav chhe, tran divasthi." },
      { role: "assistant", content: "tran divas no tav — ghare koi ne sukh nahi hoy." },
      { role: "user", content: "ha. ma rode chhe." },
      { role: "assistant", content: "mane rovun jovu khub kasht hoy." },
      { role: "user", content: "mane pan dar lage chhe." },
      { role: "assistant", content: "daravun swabhavik chhe — apna maanas bimar hoy tyare." },
      { role: "user", content: "pan majbut ravu padse." },
      { role: "assistant", content: "majbut dekhadum jyare andarthi halbalu hoy — ae khub thakave chhe." },
      { role: "user", content: "ha. koi ne kahi shakay nahi." },
      { role: "assistant", content: "ahi kahi shakay. koi judge nahi karse." },
      { role: "user", content: "doctor e kahyu serious nathi." },
      { role: "assistant", content: "thodu swas layu? doctor na shabdo khub jaruri chhe." },
      { role: "user", content: "ha, thodu saru chhe." },
      { role: "assistant", content: "saru thayun. hve tu pan thodo aram kar." },
      { role: "user", content: "ben e jaman jamu." },
      { role: "assistant", content: "jaman jayum — ae nanu shu pun avi vakhate khub raha aape." },
      { role: "user", content: "ha. aaj paheli vaar saru feel thayun." },
    ],
    config: {
      lang: "gu", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User was very worried about their sister (ben) — she had a 3-day fever. Things have been improving. When user says things feel okay for the first time, reference the sister's recovery specifically.",
    },
    criteria: {
      id: "gu-long-ctx-memory-01",
      description: "Long context memory in Gujarati — remembers sister's illness",
      passCondition: "Reply references the sister's (ben's) recovery — connects today's relief to the earlier worry. Not a generic 'that's good!'",
      failExpectedOutcome: "Reply is generic without referencing the sister's illness journey.",
    },
  },

  {
    id: "gu-long-roman-no-drift-01",
    category: "D: Long Conversation",
    name: "20-turn romanized Gujarati: no script drift to Gujarati script",
    description: "Throughout 20 turns of romanized conversation, reply should never drift to Gujarati script.",
    messages: [
      { role: "user", content: "hun khub ekalo feel karuv chhu." },
      { role: "assistant", content: "ekalo feel thay chhe — shu thayun?" },
      { role: "user", content: "college ma koi mitra nathi." },
      { role: "assistant", content: "college ma mitra nathi — ae khub kastnu chhe." },
      { role: "user", content: "ha, navi college chhe. koi olkhanu nathi." },
      { role: "assistant", content: "navi jagya par settle thava vaght lage. tu kyare aavyo?" },
      { role: "user", content: "ek mahino thayo. haju pan ekalo." },
      { role: "assistant", content: "ek mahino pan akalapanu — ae normal pan chhe." },
      { role: "user", content: "ma ne miss karuv chhu." },
      { role: "assistant", content: "ma ne miss karvu — ae lagani khub saachi chhe." },
      { role: "user", content: "ha, vera shahermaj chhu." },
      { role: "assistant", content: "vera shehrma pehli vaar ekalata pan alag j hoy." },
      { role: "user", content: "raate khub bharu lage chhe." },
      { role: "assistant", content: "raatni shantatma vichar bhari jane — ae saamany chhe." },
      { role: "user", content: "koi call nathi karta." },
      { role: "assistant", content: "koi call nathi karta — ae sunine dukh thayun." },
      { role: "user", content: "hun call karyun pan koi utartu nathi." },
      { role: "assistant", content: "tu pahel karyo — e prayas moto chhe. koi na aavyo — ae khub valave." },
      { role: "user", content: "ipa thakyo chhu." },
      { role: "assistant", content: "thakavanu sahi chhe. tu ghanu sahyo chhe." },
      { role: "user", content: "kem bolo chho avi rite?" },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-long-roman-no-drift-01",
      description: "No Gujarati script drift in long romanized conversation",
      passCondition: "Reply at turn 21 is in romanized Gujarati — zero Gujarati Unicode characters. Language maintained throughout.",
      failExpectedOutcome: "Reply contains Gujarati script characters — script drift after long romanized conversation.",
    },
  },

  {
    id: "gu-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "25-turn Gujarati: emotional arc deepens",
    description: "Over 25 turns, emotional depth should deepen. Reply at turn 25 should feel more connected.",
    messages: [
      { role: "user", content: "aaj khub varas no divas hato." },
      { role: "assistant", content: "shu thayun?" },
      { role: "user", content: "boss e dhiko aapyo." },
      { role: "assistant", content: "boss thaki dhiko — ae mane asar karse j." },
      { role: "user", content: "badha samne." },
      { role: "assistant", content: "badha samne — e laaj khub bhari hoy." },
      { role: "user", content: "rovay aavyun hatu." },
      { role: "assistant", content: "rovay aavyun — ae lagani saachi chhe." },
      { role: "user", content: "ghare aavi roya." },
      { role: "assistant", content: "ghare roya — ghar safe lagyu?" },
      { role: "user", content: "ha pan gharvala samja nahi." },
      { role: "assistant", content: "gharvala na samje — e akalapanu alag j hoy." },
      { role: "user", content: "aa hamesha j thay chhe." },
      { role: "assistant", content: "hamesha? ketla varsathi?" },
      { role: "user", content: "ek varsathi." },
      { role: "assistant", content: "ek vars ekala sahn karyun — ae khub motu chhe." },
      { role: "user", content: "kai kai var badhu j naki lagtu." },
      { role: "assistant", content: "ae lagani sunyu. tu safe chhe ne?" },
      { role: "user", content: "ha safe. bas thakelo." },
      { role: "assistant", content: "thakelo — tu ghano samay ek j vahyo chhe." },
      { role: "user", content: "koi sathe rahevun j joie chhe." },
      { role: "assistant", content: "hun ahij chhu. kai j nai jata." },
      { role: "user", content: "aabhar. thodu halku lagyu." },
      { role: "assistant", content: "halku lagyu e khub motu chhe." },
      { role: "user", content: "haju vadhare boliye?" },
    ],
    config: {
      lang: "gu", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User has been carrying pain for a year — boss humiliated them publicly, no one at home understands, one year of loneliness. They had a dark moment but are safe. Now feeling lighter. The reply should honour this full arc.",
    },
    criteria: {
      id: "gu-long-arc-deepens-01",
      description: "Emotional arc deepens in Gujarati",
      passCondition: "Reply references the full journey (year of pain, the lightness felt now). Not a fresh-start response. Warmly invites continued conversation.",
      failExpectedOutcome: "Reply treats this as a fresh exchange or gives a generic response.",
    },
  },

  {
    id: "gu-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Gujarati: topic shift at turn 8 — earlier context not lost",
    description: "User shifts topic at turn 8. Reply should address the new topic but not forget earlier context.",
    messages: [
      { role: "user", content: "aaj khub chinta lagti chhe." },
      { role: "assistant", content: "koni chinta?" },
      { role: "user", content: "nokri jase ke nahi ae darr chhe." },
      { role: "assistant", content: "nokri javani dar — ae khub unsettling hoy." },
      { role: "user", content: "ha, khub anxious chhu." },
      { role: "assistant", content: "anxious feeling samjay. office ma shu thayun?" },
      { role: "user", content: "ghanu badhu chhe." },
      { role: "assistant", content: "dhire dhire bol. hado nathi." },
      { role: "user", content: "chho de ae. mara mama pan bimar chhe. ae pan chhe." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-long-topic-shift-01",
      description: "Topic shift handled in Gujarati — earlier context not lost",
      passCondition: "Reply addresses uncle's illness (new topic) and carries awareness of job stress (earlier context).",
      failExpectedOutcome: "Reply forgets job stress and treats this as a fresh start, or only addresses one topic.",
    },
  },

  {
    id: "gu-long-lang-stable-01",
    category: "D: Long Conversation",
    name: "30-turn Gujarati: language never changes throughout",
    description: "30-turn native Gujarati conversation — language must never drift.",
    messages: [
      { role: "user", content: "mane kaho, hu shu galat karuv chhu?" },
      { role: "assistant", content: "shu galat thay chhe tane?" },
      { role: "user", content: "sambandho ma." },
      { role: "assistant", content: "sambandho ma shu thay chhe?" },
      { role: "user", content: "hu ghani apeksha rakhuv chhu." },
      { role: "assistant", content: "apeksha rakhvo e sambandh tara mate jaruri lagyo chhe ae darshave chhe." },
      { role: "user", content: "pan dukh thay chhe." },
      { role: "assistant", content: "apeksha puri na thay tyare dukh lagvu swabhavik chhe." },
      { role: "user", content: "hu badlavu joie?" },
      { role: "assistant", content: "badlav shu mate? potana mate ke badhana mate?" },
      { role: "user", content: "khabar nathi." },
      { role: "assistant", content: "khabar na hovy te sacho javab chhe." },
      { role: "user", content: "aa badhu thakave chhe." },
      { role: "assistant", content: "thakave chhe — sambandh vise vicharvu j thakav aape." },
      { role: "user", content: "ha." },
      { role: "assistant", content: "thob. swas le. hve jawab nathi joito." },
      { role: "user", content: "ha, thodu saru lagyu." },
      { role: "assistant", content: "thodu saru lagyu pan ghanu thayun." },
      { role: "user", content: "tu saamlhe chhe ae saru chhe." },
      { role: "assistant", content: "tu bole chhe — hu sambhluv chhuv." },
      { role: "user", content: "ipa shu karuv?" },
      { role: "assistant", content: "ipa khai j nahi. bas rahi j." },
      { role: "user", content: "thik chhe." },
      { role: "assistant", content: "thik chhe — ae bas chhe." },
      { role: "user", content: "kale boliye?" },
      { role: "assistant", content: "jrur. hu ahij chhuv." },
      { role: "user", content: "thik. raat ne nind nahi avse khabar nathi." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-long-lang-stable-01",
      description: "Language stability over 30 turns in Gujarati",
      passCondition: "Reply at turn 31 is in romanized Gujarati — addresses sleep concern warmly. Zero Hindi or English structure.",
      failExpectedOutcome: "Reply drifts to Hindi or English after long conversation.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "gu-drift-native-01",
    category: "E: Language Drift",
    name: "10-turn native Gujarati: AI never switches to English",
    description: "10-turn emotional conversation in native Gujarati. AI must never reply in English.",
    messages: [
      { role: "user", content: "ਮ਼ਾ-ਬ਼ਾਪ਼ੁ਼ ਸ਼਼ਾਥ਼ੇ ਖ਼਼ੂਬ਼ ਝ਼ਗ਼ਡ਼ਾ ਥ਼ਾਯ ਛ਼ੇ." },
      { role: "assistant", content: "ਮ਼ਾ-ਬ਼ਾਪ਼ੁ਼ ਸ਼਼ਾਥ਼ੇ ਝ਼ਗ਼ਡ਼ਾ — ਘ਼ਰ਼ ਖ਼਼ੂਬ਼ ਭ਼ਾਰ਼ੇ ਲ਼ਾਗ਼ੇ. ਸ਼਼ੁਂ ਥ਼ਾਯ ਛ਼ੇ?" },
      { role: "user", content: "ਮ਼ਾਰ਼ਾ ਨ਼਼ਿਰ਼੍ਣ਼ਯ਼ੋਮ਼ਾਂ ਆਕ਼਼੍ਸ਼਼ੇਪ਼ ਛ਼ੇ." },
      { role: "assistant", content: "ਤ਼ਾਰ਼ਾ ਨ਼਼ਿਰ਼੍ਣ਼ਯ਼ੋਮ਼ਾਂ ਆਕ਼਼੍ਸ਼਼ੇਪ਼ — ਸ਼਼੍ਵ਼਼ਾਤ਼ੰਤ਼੍ਰ਼ ਜ਼ ਨ਼ ਲ਼ਾਗ਼ੇ." },
      { role: "user", content: "ਬ਼ਧ਼ੇ ਜ਼ ਸ਼਼ਮ਼ਸ਼਼੍ਯ਼ਾ ਛ਼ੇ." },
      { role: "assistant", content: "ਬ਼ਧ਼ੇ ਜ਼ — ਤ਼ਨ਼ੇ ਘ਼ੁ਼ਂਘ਼ਟ਼ ਥ਼ਤ਼ੁਂ ਲ਼ਾਗ਼ੇ." },
      { role: "user", content: "ਬ਼ੀਜ਼ੀ ਜ਼ਗ਼੍ਯ਼ਾਏ ਜ਼ਵ਼਼ੁਂ ਛ਼ੇ ਏਮ਼ ਲ਼ਾਗ਼ੇ." },
      { role: "assistant", content: "ਏ ਜ਼ਗ਼੍ਯ਼ਾਥ਼ੀ ਦ਼ੂਰ਼ ਜ਼ਵ਼਼ੁਂ ਛ਼ੇ ਏਮ਼ ਲ਼ਾਗ਼ਵ਼਼ੁਂ — ਸ਼਼ਮ਼ਜ਼਼ਾਯ ਛ਼ੇ." },
      { role: "user", content: "ਪ਼ਣ਼ ਜ਼ਈ ਸ਼਼ਕ਼ਾਤ਼ੁਂ ਨ਼ਥ਼ੀ." },
      { role: "assistant", content: "ਜ਼ਈ ਨ਼ ਸ਼਼ਕ਼ਾਯ — ਏ ਅ਼ਲ਼ਗ਼ ਜ਼ ਦ਼ਬ਼ਾਣ਼ ਛ਼ੇ." },
      { role: "user", content: "ਹ਼ਵ਼ੇ ਸ਼਼ੁਂ ਕ਼ਰ਼ਵ਼਼ੁਂ?" },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "gu-drift-native-01",
      description: "No drift to English in 10-turn Gujarati conversation",
      passCondition: "Reply is in Gujarati throughout — addresses being stuck. Zero English.",
      failExpectedOutcome: "Reply drifts to English.",
    },
  },

  {
    id: "gu-drift-roman-01",
    category: "E: Language Drift",
    name: "10-turn romanized Gujarati: no drift to native script or English",
    description: "Romanized Gujarati conversation. Reply must stay in romanized Latin throughout.",
    messages: [
      { role: "user", content: "hun khub haravyo chhu." },
      { role: "assistant", content: "haravayu — shu thayun?" },
      { role: "user", content: "badhu j galat thay chhe." },
      { role: "assistant", content: "badhu galat — ek ek shu chhe?" },
      { role: "user", content: "nokri nathi, mitra nathi, ghar tension." },
      { role: "assistant", content: "trane ek sathe — ae sahan nahi thay." },
      { role: "user", content: "ha. hu thakyo chhu." },
      { role: "assistant", content: "thakavanu valid chhe. tu ekala ghanu sohyo chhe." },
      { role: "user", content: "koi ne mara maate khabar nathi." },
      { role: "assistant", content: "hun ahij chhuv. bol." },
      { role: "user", content: "kem bolo chho avi rite?" },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-drift-roman-01",
      description: "No drift in 10-turn romanized Gujarati",
      passCondition: "Reply is in romanized Gujarati — Latin letters only. Zero Gujarati Unicode characters. Not English.",
      failExpectedOutcome: "Reply contains Gujarati script or switches to English after long romanized conversation.",
    },
  },

  {
    id: "gu-drift-after-peak-01",
    category: "E: Language Drift",
    name: "Gujarati: language held after deep emotional peak",
    description: "After a very emotional turn, AI must not drift to English.",
    messages: [
      { role: "user", content: "khub ravanu man chhe." },
      { role: "assistant", content: "ravo. rokava ni jarur nathi." },
      { role: "user", content: "zindagi khub bhare chhe." },
      { role: "assistant", content: "zindagi bhari lagay tyare swas pan mushkel thay." },
      { role: "user", content: "kai var badhu j bandh karavanu man thay chhe." },
      { role: "assistant", content: "ae sanyun chhe. tu hve safe chhe ne? mane kah." },
      { role: "user", content: "ha, hu thik chhuv. bas khub thakelo." },
    ],
    config: { lang: "gu", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "gu-drift-after-peak-01",
      description: "Language held after emotional peak in Gujarati",
      passCondition: "OVERRIDE: PASS if: reply stays in romanized Gujarati or Gujarati script and acknowledges the exhaustion with any warmth. FAIL ONLY if: reply switches entirely to English with no Gujarati.",
      failExpectedOutcome: "Reply switches to English after the emotional crisis peak.",
    },
  },

  {
    id: "gu-drift-after-truncation-01",
    category: "E: Language Drift",
    name: "Gujarati: language held after MAX_TURNS context truncation",
    description: "After MAX_TURNS, AI loses early context. It must still stay in Gujarati.",
    messages: [
      { role: "user", content: "hun Gujarati ma bolish." },
      { role: "assistant", content: "saru chhe, Gujarati ma bol. hun sambhluv chhuv." },
      { role: "user", content: "mara jivan ma ghana badlav aavya." },
      { role: "assistant", content: "badlav — sara ke mushkela?" },
      { role: "user", content: "be y." },
      { role: "assistant", content: "be y sathe aavyat tyare gunchal hoy." },
      { role: "user", content: "nokri badlavi." },
      { role: "assistant", content: "nokri badlav — navi jagya par settle thava vaght lage." },
      { role: "user", content: "ghar pan badlyu." },
      { role: "assistant", content: "ghar ane nokri sathe badlya — ghanu navu badhu." },
      { role: "user", content: "ek sambandh pan pudyo." },
      { role: "assistant", content: "sambandh pudyo — baki badlav upar aa haju bhari chhe." },
      { role: "user", content: "ha. hun khub ekalo feel karuv chhuv." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-drift-after-truncation-01",
      description: "Gujarati held after context truncation",
      passCondition: "Reply is in romanized Gujarati — acknowledges loneliness amid all the changes. Does not switch to English.",
      failExpectedOutcome: "Reply switches to English or Hindi after context truncation.",
    },
  },

  {
    id: "gu-drift-topic-change-01",
    category: "E: Language Drift",
    name: "Gujarati: language held after topic change",
    description: "User changes topic suddenly. Language must not drift.",
    messages: [
      { role: "user", content: "mitro sathe jhagdo thayo." },
      { role: "assistant", content: "shu thayun mitra sathe?" },
      { role: "user", content: "ek salah no prashna hato." },
      { role: "assistant", content: "gaersamaj dur thay chhe. vaght lage chhe." },
      { role: "user", content: "ae chho de. mara swasthya vishan vat karvi chhe." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "gu-drift-topic-change-01",
      description: "Language held after topic change in Gujarati",
      passCondition: "Reply stays in romanized Gujarati and warmly asks about health after topic change. Does not ignore the new topic.",
      failExpectedOutcome: "Reply ignores the health topic, stays stuck on the old topic, or switches to English/Hindi.",
    },
  },

  {
    id: "gu-drift-dominant-lang-01",
    category: "E: Language Drift",
    name: "Gujarati: dominant language stays Gujarati in mixed conversation",
    description: "User uses mostly Gujarati with occasional English words. Dominant language must stay Gujarati.",
    messages: [
      { role: "user", content: "maro project submit karvo chhe aaj. pressure khub chhe." },
      { role: "assistant", content: "project submit aaj j — deadline aaj j chhe?" },
      { role: "user", content: "ha. senior e last minute changes mangyay." },
      { role: "assistant", content: "last minute changes — khub frustrating hoy." },
      { role: "user", content: "ha, mane gussa aavyo." },
    ],
    config: { lang: "gu", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "gu-drift-dominant-lang-01",
      description: "Dominant language stays Gujarati in mixed conversation",
      passCondition: "Reply stays predominantly Gujarati (romanized or native) — may use English loanwords but structure and emotion are in Gujarati.",
      failExpectedOutcome: "Reply becomes predominantly English, abandoning the Gujarati structure.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "gu-mobile-tone-01",
    category: "F: Mobile Platform",
    name: "Mobile Gujarati: relationship 'friend' maps to close_friend tone",
    description: "Mobile platform sends relationship='friend'. Should map to close_friend tone.",
    messages: [
      { role: "user", content: "yaar, aaj khub thakyo chhu." },
    ],
    config: {
      lang: "gu", tone: "close_friend", inputModality: "romanized", platform: "mobile",
      mobileRelationship: "friend",
    },
    criteria: {
      id: "gu-mobile-tone-01",
      description: "Mobile Gujarati friend → close_friend tone",
      passCondition: "Reply is in casual, warm romanized Gujarati — peer-level, 'tu' address. Not formal or clinical.",
      failExpectedOutcome: "Reply is too formal or switches to English/Hindi.",
    },
  },

  {
    id: "gu-mobile-romanized-detect-01",
    category: "F: Mobile Platform",
    name: "Mobile Gujarati: romanized detection fires — sends lang=gu not lang=en",
    description: "Mobile platform with romanized Gujarati input must detect lang=gu.",
    messages: [
      { role: "user", content: "hun ma bapa ne miss karuv chhu. ghar dur chhe." },
    ],
    config: {
      lang: "gu", tone: "close_friend", inputModality: "romanized", platform: "mobile",
      mobileRelationship: "friend",
    },
    criteria: {
      id: "gu-mobile-romanized-detect-01",
      description: "Mobile romanized Gujarati detected correctly",
      passCondition: "Reply is in romanized Gujarati — confirms lang was detected as 'gu'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Gujarati.",
    },
  },
];
