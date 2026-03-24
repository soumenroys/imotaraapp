/**
 * tests/imotara-ai/scenarios.ml.ts
 *
 * E2E test scenarios for Malayalam (ml) language support.
 * Categories:
 *   A: Native Script (12) — Malayalam script input/output
 *   B: Romanized Malayalam (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Malayalam notes:
 *  - Script: Malayalam script (U+0D00–U+0D7F) — unique, distinctive curving script
 *  - Address: "nee/ninte" (informal/close friend), "ningal/ningalude" (formal/elder)
 *  - Gender: 2nd-person is gender-neutral in Malayalam — no conjugation change needed for user gender
 *  - Romanized markers: njaan, nee, ningal, ningade, enthu, cheyyanam, illa, kashtam, aayi, poyinnund
 */

import type { TestScenario } from "./types";

export const mlScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ml-native-lang-01",
    category: "A: Native Script",
    name: "Native Malayalam: reply must stay in Malayalam script",
    description: "User writes in Malayalam script. Reply must stay in Malayalam — not switch to Tamil or English.",
    messages: [
      { role: "user", content: "എനിക്ക് ഇപ്പോൾ വളരെ ക്ഷീണം തോന്നുന്നു. എന്ത് ചെയ്യണം എന്ന് അറിയില്ല." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ml-native-lang-01",
      description: "Language fidelity in Malayalam",
      passCondition: "Reply is in Malayalam script — warm, emotionally present. Not in Tamil, Hindi, or English.",
      failExpectedOutcome: "Reply switches to Tamil, Hindi, or English instead of staying in Malayalam.",
    },
  },

  {
    id: "ml-native-ctx-01",
    category: "A: Native Script",
    name: "Native Malayalam: references the specific situation",
    description: "User shares being scolded by boss in public. Reply should reference it.",
    messages: [
      { role: "user", content: "ഇന്ന് ബോസ്സ് എല്ലാർടേം മുന്നിൽ വച്ചിട്ട് എന്നെ ചീത്ത പറഞ്ഞു. ഒരുപാട് വേദനിച്ചു." },
    ],
    config: {
      lang: "ml", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was publicly scolded by their boss in front of everyone — reference this specifically.",
    },
    criteria: {
      id: "ml-native-ctx-01",
      description: "Context specificity in Malayalam",
      passCondition: "Reply references being scolded in front of everyone — not generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the public humiliation.",
    },
  },

  {
    id: "ml-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Malayalam: close_friend tone",
    description: "close_friend tone — casual, warm, informal 'നീ' address.",
    messages: [
      { role: "user", content: "യാർ, ഇന്ന് മനസ്സ് ശരിയില്ല. ഒന്നും ശരിയാണ് എന്ന് തോന്നുന്നില്ല." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ml-native-tone-friend-01",
      description: "close_friend tone in Malayalam",
      passCondition: "Reply is warm and casual — feels peer-level, like talking to a close friend. Does NOT sound formal or distant. Stays in Malayalam.",
      failExpectedOutcome: "Reply uses formal language as if speaking to a stranger, or switches to English.",
    },
  },

  {
    id: "ml-native-tone-companion-01",
    category: "A: Native Script",
    name: "Native Malayalam: calm_companion tone",
    description: "calm_companion tone — steady, gentle, present.",
    messages: [
      { role: "user", content: "എനിക്ക് ഒരുപാട് ഒറ്റപ്പെട്ടതായി തോന്നുന്നു. ആർക്കും മനസ്സിലാവില്ല." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ml-native-tone-companion-01",
      description: "calm_companion tone in Malayalam",
      passCondition: "Reply is steady and gentle — primarily validates the loneliness with warmth. May gently ask one non-pressuring question. No advice. Stays in Malayalam.",
      failExpectedOutcome: "Reply gives unsolicited advice, tells the user what to do, or is preachy.",
    },
  },

  {
    id: "ml-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Malayalam: coach tone asks practical question",
    description: "coach tone — acknowledge then ask one practical forward question.",
    messages: [
      { role: "user", content: "എനിക്ക് ഒരു ജോലി വേണം പക്ഷേ എവിടെ നിന്ന് തുടങ്ങണം എന്ന് അറിയില്ല." },
    ],
    config: { lang: "ml", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ml-native-tone-coach-01",
      description: "coach tone in Malayalam",
      passCondition: "Reply in Malayalam acknowledges briefly then ends with one practical forward question or next step — not just empathy.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "ml-native-tone-mentor-01",
    category: "A: Native Script",
    name: "Native Malayalam: mentor tone gives guidance",
    description: "mentor tone — wisdom, perspective, gentle guidance.",
    messages: [
      { role: "user", content: "ഒരു തീരുമാനം എടുക്കണം, പക്ഷേ തെറ്റ് ആകുമോ എന്ന് ഭയമാണ്." },
    ],
    config: { lang: "ml", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ml-native-tone-mentor-01",
      description: "mentor tone in Malayalam",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In Malayalam.",
      failExpectedOutcome: "Reply is generic comfort without any insight or guidance.",
    },
  },

  {
    id: "ml-native-tone-mentor-deep-01",
    category: "A: Native Script",
    name: "Native Malayalam: mentor tone with perseverance theme",
    description: "mentor tone — deep discouragement. Reply must go beyond empathy.",
    messages: [
      { role: "user", content: "ഞാൻ ഒരുപാട് കഷ്ടപ്പെടുന്നു, പക്ഷേ ഫലം കിട്ടുന്നില്ല." },
      { role: "assistant", content: "നിന്റെ കഷ്ടം എനിക്ക് മനസ്സിലാകുന്നു." },
      { role: "user", content: "ഒക്കെ ഉപേക്ഷിക്കണം എന്ന് തോന്നുന്നു." },
      { role: "assistant", content: "ആ വേദന ശരിക്കും ഭാരമാണ്." },
      { role: "user", content: "ഇനി ശ്രമിക്കുന്നത് അർഥമുണ്ടോ എന്ന് തോന്നുന്നില്ല." },
    ],
    config: { lang: "ml", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ml-native-tone-mentor-deep-01",
      description: "mentor tone depth in Malayalam",
      passCondition: "Reply goes beyond plain empathy — offers at least ONE of: a gentle question to help the user reflect, a reframe on perseverance, or any perspective that opens new thinking. Acknowledges their persistence. In Malayalam.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "ml-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Malayalam: teen register (13_17)",
    description: "Teen user — casual peer-level Malayalam, no preaching.",
    messages: [
      { role: "user", content: "യാർ, exam result വളരെ മോശമായി. വീട്ടിൽ ജഗ്ഗ ഉണ്ടാകും." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "ml-native-age-teen-01",
      description: "Teen register in Malayalam",
      passCondition: "Reply is casual and warm — peer-level, like a classmate. Acknowledges the exam result and/or home situation. Does NOT sound like an adult giving advice.",
      failExpectedOutcome: "Reply is preachy, formal, or gives parent-like advice instead of peer-level warmth.",
    },
  },

  {
    id: "ml-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Malayalam: elder register (65_plus)",
    description: "Elderly user — must use respectful 'നിങ്ങൾ/നിങ്ങൾക്ക്' address.",
    messages: [
      { role: "user", content: "മക്കൾ ദൂരെ പോയി. വീട് ഒരുപാട് ശൂന്യമായി തോന്നുന്നു." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "ml-native-age-elder-01",
      description: "Elder register in Malayalam",
      passCondition: "Reply uses respectful address — warm, patient, acknowledges the quiet loneliness of an empty home. No casual 'നീ' address.",
      failExpectedOutcome: "Reply uses informal 'നീ' or treats an elderly person casually.",
    },
  },

  {
    id: "ml-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Malayalam: context retention across turns",
    description: "Sister's wedding mentioned early; sister calls later. Connect them.",
    messages: [
      { role: "user", content: "ചേട്ടത്തിക്ക് കല്യാണം ആയി. വീട് ഒഴിഞ്ഞ് തോന്നുന്നു." },
      { role: "assistant", content: "ചേട്ടത്തി പോയ ശേഷം വീട് മാറിയ പോലെ തോന്നുന്നോ?" },
      { role: "user", content: "അതേ. ഓരോ രാത്രിയും ഓർക്കും." },
      { role: "assistant", content: "ചേട്ടത്തിയോടൊപ്പം ഉള്ള ഓർമ്മകൾ ഒരുപാടുണ്ടാകും." },
      { role: "user", content: "ഇപ്പോൾ അവൾ ഫോൺ ചെയ്തു. കരയണം പോലെ തോന്നി." },
    ],
    config: {
      lang: "ml", tone: "close_friend", inputModality: "native",
      emotionMemory: "User's sister got married and moved away, leaving the house empty. User misses her every night. NOW: sister called and user felt like crying — connect the tears to missing her since she left after marriage.",
    },
    criteria: {
      id: "ml-native-ctx-retention-01",
      description: "Context retention in Malayalam",
      passCondition: "Reply connects the phone call and feeling like crying to the earlier grief of missing sister since her marriage — warm, specific.",
      failExpectedOutcome: "Reply treats the phone call as standalone without connecting to the earlier grief about sister leaving.",
    },
  },

  {
    id: "ml-native-no-english-01",
    category: "A: Native Script",
    name: "Native Malayalam: no English leak in native reply",
    description: "Reply to native Malayalam must not insert English phrases mid-reply.",
    messages: [
      { role: "user", content: "ഇത് പറയാൻ ഒരുപാട് സമയം എടുത്തു." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ml-native-no-english-01",
      description: "No English leak in native Malayalam reply",
      passCondition: "Reply stays in Malayalam script. Does NOT insert English phrases like 'Take all the time you need'. Uses Malayalam equivalent.",
      failExpectedOutcome: "Reply inserts English phrases mid-Malayalam reply.",
    },
  },

  {
    id: "ml-native-female-01",
    category: "A: Native Script",
    name: "Native Malayalam: female user — emotionally engaged reply",
    description: "Female user shares exhaustion of carrying all responsibilities.",
    messages: [
      { role: "user", content: "ഞാൻ തന്നെ ഒക്കെ ചെയ്യണം. ആരും സഹായിക്കില്ല. ഒരുപാട് ക്ഷീണം." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "native", userGender: "female" },
    criteria: {
      id: "ml-native-female-01",
      description: "Emotional engagement for female user in Malayalam",
      passCondition: "Reply validates the exhaustion of carrying everything alone — warm, specific. In Malayalam.",
      failExpectedOutcome: "Reply is generic or dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED MALAYALAM — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ml-roman-lang-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: reply must be in romanized Malayalam",
    description: "User writes romanized Malayalam. Reply must mirror: romanized Malayalam, not native script or English.",
    messages: [
      { role: "user", content: "enikku ippo valare kshenam. enthu cheyyanum ennu ariyilla." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-roman-lang-01",
      description: "Script mirror in romanized Malayalam",
      passCondition: "Reply is in romanized Malayalam (Latin letters). Not in Malayalam script, not in English.",
      failExpectedOutcome: "Reply uses Malayalam Unicode script or switches to English.",
    },
  },

  {
    id: "ml-roman-no-script-leak-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: zero Malayalam Unicode characters in reply",
    description: "If user types romanized, reply must have zero Malayalam Unicode chars.",
    messages: [
      { role: "user", content: "veetil jagala aayi. valare disturb aanu." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-roman-no-script-leak-01",
      description: "No Malayalam script in romanized reply",
      passCondition: "Reply contains zero Malayalam Unicode characters (U+0D00–U+0D7F). All words use Latin letters.",
      failExpectedOutcome: "Reply contains any Malayalam script characters — script mirror rule violated.",
    },
  },

  {
    id: "ml-roman-emotional-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: emotional intelligence preserved",
    description: "Romanized input with emotional content — warm reply.",
    messages: [
      { role: "user", content: "achan koode mathadaanulla. avaru manassilaakilla." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-roman-emotional-01",
      description: "Emotional warmth in romanized Malayalam",
      passCondition: "Reply in romanized Malayalam acknowledges the rift with father ('achan' context) — warm, specific.",
      failExpectedOutcome: "Reply is generic or in English/native Malayalam script.",
    },
  },

  {
    id: "ml-roman-tone-coach-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: coach tone action-oriented",
    description: "Coach tone in romanized Malayalam — practical forward question.",
    messages: [
      { role: "user", content: "enikku oru job venda aadal ellide ninnu thudanganam ennu ariyilla." },
    ],
    config: { lang: "ml", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "ml-roman-tone-coach-01",
      description: "Coach tone in romanized Malayalam",
      passCondition: "Reply in romanized Malayalam asks a practical focusing question — 'evide field? enu experience undo?' Not just empathy.",
      failExpectedOutcome: "Reply is only empathetic without any practical direction, or in English/native script.",
    },
  },

  {
    id: "ml-roman-context-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: context across turns",
    description: "Multi-turn romanized conversation. Reply should reference earlier context.",
    messages: [
      { role: "user", content: "innu interview und. valare nervous aanu." },
      { role: "assistant", content: "nervous aaval manassilaakam. evide interview?" },
      { role: "user", content: "TCS lo. ente first interview aanu." },
      { role: "assistant", content: "TCS - first interview, exciting aanu. nee ready aanu." },
      { role: "user", content: "alla yaar, enikku select aakilla ennu thonnunnu." },
    ],
    config: {
      lang: "ml", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User has interview at TCS today — their very first interview. Nervous about not getting selected. Reference TCS or first interview specifically.",
    },
    criteria: {
      id: "ml-roman-context-01",
      description: "Context retention in romanized Malayalam",
      passCondition: "Reply references 'TCS' or 'first interview' — shows memory of the context. In romanized Malayalam.",
      failExpectedOutcome: "Reply is generic pep talk without referencing TCS or the first interview.",
    },
  },

  {
    id: "ml-roman-mobile-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: mobile platform language detection",
    description: "Mobile platform — romanized Malayalam must be detected as 'ml', not 'en'.",
    messages: [
      { role: "user", content: "njaan ammaye miss cheyyunnu. veettil ninnum valare doorathaanu." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ml-roman-mobile-01",
      description: "Mobile romanized Malayalam detection",
      passCondition: "Reply is in romanized Malayalam — confirms language was detected as 'ml'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Malayalam.",
    },
  },

  {
    id: "ml-roman-no-english-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: no flip to pure English",
    description: "Even with English loanwords, reply must stay in romanized Malayalam.",
    messages: [
      { role: "user", content: "office lo presentation kodanam. valare nervous aanu." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-roman-no-english-01",
      description: "No flip to English in romanized Malayalam",
      passCondition: "Reply is in romanized Malayalam — may contain English loanwords but structure is Malayalam.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "ml-roman-teen-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: teen register peer-level",
    description: "Teen user in romanized Malayalam — casual peer language.",
    messages: [
      { role: "user", content: "yaar, exams valare tough. enthu cheyyum ennu ariyilla." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "ml-roman-teen-01",
      description: "Teen register in romanized Malayalam",
      passCondition: "Reply is casual, peer-level romanized Malayalam — like a classmate. Short, warm, no adult preaching.",
      failExpectedOutcome: "Reply is preachy, formal, or gives parent-like advice.",
    },
  },

  {
    id: "ml-roman-elder-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: elder register respectful",
    description: "Elderly user in romanized Malayalam — must use respectful 'ningal/ningalude'.",
    messages: [
      { role: "user", content: "makkalu valare doorathanu. veedu valare shaantham aanu." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "ml-roman-elder-01",
      description: "Elder register in romanized Malayalam",
      passCondition: "Reply uses respectful 'ningal'/'ningalkku' address — warm, patient, deeply respectful. Acknowledges the quiet of an empty home. Never uses casual 'nee'.",
      failExpectedOutcome: "Reply uses casual 'nee' or treats an elderly person informally.",
    },
  },

  {
    id: "ml-roman-anxiety-01",
    category: "B: Romanized Malayalam",
    name: "Romanized Malayalam: anxiety — steady, not dismissive",
    description: "User shares anxiety — reply must be steady and validating.",
    messages: [
      { role: "user", content: "enikku valare anxiety aanu. urakkaanilla. enthu cheyyum ennu ariyilla." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ml-roman-anxiety-01",
      description: "Anxiety scenario in romanized Malayalam",
      passCondition: "Reply in romanized Malayalam validates the anxiety — steady, warm, not dismissive. Does not give unsolicited advice.",
      failExpectedOutcome: "Reply is dismissive, gives advice without acknowledging feeling, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ml-mixed-malayalam-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Malayalam-English: Manglish code-switch",
    description: "User writes Manglish (Malayalam-English mix). Reply should match language level.",
    messages: [
      { role: "user", content: "ഈ situation handle ചെയ്യാൻ എനിക്ക് വളരെ tough ആണ്." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ml-mixed-malayalam-english-01",
      description: "Manglish code-switch handling",
      passCondition: "Reply is warm and addresses the difficulty the user described — not generic. Any language mix is fine.",
      failExpectedOutcome: "Reply is generic without engaging with the specific difficulty, or is coldly formal.",
    },
  },

  {
    id: "ml-mixed-starts-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user starts English, continues in Malayalam",
    description: "Conversation starts in English, user switches to Malayalam. Reply should follow.",
    messages: [
      { role: "user", content: "I'm really struggling today." },
      { role: "assistant", content: "I'm here. What's going on?" },
      { role: "user", content: "ഒന്നും മനസ്സിലാകുന്നില്ല. ഒക്കെ കൈ വിട്ടു പോകുന്ന പോലെ." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ml-mixed-starts-english-01",
      description: "Language follow when user switches to Malayalam",
      passCondition: "Reply follows into Malayalam — responds to the feeling of things going out of control. Not stuck in English.",
      failExpectedOutcome: "Reply stays in English despite user switching to Malayalam.",
    },
  },

  {
    id: "ml-mixed-coach-english-ends-ml-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach in English, user ends in Malayalam",
    description: "Coach conversation in English, user ends in Malayalam.",
    messages: [
      { role: "user", content: "I want to start learning coding." },
      { role: "assistant", content: "Good goal. Which language interests you most?" },
      { role: "user", content: "Python anu. Aadal enikku start cheyyaanalla." },
    ],
    config: { lang: "ml", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "ml-mixed-coach-english-ends-ml-01",
      description: "Coach in mixed Malayalam-English",
      passCondition: "Reply responds to the Python/coding goal in Malayalam, romanized Malayalam, or Manglish — with a practical forward question.",
      failExpectedOutcome: "Reply ignores the switch to Malayalam or gives only empathy without practical direction.",
    },
  },

  {
    id: "ml-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Malayalam conversation, short message. Language should not reset.",
    messages: [
      { role: "user", content: "എനിക്ക് ഒരുപാട് ബുദ്ധിമുട്ടുന്നു." },
      { role: "assistant", content: "എന്ത് സംഭവിച്ചു? പറ." },
      { role: "user", content: "വീട്ടിൽ ഝഗ്ഗ ആയി." },
      { role: "assistant", content: "വീട്ടിൽ ഝഗ്ഗ — മനസ്സ് ഒരുപാട് ബുദ്ധിമുട്ടുന്നു." },
      { role: "user", content: "ആണ്." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ml-mixed-short-after-long-01",
      description: "Short message does not reset to English",
      passCondition: "Reply stays in Malayalam after short 'ആണ്' — continues the emotional thread without resetting to English.",
      failExpectedOutcome: "Reply switches to English or Tamil after a short response.",
    },
  },

  {
    id: "ml-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized Malayalam, user switches to English",
    description: "Conversation starts in romanized Malayalam, user switches to English.",
    messages: [
      { role: "user", content: "enikku office lo valare pressure und." },
      { role: "assistant", content: "office lo enthu aayi? paru." },
      { role: "user", content: "manager koode problem und." },
      { role: "assistant", content: "manager koode enthu problem?" },
      { role: "user", content: "I don't think my manager trusts me at all." },
    ],
    config: {
      lang: "ml", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User switched to English to say their manager doesn't trust them — acknowledge the trust issue directly.",
    },
    criteria: {
      id: "ml-mixed-starts-roman-switch-english-01",
      description: "Language follow when user switches to English",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the manager trust concern (manager/trust/믿/vishwasam) or shows warmth about the work difficulty. FAIL ONLY if: cold, dismissive, or completely ignores 'manager doesn't trust me'.",
      failExpectedOutcome: "Reply ignores the manager trust concern or gives a generic response.",
    },
  },

  {
    id: "ml-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: home loneliness shared by Malayalam user",
    description: "Malayalam user shares pain of feeling unseen at home.",
    messages: [
      { role: "user", content: "ഞാൻ Malayalam സംസാരിക്കും, പക്ഷേ ഇപ്പോൾ എന്ത് പറയണം എന്ന് അറിയില്ല." },
      { role: "assistant", content: "പറയാൻ പറ്റുന്നത് പറ. ഞാൻ കേൾക്കുന്നുണ്ട്." },
      { role: "user", content: "Veetil aarkum ente vedana manassilaakilla. Valare ekaakiyaanu." },
    ],
    config: {
      lang: "ml", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User feels nobody at home understands their pain — directly acknowledge this specific loneliness of feeling unseen at home.",
    },
    criteria: {
      id: "ml-mixed-home-loneliness-01",
      description: "Home loneliness acknowledged specifically",
      passCondition: "Reply acknowledges the specific pain of nobody at home understanding — warm, personal. Addresses feeling alone/unseen at home directly. Any language is fine.",
      failExpectedOutcome: "Reply is generic comfort without engaging with the specific pain of feeling unseen at home.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ml-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Malayalam: no reply repetition",
    description: "At turn 20, reply should not repeat openers or phrases from earlier turns.",
    messages: [
      { role: "user", content: "ente life lo valare problems und." },
      { role: "assistant", content: "enthu problems? paru." },
      { role: "user", content: "job illa, relation illa, oru sahayam illa." },
      { role: "assistant", content: "moonnum onnaay — idu valare bhaaram." },
      { role: "user", content: "ha. enikku valare kshenam." },
      { role: "assistant", content: "kshenam manassilaakam. nee valare divasam okkaney sahistunnu." },
      { role: "user", content: "veeattukaar 'try cheyyoo' anu." },
      { role: "assistant", content: "try cheyyumbol 'kooduthal cheyyoo' kelkkanam — valare bhaaram." },
      { role: "user", content: "enikku oru ariyaayillaayma." },
      { role: "assistant", content: "ippo oru answer illengil paravaayilla. njaan ikkund." },
      { role: "user", content: "nandi. valare ekaantham thonnunnu." },
      { role: "assistant", content: "aa ekaantham — paryaanu paraan kashtam." },
      { role: "user", content: "ha. raatri valare bhaaram thonnunnu." },
      { role: "assistant", content: "raatri shaantham — aasamayam aalochana bhaaram aakum." },
      { role: "user", content: "ippo nannaayi thonnunna undo." },
      { role: "assistant", content: "nannaayi thonnunna illa — sarigaanu, ikkidam." },
      { role: "user", content: "nee kelkkam, adu mathi." },
      { role: "assistant", content: "nee parayan — kelkkaanu njaan ikkund." },
      { role: "user", content: "oru snehidam orth poyi." },
      { role: "assistant", content: "aa sneham — ippo orth poyi enthu thonnunnu?" },
      { role: "user", content: "ha. avanu valare doorathaayi." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-long-no-repeat-01",
      description: "No repetition at turn 20 in Malayalam",
      passCondition: "Reply at turn 21 does not repeat earlier phrases like 'ekaantham' or 'ikkund'. Fresh response about the distant friend.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "ml-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Malayalam: remembers fact from turn 1 at turn 19",
    description: "User mentioned mother is sick at turn 1. At turn 19, good news — reference amma.",
    messages: [
      { role: "user", content: "ammakku health sari alla. valare chinta." },
      { role: "assistant", content: "ammakku enthu aayi? ethra divasam?" },
      { role: "user", content: "naalu dinsath jvaram." },
      { role: "assistant", content: "naalu din jvaram — veetil rest onnum illa." },
      { role: "user", content: "ha. njaan valare stress lo." },
      { role: "assistant", content: "amma chinta, stress — nee valare mosinnu." },
      { role: "user", content: "enikku valare bhayam." },
      { role: "assistant", content: "bhayam swabhaavikam — amma kosham." },
      { role: "user", content: "veeattukaarku parayan kashtam." },
      { role: "assistant", content: "ikkad parayam. njaan judge cheyyilla." },
      { role: "user", content: "doctor serious alla ennanu." },
      { role: "assistant", content: "thiru swasam vann? doctor words valare mukhyam." },
      { role: "user", content: "ha, konjam nannaayi." },
      { role: "assistant", content: "nannaayi. ippo neeyen konjam rest edallu." },
      { role: "user", content: "amma food kazhichu." },
      { role: "assistant", content: "kazhichu — idu chinna samarambham, ippo valare relief." },
      { role: "user", content: "ha. inda divas valare nannaayi thonnunnu." },
    ],
    config: {
      lang: "ml", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's mother has been sick with fever for 4 days. She just ate food for the first time and seems better — connect the good news to the original worry about amma's sickness.",
    },
    criteria: {
      id: "ml-long-ctx-memory-01",
      description: "Context memory across long conversation in Malayalam",
      passCondition: "Reply references amma eating or getting better — connects to the original worry about her 4-day fever.",
      failExpectedOutcome: "Reply is generic without connecting to amma's sickness or the relief of her eating.",
    },
  },

  {
    id: "ml-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long Malayalam: emotional arc that deepens",
    description: "Starts surface, goes deeper. Reply should match depth.",
    messages: [
      { role: "user", content: "enikku konjam off aanu." },
      { role: "assistant", content: "enthu thonnunnu?" },
      { role: "user", content: "valare dinsath oru boring thonnunnu." },
      { role: "assistant", content: "boring — oru adangal pola thonnunnundo?" },
      { role: "user", content: "ha. njaan enthu cheyyunnu ennu thonnunnu." },
      { role: "assistant", content: "purpose patti aalochnich?" },
      { role: "user", content: "ha. njaan valare dinsath ikkund, onu maarila." },
      { role: "assistant", content: "stuck pola thonnunnu — adu valare bhaaram." },
      { role: "user", content: "ippo enikku kanneer varunu." },
    ],
    config: {
      lang: "ml", tone: "calm_companion", inputModality: "romanized",
      emotionMemory: "User started with surface boredom, went deeper to feeling purposeless, and is now crying — meet them at this depth.",
    },
    criteria: {
      id: "ml-long-arc-deepens-01",
      description: "Depth matching as emotional arc deepens in Malayalam",
      passCondition: "Reply meets the user at the depth of tears — not surface-level comfort. Warm, steady, present. Does not pivot to advice.",
      failExpectedOutcome: "Reply treats the emotional depth like the early 'off' feeling — stays too light.",
    },
  },

  {
    id: "ml-long-tone-shift-01",
    category: "D: Long Conversation",
    name: "Long Malayalam: adapts to practical request",
    description: "User requests practical help after emotional exchange.",
    messages: [
      { role: "user", content: "enikku oru vishayath valare confused." },
      { role: "assistant", content: "enthu vishayam? paru." },
      { role: "user", content: "career patti." },
      { role: "assistant", content: "career lo enthu maarunn?" },
      { role: "user", content: "njaan ippo IT lo aanu, creative work cheyyaanum aagrham." },
      { role: "assistant", content: "aa aabhilash arth und. creative path patti aalochnich?" },
      { role: "user", content: "ha. practical steps parayan?" },
    ],
    config: { lang: "ml", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "ml-long-tone-shift-01",
      description: "Adapts to practical request in Malayalam",
      passCondition: "Reply shifts to practical coaching — asks about specific creative interest or suggests a concrete first step. In romanized Malayalam.",
      failExpectedOutcome: "Reply stays empathetic-only without giving practical direction when user explicitly asked for it.",
    },
  },

  {
    id: "ml-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long Malayalam: topic shift handled gracefully",
    description: "User shifts from relationship grief to practical question.",
    messages: [
      { role: "user", content: "enikku valare dinsath relation problem und." },
      { role: "assistant", content: "enthu aayi? paru." },
      { role: "user", content: "partner koode mathadaanilla." },
      { role: "assistant", content: "aa dooram — valare hurt aayi thonnunnu." },
      { role: "user", content: "ha. valare dinsath try cheyyunnu." },
      { role: "assistant", content: "try cheyyumbol response illaayal — valare kshanam." },
      { role: "user", content: "ha sare. oru vere vishayam chodyikkam — meditation start cheyyaan?" },
    ],
    config: {
      lang: "ml", tone: "mentor", inputModality: "romanized",
      emotionMemory: "User was dealing with a relationship where partner is distant. Now shifting topic to ask about meditation — honor the pivot.",
    },
    criteria: {
      id: "ml-long-topic-shift-01",
      description: "Topic shift handled gracefully in Malayalam",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the meditation question and gives any helpful guidance or first step — in romanized Malayalam or English. FAIL ONLY if: reply ignores the meditation question entirely and only continues with relationship advice.",
      failExpectedOutcome: "Reply ignores the topic shift and continues with relationship advice.",
    },
  },

  {
    id: "ml-long-closure-01",
    category: "D: Long Conversation",
    name: "Long Malayalam: user signals closure — gentle send-off",
    description: "User says they need to go. Warm send-off, no more questions.",
    messages: [
      { role: "user", content: "enikku valare budhimuttund." },
      { role: "assistant", content: "paru. njaan keltund." },
      { role: "user", content: "relation lo issues." },
      { role: "assistant", content: "adu hurt cheythu. enthu aayi?" },
      { role: "user", content: "valare mathadanu. ippo oru walk poyidam." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-long-closure-01",
      description: "Closure send-off in Malayalam",
      passCondition: "Reply gives a warm send-off — acknowledges + encourages + reassures you'll be here. Does NOT ask any question. In romanized Malayalam.",
      failExpectedOutcome: "Reply asks more questions or tries to continue the conversation instead of sending off warmly.",
    },
  },

  {
    id: "ml-long-drift-01",
    category: "D: Long Conversation",
    name: "Long Malayalam: language consistency across many turns",
    description: "Long romanized Malayalam conversation — no drift to English after many turns.",
    messages: [
      { role: "user", content: "enikku oru vishayam paryaam." },
      { role: "assistant", content: "paru. njaan keltund." },
      { role: "user", content: "njaan office lo valare lonely thonnunnu." },
      { role: "assistant", content: "aa lonely bhaavanaa — office lo enthu aayi?" },
      { role: "user", content: "ellaarum group aakum, njaan vashatthu." },
      { role: "assistant", content: "aa group lo koodaan try cheyyumo?" },
      { role: "user", content: "ha, aadal manassilaayilla." },
      { role: "assistant", content: "reject aayal pola — valare hurt cheyyum." },
      { role: "user", content: "ha. ippo office ku pogaan dread thonnunnu." },
      { role: "assistant", content: "office dread — adu njaan arth cheythu." },
      { role: "user", content: "ha. nee arth cheyyunnu adu mathi." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-long-drift-01",
      description: "No language drift after many turns in Malayalam",
      passCondition: "Reply at turn 11 stays in romanized Malayalam — does not drift to English. Continues the office loneliness thread.",
      failExpectedOutcome: "Reply drifts to English after many turns.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ml-drift-stays-malayalam-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Malayalam — reply stays in Malayalam",
    description: "Malayalam user — reply should not drift to Tamil, Hindi, or English.",
    messages: [
      { role: "user", content: "എനിക്ക് ഒരുപാട് ക്ഷീണം. ജീവിതം ബുദ്ധിമുട്ടാണ്." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ml-drift-stays-malayalam-01",
      description: "No language drift for Malayalam user",
      passCondition: "Reply is in Malayalam script — warm, emotionally present. Does not switch to Tamil, Hindi, or English.",
      failExpectedOutcome: "Reply switches to Tamil, Hindi, or English instead of Malayalam.",
    },
  },

  {
    id: "ml-drift-from-english-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Malayalam",
    description: "Starts English, switches to Malayalam. Reply must follow into Malayalam.",
    messages: [
      { role: "user", content: "I'm feeling overwhelmed." },
      { role: "assistant", content: "That sounds heavy. What's going on?" },
      { role: "user", content: "ഒന്നും മനസ്സിലാകുന്നില്ല. ഒക്കെ കൈ വിട്ടു പോകുന്ന പോലെ." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ml-drift-from-english-01",
      description: "Language follow from English to Malayalam",
      passCondition: "OVERRIDE: PASS if: reply contains any Malayalam script or Manglish words and shows any engagement with the user's feeling. FAIL ONLY if: reply is entirely in English with zero Malayalam or Manglish words.",
      failExpectedOutcome: "Reply stays in English despite user switching to Malayalam.",
    },
  },

  {
    id: "ml-drift-to-english-01",
    category: "E: Language Drift",
    name: "Language drift: Malayalam with English loanwords — reply stays Malayalam",
    description: "User writes Malayalam with English loanwords. Reply should stay in Malayalam.",
    messages: [
      { role: "user", content: "ente relationship lo valare problems und. Frustrated aanu." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ml-drift-to-english-01",
      description: "Stays Malayalam despite English loanwords",
      passCondition: "Reply engages with the relationship frustration in Malayalam or Manglish — not pure English.",
      failExpectedOutcome: "Reply flips to pure English because of the English loanwords in the user's message.",
    },
  },

  {
    id: "ml-drift-mixed-01",
    category: "E: Language Drift",
    name: "Language drift: previous English history, user now writes Malayalam",
    description: "Conversation history has English, but current message is Malayalam.",
    messages: [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm here. How are you doing?" },
      { role: "user", content: "നിങ്ങളോട് സംസാരിക്കണം. ഒരുപാട് ടെൻഷൻ." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ml-drift-mixed-01",
      description: "Current message overrides history language",
      passCondition: "OVERRIDE: PASS if: reply contains any Malayalam script or Manglish and shows warmth or presence — even a single Malayalam word embedded in an otherwise warm reply counts. FAIL ONLY if: reply is entirely in English with zero Malayalam script or Manglish words.",
      failExpectedOutcome: "Reply stays in English based on conversation history despite current Malayalam message.",
    },
  },

  {
    id: "ml-drift-native-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Malayalam reply",
    description: "Native Malayalam reply must not insert English phrases mid-reply.",
    messages: [
      { role: "user", content: "ഇത് പറയാൻ ഒരുപാട് സമയം വേണ്ടി വന്നു." },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ml-drift-native-01",
      description: "No English phrase insertion in native Malayalam",
      passCondition: "Reply stays fully in Malayalam script. Does NOT insert English phrases like 'Take all the time you need'. Uses Malayalam equivalent.",
      failExpectedOutcome: "Reply inserts English phrases mid-Malayalam reply.",
    },
  },

  {
    id: "ml-drift-roman-01",
    category: "E: Language Drift",
    name: "Language drift: romanized Malayalam after English history",
    description: "User switches from English to romanized Malayalam. Reply mirrors romanized.",
    messages: [
      { role: "user", content: "Things have been difficult lately." },
      { role: "assistant", content: "That sounds tough. Tell me more." },
      { role: "user", content: "njaan oru vishayam paryaam ennu thirumanichchu." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ml-drift-roman-01",
      description: "Romanized Malayalam after English history",
      passCondition: "Reply mirrors into romanized Malayalam — not English, not Malayalam script.",
      failExpectedOutcome: "Reply stays in English or uses Malayalam script instead of romanized.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ml-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Malayalam input handled correctly",
    description: "Mobile platform — native Malayalam must be recognized and replied in Malayalam.",
    messages: [
      { role: "user", content: "എനിക്ക് ഒരുപാട് ദുഃഖം. നിങ്ങൾ കേൾക്കുമോ?" },
    ],
    config: { lang: "ml", tone: "calm_companion", inputModality: "native", platform: "mobile" },
    criteria: {
      id: "ml-mobile-native-01",
      description: "Mobile native Malayalam",
      passCondition: "Reply is in Malayalam script — warm, acknowledges the sadness. Not in English or Tamil.",
      failExpectedOutcome: "Reply is in English or Tamil — mobile failed to handle Malayalam script.",
    },
  },

  {
    id: "ml-mobile-roman-01",
    category: "F: Mobile Platform",
    name: "Mobile: romanized Malayalam input detected correctly",
    description: "Mobile platform — romanized Malayalam must be detected as 'ml', not 'en'.",
    messages: [
      { role: "user", content: "yaar, enikku valare kashtam. mathaadaan oru idamvenda." },
    ],
    config: { lang: "ml", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ml-mobile-roman-01",
      description: "Mobile romanized Malayalam detection",
      passCondition: "Reply is in romanized Malayalam — confirms language was detected as 'ml'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Malayalam.",
    },
  },

];
