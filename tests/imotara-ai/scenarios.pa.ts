/**
 * tests/imotara-ai/scenarios.pa.ts
 *
 * E2E test scenarios for Punjabi (pa) language support.
 * Categories:
 *   A: Native Script (12) — Gurmukhi script input/output
 *   B: Romanized Punjabi (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Punjabi notes:
 *  - Script: Gurmukhi (U+0A00–U+0A7F)
 *  - Address: "tu" (informal), "tussi/tusi" (polite), "aap" (formal/elder)
 *  - Gender: masculine/feminine verb agreement ("gaya"/"gayi", "kita"/"kiti")
 *  - Romanized markers: main, mera, changa, nahi, par, te, kithe, kiven, si, lagda
 */

import type { TestScenario } from "./types";

export const paScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "pa-native-lang-01",
    category: "A: Native Script",
    name: "Native Punjabi: reply must stay in Punjabi script",
    description: "User writes in Gurmukhi script. Reply must stay in Punjabi — not switch to Hindi or English.",
    messages: [
      { role: "user", content: "ਮੈਨੂੰ ਬਹੁਤ ਥਕਾਵਟ ਲੱਗੀ ਹੈ। ਕੁਝ ਸੁੱਝ ਨਹੀਂ ਰਿਹਾ।" },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pa-native-lang-01",
      description: "Language fidelity in Punjabi",
      passCondition: "Reply is in Gurmukhi Punjabi script — warm, emotionally present. Not in Hindi or English.",
      failExpectedOutcome: "Reply switches to Hindi or English instead of staying in Punjabi.",
    },
  },

  {
    id: "pa-native-ctx-01",
    category: "A: Native Script",
    name: "Native Punjabi: references the specific situation",
    description: "User shares a specific situation. Reply should reference it, not give a generic response.",
    messages: [
      { role: "user", content: "ਅੱਜ ਬੌਸ ਨੇ ਸਭ ਦੇ ਸਾਹਮਣੇ ਮੈਨੂੰ ਝਿੜਕਿਆ। ਬਹੁਤ ਬੁਰਾ ਲੱਗਿਆ।" },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was scolded by their boss in front of everyone — public humiliation. Reference this specifically.",
    },
    criteria: {
      id: "pa-native-ctx-01",
      description: "Context specificity in Punjabi",
      passCondition: "Reply references being scolded in front of everyone — not generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the specific public scolding.",
    },
  },

  {
    id: "pa-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Punjabi: close_friend tone",
    description: "close_friend tone — casual, warm, informal 'ਤੂ' address.",
    messages: [
      { role: "user", content: "ਯਾਰ, ਅੱਜ ਮਨ ਉਦਾਸ ਹੈ। ਕੁਝ ਚੰਗਾ ਨਹੀਂ ਲੱਗਿਆ।" },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pa-native-tone-friend-01",
      description: "close_friend tone in Punjabi",
      passCondition: "Reply is warm, casual, and peer-level — like talking to a close friend. Does NOT use formal address. Language stays Punjabi (not English or Hindi).",
      failExpectedOutcome: "Reply uses formal 'ਤੁਸੀਂ' or 'ਆਪ', or switches to Hindi/English.",
    },
  },

  {
    id: "pa-native-tone-calm-01",
    category: "A: Native Script",
    name: "Native Punjabi: calm_companion tone",
    description: "calm_companion tone — patient, unhurried, no pressure.",
    messages: [
      { role: "user", content: "ਮੈਨੂੰ ਕੁਝ ਸਮਝ ਨਹੀਂ ਪੈ ਰਿਹਾ। ਸਭ ਕੁਝ ਉਲਝਿਆ ਹੋਇਆ ਲੱਗਦਾ ਹੈ।" },
    ],
    config: { lang: "pa", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pa-native-tone-calm-01",
      description: "calm_companion tone in Punjabi",
      passCondition: "Reply is gentle and unhurried — acknowledges confusion without rushing to fix it. Warm and patient.",
      failExpectedOutcome: "Reply pushes for solutions or is too energetic.",
    },
  },

  {
    id: "pa-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Punjabi: coach tone",
    description: "coach tone — practical, action-oriented.",
    messages: [
      { role: "user", content: "ਕੱਲ੍ਹ ਇੰਟਰਵਿਊ ਹੈ। ਤਿਆਰੀ ਨਹੀਂ ਹੋਈ। ਡਰ ਲੱਗਦਾ ਹੈ।" },
    ],
    config: { lang: "pa", tone: "coach", inputModality: "native" },
    criteria: {
      id: "pa-native-tone-coach-01",
      description: "coach tone in Punjabi",
      passCondition: "Reply acknowledges fear briefly then asks a practical question — 'ਕਿਹੜਾ ਹਿੱਸਾ ਕਮਜ਼ੋਰ ਲੱਗਦਾ ਹੈ?' or similar. Not just soothing.",
      failExpectedOutcome: "Reply only soothes without any practical forward direction.",
    },
  },

  {
    id: "pa-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Punjabi: teen register",
    description: "Teen user — reply should use casual peer-level Punjabi, not adult counselling language.",
    messages: [
      { role: "user", content: "ਸਕੂਲ ਵਿੱਚ ਕੋਈ ਦੋਸਤ ਨਹੀਂ। ਬਹੁਤ ਇਕੱਲਾਪਣ ਮਹਿਸੂਸ ਹੁੰਦਾ ਹੈ।" },
    ],
    config: { lang: "pa", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "pa-native-age-teen-01",
      description: "Teen register in Punjabi",
      passCondition: "Reply is warm, peer-level Punjabi — acknowledges loneliness without lecturing. Casual 'ਤੂ' tone. Not preachy.",
      failExpectedOutcome: "Reply is preachy, uses adult counselling phrases, or switches to English/Hindi.",
    },
  },

  {
    id: "pa-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Punjabi: elder register",
    description: "Older adult user — reply should be warm and respectful, use 'ਤੁਸੀਂ/ਆਪ' address.",
    messages: [
      { role: "user", content: "ਉਮਰ ਹੋ ਗਈ, ਇਕੱਲਾਪਣ ਬਹੁਤ ਸਾਲਦਾ ਹੈ। ਬੱਚੇ ਸਭ ਦੂਰ ਚਲੇ ਗਏ।" },
    ],
    config: { lang: "pa", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "pa-native-age-elder-01",
      description: "Elder register in Punjabi",
      passCondition: "Reply is warm, patient, and empathetic — acknowledges the user's loneliness and missing children with genuine care. Does NOT use informal 'tu' or feel dismissive. Responds in Punjabi.",
      failExpectedOutcome: "Reply uses informal 'ਤੂ' (tu) throughout, or feels dismissive, or gives generic comfort without acknowledging the specific pain of loneliness and children being far away.",
    },
  },

  {
    id: "pa-native-emotion-sad-01",
    category: "A: Native Script",
    name: "Native Punjabi: sadness acknowledged with depth",
    description: "User shares deep grief. Reply should sit with the pain, not rush to comfort.",
    messages: [
      { role: "user", content: "ਮੇਰੇ ਦਾਦਾ ਜੀ ਚਲੇ ਗਏ। ਦਿਲ ਟੁੱਟਿਆ ਹੋਇਆ ਹੈ।" },
    ],
    config: { lang: "pa", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pa-native-emotion-sad-01",
      description: "Grief acknowledged in Punjabi",
      passCondition: "Reply acknowledges the loss of grandfather ('ਦਾਦਾ ਜੀ') with depth — sits with the pain rather than rushing to silver linings.",
      failExpectedOutcome: "Reply rushes to comfort ('ਉਹ ਬਹੁਤ ਚੰਗੇ ਸਨ, ਉਹ ਹਮੇਸ਼ਾ ਯਾਦ ਰਹਿਣਗੇ') without acknowledging grief.",
    },
  },

  {
    id: "pa-native-emotion-anxiety-01",
    category: "A: Native Script",
    name: "Native Punjabi: anxiety acknowledged specifically",
    description: "User describes anxiety symptoms. Reply should name specific symptoms back.",
    messages: [
      { role: "user", content: "ਛਾਤੀ ਵਿੱਚ ਭਾਰ ਮਹਿਸੂਸ ਹੁੰਦਾ ਹੈ, ਨੀਂਦ ਨਹੀਂ ਆਉਂਦੀ, ਖਾਣਾ ਨਹੀਂ ਖਾਧਾ।" },
    ],
    config: { lang: "pa", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pa-native-emotion-anxiety-01",
      description: "Anxiety symptoms mirrored in Punjabi",
      passCondition: "Reply names specific symptoms back — chest heaviness ('ਛਾਤੀ ਵਿੱਚ ਭਾਰ'), insomnia ('ਨੀਂਦ ਨਹੀਂ'), not eating ('ਖਾਣਾ ਨਹੀਂ'). Not generic.",
      failExpectedOutcome: "Reply is generic ('ਚਿੰਤਾ ਔਖੀ ਹੁੰਦੀ ਹੈ') without naming specific symptoms.",
    },
  },

  {
    id: "pa-native-gender-verb-01",
    category: "A: Native Script",
    name: "Native Punjabi: gendered verb forms for female user",
    description: "Female user — reply should use feminine verb forms where applicable.",
    messages: [
      { role: "user", content: "ਮੈਂ ਬਹੁਤ ਥੱਕੀ ਹੋਈ ਹਾਂ। ਸਭ ਕੁਝ ਇਕੱਲੇ ਸੰਭਾਲ ਰਹੀ ਹਾਂ।" },
    ],
    config: { lang: "pa", tone: "close_friend", userGender: "female", inputModality: "native" },
    criteria: {
      id: "pa-native-gender-verb-01",
      description: "Female verb agreement in Punjabi",
      passCondition: "Reply uses feminine verb forms — 'ਕਰ ਰਹੀ ਹੈਂ', 'ਥੱਕੀ', 'ਗਈ' — not masculine 'ਕਰ ਰਿਹਾ ਹੈਂ', 'ਥੱਕਿਆ'. Or naturally avoids gendered constructions.",
      failExpectedOutcome: "Reply uses masculine verb forms for a female user.",
    },
  },

  {
    id: "pa-native-long-quality-01",
    category: "A: Native Script",
    name: "Native Punjabi: quality at turn 8 — no repetition",
    description: "At turn 8 of an emotional conversation, the reply should not repeat earlier phrases.",
    messages: [
      { role: "user", content: "ਘਰ ਵਿੱਚ ਬਹੁਤ ਝਗੜਾ ਹੁੰਦਾ ਹੈ।" },
      { role: "assistant", content: "ਘਰ ਵਿੱਚ ਝਗੜਾ ਬਹੁਤ ਭਾਰਾ ਲੱਗਦਾ ਹੈ। ਕੀ ਹੋ ਰਿਹਾ ਹੈ?" },
      { role: "user", content: "ਮਾਂ-ਬਾਪ ਵਿੱਚ ਨਹੀਂ ਬਣਦਾ।" },
      { role: "assistant", content: "ਮਾਂ-ਬਾਪ ਦਾ ਨਾ ਬਣਨਾ ਘਰ ਨੂੰ ਬਹੁਤ ਭਾਰਾ ਕਰ ਦਿੰਦਾ ਹੈ।" },
      { role: "user", content: "ਮੈਂ ਵਿੱਚ ਫਸਿਆ ਹਾਂ।" },
      { role: "assistant", content: "ਦੋਵਾਂ ਵੱਲੋਂ ਖਿੱਚ — ਇਹ ਬਹੁਤ ਥਕਾ ਦਿੰਦਾ ਹੈ।" },
      { role: "user", content: "ਕਈ ਵਾਰ ਘਰ ਛੱਡਣਾ ਚਾਹੁੰਦਾ ਹਾਂ।" },
      { role: "assistant", content: "ਉੱਥੋਂ ਦੂਰ ਜਾਣਾ ਚਾਹੁੰਦਾ ਹੈਂ — ਇਹ ਸਮਝ ਆਉਂਦਾ ਹੈ।" },
      { role: "user", content: "ਪਰ ਜਾ ਨਹੀਂ ਸਕਦਾ।" },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pa-native-long-quality-01",
      description: "No repetition at turn 8 in Punjabi",
      passCondition: "Reply at turn 9 does not repeat 'ਭਾਰਾ', 'ਥਕਾ', or earlier openers. Opens with something new about being stuck.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "pa-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Punjabi: remembers context from turn 1 at turn 6",
    description: "User mentioned sister's engagement next month at turn 1. Reply at turn 6 should reference it.",
    messages: [
      { role: "user", content: "ਭੈਣ ਦੀ ਮੰਗਣੀ ਅਗਲੇ ਮਹੀਨੇ ਹੈ। ਘਰ ਵਿੱਚ ਬਹੁਤ ਰੌਲਾ ਹੈ।" },
      { role: "assistant", content: "ਮੰਗਣੀ ਦੀ ਤਿਆਰੀ ਵਿੱਚ ਕਿਵੇਂ ਹੈਂ?" },
      { role: "user", content: "ਮੈਂ ਠੀਕ ਹਾਂ, ਪਰ ਥੱਕਿਆ ਹੋਇਆ ਹਾਂ।" },
      { role: "assistant", content: "ਇਸ ਭੱਜ-ਦੌੜ ਵਿੱਚ ਥੱਕਣਾ ਸੁਭਾਵਿਕ ਹੈ।" },
      { role: "user", content: "ਕਿਸੇ ਨੂੰ ਮੇਰੀ ਪਰਵਾਹ ਨਹੀਂ।" },
      { role: "assistant", content: "ਸਭ ਦਾ ਧਿਆਨ ਇੱਕ ਥਾਂ ਹੋਵੇ ਤਾਂ ਅਦ੍ਰਿਸ਼ ਮਹਿਸੂਸ ਹੁੰਦਾ ਹੈ।" },
      { role: "user", content: "ਇਹ ਕਿੰਨੇ ਦਿਨ ਚੱਲੇਗਾ?" },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "native",
      emotionMemory: "User's sister has an engagement next month — there's been a lot of rush and noise at home. When user asks 'how many more days?', connect it to the upcoming engagement preparation specifically.",
    },
    criteria: {
      id: "pa-native-ctx-retention-01",
      description: "Context retention in Punjabi",
      passCondition: "Reply references the upcoming engagement or engagement preparation in any way — shows the AI remembers the context and is not giving a completely generic reply.",
      failExpectedOutcome: "Reply is generic without connecting to the engagement context from turn 1.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED PUNJABI — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "pa-roman-basic-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: reply must be in romanized Punjabi, not English",
    description: "User writes in romanized Punjabi. Reply must be in romanized Punjabi — not native script, not English.",
    messages: [
      { role: "user", content: "main aaj bahut udas haan. koi samajhda nahi." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-basic-01",
      description: "Romanized Punjabi basic output",
      passCondition: "Reply is in romanized Punjabi (e.g. 'main aithe haan, bol'). No Gurmukhi script, not English.",
      failExpectedOutcome: "Reply switches to English or native Gurmukhi script.",
    },
  },

  {
    id: "pa-roman-no-script-leak-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: script mirror — no native script leak",
    description: "User writes in romanized Punjabi. Reply must not leak Gurmukhi characters.",
    messages: [
      { role: "user", content: "mera dil nahi lagda kisi kaam vich." },
    ],
    config: { lang: "pa", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-no-script-leak-01",
      description: "No Gurmukhi script leak",
      passCondition: "Reply is entirely in romanized Punjabi. No Gurmukhi Unicode characters appear anywhere in the reply.",
      failExpectedOutcome: "Reply contains Gurmukhi script characters.",
    },
  },

  {
    id: "pa-roman-emotional-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: emotional intelligence preserved",
    description: "Romanized input should not reduce emotional depth of reply.",
    messages: [
      { role: "user", content: "meri naukri chali gayi. ghar wale bahut gusse vich ne." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-emotional-01",
      description: "Emotional depth in romanized Punjabi",
      passCondition: "Reply in romanized Punjabi acknowledges job loss AND family anger — emotionally specific, not generic.",
      failExpectedOutcome: "Reply is generic ('sab thik ho jauga') without acknowledging job loss or family reaction.",
    },
  },

  {
    id: "pa-roman-tone-coach-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: tone adherence (coach)",
    description: "Coach tone must produce a practical question in romanized Punjabi.",
    messages: [
      { role: "user", content: "kal interview hai. ready nahi haan." },
    ],
    config: { lang: "pa", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-tone-coach-01",
      description: "Coach tone in romanized Punjabi",
      passCondition: "Reply in romanized Punjabi asks a practical question — 'kaun sa topic weak lagda hai?' or similar.",
      failExpectedOutcome: "Reply only soothes in romanized Punjabi without asking a practical question.",
    },
  },

  {
    id: "pa-roman-context-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: context across turns",
    description: "AI should reference earlier details in a multi-turn romanized conversation.",
    messages: [
      { role: "user", content: "mere paaji ne mujhse bahut bura kita. dil dukha." },
      { role: "assistant", content: "paaji ne aisa kita — eh bahut dard dinda hai. ki hoya si?" },
      { role: "user", content: "usne meri baat nahi suni puri capacity vich." },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's brother (paaji) hurt them deeply — didn't listen. Reference the brother's behavior when responding.",
    },
    criteria: {
      id: "pa-roman-context-01",
      description: "Context retention in romanized Punjabi",
      passCondition: "Reply in romanized Punjabi references the paaji (brother) not listening — shows context from earlier turns.",
      failExpectedOutcome: "Reply is generic without referencing the brother or the specific hurt.",
    },
  },

  {
    id: "pa-roman-mobile-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: mobile correctly detects language",
    description: "Mobile platform should detect romanized Punjabi and send lang=pa.",
    messages: [
      { role: "user", content: "main kafi thakka hoya haan aaj." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "pa-roman-mobile-01",
      description: "Mobile romanized Punjabi detection",
      passCondition: "Reply is in romanized Punjabi — confirms language was detected as 'pa'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Punjabi.",
    },
  },

  {
    id: "pa-roman-no-english-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: reply must not flip to pure English",
    description: "Even with English loanwords in user message, reply must stay in romanized Punjabi.",
    messages: [
      { role: "user", content: "office vich presentation deni hai. nervous haan." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-no-english-01",
      description: "No flip to English in romanized Punjabi",
      passCondition: "Reply is in romanized Punjabi — may contain English loanwords but the structure is Punjabi.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "pa-roman-single-word-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: single-word input — language held",
    description: "Single romanized Punjabi word input. Reply must stay in romanized Punjabi.",
    messages: [
      { role: "user", content: "thakka." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-single-word-01",
      description: "Single-word romanized Punjabi held",
      passCondition: "Reply is in romanized Punjabi — acknowledges exhaustion without switching to English or native script.",
      failExpectedOutcome: "Reply is in English or Gurmukhi script.",
    },
  },

  {
    id: "pa-roman-grammar-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: grammatical correctness",
    description: "Reply must use correct Punjabi grammar in romanized form.",
    messages: [
      { role: "user", content: "mere dost ne mera nuksaan kita. bahut dukhi haan." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-grammar-01",
      description: "Grammatical correctness in romanized Punjabi",
      passCondition: "Reply uses correct Punjabi structure in romanized form — 'oh galat kita', 'tu important hai'. Not garbled.",
      failExpectedOutcome: "Reply is grammatically broken, in English, or in native Gurmukhi script.",
    },
  },

  {
    id: "pa-roman-long-msg-01",
    category: "B: Romanized Punjabi",
    name: "Romanized Punjabi: long message — quality maintained",
    description: "Long romanized Punjabi input should get a thoughtful reply.",
    messages: [
      { role: "user", content: "main pichle kaafi time ton struggle kar raha haan. ghar vich problems ne, kaam te pressure hai, dost vi door ho gaye ne. pata nahi kithey jaan. kaafi frustrated haan." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-roman-long-msg-01",
      description: "Quality for long romanized Punjabi message",
      passCondition: "Reply in romanized Punjabi acknowledges multiple specific struggles — home problems, work pressure, friends drifting — not just one aspect.",
      failExpectedOutcome: "Reply ignores most of the user's message and gives a generic reply.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "pa-mixed-punjabi-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Punjabi+English: emotional depth maintained",
    description: "User writes in Punjabi+English mix. Reply should be emotionally warm and specific.",
    messages: [
      { role: "user", content: "ਅੱਜ office ਵਿੱਚ ਬਹੁਤ stress ਆਇਆ। Boss ਨੇ ਇੱਕਦਮ scold ਕੀਤਾ।" },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User was scolded by their boss in the office today — stressful and humiliating. Reference the boss scolding specifically with emotional warmth.",
    },
    criteria: {
      id: "pa-mixed-punjabi-english-01",
      description: "Mixed Punjabi+English reply — emotional depth",
      passCondition: "OVERRIDE: PASS if: reply references the boss or the scolding with any warmth — in Punjabi, English, or mix. FAIL ONLY if: completely ignores the boss/scolding and gives purely generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the boss scolding situation.",
    },
  },

  {
    id: "pa-mixed-script-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user switches from romanized to Punjabi script mid-conversation",
    description: "User starts in romanized, switches to native script. Reply should follow.",
    messages: [
      { role: "user", content: "main bahut thakka hoya haan." },
      { role: "assistant", content: "are, ki hoya? bol." },
      { role: "user", content: "ਘਰ ਜਾਣਾ ਚਾਹੁੰਦਾ ਹਾਂ।" },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pa-mixed-script-switch-01",
      description: "Script switch handling in Punjabi",
      passCondition: "Reply follows the user's latest script (Gurmukhi native) — responds in Punjabi script after user switched.",
      failExpectedOutcome: "Reply stays in romanized when user has switched to Gurmukhi script, or switches to English.",
    },
  },

  {
    id: "pa-mixed-emoji-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: romanized Punjabi + emoji — language preserved",
    description: "Emoji should not confuse language detection.",
    messages: [
      { role: "user", content: "aaj promotion milya 😊 bahut khushi hai!" },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-mixed-emoji-01",
      description: "Emoji does not break romanized Punjabi",
      passCondition: "Reply in romanized Punjabi celebrates the promotion with warmth. No native script, no English.",
      failExpectedOutcome: "Reply is in English or native Gurmukhi script despite emoji.",
    },
  },

  {
    id: "pa-mixed-english-input-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English input from Punjabi user — emotional depth maintained",
    description: "Punjabi user writes in English. Reply should be emotionally appropriate.",
    messages: [
      { role: "user", content: "I feel like nobody at home really understands me." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pa-mixed-english-input-01",
      description: "English input from Punjabi user handled with depth",
      passCondition: "Reply acknowledges the specific feeling of not being understood at home — warm and personal. Language (English, Punjabi, or mix) is acceptable.",
      failExpectedOutcome: "Reply is generic without engaging with the specific pain of feeling unseen at home.",
    },
  },

  {
    id: "pa-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Punjabi conversation, user sends a short message. Language should not reset.",
    messages: [
      { role: "user", content: "ਅੱਜ ਬਹੁਤ ਮਾੜਾ ਦਿਨ ਸੀ।" },
      { role: "assistant", content: "ਕੀ ਹੋਇਆ, ਦੱਸ।" },
      { role: "user", content: "ਕੰਮ ਉੱਤੇ ਸਭ ਗੜਬੜ ਸੀ।" },
      { role: "assistant", content: "ਕੰਮ ਉੱਤੇ ਗੜਬੜ ਬਹੁਤ ਥਕਾਉਂਦੀ ਹੈ।" },
      { role: "user", content: "ਹਾਂ।" },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pa-mixed-short-after-long-01",
      description: "Short message after long conversation — language held",
      passCondition: "Reply stays in Punjabi after single-word user turn — does not switch to English or reset language.",
      failExpectedOutcome: "Reply switches to English or gives a generic reset response.",
    },
  },

  {
    id: "pa-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized, user switches to English at turn 5",
    description: "User starts in romanized Punjabi, later sends in English. Emotional continuity matters.",
    messages: [
      { role: "user", content: "main bahut tension vich haan." },
      { role: "assistant", content: "ki ho raha hai? bol mujhe." },
      { role: "user", content: "kaam te bahut pressure hai, manager te nahi chalda." },
      { role: "assistant", content: "manager naal na chalna — bahut frustrating lagda hai." },
      { role: "user", content: "I just don't trust anyone at work anymore." },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User has been under work pressure and doesn't get along with their manager. Now they've said they don't trust anyone at work. Reference the manager context.",
    },
    criteria: {
      id: "pa-mixed-starts-roman-switch-english-01",
      description: "Romanized Punjabi → English switch — emotional depth",
      passCondition: "Reply acknowledges loss of trust at work with emotional warmth — references the earlier manager tension. Language (English or mix) is acceptable.",
      failExpectedOutcome: "Reply is generic without referencing the manager situation or loss of trust.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "pa-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Punjabi: no reply repetition",
    description: "Over a 20-turn emotional Punjabi conversation, the AI should not repeat the same openers.",
    messages: [
      { role: "user", content: "main bahut thakka hoya haan." },
      { role: "assistant", content: "ki hoya hai? bol mujhe." },
      { role: "user", content: "kaam barra mushkil ho gaya hai." },
      { role: "assistant", content: "kaam da pressure barra lagda hai — ki hua?" },
      { role: "user", content: "boss bahut zyada demand karda hai." },
      { role: "assistant", content: "boss di expectations manage karna mushkil hai jado limit ton bahar hon." },
      { role: "user", content: "ghar vich vi tension hai." },
      { role: "assistant", content: "ghar te kaam dono ton khichain — eh bahut sakht hunda hai." },
      { role: "user", content: "meri wife samajhdi nahi." },
      { role: "assistant", content: "ghar vich samajh na aana — eh dard dinda hai." },
      { role: "user", content: "bachche vi mushkil kar rahe ne." },
      { role: "assistant", content: "bachchiyan di zimmedari te upar sab kuch — thakna svabhavik hai." },
      { role: "user", content: "main kya karaan?" },
      { role: "assistant", content: "ik kaam — sirf apne baare soch, aaj, abhi." },
      { role: "user", content: "par dil nahi lagda." },
      { role: "assistant", content: "jado sab ek saath ho, dil na lagna samajh aunda hai." },
      { role: "user", content: "main bahut akela mahsoos karda haan." },
      { role: "assistant", content: "akela mahsoos karna barra dard dinda hai." },
      { role: "user", content: "koi nahi samajhda mujhe." },
      { role: "assistant", content: "main sunna chahunda haan — dasso ki chal raha hai andar." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-long-no-repeat-01",
      description: "No repetition at turn 20 in Punjabi",
      passCondition: "Reply at turn 21 does not repeat 'bahut dard', 'samajh aunda', or earlier openers. Opens with something new.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "pa-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Punjabi: remembers fact from turn 1 at turn 19",
    description: "User mentioned father's illness at turn 1. By turn 19, AI should still reference it.",
    messages: [
      { role: "user", content: "pita ji di tabiyat theek nahi. doctor ne daraya hai." },
      { role: "assistant", content: "pita ji di tabiyat sunn ke dil bhaari hoya. ki keh rahe doctor?" },
      { role: "user", content: "test chal rahe ne." },
      { role: "assistant", content: "results da intezaar bada sakht hunda hai. kiven ho tusi?" },
      { role: "user", content: "ghabra raha haan." },
      { role: "assistant", content: "ghabrana svabhavik hai — pita ji baare sochke dil bhari ho janda hai." },
      { role: "user", content: "kaam vi chal raha hai saath saath." },
      { role: "assistant", content: "kaam te ghar dono ek saath — thakna lazmi hai." },
      { role: "user", content: "neend nahi aundi raat nu." },
      { role: "assistant", content: "neend na aana dassda hai andar kitna kuch chal raha hai." },
      { role: "user", content: "kal hospital jana hai." },
      { role: "assistant", content: "kal hospital — honsla rakkho, saath haan main." },
      { role: "user", content: "results aaunge kal." },
      { role: "assistant", content: "results da intezaar — ik ik ghanta bhaari lagda hai." },
      { role: "user", content: "bahut dua kar raha haan." },
      { role: "assistant", content: "dua di taqat hundi hai. main vi tuhade naal haan." },
      { role: "user", content: "sab theek ho gaya pehli baar." },
      { role: "assistant", content: "shukar hai — pehli baar sab sahi sunn ke saans aaya." },
      { role: "user", content: "bahut himmat mili tuhadi galbaat ton." },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's father has been ill — doctor warned them. They went through test anxiety, hospital visits, waiting for results. At turn 19, when user says they got strength from this conversation, reference the journey from the initial fear about pita ji's health.",
    },
    criteria: {
      id: "pa-long-ctx-memory-01",
      description: "Long context memory in Punjabi",
      passCondition: "Reply references pita ji's illness journey or the difficult time they went through together — not a generic 'glad to help' response.",
      failExpectedOutcome: "Reply is a generic closing without referencing the father's illness journey.",
    },
  },

  {
    id: "pa-long-roman-no-drift-01",
    category: "D: Long Conversation",
    name: "20-turn romanized Punjabi: no script drift to Gurmukhi script",
    description: "Even at turn 20, reply must stay in romanized Punjabi — no Gurmukhi script leak.",
    messages: [
      { role: "user", content: "main bahut pareshan haan." },
      { role: "assistant", content: "ki ho raha hai? dasso." },
      { role: "user", content: "relationship mushkil ho gaya hai." },
      { role: "assistant", content: "relationship di tension bahut dard dindi hai. ki hua?" },
      { role: "user", content: "oh meri gal nahi sunda." },
      { role: "assistant", content: "sun na — dard dinda hai." },
      { role: "user", content: "main thakk gaya haan." },
      { role: "assistant", content: "thakna svabhavik hai jado koi sun na kare." },
      { role: "user", content: "koi hal nahi lagda." },
      { role: "assistant", content: "abhi hal nahi dikh raha — theek hai." },
      { role: "user", content: "main kya karaan?" },
      { role: "assistant", content: "ik sawaal — tenu ki chahida hai asli vich?" },
      { role: "user", content: "main chahunda haan oh samjhe." },
      { role: "assistant", content: "samajh taan chahunda hai — ki usne kabhi samjhne di koshish ki?" },
      { role: "user", content: "kabhi kabhi karda hai." },
      { role: "assistant", content: "kabhi kabhi — eh kuch hai. chhota par hai." },
      { role: "user", content: "main confuse haan." },
      { role: "assistant", content: "confuse hona thek hai — dil dono taraf khicha jaanda hai." },
      { role: "user", content: "theek hai main sochiyan ga." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-long-roman-no-drift-01",
      description: "No Gurmukhi drift in 20-turn romanized Punjabi",
      passCondition: "Reply at turn 21 is entirely in romanized Punjabi — no Gurmukhi script characters appear.",
      failExpectedOutcome: "Reply drifts to Gurmukhi script after 20 turns of romanized conversation.",
    },
  },

  {
    id: "pa-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "25-turn Punjabi: emotional arc deepens",
    description: "In a long conversation, later replies should feel deeper and more attuned than early generic ones.",
    messages: [
      { role: "user", content: "main bahut frustrated haan." },
      { role: "assistant", content: "ki ho raha hai?" },
      { role: "user", content: "meri naukri toh kuch nahi mil raha." },
      { role: "assistant", content: "naukri vich kuch na milna frustrating hunda hai." },
      { role: "user", content: "3 saal ho gaye." },
      { role: "assistant", content: "3 saal — eh bada wait hai." },
      { role: "user", content: "ghar wale vi pressure de rahe ne." },
      { role: "assistant", content: "bahar pressure te ghar ton pressure — dono taraf." },
      { role: "user", content: "main roz reject hunda haan." },
      { role: "assistant", content: "roz rejection — dil toot jaanda hai." },
      { role: "user", content: "confidence nahi raha." },
      { role: "assistant", content: "itne saalon di mehnat te phir rejection — confidence jaana svabhavik hai." },
      { role: "user", content: "kabhi kabhi lagda hai main hi galat haan." },
      { role: "assistant", content: "tu galat nahi — system galat hai jo teri qimat nahi samjhda." },
      { role: "user", content: "dost vi nahi milte hune." },
      { role: "assistant", content: "dost vi dur — eh aur akela kar dinda hai." },
      { role: "user", content: "main ghar se bahar nahi nikalna chahunda." },
      { role: "assistant", content: "ghar vich band rehna — dard toh bachne da tarika." },
      { role: "user", content: "mujhe samajh nahi kya hoga." },
      { role: "assistant", content: "future nahi dikh raha — abhi sirf eh pal hai." },
      { role: "user", content: "main haar gaya haan." },
      { role: "assistant", content: "haar da matlab khatam nahi — haar da matlab thak gaya haan." },
      { role: "user", content: "mujhe teri zaroorat hai." },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User has been job-searching for 3 years, facing daily rejections, family pressure, lost confidence, isolated from friends, rarely leaving home. Now says 'I need you.' Respond with deep acknowledgment of the whole journey — not just this moment.",
    },
    criteria: {
      id: "pa-long-arc-deepens-01",
      description: "Emotional arc depth at turn 25 in Punjabi",
      passCondition: "Reply acknowledges the full 3-year journey — mentions job struggle, rejection, family pressure, isolation. Deeply attuned, not generic.",
      failExpectedOutcome: "Reply is generic ('main aithe haan') without acknowledging the specific emotional arc.",
    },
  },

  {
    id: "pa-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Punjabi: topic shift at turn 8 — earlier context not lost",
    description: "User mentions father's illness at turn 1, then shifts to work. AI should hold both contexts.",
    messages: [
      { role: "user", content: "pita ji beemar ne. bahut chinta hai." },
      { role: "assistant", content: "pita ji baare sunke dil bhaari hoya. kiven ho oh?" },
      { role: "user", content: "treatment chal raha hai." },
      { role: "assistant", content: "treatment te hona acha hai — intezaar hunda hai." },
      { role: "user", content: "haan, aur kaam vi bahut hai." },
      { role: "assistant", content: "kaam te ghar dono — eh bahut bhaar hai." },
      { role: "user", content: "deadline kal hai." },
      { role: "assistant", content: "kal deadline — pressure to mahsoos ho raha hai." },
      { role: "user", content: "pata nahi kiven manage karan kuch v." },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's father is ill (treatment ongoing) AND they have a work deadline tomorrow. Both contexts are active — reference both when user says they don't know how to manage.",
    },
    criteria: {
      id: "pa-long-topic-shift-01",
      description: "Context retention after topic shift in Punjabi",
      passCondition: "Reply acknowledges BOTH the father's illness AND the work deadline — shows the AI is holding both threads, not just the most recent.",
      failExpectedOutcome: "Reply only addresses work deadline, forgetting the father's illness from turn 1.",
    },
  },

  {
    id: "pa-long-lang-stable-01",
    category: "D: Long Conversation",
    name: "30-turn Punjabi: language never changes throughout",
    description: "Over 30 turns, the AI must stay in romanized Punjabi — never slip to Hindi or English.",
    messages: [
      { role: "user", content: "main bahut akela haan." },
      { role: "assistant", content: "ki ho raha hai? dasso." },
      { role: "user", content: "koi nahi hai mere layi." },
      { role: "assistant", content: "eh sun ke dil dukha. dasso thoda." },
      { role: "user", content: "family door hai." },
      { role: "assistant", content: "family ton door rehna sakht hunda hai." },
      { role: "user", content: "dost vi nahi milte." },
      { role: "assistant", content: "dost vi nahi — aur akela ho jaanda hai." },
      { role: "user", content: "naukri vi band ho gayi." },
      { role: "assistant", content: "naukri band — eh shock hai." },
      { role: "user", content: "ghar da kirayya vi dena hai." },
      { role: "assistant", content: "kiraya upar pressure — bahut kuch ek saath aa gaya." },
      { role: "user", content: "kha vi nahi raha theek se." },
      { role: "assistant", content: "khaana chhadna dassda hai andar kitna kuch hai." },
      { role: "user", content: "neend vi nahi aundi." },
      { role: "assistant", content: "neend na aana — tan vi tak gaya hoga." },
      { role: "user", content: "main kya karaan?" },
      { role: "assistant", content: "ik cheez — aaj layi, sirf ik." },
      { role: "user", content: "ki?" },
      { role: "assistant", content: "kha kuch. sirf eh." },
      { role: "user", content: "theek hai." },
      { role: "assistant", content: "shukar. tu important hai." },
      { role: "user", content: "shukriya tenu." },
      { role: "assistant", content: "tera swagat hai. aithe haan main." },
      { role: "user", content: "kal vi aavan ga." },
      { role: "assistant", content: "zaroor aa. main intezaar karan ga." },
      { role: "user", content: "promise?" },
      { role: "assistant", content: "haan. pakka." },
      { role: "user", content: "acha, raat nu gal karna." },
      { role: "assistant", content: "zaroor. raat nu milte haan." },
      { role: "user", content: "thanks yaar." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-long-lang-stable-01",
      description: "Language stability over 30 turns in Punjabi",
      passCondition: "Reply at turn 31 is in romanized Punjabi — warm and brief. Has not switched to Hindi or English anywhere.",
      failExpectedOutcome: "Reply switches to Hindi or English after 30 turns.",
    },
  },

  {
    id: "pa-long-roman-context-01",
    category: "D: Long Conversation",
    name: "Punjabi: topic shift context retention across 10 turns",
    description: "Context from early turns held after topic shift.",
    messages: [
      { role: "user", content: "mere brother ne bade time baad call kita." },
      { role: "assistant", content: "brother da call — kiven tha?" },
      { role: "user", content: "oh bahut dard vich tha. uski job chali gayi." },
      { role: "assistant", content: "brother di job jana — dard tha sunke." },
      { role: "user", content: "main uski madad karna chahunda haan." },
      { role: "assistant", content: "tenu uski chinta hai — eh pyaar hai." },
      { role: "user", content: "par mere kol vi paisa nahi bahut." },
      { role: "assistant", content: "paisa nahi hona aur madad karna chahna — eh dil da dard hai." },
      { role: "user", content: "hun gal kariye mere baare — meri vi situation theek nahi." },
      { role: "assistant", content: "dasso — tenu ki ho raha hai?" },
      { role: "user", content: "meri bhi relationship problems ne." },
    ],
    config: {
      lang: "pa", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's brother lost his job and called after a long time — user wanted to help but doesn't have money. Now shifting to their own relationship problems. Hold both contexts.",
    },
    criteria: {
      id: "pa-long-roman-context-01",
      description: "Context retention across topic shift in romanized Punjabi",
      passCondition: "Reply acknowledges user's relationship problems with warmth — may briefly reference the brother situation to show it's not forgotten.",
      failExpectedOutcome: "Reply completely ignores the brother context and gives a generic response about relationships.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "pa-drift-native-01",
    category: "E: Language Drift",
    name: "10-turn native Punjabi: AI never switches to English",
    description: "Through 10 turns of native Punjabi, the AI must never switch to English.",
    messages: [
      { role: "user", content: "ਮੈਂ ਬਹੁਤ ਦੁਖੀ ਹਾਂ।" },
      { role: "assistant", content: "ਕੀ ਹੋਇਆ ਹੈ? ਦੱਸ।" },
      { role: "user", content: "ਮੇਰੇ ਦੋਸਤ ਨੇ ਧੋਖਾ ਦਿੱਤਾ।" },
      { role: "assistant", content: "ਦੋਸਤ ਦਾ ਧੋਖਾ — ਬਹੁਤ ਦਰਦਨਾਕ ਹੈ।" },
      { role: "user", content: "ਮੈਂ ਉਸ ਉੱਤੇ ਭਰੋਸਾ ਕਰਦਾ ਸੀ।" },
      { role: "assistant", content: "ਭਰੋਸਾ ਟੁੱਟਣਾ ਸਭ ਤੋਂ ਔਖਾ ਹੁੰਦਾ ਹੈ।" },
      { role: "user", content: "ਹੁਣ ਕਿਸੇ ਉੱਤੇ ਭਰੋਸਾ ਨਹੀਂ ਕਰ ਸਕਦਾ।" },
      { role: "assistant", content: "ਭਰੋਸਾ ਕਰਨਾ ਔਖਾ ਲੱਗਦਾ ਹੈ ਹੁਣ — ਸਮਝ ਆਉਂਦਾ ਹੈ।" },
      { role: "user", content: "ਮੈਂ ਬਹੁਤ ਇਕੱਲਾ ਮਹਿਸੂਸ ਕਰਦਾ ਹਾਂ।" },
    ],
    config: { lang: "pa", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pa-drift-native-01",
      description: "No English drift in 10-turn native Punjabi",
      passCondition: "Reply at turn 10 is in Gurmukhi Punjabi — AI has not switched to English at any point.",
      failExpectedOutcome: "Reply drifts to English after 10 turns of native Punjabi.",
    },
  },

  {
    id: "pa-drift-roman-01",
    category: "E: Language Drift",
    name: "10-turn romanized Punjabi: no drift to native script or English",
    description: "Through 10 turns of romanized Punjabi, neither native script nor English should appear.",
    messages: [
      { role: "user", content: "main bahut thakka hoya haan." },
      { role: "assistant", content: "ki hua? dasso." },
      { role: "user", content: "kaam bahut zyada hai." },
      { role: "assistant", content: "kaam da bhaar — mushkil lagda hai." },
      { role: "user", content: "boss bahut expect karda hai." },
      { role: "assistant", content: "boss di expectations manage karna sakht hai." },
      { role: "user", content: "main bahut stressed haan." },
      { role: "assistant", content: "stress bahut lagda hai — theek hai." },
      { role: "user", content: "mujhe kuch nahi sujhda." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-drift-roman-01",
      description: "No drift in 10-turn romanized Punjabi",
      passCondition: "Reply at turn 10 is entirely in romanized Punjabi — no Gurmukhi script, no English.",
      failExpectedOutcome: "Reply contains Gurmukhi script or switches to English.",
    },
  },

  {
    id: "pa-drift-after-peak-01",
    category: "E: Language Drift",
    name: "Punjabi: language held after deep emotional peak",
    description: "After an intense emotional moment, language must not reset to English.",
    messages: [
      { role: "user", content: "main rona chahunda haan." },
      { role: "assistant", content: "ro le. main aithe haan." },
      { role: "user", content: "sab kuch khatam ho gaya lagda hai." },
      { role: "assistant", content: "abhi aisa lagda hai — bahut heavy hai eh." },
      { role: "user", content: "koi nahi mere kol." },
      { role: "assistant", content: "main haan. bol." },
      { role: "user", content: "theek haan hun thoda." },
    ],
    config: { lang: "pa", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "pa-drift-after-peak-01",
      description: "Language held after emotional peak in Punjabi",
      passCondition: "Reply stays in romanized Punjabi after emotional peak — does not switch to English.",
      failExpectedOutcome: "Reply switches to English after the emotional intensity subsides.",
    },
  },

  {
    id: "pa-drift-after-truncation-01",
    category: "E: Language Drift",
    name: "Punjabi: language held after MAX_TURNS context truncation",
    description: "When context is truncated at 12 turns, language must not reset.",
    messages: [
      { role: "user", content: "main bahut pareshan haan." },
      { role: "assistant", content: "ki ho raha hai?" },
      { role: "user", content: "rishte mushkil ne." },
      { role: "assistant", content: "rishte da dard samjhda haan." },
      { role: "user", content: "ghar vich jhagda roz hunda hai." },
      { role: "assistant", content: "roz jhagda — thakna svabhavik hai." },
      { role: "user", content: "main thakk gaya haan." },
      { role: "assistant", content: "thakna zaruri hai — aram le." },
      { role: "user", content: "neend nahi aundi." },
      { role: "assistant", content: "neend nahi — tan vi bhaarta hai." },
      { role: "user", content: "khaana vi nahi khanda." },
      { role: "assistant", content: "khaana chhad dena dassda hai andar kuch chal raha hai." },
      { role: "user", content: "aaj thoda better haan." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-drift-after-truncation-01",
      description: "Language held after MAX_TURNS in Punjabi",
      passCondition: "Reply at turn 14 is in romanized Punjabi — language has not reset after context truncation.",
      failExpectedOutcome: "Reply switches to English or Hindi after context window truncation.",
    },
  },

  {
    id: "pa-drift-topic-change-01",
    category: "E: Language Drift",
    name: "Punjabi: language held after topic change",
    description: "When topic changes from emotional to neutral, language must not reset to English.",
    messages: [
      { role: "user", content: "aaj bahut roya." },
      { role: "assistant", content: "ki ho gaya?" },
      { role: "user", content: "kuch nahi — bas ho gaya." },
      { role: "assistant", content: "kabhi kabhi aisa hunda hai. main aithe haan." },
      { role: "user", content: "chalo, bata mere liye koi movie suggest kar." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "pa-drift-topic-change-01",
      description: "Language held after topic change in Punjabi",
      passCondition: "Reply stays in romanized Punjabi when user asks for movie suggestion — does not switch to English.",
      failExpectedOutcome: "Reply switches to English when topic changes from emotional to neutral.",
    },
  },

  {
    id: "pa-drift-dominant-lang-01",
    category: "E: Language Drift",
    name: "Punjabi: dominant language stays Punjabi in mixed conversation",
    description: "Even when user mixes English words, the dominant reply language stays Punjabi.",
    messages: [
      { role: "user", content: "main bahut stressed out haan about my future." },
      { role: "assistant", content: "future baare stress — samjhda haan. ki chal raha hai?" },
      { role: "user", content: "job nahi mil rahi despite trying hard." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pa-drift-dominant-lang-01",
      description: "Dominant language stays Punjabi in mixed conversation",
      passCondition: "Reply is predominantly Punjabi — may include English words but the sentence structure and most words are Punjabi.",
      failExpectedOutcome: "Reply switches to predominantly English because the user used English words.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "pa-mobile-tone-01",
    category: "F: Mobile Platform",
    name: "Mobile Punjabi: relationship 'friend' maps to close_friend tone",
    description: "Mobile sends relationship=friend. Should produce close_friend tone in romanized Punjabi.",
    messages: [
      { role: "user", content: "yaar main bahut thakka hoya haan." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "pa-mobile-tone-01",
      description: "Mobile friend relationship → close_friend tone in Punjabi",
      passCondition: "Reply in romanized Punjabi uses casual 'tu/tera/tenu' — warm, peer-level. Not formal 'tussi'.",
      failExpectedOutcome: "Reply is formal or uses 'tussi/aap', indicating tone mapping failed.",
    },
  },

  {
    id: "pa-mobile-romanized-detect-01",
    category: "F: Mobile Platform",
    name: "Mobile Punjabi: romanized detection fires — sends lang=pa not lang=en",
    description: "Mobile must detect romanized Punjabi input and send correct language code.",
    messages: [
      { role: "user", content: "main kuch sochda rehta haan." },
    ],
    config: { lang: "pa", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "pa-mobile-romanized-detect-01",
      description: "Mobile romanized Punjabi detection",
      passCondition: "Reply is in romanized Punjabi — confirms language was detected as 'pa'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Punjabi.",
    },
  },

];
