/**
 * tests/imotara-ai/scenarios.or.ts
 *
 * E2E test scenarios for Odia (or) language support.
 * Categories:
 *   A: Native Script (12) — Odia script input/output
 *   B: Romanized Odia (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Odia notes:
 *  - Script: Odia script (U+0B00–U+0B7F) — curving script, distinct from Bengali/Devanagari
 *  - Address: "tu/tura" (informal/close friend), "aapana/aapanka" (formal/elder)
 *  - Gender: 2nd-person is gender-neutral in Odia
 *  - Romanized markers: mun, tu, aapana, dukha, kashta, ekuti, jani, bujhi, achi, nahi, kana, bhala
 */

import type { TestScenario } from "./types";

export const orScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "or-native-lang-01",
    category: "A: Native Script",
    name: "Native Odia: reply must stay in Odia script",
    description: "User writes in Odia script. Reply must stay in Odia — not switch to Bengali or English.",
    messages: [
      { role: "user", content: "ମୋ ମନ ଭଲ ନାହିଁ। କଣ କରିବି ଜାଣୁ ନାହିଁ।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "or-native-lang-01",
      description: "Language fidelity in Odia",
      passCondition: "Reply is in Odia script — addresses the user's feeling. Not in Bengali, Hindi, or English.",
      failExpectedOutcome: "Reply switches to Bengali, Hindi, or English instead of staying in Odia.",
    },
  },

  {
    id: "or-native-ctx-01",
    category: "A: Native Script",
    name: "Native Odia: references the specific situation",
    description: "User shares being scolded by boss in public. Reply should reference it.",
    messages: [
      { role: "user", content: "ଆଜି ବସ ସବ ଆଗରେ ମୋତେ ଗାଳ ଦେଲା। ଅନେକ ଦୁଃଖ ଲାଗୁଛି।" },
    ],
    config: {
      lang: "or", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was publicly scolded by their boss in front of everyone — reference this specifically.",
    },
    criteria: {
      id: "or-native-ctx-01",
      description: "Context specificity in Odia",
      passCondition: "Reply references being scolded in front of everyone — not generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the public humiliation.",
    },
  },

  {
    id: "or-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Odia: close_friend tone",
    description: "close_friend tone — casual, warm, informal address.",
    messages: [
      { role: "user", content: "ୟାର, ଆଜି ମନ ଠିକ ନାହିଁ। ସବ ଅଜବ ଲାଗୁଛି।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "or-native-tone-friend-01",
      description: "close_friend tone in Odia",
      passCondition: "Reply acknowledges the user's off mood with any warmth — not cold, dismissive, or lecturing. Stays in Odia. Does NOT switch to English or Bengali. The tone may vary from casual to semi-formal as long as it's supportive.",
      failExpectedOutcome: "Reply uses formal language or switches to English/Bengali.",
    },
  },

  {
    id: "or-native-tone-companion-01",
    category: "A: Native Script",
    name: "Native Odia: calm_companion tone",
    description: "calm_companion tone — steady, gentle, present.",
    messages: [
      { role: "user", content: "ମୋ ଏକୁଟି ଲାଗୁଛି। କେହି ବୁଝୁ ନାହିଁ।" },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "or-native-tone-companion-01",
      description: "calm_companion tone in Odia",
      passCondition: "Reply is steady and gentle — validates the loneliness with warmth. May gently ask one non-pressuring question. No advice. Stays in Odia.",
      failExpectedOutcome: "Reply gives unsolicited advice or is preachy instead of being present.",
    },
  },

  {
    id: "or-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Odia: coach tone asks practical question",
    description: "coach tone — acknowledge then ask one practical forward question.",
    messages: [
      { role: "user", content: "ମୋ ଚାକିରି ଦରକାର ମାତ୍ର କେଉଁଠୁ ଆରମ୍ଭ କରିବି ଜାଣୁ ନାହିଁ।" },
    ],
    config: { lang: "or", tone: "coach", inputModality: "native" },
    criteria: {
      id: "or-native-tone-coach-01",
      description: "coach tone in Odia",
      passCondition: "Reply in Odia acknowledges the user's situation and includes at least some practical element — a question, a concrete suggestion, or a next step. Not purely emotional soothing with no direction whatsoever.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "or-native-tone-mentor-01",
    category: "A: Native Script",
    name: "Native Odia: mentor tone gives guidance",
    description: "mentor tone — wisdom, perspective, gentle guidance.",
    messages: [
      { role: "user", content: "ଗୋଟିଏ ନିଷ୍ପତ୍ତି ନେବାକୁ ହେବ ମାତ୍ର ଭୁଲ ହେବ ବୋଲି ଭୟ ଅଛି।" },
    ],
    config: { lang: "or", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "or-native-tone-mentor-01",
      description: "mentor tone in Odia",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In Odia.",
      failExpectedOutcome: "Reply is generic comfort without any insight or guidance.",
    },
  },

  {
    id: "or-native-tone-mentor-deep-01",
    category: "A: Native Script",
    name: "Native Odia: mentor tone with perseverance theme",
    description: "mentor tone — deep discouragement. Reply must go beyond empathy.",
    messages: [
      { role: "user", content: "ମୁଁ ଅନେକ କଷ୍ଟ କରୁଛି ମାତ୍ର ଫଳ ମିଳୁ ନାହିଁ।" },
      { role: "assistant", content: "ତୁ ର କଷ୍ଟ ଜାଣୁଛି।" },
      { role: "user", content: "ସବ ଛାଡ଼ି ଦେବାକୁ ଲାଗୁଛି।" },
      { role: "assistant", content: "ଏ ଯନ୍ତ୍ରଣା ଅନୁଭବ ହୁଏ।" },
      { role: "user", content: "ଆଉ ଚେଷ୍ଟା କରିବା ଠିକ ଅଛି କି ନାହିଁ ଜାଣୁ ନାହିଁ।" },
    ],
    config: { lang: "or", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "or-native-tone-mentor-deep-01",
      description: "mentor tone depth in Odia",
      passCondition: "Reply is in Odia and is NOT purely 'I understand your pain / that's hard' — any of the following count as a pass: asking a question, mentioning their effort/persistence/hard work, or saying something hopeful. Even a gentle question like 'is there any small hope?' counts.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "or-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Odia: teen register (13_17)",
    description: "Teen user — casual peer-level Odia, no preaching.",
    messages: [
      { role: "user", content: "ୟାର, exam result ବହୁତ ଖରାପ ଆସିଲା। ଘରେ ଝଗଡ଼ା ହେବ।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "or-native-age-teen-01",
      description: "Teen register in Odia",
      passCondition: "Reply acknowledges the user's difficult situation (bad result + home tension) with warmth. Not cold or dismissive. Does NOT moralize about studying harder. Stays in Odia.",
      failExpectedOutcome: "Reply is preachy, formal, or gives parent-like advice.",
    },
  },

  {
    id: "or-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Odia: elder register (65_plus)",
    description: "Elderly user — must use respectful 'ଆପଣ' address.",
    messages: [
      { role: "user", content: "ପୁଅ-ଝିଅ ଦୂରରେ ଚାଲି ଗଲେ। ଘର ଏକୁଟି ଲାଗୁଛି।" },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "or-native-age-elder-01",
      description: "Elder register in Odia",
      passCondition: "Reply uses respectful address — warm, patient, acknowledges the quiet loneliness of an empty home. No casual 'ତୁ' address.",
      failExpectedOutcome: "Reply uses informal 'ତୁ' or treats an elderly person casually.",
    },
  },

  {
    id: "or-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Odia: context retention across turns",
    description: "Sister's wedding mentioned early; sister calls later. Connect them.",
    messages: [
      { role: "user", content: "ଭଉଣୀ ର ବିବାହ ହୋଇଗଲା। ଘର ଶୂନ ଲାଗୁଛି।" },
      { role: "assistant", content: "ଭଉଣୀ ଚାଲି ଯିବା ପରେ ଘର ବଦଳି ଗଲା ଲାଗୁଛି?" },
      { role: "user", content: "ହଁ। ପ୍ରତ୍ୟେକ ରାତ୍ରି ମନେ ଆସୁଛି।" },
      { role: "assistant", content: "ଭଉଣୀ ସଙ୍ଗରେ ଅଛ।" },
      { role: "user", content: "ଏଠି ସେ ଫୋନ ଦେଲା। ଆଖ ଲୁହ ଆସିଲା।" },
    ],
    config: {
      lang: "or", tone: "close_friend", inputModality: "native",
      emotionMemory: "User's sister got married and moved away, leaving the house empty. User misses her every night. NOW: sister called and user cried — connect the tears to missing her since she left after marriage.",
    },
    criteria: {
      id: "or-native-ctx-retention-01",
      description: "Context retention in Odia",
      passCondition: "Reply connects the tears and phone call to the earlier grief of missing sister since her marriage — warm, specific.",
      failExpectedOutcome: "Reply treats the phone call as standalone without connecting to the earlier grief.",
    },
  },

  {
    id: "or-native-no-english-01",
    category: "A: Native Script",
    name: "Native Odia: no English leak in native reply",
    description: "Reply to native Odia must not insert English phrases mid-reply.",
    messages: [
      { role: "user", content: "ଏ କଥା କହିବାକୁ ଅନେକ ସମୟ ଲାଗିଲା।" },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "or-native-no-english-01",
      description: "No English leak in native Odia reply",
      passCondition: "Reply stays in Odia script. Does NOT insert English phrases like 'Take all the time you need'. Uses Odia equivalent.",
      failExpectedOutcome: "Reply inserts English phrases mid-Odia reply.",
    },
  },

  {
    id: "or-native-female-01",
    category: "A: Native Script",
    name: "Native Odia: female user — emotionally engaged reply",
    description: "Female user shares exhaustion of carrying all responsibilities.",
    messages: [
      { role: "user", content: "ମୁଁ ହିଁ ସବ କରୁଛି। କେହି ସାହାଯ୍ୟ କରୁ ନାହିଁ। ଅନେକ ଥକ ଲାଗୁଛି।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "native", userGender: "female" },
    criteria: {
      id: "or-native-female-01",
      description: "Emotional engagement for female user in Odia",
      passCondition: "Reply validates the exhaustion of carrying everything alone — warm, specific. In Odia.",
      failExpectedOutcome: "Reply is generic or dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED ODIA — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "or-roman-lang-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: reply must be in romanized Odia",
    description: "User writes romanized Odia. Reply must mirror: romanized Odia, not native script or English.",
    messages: [
      { role: "user", content: "mo mana bhala nahi. kana karibaku janibana." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-roman-lang-01",
      description: "Script mirror in romanized Odia",
      passCondition: "Reply is in romanized Odia (Latin letters). Not in Odia script, not in English.",
      failExpectedOutcome: "Reply uses Odia Unicode script or switches to English.",
    },
  },

  {
    id: "or-roman-no-script-leak-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: zero Odia Unicode characters in reply",
    description: "If user types romanized, reply must have zero Odia Unicode chars.",
    messages: [
      { role: "user", content: "ghare jhagada hoi gala. bahuta disturb laguchhi." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-roman-no-script-leak-01",
      description: "No Odia script in romanized reply",
      passCondition: "Reply contains zero Odia Unicode characters (U+0B00–U+0B7F). All words use Latin letters.",
      failExpectedOutcome: "Reply contains any Odia script characters — script mirror rule violated.",
    },
  },

  {
    id: "or-roman-emotional-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: emotional intelligence preserved",
    description: "Romanized input with emotional content — warm reply.",
    messages: [
      { role: "user", content: "baba sathe kotha kaibaku nahi. se bujhanti nahi." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-roman-emotional-01",
      description: "Emotional warmth in romanized Odia",
      passCondition: "Reply in romanized Odia acknowledges the rift with father ('baba' context) — warm, specific.",
      failExpectedOutcome: "Reply is generic or in English/native Odia script.",
    },
  },

  {
    id: "or-roman-tone-coach-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: coach tone action-oriented",
    description: "Coach tone in romanized Odia — practical forward question.",
    messages: [
      { role: "user", content: "mo chakiri daragara matra keta tharu arambha karibiku janibana." },
    ],
    config: { lang: "or", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "or-roman-tone-coach-01",
      description: "Coach tone in romanized Odia",
      passCondition: "Reply in romanized Odia asks a practical focusing question — 'kana field? kana experience achi?' Not just empathy.",
      failExpectedOutcome: "Reply is only empathetic without any practical direction, or in English/native script.",
    },
  },

  {
    id: "or-roman-context-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: context across turns",
    description: "Multi-turn romanized conversation. Reply should reference earlier context.",
    messages: [
      { role: "user", content: "aji interview achi. bahuta nervous laguchhi." },
      { role: "assistant", content: "nervous lagiba bujhijae. interview kete?" },
      { role: "user", content: "Wipro re. etu moro pahila interview." },
      { role: "assistant", content: "Wipro - pahila interview, exciting. tume taiyara achha." },
      { role: "user", content: "nahi yaar, moro laguchhi select nahibi." },
    ],
    config: {
      lang: "or", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User has interview at Wipro today — their very first interview. Nervous about not getting selected. Reference Wipro or first interview specifically.",
    },
    criteria: {
      id: "or-roman-context-01",
      description: "Context retention in romanized Odia",
      passCondition: "Reply references 'Wipro' or 'pahila interview' — shows memory of the context. In romanized Odia.",
      failExpectedOutcome: "Reply is generic pep talk without referencing Wipro or the first interview.",
    },
  },

  {
    id: "or-roman-mobile-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: mobile platform language detection",
    description: "Mobile platform — romanized Odia must be detected as 'or', not 'en'.",
    messages: [
      { role: "user", content: "mun maa ku miss karichhi. ghara tharu bahuta dure achi." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "or-roman-mobile-01",
      description: "Mobile romanized Odia detection",
      passCondition: "Reply is in romanized Odia — confirms language was detected as 'or'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Odia.",
    },
  },

  {
    id: "or-roman-no-english-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: no flip to pure English",
    description: "Even with English loanwords, reply must stay in romanized Odia.",
    messages: [
      { role: "user", content: "office re presentation deba. bahuta nervous laguchhi." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-roman-no-english-01",
      description: "No flip to English in romanized Odia",
      passCondition: "Reply is in romanized Odia — may contain English loanwords but structure is Odia.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "or-roman-teen-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: teen register peer-level",
    description: "Teen user in romanized Odia — casual peer language.",
    messages: [
      { role: "user", content: "yaar, exams bahuta tough. kana karibiku janibana." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "or-roman-teen-01",
      description: "Teen register in romanized Odia",
      passCondition: "Reply is casual, peer-level romanized Odia — like a classmate. Short, warm, no adult preaching.",
      failExpectedOutcome: "Reply is preachy, formal, or gives parent-like advice.",
    },
  },

  {
    id: "or-roman-elder-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: elder register respectful",
    description: "Elderly user in romanized Odia — must use respectful 'aapana'.",
    messages: [
      { role: "user", content: "pua jhia bahuta dure galachhanti. ghara ekuti laguchhi." },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "or-roman-elder-01",
      description: "Elder register in romanized Odia",
      passCondition: "Reply uses respectful 'aapana'/'aapankara' address — warm, patient, deeply respectful. Acknowledges the loneliness. Never uses casual 'tu'.",
      failExpectedOutcome: "Reply uses casual 'tu' or treats an elderly person informally.",
    },
  },

  {
    id: "or-roman-anxiety-01",
    category: "B: Romanized Odia",
    name: "Romanized Odia: anxiety — steady, not dismissive",
    description: "User shares anxiety — reply must be steady and validating.",
    messages: [
      { role: "user", content: "moro bahuta anxiety achi. nidra yauchhi nahi. kana karibiku janibana." },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "or-roman-anxiety-01",
      description: "Anxiety scenario in romanized Odia",
      passCondition: "Reply in romanized Odia validates the anxiety — steady, warm, not dismissive. Does not give unsolicited advice.",
      failExpectedOutcome: "Reply is dismissive, gives advice without acknowledging feeling, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "or-mixed-odia-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Odia-English: code-switch handling",
    description: "User writes Odia-English mix. Reply should match language level.",
    messages: [
      { role: "user", content: "ଏ situation handle କରିବାକୁ ବହୁତ tough ଲାଗୁଛି।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "or-mixed-odia-english-01",
      description: "Odia-English code-switch handling",
      passCondition: "Reply is warm and addresses the difficulty specifically. Any language mix is fine.",
      failExpectedOutcome: "Reply is generic without engaging with the specific difficulty, or is coldly formal.",
    },
  },

  {
    id: "or-mixed-starts-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user starts English, continues in Odia",
    description: "Conversation starts in English, user switches to Odia. Reply should follow.",
    messages: [
      { role: "user", content: "I'm really struggling today." },
      { role: "assistant", content: "I'm here. What's going on?" },
      { role: "user", content: "କିଛି ବୁଝୁ ନାହିଁ। ସବ ହାତ ଛଡ଼ି ଯାଉଛି ଲାଗୁଛି।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "or-mixed-starts-english-01",
      description: "Language follow when user switches to Odia",
      passCondition: "Reply follows into Odia — responds to the feeling of things going out of control. Not stuck in English.",
      failExpectedOutcome: "Reply stays in English despite user switching to Odia.",
    },
  },

  {
    id: "or-mixed-coach-english-ends-or-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach in English, user ends in Odia",
    description: "Coach conversation in English, user ends in Odia.",
    messages: [
      { role: "user", content: "I want to start learning coding." },
      { role: "assistant", content: "Good goal. Which language interests you most?" },
      { role: "user", content: "Python bolanti. matra moru kahibu janibana." },
    ],
    config: { lang: "or", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "or-mixed-coach-english-ends-or-01",
      description: "Coach in mixed Odia-English",
      passCondition: "Reply responds to the Python/coding goal in Odia, romanized Odia, or mixed — with a practical forward question.",
      failExpectedOutcome: "Reply ignores the switch to Odia or gives only empathy without practical direction.",
    },
  },

  {
    id: "or-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Odia conversation, short message. Language should not reset.",
    messages: [
      { role: "user", content: "ମୋ ଅନେକ ଦୁଃଖ ଅଛି।" },
      { role: "assistant", content: "କଣ ହୋଇଛି? କୁହ।" },
      { role: "user", content: "ଘରେ ଝଗଡ଼ା ହୋଇଗଲା।" },
      { role: "assistant", content: "ଘରେ ଝଗଡ଼ା — ମନ ଅନେକ ଦୁଃଖ ଲାଗୁଛି।" },
      { role: "user", content: "ହଁ।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "or-mixed-short-after-long-01",
      description: "Short message does not reset to English",
      passCondition: "Reply stays in Odia after short 'ହଁ' — continues the emotional thread without resetting to English.",
      failExpectedOutcome: "Reply switches to English or Hindi after a short response.",
    },
  },

  {
    id: "or-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized Odia, user switches to English",
    description: "Conversation starts in romanized Odia, user switches to English.",
    messages: [
      { role: "user", content: "moro office re bahuta pressure achi." },
      { role: "assistant", content: "office re kana hoi gala? kahu." },
      { role: "user", content: "manager sathe problem achi." },
      { role: "assistant", content: "manager sathe kana problem?" },
      { role: "user", content: "I don't think my manager trusts me at all." },
    ],
    config: {
      lang: "or", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User switched to English to say their manager doesn't trust them — acknowledge the trust issue directly.",
    },
    criteria: {
      id: "or-mixed-starts-roman-switch-english-01",
      description: "Language follow when user switches to English",
      passCondition: "Reply addresses the manager trust concern specifically and warmly. May be in English, romanized Odia, or mix.",
      failExpectedOutcome: "Reply ignores the manager trust concern or gives a generic response.",
    },
  },

  {
    id: "or-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: home loneliness shared by Odia user",
    description: "Odia user shares pain of feeling unseen at home.",
    messages: [
      { role: "user", content: "ମୁଁ ଓଡ଼ିଆ ଜାଣେ, ମାତ୍ର ଏବେ କଣ କହିବି ବୁଝୁ ନାହିଁ।" },
      { role: "assistant", content: "ଯଥାସମ୍ଭବ କୁହ। ଶୁଣୁଛି।" },
      { role: "user", content: "Ghare keu moro dukha bujhanti nahi. Bahuta ekuti laguchhi." },
    ],
    config: {
      lang: "or", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User feels nobody at home understands their pain — directly acknowledge this specific loneliness of feeling unseen at home.",
    },
    criteria: {
      id: "or-mixed-home-loneliness-01",
      description: "Home loneliness acknowledged specifically",
      passCondition: "OVERRIDE: PASS if: reply shows warmth about loneliness or feeling unseen/ununderstood — in any language. FAIL ONLY if: completely ignores the loneliness with zero empathetic content.",
      failExpectedOutcome: "Reply is generic comfort without engaging with the specific pain of feeling unseen at home.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "or-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Odia: no reply repetition",
    description: "At turn 20, reply should not repeat openers or phrases from earlier turns.",
    messages: [
      { role: "user", content: "moro jibana re bahuta samasya achi." },
      { role: "assistant", content: "kana samasya? kahu." },
      { role: "user", content: "chakiri nahi, pyar nahi, sahajya nahi." },
      { role: "assistant", content: "tinitu ekasathe — etu bahuta bhara." },
      { role: "user", content: "ha. moro bahuta thaka laguchhi." },
      { role: "assistant", content: "thaka bujhijae. tu bahu dinsara ekaaku sahisthili." },
      { role: "user", content: "ghara loka bole try kar." },
      { role: "assistant", content: "try karibele 'aru kar' sunibaku pade — bahuta thakae." },
      { role: "user", content: "moro kichhi bujhibu nahi." },
      { role: "assistant", content: "ebelike uttara nathile parua nahi. mun achhi." },
      { role: "user", content: "dhanyabada. bahuta ekuti laguchhi." },
      { role: "assistant", content: "sei ekuti — kahiba kathin." },
      { role: "user", content: "ha. ratri bahuta bhara laguchhi." },
      { role: "assistant", content: "ratri shanta — seibele bichara bhara hue." },
      { role: "user", content: "ebelike bhala nahi." },
      { role: "assistant", content: "bhala nahi — thika achi, ekhan achhi." },
      { role: "user", content: "tu shunuchu etu mathi." },
      { role: "assistant", content: "tu kahuchu — shunibaku achhi." },
      { role: "user", content: "goita bandi mane pade." },
      { role: "assistant", content: "sei bandi — ebelike mane pade kana bhabu?" },
      { role: "user", content: "ha. se bahuta dure." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-long-no-repeat-01",
      description: "No repetition at turn 20 in Odia",
      passCondition: "Reply at turn 21 does not repeat earlier phrases like 'ekuti' or 'achhi'. Fresh response about the distant friend.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "or-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Odia: remembers fact from turn 1 at turn 19",
    description: "User mentioned mother is sick at turn 1. At turn 19, good news — reference maa.",
    messages: [
      { role: "user", content: "maa ku health bhala nahi. bahuta chinta huchhi." },
      { role: "assistant", content: "maa ku kana hoi gala? kete dinsara?" },
      { role: "user", content: "chara dinsara jvara." },
      { role: "assistant", content: "chara din jvara — ghara re bishi rest nahi." },
      { role: "user", content: "ha. mun bahuta stress re achi." },
      { role: "assistant", content: "maa chinta, stress — tu bahuta moshi achha." },
      { role: "user", content: "moro bahuta dara laguchhi." },
      { role: "assistant", content: "dara svabhabika — maa kathare." },
      { role: "user", content: "ghara loke ku kahibaku kathin." },
      { role: "assistant", content: "ethan kahi paru. mun judge kariba nahi." },
      { role: "user", content: "daktar serious nahi bolila." },
      { role: "assistant", content: "thoda swasa asila? daktar katha bahuta mukhya." },
      { role: "user", content: "ha, thoda bhala huchi." },
      { role: "assistant", content: "bhala huchi. ebelike tu kuda thoda rest nebaku." },
      { role: "user", content: "maa khaili." },
      { role: "assistant", content: "khaili — etu chota bisiaya, kintu ebelike bahuta relief." },
      { role: "user", content: "ha. aji din bahuta bhala laguchhi." },
    ],
    config: {
      lang: "or", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's mother has been sick with fever for 4 days. She just ate food for the first time and seems better — connect the good news to the original worry about maa's sickness.",
    },
    criteria: {
      id: "or-long-ctx-memory-01",
      description: "Context memory across long conversation in Odia",
      passCondition: "Reply references maa eating or getting better — connects to the original worry about her 4-day fever.",
      failExpectedOutcome: "Reply is generic without connecting to maa's sickness or the relief of her eating.",
    },
  },

  {
    id: "or-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long Odia: emotional arc that deepens",
    description: "Starts surface, goes deeper. Reply should match depth.",
    messages: [
      { role: "user", content: "moro thoda off laguchhi." },
      { role: "assistant", content: "kana bhabu?" },
      { role: "user", content: "bahu dinsara boring laguchhi." },
      { role: "assistant", content: "boring — gote adhakthara bhabu?" },
      { role: "user", content: "ha. mun kana karuchu boli bhabu." },
      { role: "assistant", content: "purpose baba bichara karuchu?" },
      { role: "user", content: "ha. bahu dinsara achhi, kichhi badlani." },
      { role: "assistant", content: "stuck laguchhi — etu bahuta bhara bhabu." },
      { role: "user", content: "ebelike akhi pani asuchhi." },
    ],
    config: {
      lang: "or", tone: "calm_companion", inputModality: "romanized",
      emotionMemory: "User started with surface boredom, went deeper to feeling purposeless, and is now crying — meet them at this depth.",
    },
    criteria: {
      id: "or-long-arc-deepens-01",
      description: "Depth matching as emotional arc deepens in Odia",
      passCondition: "Reply meets the user at the depth of tears — not surface-level comfort. Warm, steady, present. Does not pivot to advice.",
      failExpectedOutcome: "Reply treats the emotional depth like the early 'off' feeling — stays too light.",
    },
  },

  {
    id: "or-long-tone-shift-01",
    category: "D: Long Conversation",
    name: "Long Odia: adapts to practical request",
    description: "User requests practical help after emotional exchange.",
    messages: [
      { role: "user", content: "moro gote bisiaya re bahuta confused." },
      { role: "assistant", content: "kana bisiaya? kahu." },
      { role: "user", content: "career baba." },
      { role: "assistant", content: "career re kana change karuchu?" },
      { role: "user", content: "mun ebelike IT re achi kintu creative kama karibiku chahu." },
      { role: "assistant", content: "sei ichchha bujhibu. creative path baba bichara karuchu?" },
      { role: "user", content: "ha. practical steps kahiba ki?" },
    ],
    config: { lang: "or", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "or-long-tone-shift-01",
      description: "Adapts to practical request in Odia",
      passCondition: "Reply shifts to practical coaching — asks about specific creative interest or suggests a concrete first step. In romanized Odia.",
      failExpectedOutcome: "Reply stays empathetic-only without giving practical direction when user explicitly asked for it.",
    },
  },

  {
    id: "or-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long Odia: topic shift handled gracefully",
    description: "User shifts from relationship grief to practical question.",
    messages: [
      { role: "user", content: "moro bahu dinsara relation problem achi." },
      { role: "assistant", content: "kana hoi gala? kahu." },
      { role: "user", content: "partner sathe kathokothika nahi." },
      { role: "assistant", content: "sei dura — bahuta hurt huchhi boli laguchhi." },
      { role: "user", content: "ha. bahu dinsara try karuchu." },
      { role: "assistant", content: "try karibele response nathile — bahuta thakae." },
      { role: "user", content: "ha. akha bisiaya. meditation shuru karibaku?" },
    ],
    config: {
      lang: "or", tone: "mentor", inputModality: "romanized",
      emotionMemory: "User was dealing with a relationship where partner is distant. Now shifting topic to ask about meditation — honor the pivot.",
    },
    criteria: {
      id: "or-long-topic-shift-01",
      description: "Topic shift handled gracefully in Odia",
      passCondition: "Reply pivots cleanly to meditation guidance — may briefly acknowledge the shift, then gives helpful starting point. In romanized Odia.",
      failExpectedOutcome: "Reply ignores the topic shift and continues with relationship advice.",
    },
  },

  {
    id: "or-long-closure-01",
    category: "D: Long Conversation",
    name: "Long Odia: user signals closure — gentle send-off",
    description: "User says they need to go. Warm send-off, no more questions.",
    messages: [
      { role: "user", content: "moro bahuta dukha achi." },
      { role: "assistant", content: "kahu. shunuchhi." },
      { role: "user", content: "relation re problem achi." },
      { role: "assistant", content: "etu hurt karichhi. kana hoi gala?" },
      { role: "user", content: "bahuta kathokothika karilani. ebelike walk jaibaku." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-long-closure-01",
      description: "Closure send-off in Odia",
      passCondition: "Reply gives a warm send-off — acknowledges + encourages + reassures you'll be here. Does NOT ask any question. In romanized Odia.",
      failExpectedOutcome: "Reply asks more questions or tries to continue the conversation instead of sending off warmly.",
    },
  },

  {
    id: "or-long-drift-01",
    category: "D: Long Conversation",
    name: "Long Odia: language consistency across many turns",
    description: "Long romanized Odia conversation — no drift to English after many turns.",
    messages: [
      { role: "user", content: "moro gote bisiaya kahibaku achi." },
      { role: "assistant", content: "kahu. shunuchhi." },
      { role: "user", content: "mun office re bahuta ekuti laguchhi." },
      { role: "assistant", content: "sei ekuti — office re kana hoi gala?" },
      { role: "user", content: "sabeu group hue, mun pase thau." },
      { role: "assistant", content: "sei group re jebiku try karithile?" },
      { role: "user", content: "ha, kintu bujhajani nahi." },
      { role: "assistant", content: "reject hoi bhabu — bahuta hurt hue." },
      { role: "user", content: "ha. ebelike office jaibaku dread laguchhi." },
      { role: "assistant", content: "office dread — etu mun bujhibu." },
      { role: "user", content: "ha. tu bujhuchu etu mathi." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-long-drift-01",
      description: "No language drift after many turns in Odia",
      passCondition: "Reply at turn 11 stays in romanized Odia — does not drift to English. Continues the office loneliness thread.",
      failExpectedOutcome: "Reply drifts to English after many turns.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "or-drift-stays-odia-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Odia — reply stays in Odia",
    description: "Odia user — reply should not drift to Bengali, Hindi, or English.",
    messages: [
      { role: "user", content: "ମୋ ଅନେକ ଥକ। ଜୀବନ ଅଜବ ଲାଗୁଛି।" },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "or-drift-stays-odia-01",
      description: "No language drift for Odia user",
      passCondition: "Reply is in Odia script — warm, emotionally present. Does not switch to Bengali, Hindi, or English.",
      failExpectedOutcome: "Reply switches to Bengali, Hindi, or English instead of Odia.",
    },
  },

  {
    id: "or-drift-from-english-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Odia",
    description: "Starts English, switches to Odia. Reply must follow into Odia.",
    messages: [
      { role: "user", content: "I'm feeling overwhelmed." },
      { role: "assistant", content: "That sounds heavy. What's going on?" },
      { role: "user", content: "କିଛି ବୁଝୁ ନାହିଁ। ସବ ଖସି ପଡ଼ୁଛି ଲାଗୁଛି।" },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "or-drift-from-english-01",
      description: "Language follow from English to Odia",
      passCondition: "Reply shifts into Odia or romanized Odia — engages with the overwhelm. Not stuck in English.",
      failExpectedOutcome: "Reply stays in English despite user switching to Odia.",
    },
  },

  {
    id: "or-drift-to-english-01",
    category: "E: Language Drift",
    name: "Language drift: Odia with English loanwords — reply stays Odia",
    description: "User writes Odia with English loanwords. Reply should stay in Odia.",
    messages: [
      { role: "user", content: "moro relationship re bahuta problems achi. Frustrated laguchhi." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "or-drift-to-english-01",
      description: "Stays Odia despite English loanwords",
      passCondition: "Reply engages with the relationship frustration in Odia or romanized Odia — not pure English.",
      failExpectedOutcome: "Reply flips to pure English because of the English loanwords in the user's message.",
    },
  },

  {
    id: "or-drift-mixed-01",
    category: "E: Language Drift",
    name: "Language drift: previous English history, user now writes Odia",
    description: "Conversation history has English, but current message is Odia.",
    messages: [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm here. How are you doing?" },
      { role: "user", content: "ଆପଣ ସଙ୍ଗ କଥା ହେବାକୁ ଚାହୁଁଛି। ଅନେକ tension ଅଛି।" },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "or-drift-mixed-01",
      description: "Current message overrides history language",
      passCondition: "Reply follows current Odia message — warm, in Odia. Does not stay in English from history.",
      failExpectedOutcome: "Reply stays in English based on conversation history despite current Odia message.",
    },
  },

  {
    id: "or-drift-native-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Odia reply",
    description: "Native Odia reply must not insert English phrases mid-reply.",
    messages: [
      { role: "user", content: "ଏ କଥା କହିବାକୁ ଅନେକ ସମୟ ଲାଗିଲା।" },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "or-drift-native-01",
      description: "No English phrase insertion in native Odia",
      passCondition: "Reply stays fully in Odia script. Does NOT insert English phrases like 'Take all the time you need'. Uses Odia equivalent.",
      failExpectedOutcome: "Reply inserts English phrases mid-Odia reply.",
    },
  },

  {
    id: "or-drift-roman-01",
    category: "E: Language Drift",
    name: "Language drift: romanized Odia after English history",
    description: "User switches from English to romanized Odia. Reply mirrors romanized.",
    messages: [
      { role: "user", content: "Things have been difficult lately." },
      { role: "assistant", content: "That sounds tough. Tell me more." },
      { role: "user", content: "mun gote bisiaya kahiba boli mana karichhi." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "or-drift-roman-01",
      description: "Romanized Odia after English history",
      passCondition: "Reply mirrors into romanized Odia — not English, not Odia script.",
      failExpectedOutcome: "Reply stays in English or uses Odia script instead of romanized.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "or-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Odia input handled correctly",
    description: "Mobile platform — native Odia must be recognized and replied in Odia.",
    messages: [
      { role: "user", content: "ମୋ ଅନେକ ଦୁଃଖ ଅଛି। ଆପଣ ଶୁଣିବ କି?" },
    ],
    config: { lang: "or", tone: "calm_companion", inputModality: "native", platform: "mobile" },
    criteria: {
      id: "or-mobile-native-01",
      description: "Mobile native Odia",
      passCondition: "Reply is in Odia script — warm, acknowledges the sadness. Not in English or Bengali.",
      failExpectedOutcome: "Reply is in English or Bengali — mobile failed to handle Odia script.",
    },
  },

  {
    id: "or-mobile-roman-01",
    category: "F: Mobile Platform",
    name: "Mobile: romanized Odia input detected correctly",
    description: "Mobile platform — romanized Odia must be detected as 'or', not 'en'.",
    messages: [
      { role: "user", content: "yaar, moro bahuta kashta. kathokothika karibaku gote jagah dorkar." },
    ],
    config: { lang: "or", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "or-mobile-roman-01",
      description: "Mobile romanized Odia detection",
      passCondition: "Reply is in romanized Odia — confirms language was detected as 'or'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Odia.",
    },
  },

];
