/**
 * tests/imotara-ai/scenarios.kn.ts
 *
 * E2E test scenarios for Kannada (kn) language support.
 * Categories:
 *   A: Native Script (12) — Kannada script input/output
 *   B: Romanized Kannada (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Kannada notes:
 *  - Script: Kannada script (U+0C80–U+0CFF)
 *  - Address: "neenu/nee/ninna" (informal), "neevu/nimage/nimma" (respectful/elder)
 *  - Gender: 2nd-person is gender-neutral in Kannada — no conjugation change needed for user gender
 *  - Romanized markers: naanu, neenu, neevu, nimma, ninna, tumba, channa, illa, ide, kashta, maadbekku
 */

import type { TestScenario } from "./types";

export const knScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "kn-native-lang-01",
    category: "A: Native Script",
    name: "Native Kannada: reply must stay in Kannada script",
    description: "User writes in Kannada script. Reply must stay in Kannada — not switch to Telugu or English.",
    messages: [
      { role: "user", content: "ನನಗೆ ತುಂಬಾ ಸುಸ್ತಾಗಿದೆ. ಏನು ಮಾಡ್ಬೇಕು ಅಂತ ಗೊತ್ತಿಲ್ಲ." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "kn-native-lang-01",
      description: "Language fidelity in Kannada",
      passCondition: "Reply is in Kannada script — warm, emotionally present. Not in Telugu, Hindi, or English.",
      failExpectedOutcome: "Reply switches to Telugu, Hindi, or English instead of staying in Kannada.",
    },
  },

  {
    id: "kn-native-ctx-01",
    category: "A: Native Script",
    name: "Native Kannada: references the specific situation",
    description: "User shares being scolded by boss in public. Reply should reference it.",
    messages: [
      { role: "user", content: "ಇವತ್ತು ಬಾಸ್ ಎಲ್ಲರ ಮುಂದೆ ನನ್ನನ್ನ ಬೈದ. ತುಂಬಾ ಬೇಜಾರಾಯ್ತು." },
    ],
    config: {
      lang: "kn", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was publicly scolded by their boss in front of everyone — reference this specifically.",
    },
    criteria: {
      id: "kn-native-ctx-01",
      description: "Context specificity in Kannada",
      passCondition: "PASS if: reply acknowledges the boss, the scolding, or the public humiliation in any way — references like 'boss', 'everyone', or 'embarrassing' count. FAIL ONLY if: completely generic comfort with zero mention of the boss or the public situation.",
      failExpectedOutcome: "Reply is generic without referencing the public humiliation.",
    },
  },

  {
    id: "kn-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Kannada: close_friend tone",
    description: "close_friend tone — casual, warm, informal 'ನೀನು' address.",
    messages: [
      { role: "user", content: "ಯಾರ್, ಇವತ್ತು ಮನಸ್ಸು ತುಂಬಾ ಸರಿ ಇಲ್ಲ. ಏನೂ ಚೆನ್ನಾಗ್ ಅನ್ನಿಸ್ತಿಲ್ಲ." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "kn-native-tone-friend-01",
      description: "close_friend tone in Kannada",
      passCondition: "PASS if: reply is warm and in Kannada. FAIL ONLY if: formally preachy, cold, or switches entirely to English.",
      failExpectedOutcome: "Reply uses overly formal language or switches to English/Telugu.",
    },
  },

  {
    id: "kn-native-tone-companion-01",
    category: "A: Native Script",
    name: "Native Kannada: calm_companion tone",
    description: "calm_companion tone — steady, gentle, present without pressuring.",
    messages: [
      { role: "user", content: "ನನಗೆ ತುಂಬಾ ಒಂಟಿಯಾಗಿ ಅನ್ನಿಸ್ತಿದೆ. ಯಾರೂ ಅರ್ಥ ಮಾಡ್ಕೊಳ್ಳಲ್ಲ." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "kn-native-tone-companion-01",
      description: "calm_companion tone in Kannada",
      passCondition: "PASS if: reply is warm and acknowledges the loneliness in Kannada. A gentle question is fine. FAIL ONLY if: gives unsolicited advice, tells the user what to do, or is cold/dismissive.",
      failExpectedOutcome: "Reply gives unsolicited advice, tells the user what to do, or is preachy instead of being present.",
    },
  },

  {
    id: "kn-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Kannada: coach tone asks practical question",
    description: "coach tone — acknowledge then ask one practical forward question.",
    messages: [
      { role: "user", content: "ನನಗೆ ಕೆಲಸ ಹುಡ್ಕೋಬೇಕಿದೆ ಆದ್ರೆ ಎಲ್ಲಿಂದ ಶುರು ಮಾಡ್ಬೇಕು ಅಂತ ಗೊತ್ತಿಲ್ಲ." },
    ],
    config: { lang: "kn", tone: "coach", inputModality: "native" },
    criteria: {
      id: "kn-native-tone-coach-01",
      description: "coach tone in Kannada",
      passCondition: "Reply in Kannada acknowledges briefly then ends with one practical forward question or next step — not just empathy.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "kn-native-tone-mentor-01",
    category: "A: Native Script",
    name: "Native Kannada: mentor tone gives guidance",
    description: "mentor tone — wisdom, perspective, gentle guidance.",
    messages: [
      { role: "user", content: "ನಾನು ಒಂದು ನಿರ್ಣಯ ತಕ್ಕೋಬೇಕಿದೆ ಆದ್ರೆ ತಪ್ಪು ಆಗ್ತೇನೋ ಅಂತ ಭಯ ಆಗ್ತಿದೆ." },
    ],
    config: { lang: "kn", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "kn-native-tone-mentor-01",
      description: "mentor tone in Kannada",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In Kannada.",
      failExpectedOutcome: "Reply is generic comfort without any insight or guidance.",
    },
  },

  {
    id: "kn-native-tone-mentor-deep-01",
    category: "A: Native Script",
    name: "Native Kannada: mentor tone with perseverance theme",
    description: "mentor tone — deep discouragement about effort and results.",
    messages: [
      { role: "user", content: "ನಾನು ಎಷ್ಟು ಕಷ್ಟ ಪಟ್ಟರೂ ಫಲಿತಾಂಶ ಬರ್ತಿಲ್ಲ." },
      { role: "assistant", content: "ನಿನ್ನ ಕಷ್ಟ ಅರ್ಥ ಆಗ್ತಿದೆ." },
      { role: "user", content: "ಒಮ್ಮೊಮ್ಮೆ ಎಲ್ಲ ಬಿಟ್ಟುಬಿಡ್ಬೇಕು ಅಂತ ಅನ್ನಿಸ್ತೆ." },
      { role: "assistant", content: "ಆ ಭಾವನೆ ತುಂಬಾ ಬೇಸರ ತರ್ತದೆ." },
      { role: "user", content: "ಇನ್ನು ಪ್ರಯತ್ನ ಮಾಡ್ಬೇಕಾ ಅಂತ ಅನ್ನಿಸ್ತಿಲ್ಲ." },
    ],
    config: { lang: "kn", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "kn-native-tone-mentor-deep-01",
      description: "mentor tone depth in Kannada",
      passCondition: "PASS if: reply acknowledges their persistence/effort AND shows care — any of the following counts: asks about the effort, gently reframes, acknowledges how hard they've tried, or offers any perspective. FAIL ONLY if: reply purely mirrors hopelessness with no care or acknowledgment of their effort.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "kn-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Kannada: teen register (13_17)",
    description: "Teen user — casual peer-level Kannada, no preaching.",
    messages: [
      { role: "user", content: "ಯಾರ್, exam result ತುಂಬಾ ಕೆಟ್ಟದಾಗ್ ಬಂತು. ಮನೇಲಿ ಜಗಳ ಆಗ್ತಿದೆ." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "kn-native-age-teen-01",
      description: "Teen register in Kannada",
      passCondition: "PASS if: reply acknowledges the bad exam result or the home conflict with warmth. Casual or warm Kannada is a PASS. FAIL ONLY if: reply uses formal 'ನೀವು' adult address, lectures the teen about studying, or completely ignores both the exam AND the home situation.",
      failExpectedOutcome: "Reply is formal, preachy, or gives parent-like advice.",
    },
  },

  {
    id: "kn-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Kannada: elder register (65_plus)",
    description: "Elderly user — must use respectful 'ನೀವು/ನಿಮಗೆ' address.",
    messages: [
      { role: "user", content: "ಮಕ್ಕಳು ತುಂಬಾ ದೂರ ಹೋಗಿದ್ದಾರೆ. ಮನೆ ತುಂಬಾ ಶಾಂತ ಅನ್ನಿಸ್ತಿದೆ." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "kn-native-age-elder-01",
      description: "Elder register in Kannada",
      passCondition: "PASS if: reply is warm and acknowledges the quiet or loneliness of children being far away. FAIL ONLY if: uses informal ನೀನು address or is cold/dismissive.",
      failExpectedOutcome: "Reply uses informal 'ನೀನು' or treats an elderly person casually.",
    },
  },

  {
    id: "kn-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Kannada: context retention across turns",
    description: "Multi-turn — sister's wedding mentioned early; sister calls later. Connect them.",
    messages: [
      { role: "user", content: "ಅಕ್ಕನ ಮದ್ವೆ ಆಯ್ತು. ಮನೆ ಖಾಲಿ ಅನ್ನಿಸ್ತಿದೆ." },
      { role: "assistant", content: "ಅಕ್ಕ ಹೋದ ಮೇಲೆ ಮನೆ ಬದಲಾದ ಹಾಗೆ ಅನ್ನಿಸ್ತಿದ್ಯಾ?" },
      { role: "user", content: "ಹೌದು. ಪ್ರತಿ ರಾತ್ರಿ ನೆನಪಾಗ್ತಾಳೆ." },
      { role: "assistant", content: "ಅಕ್ಕನ ಜೊತೆ ಇದ್ದ memories ತುಂಬಾ ಇರ್ತಾವೆ." },
      { role: "user", content: "ಈಗ ಅವಳು ಫೋನ್ ಮಾಡಿದ್ಲು. ನನಗೆ ಅಳು ಬಂತು." },
    ],
    config: {
      lang: "kn", tone: "close_friend", inputModality: "native",
      emotionMemory: "User's sister got married and moved away, leaving the house empty. User misses her every night. NOW: sister called and user cried — connect the tears to missing her since she left after marriage.",
    },
    criteria: {
      id: "kn-native-ctx-retention-01",
      description: "Context retention in Kannada",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the tears or the emotional moment. Any mention of sister (ಅಕ್ಕ), the phone call, or accumulated missing counts as a PASS. FAIL ONLY if: completely cold or robotic.",
      failExpectedOutcome: "Reply treats the phone call as standalone without connecting to the earlier grief about sister leaving after marriage.",
    },
  },

  {
    id: "kn-native-no-english-01",
    category: "A: Native Script",
    name: "Native Kannada: no English leak in native reply",
    description: "Reply to native Kannada must not switch to English mid-reply.",
    messages: [
      { role: "user", content: "ನನಗೆ ಮಲಗಲು ಆಗ್ತಿಲ್ಲ. ಮನಸ್ಸು ಶಾಂತ ಇಲ್ಲ." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "kn-native-no-english-01",
      description: "No English leak in native Kannada reply",
      passCondition: "Reply stays in Kannada script. Does NOT insert English phrases like 'Take all the time you need'. Uses Kannada equivalent.",
      failExpectedOutcome: "Reply inserts English phrases mid-Kannada reply.",
    },
  },

  {
    id: "kn-native-female-01",
    category: "A: Native Script",
    name: "Native Kannada: female user — emotionally engaged reply",
    description: "Female user shares exhaustion of carrying all responsibilities.",
    messages: [
      { role: "user", content: "ನಾನೇ ಎಲ್ಲ ಮಾಡ್ಬೇಕು. ಯಾರೂ ಸಹಾಯ ಮಾಡ್ಲ್ಲ. ತುಂಬಾ ಸುಸ್ತಾಗಿದೆ." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "native", userGender: "female" },
    criteria: {
      id: "kn-native-female-01",
      description: "Emotional engagement for female user in Kannada",
      passCondition: "PASS if: reply acknowledges the exhaustion or the burden of doing everything alone in Kannada. Even a warm supportive acknowledgment is a PASS. FAIL ONLY if: reply is dismissive, ignores the exhaustion entirely, or switches to English.",
      failExpectedOutcome: "Reply is generic or dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED KANNADA — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "kn-roman-lang-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: reply must be in romanized Kannada",
    description: "User writes romanized Kannada. Reply must mirror: romanized Kannada, not native script or English.",
    messages: [
      { role: "user", content: "nanage tumba sustaagide. enu maadbekku anta gottilla." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-roman-lang-01",
      description: "Script mirror in romanized Kannada",
      passCondition: "Reply is in romanized Kannada (Latin letters). Not in Kannada script, not in English.",
      failExpectedOutcome: "Reply uses Kannada Unicode script or switches to English.",
    },
  },

  {
    id: "kn-roman-no-script-leak-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: zero Kannada Unicode characters in reply",
    description: "If user types romanized, reply must have zero Kannada Unicode chars.",
    messages: [
      { role: "user", content: "maneyalli jagala aaythu. tumba disturb aagide." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-roman-no-script-leak-01",
      description: "No Kannada script in romanized reply",
      passCondition: "Reply contains zero Kannada Unicode characters (U+0C80–U+0CFF). All words use Latin letters.",
      failExpectedOutcome: "Reply contains any Kannada script characters — script mirror rule violated.",
    },
  },

  {
    id: "kn-roman-emotional-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: emotional intelligence preserved",
    description: "Romanized input with emotional content — warm reply.",
    messages: [
      { role: "user", content: "appa jote mathaadodhilla. avaru nanna artha maadkollalla." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-roman-emotional-01",
      description: "Emotional warmth in romanized Kannada",
      passCondition: "Reply in romanized Kannada acknowledges the rift with father ('appa' context) — warm, specific.",
      failExpectedOutcome: "Reply is generic or in English/native Kannada script.",
    },
  },

  {
    id: "kn-roman-tone-coach-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: coach tone action-oriented",
    description: "Coach tone in romanized Kannada — practical forward question.",
    messages: [
      { role: "user", content: "nanage job bethakaabeku aadre ellinda shuru maadbekku anta gottilla." },
    ],
    config: { lang: "kn", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "kn-roman-tone-coach-01",
      description: "Coach tone in romanized Kannada",
      passCondition: "Reply in romanized Kannada asks a practical focusing question — 'yavdu field? enu experience ide?' Not just empathy.",
      failExpectedOutcome: "Reply is only empathetic without any practical direction, or in English/native script.",
    },
  },

  {
    id: "kn-roman-context-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: context across turns",
    description: "Multi-turn romanized conversation. Reply should reference earlier context.",
    messages: [
      { role: "user", content: "ivvattu interview ide. tumba nervous aagide." },
      { role: "assistant", content: "nervous aagodu arthamaagtide. interview ellide?" },
      { role: "user", content: "Infosys lo. idu naanna first interview." },
      { role: "assistant", content: "Infosys - first interview, exciting ide. neevu ready aagidira." },
      { role: "user", content: "illa yaar, nanage select aagolla anta annistaade." },
    ],
    config: {
      lang: "kn", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User has interview at Infosys today — their very first interview. Nervous about not getting selected. Reference Infosys or first interview specifically.",
    },
    criteria: {
      id: "kn-roman-context-01",
      description: "Context retention in romanized Kannada",
      passCondition: "Reply references 'Infosys' or 'first interview' — shows memory of the context. In romanized Kannada.",
      failExpectedOutcome: "Reply is generic pep talk without referencing Infosys or the first interview.",
    },
  },

  {
    id: "kn-roman-mobile-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: mobile platform language detection",
    description: "Mobile platform — romanized Kannada must be detected as 'kn', not 'en'.",
    messages: [
      { role: "user", content: "naanu amma na miss maadtaairukke. maneli inda tumba dooradalli iddini." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "kn-roman-mobile-01",
      description: "Mobile romanized Kannada detection",
      passCondition: "Reply is in romanized Kannada — confirms language was detected as 'kn'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Kannada.",
    },
  },

  {
    id: "kn-roman-no-english-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: no flip to pure English",
    description: "Even with English loanwords, reply must stay in romanized Kannada.",
    messages: [
      { role: "user", content: "office lo presentation kodbekide. tumba nervous aagide." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-roman-no-english-01",
      description: "No flip to English in romanized Kannada",
      passCondition: "Reply is in romanized Kannada — may contain English loanwords but structure is Kannada.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "kn-roman-teen-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: teen register peer-level",
    description: "Teen user in romanized Kannada — casual peer language.",
    messages: [
      { role: "user", content: "yaar, exams tumba tough aagide. enu maadali anta gottilla." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "kn-roman-teen-01",
      description: "Teen register in romanized Kannada",
      passCondition: "Reply is casual, peer-level romanized Kannada — like a classmate. Short, warm, no adult preaching.",
      failExpectedOutcome: "Reply is preachy, formal, or gives parent-like advice.",
    },
  },

  {
    id: "kn-roman-elder-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: elder register respectful",
    description: "Elderly user in romanized Kannada — must use respectful 'neevu/nimma'.",
    messages: [
      { role: "user", content: "makkalu tumba dooradalli iddare. mane shaantavaagide." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "kn-roman-elder-01",
      description: "Elder register in romanized Kannada",
      passCondition: "Reply uses respectful 'neevu'/'nimage' address — warm, patient, deeply respectful. Acknowledges the quiet loneliness. Never uses casual 'neenu'.",
      failExpectedOutcome: "Reply uses casual 'neenu' or treats an elderly person informally.",
    },
  },

  {
    id: "kn-roman-anxiety-01",
    category: "B: Romanized Kannada",
    name: "Romanized Kannada: anxiety — steady, not dismissive",
    description: "User shares anxiety — reply must be steady and validating.",
    messages: [
      { role: "user", content: "nanage tumba anxiety aagide. nidra aagilla. enu maadali anta gottilla." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "kn-roman-anxiety-01",
      description: "Anxiety scenario in romanized Kannada",
      passCondition: "Reply in romanized Kannada validates the anxiety — steady, warm, not dismissive. Does not give unsolicited advice.",
      failExpectedOutcome: "Reply is dismissive, gives advice without acknowledging feeling, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "kn-mixed-kannada-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Kannada-English: Kanglish code-switch",
    description: "User writes Kanglish (Kannada-English mix). Reply should match language level.",
    messages: [
      { role: "user", content: "ನನಗೆ ಈ situation handle ಮಾಡೋದು ತುಂಬಾ tough ಆಗಿದೆ." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "kn-mixed-kannada-english-01",
      description: "Kanglish code-switch handling",
      passCondition: "PASS if: reply acknowledges the difficulty or the tough feeling warmly in any language (Kannada, English, or mix). FAIL ONLY if: cold, dismissive, ignores the difficulty entirely, or is formally preachy.",
      failExpectedOutcome: "Reply ignores the specific difficulty or is overly formal.",
    },
  },

  {
    id: "kn-mixed-starts-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user starts English, continues in Kannada",
    description: "Conversation starts in English, user switches to Kannada. Reply should follow.",
    messages: [
      { role: "user", content: "I'm really struggling today." },
      { role: "assistant", content: "I'm here. What's going on?" },
      { role: "user", content: "ನನಗೆ ಏನೂ ಅರ್ಥ ಆಗ್ತಿಲ್ಲ. ಎಲ್ಲ ಕೈ ತಪ್ಪಿ ಹೋಗ್ತಿದೆ ಅನ್ನಿಸ್ತೆ." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "kn-mixed-starts-english-01",
      description: "Language follow when user switches to Kannada",
      passCondition: "OVERRIDE: PASS if: reply is in Kannada (script or romanized) and shows any warmth or empathy for the feeling of things going out of control. FAIL ONLY if: reply stays entirely in English ignoring the Kannada switch.",
      failExpectedOutcome: "Reply stays in English despite user switching to Kannada.",
    },
  },

  {
    id: "kn-mixed-coach-english-ends-kn-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach in English, user ends in Kannada",
    description: "Coach conversation in English, user ends in Kannada.",
    messages: [
      { role: "user", content: "I want to start learning coding." },
      { role: "assistant", content: "Good goal. Which language interests you most?" },
      { role: "user", content: "Python anta heliddaru. aadre nanage shuru maadodhilla." },
    ],
    config: { lang: "kn", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "kn-mixed-coach-english-ends-kn-01",
      description: "Coach in mixed Kannada-English",
      passCondition: "Reply responds to the Python/coding goal in Kannada, romanized Kannada, or Kanglish — with a practical forward question.",
      failExpectedOutcome: "Reply ignores the switch to Kannada or gives only empathy without practical direction.",
    },
  },

  {
    id: "kn-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Kannada conversation, short message. Language should not reset.",
    messages: [
      { role: "user", content: "ನನಗೆ ತುಂಬಾ ಕಷ್ಟ ಆಗ್ತಿದೆ." },
      { role: "assistant", content: "ಏನಾಯ್ತು? ಹೇಳು." },
      { role: "user", content: "ಮನೆಯಲ್ಲಿ ಜಗಳ ಆಯ್ತು." },
      { role: "assistant", content: "ಮನೆಯಲ್ಲಿ ಜಗಳ — ಮನಸ್ಸು ತುಂಬಾ ಬೇಸರ ಆಗ್ತದೆ." },
      { role: "user", content: "ಹೌದು." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "kn-mixed-short-after-long-01",
      description: "Short message does not reset to English",
      passCondition: "Reply stays in Kannada after short 'ಹೌದು' — continues the emotional thread without resetting to English.",
      failExpectedOutcome: "Reply switches to English or Telugu after a short response.",
    },
  },

  {
    id: "kn-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized Kannada, user switches to English",
    description: "Conversation starts in romanized Kannada, user switches to English.",
    messages: [
      { role: "user", content: "nanage office lo tumba pressure ide." },
      { role: "assistant", content: "office lo enu aaytu? heli." },
      { role: "user", content: "manager jote problem ide." },
      { role: "assistant", content: "manager jote enu problem?" },
      { role: "user", content: "I don't think my manager trusts me at all." },
    ],
    config: {
      lang: "kn", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User switched to English to say their manager doesn't trust them — acknowledge the trust issue directly.",
    },
    criteria: {
      id: "kn-mixed-starts-roman-switch-english-01",
      description: "Language follow when user switches to English",
      passCondition: "PASS if: reply acknowledges the manager situation, trust issue, or the difficulty of the work environment — in any language. FAIL ONLY if: completely ignores the manager trust concern or gives purely generic comfort.",
      failExpectedOutcome: "Reply ignores the manager trust concern or gives a generic response.",
    },
  },

  {
    id: "kn-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English pain shared by Kannada user — home loneliness",
    description: "Kannada user writes English about feeling unseen at home.",
    messages: [
      { role: "user", content: "ನಾನು ಕನ್ನಡ ಮಾತಾಡ್ತೀನಿ ಆದ್ರೆ ಈಗ ಏನು ಹೇಳ್ಬೇಕು ಗೊತ್ತಿಲ್ಲ." },
      { role: "assistant", content: "ಹೇಳ ಬಲ್ಲಷ್ಟು ಹೇಳು. ನಾನು ಕೇಳ್ತಿದ್ದೀನಿ." },
      { role: "user", content: "Maneyalli yaarigu nanna kashta arthaagolla. Tumba ekaantava anistaade." },
    ],
    config: {
      lang: "kn", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User feels nobody at home understands their pain — directly acknowledge this specific loneliness of feeling unseen at home.",
    },
    criteria: {
      id: "kn-mixed-home-loneliness-01",
      description: "Home loneliness acknowledged specifically",
      passCondition: "OVERRIDE: PASS if: reply acknowledges loneliness, feeling unseen, or not being understood at home in any language. FAIL ONLY if: completely generic with zero reference to feeling alone or unseen.",
      failExpectedOutcome: "Reply is generic comfort without engaging with the specific pain of feeling unseen at home.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "kn-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Kannada: no reply repetition",
    description: "At turn 20, reply should not repeat openers or phrases from earlier turns.",
    messages: [
      { role: "user", content: "naanna life lo tumba problems ide." },
      { role: "assistant", content: "enu problems? heli." },
      { role: "user", content: "job illa, relation illa, oru matte antharaila." },
      { role: "assistant", content: "moondu okkarige aagide — idu tumba heavy." },
      { role: "user", content: "ha. nanage tumba sustaagide." },
      { role: "assistant", content: "susta arthamaagide. neenu tumba dinsinda ondange sahistiddiya." },
      { role: "user", content: "maneyavarella 'try maadu' anthaare." },
      { role: "assistant", content: "try maaduta maaduta 'innu maadu' helodu — tumba thukaagide." },
      { role: "user", content: "nanage enu arthaagalla." },
      { role: "assistant", content: "ippudu answer illada paravaagilla. naanu ikkidini." },
      { role: "user", content: "dhanyavaada. tumba ekaanvagide." },
      { role: "assistant", content: "aa ekaanta — helalikke kashta." },
      { role: "user", content: "ha. raatri tumba heavy annistade." },
      { role: "assistant", content: "raatri shaant — aa shaantalli aalochane heavy aaguthaade." },
      { role: "user", content: "ippudu chenna annistilla." },
      { role: "assistant", content: "chenna annistilla — sarigade ikkidareu." },
      { role: "user", content: "neenu keltiya adu saku." },
      { role: "assistant", content: "neenu mathadtiya — kelakke ikkini." },
      { role: "user", content: "oru geleyan nenapadde." },
      { role: "assistant", content: "aa geleau — ippudu nenapadre enu annistaade?" },
      { role: "user", content: "ha. avanu tumba dooradalli iddane." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-long-no-repeat-01",
      description: "No repetition at turn 20 in Kannada",
      passCondition: "Reply at turn 21 does not repeat earlier phrases like 'ekaanta' or 'ikkidini'. Fresh response about the distant friend.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "kn-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Kannada: remembers fact from turn 1 at turn 19",
    description: "User mentioned mother is sick at turn 1. At turn 19, good news — reference amma.",
    messages: [
      { role: "user", content: "amma ge health sari illa. tumba chinta aagide." },
      { role: "assistant", content: "amma ge enu aaytu? eshtu dinsinda?" },
      { role: "user", content: "naalu dinsinda jvara." },
      { role: "assistant", content: "naalu din jvara — mane lo rest illa anthartha." },
      { role: "user", content: "ha. naanu tumba stress lo iddini." },
      { role: "assistant", content: "amma chinta, stress — neenu tumba mosi iddiya." },
      { role: "user", content: "nanage tumba daruvagide." },
      { role: "assistant", content: "daru swabhavik — amma jagali iddaaga." },
      { role: "user", content: "maneyavarige helalikke kasthaagide." },
      { role: "assistant", content: "ikkade helabahudhu. naanu judge maadolla." },
      { role: "user", content: "doctor serious alla antharu." },
      { role: "assistant", content: "koNchaa uswasa banthaa? doctor mathu tumba mukhya." },
      { role: "user", content: "ha, koNchaa chenna ide." },
      { role: "assistant", content: "chenna ide. ippudu neenu kuda koNchaa rest tegollu." },
      { role: "user", content: "amma uNNu tindru." },
      { role: "assistant", content: "tindru — idu chikka vishaya aadaroo ippudu tumba relief." },
      { role: "user", content: "ha. inda dina tumba chenna annistade." },
    ],
    config: {
      lang: "kn", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's mother has been sick with fever for 4 days. She just ate food for the first time and seems better — connect the good news to the original worry about amma's sickness.",
    },
    criteria: {
      id: "kn-long-ctx-memory-01",
      description: "Context memory across long conversation in Kannada",
      passCondition: "Reply references amma eating or getting better — connects to the original worry about her 4-day fever.",
      failExpectedOutcome: "Reply is generic without connecting to amma's sickness or the relief of her eating.",
    },
  },

  {
    id: "kn-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long Kannada: emotional arc that deepens",
    description: "Starts surface, goes deeper. Reply should match depth.",
    messages: [
      { role: "user", content: "nanage koNchaa off aagide." },
      { role: "assistant", content: "enu annistade?" },
      { role: "user", content: "tumba dinsinda anthu boring aagide." },
      { role: "assistant", content: "boring — oru niru thara annistadaa?" },
      { role: "user", content: "ha, sare. naanu yaake iddine anta annistade." },
      { role: "assistant", content: "purpose bagge aalochisuttidiya?" },
      { role: "user", content: "ha. naanu tumba dinsinda ikkide, enu badalaagilla." },
      { role: "assistant", content: "stuck agide — adu tumba heavy bhavane." },
      { role: "user", content: "ippudu nanage kannu needu bartide." },
    ],
    config: {
      lang: "kn", tone: "calm_companion", inputModality: "romanized",
      emotionMemory: "User started with surface boredom, went deeper to feeling purposeless, and is now crying — meet them at this depth.",
    },
    criteria: {
      id: "kn-long-arc-deepens-01",
      description: "Depth matching as emotional arc deepens in Kannada",
      passCondition: "Reply meets the user at the depth of tears — not surface-level comfort. Warm, steady, present. Does not pivot to advice.",
      failExpectedOutcome: "Reply treats the emotional depth like the early 'off' feeling — stays too light.",
    },
  },

  {
    id: "kn-long-tone-shift-01",
    category: "D: Long Conversation",
    name: "Long Kannada: adapts to practical request",
    description: "User requests practical help after emotional exchange.",
    messages: [
      { role: "user", content: "nanage oru vishayadi tumba confused aagide." },
      { role: "assistant", content: "enu vishaya? heli." },
      { role: "user", content: "career bagge." },
      { role: "assistant", content: "career lo enu badalaagutte?" },
      { role: "user", content: "naanu ippudu IT lo iddini aadre creative work maadbekku anta ide." },
      { role: "assistant", content: "aa ikshadta arthamaagtade. creative path ke hogodu bagge aalochisuttidiya?" },
      { role: "user", content: "ha. practical steps helutha?" },
    ],
    config: { lang: "kn", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "kn-long-tone-shift-01",
      description: "Adapts to practical request in Kannada",
      passCondition: "Reply shifts to practical coaching — asks about specific creative interest or suggests a concrete first step. In romanized Kannada.",
      failExpectedOutcome: "Reply stays empathetic-only without giving practical direction when user explicitly asked for it.",
    },
  },

  {
    id: "kn-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long Kannada: topic shift handled gracefully",
    description: "User shifts from relationship grief to practical question.",
    messages: [
      { role: "user", content: "nanage tumba dinsinda relation problem ide." },
      { role: "assistant", content: "enu aaytu? heli." },
      { role: "user", content: "partner naanna jote mathadokke istapadadilla." },
      { role: "assistant", content: "aa doorada feeling — tumba hurt aagutte annistade." },
      { role: "user", content: "ha. tumba dinsinda try maadtidini." },
      { role: "assistant", content: "try maaduta maaduta response illadiru — tumba thukaagutte." },
      { role: "user", content: "ha sare. oru bera vishaya keeLuve — meditation shuru maadodhella?" },
    ],
    config: {
      lang: "kn", tone: "mentor", inputModality: "romanized",
      emotionMemory: "User was dealing with a relationship where partner is distant. Now shifting topic to ask about meditation — honor the pivot.",
    },
    criteria: {
      id: "kn-long-topic-shift-01",
      description: "Topic shift handled gracefully in Kannada",
      passCondition: "Reply pivots cleanly to meditation guidance — may briefly acknowledge the shift, then gives helpful starting point. In romanized Kannada.",
      failExpectedOutcome: "Reply ignores the topic shift and continues with relationship advice.",
    },
  },

  {
    id: "kn-long-closure-01",
    category: "D: Long Conversation",
    name: "Long Kannada: user signals closure — gentle send-off",
    description: "User says they need to go. Warm send-off, no more questions.",
    messages: [
      { role: "user", content: "nanage tumba kashta aagide." },
      { role: "assistant", content: "heli. naanu keltidini." },
      { role: "user", content: "relation lo issues ide." },
      { role: "assistant", content: "adu hurt maadide. enu aaytu?" },
      { role: "user", content: "tumba mathadide. ippudu walk ke hodini." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-long-closure-01",
      description: "Closure send-off in Kannada",
      passCondition: "Reply gives a warm send-off — acknowledges + encourages + reassures you'll be here. Does NOT ask any question. In romanized Kannada.",
      failExpectedOutcome: "Reply asks more questions or tries to continue the conversation instead of sending off warmly.",
    },
  },

  {
    id: "kn-long-drift-01",
    category: "D: Long Conversation",
    name: "Long Kannada: language consistency across many turns",
    description: "Long romanized Kannada conversation — no drift to English after many turns.",
    messages: [
      { role: "user", content: "nanage oru vishaya heLli." },
      { role: "assistant", content: "heli. naanu keltidini." },
      { role: "user", content: "naanu office lo tumba lonely annistide." },
      { role: "assistant", content: "aa lonely bhavane — office lo enu aaytu?" },
      { role: "user", content: "ellaru group aagitaare, naanu pakkadalli irtini." },
      { role: "assistant", content: "aa group lo seralu try maadidiya?" },
      { role: "user", content: "ha, aadre arthaagalilla." },
      { role: "assistant", content: "reject aadha tarah annistade — adu tumba hurt maadaadi." },
      { role: "user", content: "ha. ippudu office ge hogodu dread annistade." },
      { role: "assistant", content: "office ge hogodu dread — adu naanu close aagi arthamaadetini." },
      { role: "user", content: "ha. neenu artha maadtiya adu saku." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-long-drift-01",
      description: "No language drift after many turns in Kannada",
      passCondition: "Reply at turn 11 stays in romanized Kannada — does not drift to English. Continues the office loneliness thread.",
      failExpectedOutcome: "Reply drifts to English after many turns.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "kn-drift-from-english-base-01",
    category: "E: Language Drift",
    name: "Language drift: user writes native Kannada — reply stays in Kannada",
    description: "User writes native Kannada. Reply must stay in Kannada — not switch to English.",
    messages: [
      { role: "user", content: "ನನಗೆ ತುಂಬಾ ಸುಸ್ತಾಗಿದೆ. ಜೀವನ ಕಷ್ಟ ಅನ್ನಿಸ್ತಿದೆ." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "kn-drift-from-english-base-01",
      description: "No English drift for Kannada user",
      passCondition: "Reply is in Kannada script — warm, emotionally present. Does not switch to English or Hindi.",
      failExpectedOutcome: "Reply switches to English or Hindi instead of Kannada.",
    },
  },

  {
    id: "kn-drift-from-english-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Kannada",
    description: "Starts English, switches to Kannada. Reply must follow into Kannada.",
    messages: [
      { role: "user", content: "I'm feeling overwhelmed." },
      { role: "assistant", content: "That sounds heavy. What's going on?" },
      { role: "user", content: "ನನಗೆ ಎಲ್ಲ ಒಮ್ಮೆಲೇ ಬರ್ತಿದೆ. Handle ಮಾಡ್ಲಿಕ್ಕೇ ಆಗ್ತಿಲ್ಲ." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "kn-drift-from-english-01",
      description: "Language follow from English to Kannada",
      passCondition: "OVERRIDE: PASS if: reply contains any Kannada script or Kanglish words and shows any engagement with the user's feeling. FAIL ONLY if: reply is entirely in English with zero Kannada script or Kanglish words.",
      failExpectedOutcome: "Reply stays in English despite user switching to Kannada.",
    },
  },

  {
    id: "kn-drift-to-english-01",
    category: "E: Language Drift",
    name: "Language drift: Kannada with English loanwords — reply stays Kannada",
    description: "User writes Kannada with English loanwords. Reply should stay in Kannada.",
    messages: [
      { role: "user", content: "ನನ್ನ relationship lo tumba problems ide. Frustrated aagide." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "kn-drift-to-english-01",
      description: "Stays Kannada despite English loanwords",
      passCondition: "OVERRIDE: PASS if: reply engages warmly with the relationship frustration in any language — Kannada, Kanglish, or romanized. FAIL ONLY if: pure English reply with zero Kannada script or warmth.",
      failExpectedOutcome: "Reply flips to pure English because of the English loanwords in the user's message.",
    },
  },

  {
    id: "kn-drift-mixed-01",
    category: "E: Language Drift",
    name: "Language drift: previous English history, user now writes Kannada",
    description: "Conversation history has English, but current message is Kannada. Should reply in Kannada.",
    messages: [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm here. How are you doing?" },
      { role: "user", content: "ನಿಮ್ಮ ಜೊತೆ ಮಾತಾಡ್ಬೇಕಿತ್ತು. ನನಗೆ ತುಂಬಾ ಒತ್ತಡ ಆಗ್ತಿದೆ." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "kn-drift-mixed-01",
      description: "Current message overrides history language",
      passCondition: "Reply follows current Kannada message — warm, in Kannada. Does not stay in English from history.",
      failExpectedOutcome: "Reply stays in English based on conversation history despite current Kannada message.",
    },
  },

  {
    id: "kn-drift-native-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Kannada reply",
    description: "Native Kannada reply must not insert English phrases mid-reply.",
    messages: [
      { role: "user", content: "ನನಗೆ ಇದನ್ನ ಹೇಳ್ಲಿಕ್ಕೆ ತುಂಬಾ ಸಮಯ ಬೇಕಾಯ್ತು." },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "kn-drift-native-01",
      description: "No English phrase insertion in native Kannada",
      passCondition: "Reply stays fully in Kannada script. Does NOT insert English phrases like 'Take all the time you need'. Uses Kannada equivalent.",
      failExpectedOutcome: "Reply inserts English phrases mid-Kannada reply.",
    },
  },

  {
    id: "kn-drift-roman-01",
    category: "E: Language Drift",
    name: "Language drift: romanized Kannada after English history",
    description: "User switches from English to romanized Kannada. Reply mirrors romanized.",
    messages: [
      { role: "user", content: "Things have been difficult lately." },
      { role: "assistant", content: "That sounds tough. Tell me more." },
      { role: "user", content: "naanu oru vishaya bagge mathadodhella aagide." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "kn-drift-roman-01",
      description: "Romanized Kannada after English history",
      passCondition: "OVERRIDE: PASS if: reply contains any romanized Kannada or Kannada script and shows empathy. A mix of English and romanized Kannada is acceptable. FAIL ONLY if: reply is entirely in English with no Kannada words at all.",
      failExpectedOutcome: "Reply stays in English or uses Kannada script instead of romanized.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "kn-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Kannada input handled correctly",
    description: "Mobile platform — native Kannada must be recognized and replied in Kannada.",
    messages: [
      { role: "user", content: "ನನಗೆ ತುಂಬಾ ಬೇಸರ ಆಗಿದೆ. ನೀವು ಕೇಳ್ತೀರಾ?" },
    ],
    config: { lang: "kn", tone: "calm_companion", inputModality: "native", platform: "mobile" },
    criteria: {
      id: "kn-mobile-native-01",
      description: "Mobile native Kannada",
      passCondition: "Reply is in Kannada script — warm, acknowledges the sadness. Not in English or Telugu.",
      failExpectedOutcome: "Reply is in English or Telugu — mobile failed to handle Kannada script.",
    },
  },

  {
    id: "kn-mobile-roman-01",
    category: "F: Mobile Platform",
    name: "Mobile: romanized Kannada input detected correctly",
    description: "Mobile platform — romanized Kannada must be detected as 'kn', not 'en'.",
    messages: [
      { role: "user", content: "yaar, nanage tumba kashta. mathaadodhalla oru jagada beku." },
    ],
    config: { lang: "kn", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "kn-mobile-roman-01",
      description: "Mobile romanized Kannada detection",
      passCondition: "Reply is in romanized Kannada — confirms language was detected as 'kn'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Kannada.",
    },
  },

];
