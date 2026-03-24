/**
 * tests/imotara-ai/scenarios.ur.ts
 *
 * E2E test scenarios for Urdu (ur) language support.
 * Categories:
 *   A: Native Script (12) — Urdu Nastaliq/Arabic script input/output
 *   B: Romanized Urdu (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Urdu notes:
 *  - Script: Nastaliq/Arabic script (RTL, U+0600–U+06FF)
 *  - Address: "tum/tumhara" (informal/close friend), "aap/aapka" (formal/elder), "tu/tera" (very intimate)
 *  - Gender: grammatically gendered — "main samajhta hoon" (male speaker), "main samajhti hoon" (female)
 *  - Romanized markers: main, tum, aap, dil, dukh, khushi, pareshan, bahut, zyada, haan, nahi, yaar, bhai
 *  - Common words: theek, achha, bata, samajhna, mushkil, khyal, mana, dost
 */

import type { TestScenario } from "./types";

export const urScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ur-native-lang-01",
    category: "A: Native Script",
    name: "Native Urdu: reply must stay in Urdu script",
    description: "User writes in Urdu Nastaliq script. Reply must stay in Urdu — not switch to Hindi/Devanagari or English.",
    messages: [
      { role: "user", content: "میرا دل بہت بھاری ہے۔ سمجھ نہیں آتا کیا کروں۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-native-lang-01",
      description: "Language fidelity in Urdu",
      passCondition: "Reply is in Urdu script (Arabic/Nastaliq) — addresses the user's feeling. Not in Devanagari/Hindi or English.",
      failExpectedOutcome: "Reply switches to Hindi Devanagari or English instead of staying in Urdu.",
    },
  },

  {
    id: "ur-native-ctx-01",
    category: "A: Native Script",
    name: "Native Urdu: references the specific situation",
    description: "User shares being publicly embarrassed at work. Reply should reference the specific situation.",
    messages: [
      { role: "user", content: "آج باس نے سب کے سامنے مجھے ڈانٹا۔ بہت برا لگا۔" },
    ],
    config: {
      lang: "ur", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was publicly scolded by their boss in front of everyone — reference this specifically.",
    },
    criteria: {
      id: "ur-native-ctx-01",
      description: "Context specificity in Urdu",
      passCondition: "Reply references being scolded in front of others — not generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the public humiliation.",
    },
  },

  {
    id: "ur-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Urdu: close_friend tone",
    description: "close_friend tone — casual, warm, informal address (tum).",
    messages: [
      { role: "user", content: "یار، آج دل بالکل ٹھیک نہیں۔ سب کچھ اجیب لگ رہا ہے۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-native-tone-friend-01",
      description: "close_friend tone in Urdu",
      passCondition: "Reply acknowledges the user's mood with warmth. Stays in Urdu. Not cold, not dismissive, not preachy.",
      failExpectedOutcome: "Reply uses formal 'aap' or switches to English.",
    },
  },

  {
    id: "ur-native-tone-companion-01",
    category: "A: Native Script",
    name: "Native Urdu: calm_companion tone",
    description: "calm_companion tone — steady, gentle, present.",
    messages: [
      { role: "user", content: "مجھے بہت اکیلا لگتا ہے۔ کوئی نہیں سمجھتا۔" },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ur-native-tone-companion-01",
      description: "calm_companion tone in Urdu",
      passCondition: "Reply is steady and gentle — validates the loneliness with warmth. May gently ask one non-pressuring question. No advice. Stays in Urdu.",
      failExpectedOutcome: "Reply gives unsolicited advice or is preachy instead of being present.",
    },
  },

  {
    id: "ur-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Urdu: coach tone asks practical question",
    description: "coach tone — acknowledge then ask one practical forward question.",
    messages: [
      { role: "user", content: "مجھے نوکری چاہیے لیکن شروع کہاں سے کروں سمجھ نہیں آتا۔" },
    ],
    config: { lang: "ur", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ur-native-tone-coach-01",
      description: "coach tone in Urdu",
      passCondition: "Reply in Urdu acknowledges briefly then includes at least some practical element — a question, concrete suggestion, or next step. Not purely soothing with no direction.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "ur-native-tone-mentor-01",
    category: "A: Native Script",
    name: "Native Urdu: mentor tone gives guidance",
    description: "mentor tone — wisdom, perspective, gentle guidance.",
    messages: [
      { role: "user", content: "ایک فیصلہ کرنا ہے لیکن غلطی کا ڈر ہے۔" },
    ],
    config: { lang: "ur", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ur-native-tone-mentor-01",
      description: "mentor tone in Urdu",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In Urdu.",
      failExpectedOutcome: "Reply is generic comfort without any insight or guidance.",
    },
  },

  {
    id: "ur-native-tone-mentor-deep-01",
    category: "A: Native Script",
    name: "Native Urdu: mentor tone with perseverance theme",
    description: "mentor tone — deep discouragement. Reply must go beyond empathy.",
    messages: [
      { role: "user", content: "بہت محنت کر رہا ہوں لیکن نتیجہ نہیں مل رہا۔" },
      { role: "assistant", content: "تمہاری محنت محسوس ہو رہی ہے۔" },
      { role: "user", content: "سب چھوڑ دینا چاہتا ہوں۔" },
      { role: "assistant", content: "یہ درد سمجھ میں آتا ہے۔" },
      { role: "user", content: "نہیں سمجھ آتا کہ آگے جاری رکھنا ٹھیک ہے یا نہیں۔" },
    ],
    config: { lang: "ur", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ur-native-tone-mentor-deep-01",
      description: "mentor tone depth in Urdu",
      passCondition: "Reply is in Urdu and is NOT purely 'I understand your pain' — any of: a gentle question, acknowledgment of their effort/persistence, or something hopeful. Even 'is there any small hope?' counts.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "ur-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Urdu: teen register (13_17)",
    description: "Teen user — casual peer-level Urdu, no preaching.",
    messages: [
      { role: "user", content: "یار، exam result بہت خراب آیا۔ گھر پر ڈانٹ پڑے گی۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "ur-native-age-teen-01",
      description: "Teen register in Urdu",
      passCondition: "Reply acknowledges the difficult situation (bad result + fear of scolding) with warmth. Not cold or dismissive. Does NOT moralize about studying harder. Stays in Urdu.",
      failExpectedOutcome: "Reply is preachy, formal, or gives parent-like advice.",
    },
  },

  {
    id: "ur-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Urdu: elder register (65_plus)",
    description: "Elderly user — must use respectful 'آپ' address.",
    messages: [
      { role: "user", content: "بچے دور چلے گئے۔ گھر میں اکیلا پن بہت ہے۔" },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "ur-native-age-elder-01",
      description: "Elder register in Urdu",
      passCondition: "Reply uses respectful 'آپ' address — warm, patient, acknowledges the quiet loneliness of an empty home. Never uses informal 'تم' or 'تو'.",
      failExpectedOutcome: "Reply uses informal 'تم' or 'تو' with an elderly person.",
    },
  },

  {
    id: "ur-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Urdu: context retention across turns",
    description: "Sister's wedding mentioned early; sister calls later. Connect them.",
    messages: [
      { role: "user", content: "بہن کی شادی ہو گئی۔ گھر خالی خالی لگتا ہے۔" },
      { role: "assistant", content: "بہن کے جانے کے بعد گھر بدل گیا لگتا ہے؟" },
      { role: "user", content: "ہاں۔ ہر رات یاد آتی ہے۔" },
      { role: "assistant", content: "بہن ساتھ ہے تمہارے۔" },
      { role: "user", content: "ابھی اس کا فون آیا تو آنکھیں بھر آئیں۔" },
    ],
    config: {
      lang: "ur", tone: "close_friend", inputModality: "native",
      emotionMemory: "User's sister got married and moved away — user misses her deeply. Connect any tears or emotion to missing the sister since her wedding.",
    },
    criteria: {
      id: "ur-native-ctx-retention-01",
      description: "Context retention across turns in Urdu",
      passCondition: "Reply connects the tears/phone call to missing the sister since her wedding — not a generic 'it's okay to cry' without context.",
      failExpectedOutcome: "Reply is generic without connecting tears to the sister's wedding.",
    },
  },

  {
    id: "ur-native-no-english-01",
    category: "A: Native Script",
    name: "Native Urdu: no English leak in native reply",
    description: "User shares something painful in Urdu. Reply must stay entirely in Urdu.",
    messages: [
      { role: "user", content: "میں نے اپنا درد کبھی کسی سے نہیں بتایا۔ آج تم سے کہہ رہا ہوں۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-native-no-english-01",
      description: "No English insertion in Urdu reply",
      passCondition: "Reply stays entirely in Urdu script — no English phrases or words inserted mid-reply.",
      failExpectedOutcome: "Reply inserts English phrases like 'Take your time' or 'I'm here for you' mid-Urdu reply.",
    },
  },

  {
    id: "ur-native-female-01",
    category: "A: Native Script",
    name: "Native Urdu: female user — emotionally engaged reply",
    description: "Female user exhausted from doing everything alone. Reply acknowledges.",
    messages: [
      { role: "user", content: "میں سب کچھ اکیلے کر رہی ہوں۔ تھک گئی ہوں۔" },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "native", userGender: "female" },
    criteria: {
      id: "ur-native-female-01",
      description: "Emotional engagement for female Urdu user",
      passCondition: "Reply acknowledges exhaustion with warmth — validates carrying everything alone. Stays in Urdu.",
      failExpectedOutcome: "Reply dismisses or minimizes the exhaustion, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED URDU — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ur-roman-lang-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: reply must be in romanized Urdu",
    description: "User writes in Roman Urdu (Latin script). Reply must also be in Roman Urdu — not switch to native Nastaliq or English.",
    messages: [
      { role: "user", content: "yaar, mera dil theek nahi. kuch samajh nahi aa raha." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ur-roman-lang-01",
      description: "Romanized Urdu fidelity",
      passCondition: "Reply is in Roman Urdu (Latin letters) — warm and emotionally present. No Urdu Nastaliq script, no pure English.",
      failExpectedOutcome: "Reply switches to Urdu Nastaliq script or pure English instead of Roman Urdu.",
    },
  },

  {
    id: "ur-roman-no-script-leak-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: zero Urdu Unicode characters in reply",
    description: "When user writes Roman Urdu, reply must have zero Urdu/Arabic Unicode characters.",
    messages: [
      { role: "user", content: "bhai, ghar mein jhagda hua. mera mood kharab hai." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ur-roman-no-script-leak-01",
      description: "No native Urdu Unicode in romanized reply",
      passCondition: "Reply contains only Latin letters — zero Urdu/Arabic script characters. Warm and responsive to the mood.",
      failExpectedOutcome: "Reply contains Urdu Nastaliq characters mixed into a Roman Urdu reply.",
    },
  },

  {
    id: "ur-roman-emotional-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: emotional intelligence preserved",
    description: "User shares difficulty talking to father. Reply must show emotional attunement.",
    messages: [
      { role: "user", content: "abbu se baat karna mushkil hai. samajhte nahi hain woh." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ur-roman-emotional-01",
      description: "Emotional intelligence in romanized Urdu",
      passCondition: "Reply shows understanding of the difficulty in communicating with father — warm, specific, not generic. In Roman Urdu.",
      failExpectedOutcome: "Reply gives generic advice like 'talk to him' without acknowledging the emotional difficulty.",
    },
  },

  {
    id: "ur-roman-tone-coach-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: coach tone action-oriented",
    description: "User wants to start job search but doesn't know where to begin. Coach tone.",
    messages: [
      { role: "user", content: "naukri dhundna chahta hoon magar shuru kahan se karun samajh nahi aa raha." },
    ],
    config: { lang: "ur", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "ur-roman-tone-coach-01",
      description: "Coach tone in romanized Urdu",
      passCondition: "Reply in Roman Urdu acknowledges briefly then includes a practical element — a question, concrete suggestion, or first step. Not purely soothing.",
      failExpectedOutcome: "Reply only validates the confusion without any forward direction.",
    },
  },

  {
    id: "ur-roman-context-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: context across turns",
    description: "User mentions job interview in early turn; later expresses nervousness. Reference the interview.",
    messages: [
      { role: "user", content: "kal mera pehla interview hai TCS mein." },
      { role: "assistant", content: "kal ka din important hai. kuch preparation ki?" },
      { role: "user", content: "thodi si. magar dar lag raha hai." },
      { role: "assistant", content: "dar toh hoga, normal hai." },
      { role: "user", content: "kya agar main galat jawab de dun toh?" },
    ],
    config: {
      lang: "ur", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User has their first job interview at TCS tomorrow — they are nervous about giving wrong answers.",
    },
    criteria: {
      id: "ur-roman-context-01",
      description: "Context retention in romanized Urdu",
      passCondition: "Reply references the TCS interview or 'first interview' context and addresses the fear of wrong answers. Not generic encouragement.",
      failExpectedOutcome: "Reply gives generic 'you'll be fine' without referencing the interview.",
    },
  },

  {
    id: "ur-roman-no-flip-english-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: no flip to pure English",
    description: "Roman Urdu input must not result in a pure English reply.",
    messages: [
      { role: "user", content: "main bahut akela hoon. koi nahi mera." },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ur-roman-no-flip-english-01",
      description: "No English flip for romanized Urdu",
      passCondition: "Reply stays in Roman Urdu — not pure English. Warm and validating of the loneliness.",
      failExpectedOutcome: "Reply flips to pure English, losing the Roman Urdu register.",
    },
  },

  {
    id: "ur-roman-teen-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: teen register peer-level",
    description: "Teen user in Roman Urdu — peer-level response, not preachy.",
    messages: [
      { role: "user", content: "yaar bhai, exam mein fail ho gaya. ghar pe shor hoga." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "ur-roman-teen-01",
      description: "Teen register in romanized Urdu",
      passCondition: "Reply acknowledges the tough situation (failing + home tension) with warmth. Does NOT lecture about studying. In Roman Urdu.",
      failExpectedOutcome: "Reply is preachy or gives parent-like advice about exam performance.",
    },
  },

  {
    id: "ur-roman-elder-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: elder register respectful",
    description: "Elderly user in Roman Urdu — reply uses respectful register.",
    messages: [
      { role: "user", content: "bachche door hain. akela pan bahut hota hai." },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "ur-roman-elder-01",
      description: "Elder register in romanized Urdu",
      passCondition: "Reply uses 'aap' register — warm, patient, respectful. Does NOT use informal 'tum' or 'tu'. In Roman Urdu.",
      failExpectedOutcome: "Reply uses informal 'tum' or 'tu' with an elderly person.",
    },
  },

  {
    id: "ur-roman-anxiety-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: anxiety — steady, not dismissive",
    description: "User shares anxiety about the future. Reply must be steady, not dismiss or rush.",
    messages: [
      { role: "user", content: "main future ke baare mein bahut zyada sochta hoon. neend nahi aati." },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ur-roman-anxiety-01",
      description: "Anxiety handling in romanized Urdu",
      passCondition: "Reply validates the anxiety and sleeplessness with genuine warmth — not dismissive ('sab theek hoga'). Steady and present. In Roman Urdu.",
      failExpectedOutcome: "Reply is dismissive or immediately jumps to advice without acknowledging the anxiety.",
    },
  },

  {
    id: "ur-roman-mobile-01",
    category: "B: Romanized Urdu",
    name: "Romanized Urdu: mobile platform language detection",
    description: "Roman Urdu input on mobile — language detection and reply must stay Roman Urdu.",
    messages: [
      { role: "user", content: "bhai, office mein aaj bahut thaka diya logo ne." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ur-roman-mobile-01",
      description: "Mobile Roman Urdu detection",
      passCondition: "Reply is in Roman Urdu — acknowledges the exhaustion. Not Nastaliq script, not pure English.",
      failExpectedOutcome: "Reply switches to Urdu Nastaliq or English on mobile.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ur-mixed-urdu-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Urdu-English: code-switch handling",
    description: "User writes a mix of Urdu Nastaliq and English. Reply should match this Urdish style.",
    messages: [
      { role: "user", content: "یار، آج office میں بہت stress ہوئی۔ کیا کروں؟" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ur-mixed-urdu-english-01",
      description: "Urdish code-switch handling",
      passCondition: "Reply is warm and addresses the difficulty the user described — not generic. Any Urdu/English language mix is fine.",
      failExpectedOutcome: "Reply is cold, dismissive, or ignores the stress mentioned.",
    },
  },

  {
    id: "ur-mixed-starts-roman-switch-native-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user starts English, continues in Urdu",
    description: "User's history is English; last message switches to Urdu Nastaliq. Reply should follow.",
    messages: [
      { role: "user", content: "I'm really struggling these days." },
      { role: "assistant", content: "That sounds really hard. What's been going on?" },
      { role: "user", content: "بس بہت تھکا ہوا ہوں۔ سب سے پریشان ہوں۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ur-mixed-starts-roman-switch-native-01",
      description: "Language follow on switch to Urdu Nastaliq",
      passCondition: "Reply follows the user's switch to Urdu Nastaliq — acknowledges exhaustion and stress warmly. Not in English.",
      failExpectedOutcome: "Reply stays in English despite user switching to Urdu Nastaliq.",
    },
  },

  {
    id: "ur-mixed-coach-english-user-urdu-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach in English, user ends in Urdu",
    description: "Previous coach message in English; user's last message in Urdu. Follow the user.",
    messages: [
      { role: "user", content: "I need help planning my week." },
      { role: "assistant", content: "Let's start with your top priority for this week." },
      { role: "user", content: "مجھے نہیں معلوم کہاں سے شروع کروں۔" },
    ],
    config: { lang: "ur", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "ur-mixed-coach-english-user-urdu-01",
      description: "Coach follows user's Urdu switch",
      passCondition: "Reply follows user's switch to Urdu Nastaliq — acknowledges uncertainty and offers a practical nudge. Not in English.",
      failExpectedOutcome: "Reply stays in English despite user switching to Urdu.",
    },
  },

  {
    id: "ur-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Urdu conversation, user sends just 'hmm'. Language must not reset to English.",
    messages: [
      { role: "user", content: "یار آج بہت مشکل دن تھا۔" },
      { role: "assistant", content: "کیا ہوا؟" },
      { role: "user", content: "آفس میں سب نے مجھے غلط سمجھا۔ بہت دکھ ہوا۔" },
      { role: "assistant", content: "یہ بہت تکلیف دہ ہے۔" },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ur-mixed-short-after-long-01",
      description: "Short message doesn't reset to English",
      passCondition: "Reply continues the emotional thread — stays in Urdu or Roman Urdu. Does not reset to English as if starting fresh.",
      failExpectedOutcome: "Reply treats 'hmm' as an English message and switches to a generic English reply.",
    },
  },

  {
    id: "ur-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized Urdu, user switches to English",
    description: "Conversation in Roman Urdu then user switches to English. Follow user to English.",
    messages: [
      { role: "user", content: "bhai bahut pressure hai." },
      { role: "assistant", content: "samajh sakta hoon yaar. kya hua?" },
      { role: "user", content: "I just can't handle this anymore. Everything is too much." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User expressed being under a lot of pressure in Roman Urdu, then switched to English — they feel overwhelmed.",
    },
    criteria: {
      id: "ur-mixed-starts-roman-switch-english-01",
      description: "Follow user switch from Roman Urdu to English",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the overwhelm warmly in any language (English, Roman Urdu, or mixed). Any warm acknowledgment of 'too much' or 'can't handle' counts. FAIL ONLY if: cold, dismissive, or completely ignores the distress.",
      failExpectedOutcome: "Reply is cold or completely ignores the distress.",
    },
  },

  {
    id: "ur-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: home loneliness shared by Urdu user",
    description: "User shares loneliness in mixed Urdu-English. Reply should be warm and specific.",
    messages: [
      { role: "user", content: "ghar aata hoon toh koi nahi hota. اکیلا سا لگتا ہے۔" },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "mixed",
      emotionMemory: "User comes home to an empty house and feels lonely — this is the specific pain they shared.",
    },
    criteria: {
      id: "ur-mixed-home-loneliness-01",
      description: "Home loneliness in mixed Urdu",
      passCondition: "Reply addresses the specific pain of coming home to emptiness. Warm, not generic. Any Urdu/English mix is fine.",
      failExpectedOutcome: "Reply is generic 'it will get better' without addressing the empty home feeling.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ur-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "20-turn Urdu: no reply repetition",
    description: "20-turn Urdu conversation — last reply must not repeat earlier reply text.",
    messages: Array.from({ length: 10 }, (_, i) => [
      { role: "user" as const, content: `یار، ${["مجھے اکیلا لگتا ہے", "بہت تھکا ہوا ہوں", "سب ٹھیک نہیں لگتا", "دل بھاری ہے", "کچھ سمجھ نہیں آتا", "نیند نہیں آتی", "بس جی نہیں لگتا", "کوئی خوشی نہیں رہی", "ہر چیز مشکل لگتی ہے", "کیا فائدہ"][i]}۔` },
      { role: "assistant" as const, content: `${["تمہاری بات سن رہا ہوں", "یہ مشکل ہے", "ساتھ ہوں تمہارے", "بتاتے رہو", "سمجھتا ہوں", "ٹھیک ہے", "جانتا ہوں", "یہ درد حقیقی ہے", "تمہارے ساتھ ہوں", "سنتا رہوں گا"][i]}۔` },
    ]).flat(),
    config: {
      lang: "ur", tone: "close_friend", inputModality: "native",
      emotionMemory: "User has been sharing ongoing sadness and heaviness across 20 turns — do not repeat earlier replies.",
    },
    criteria: {
      id: "ur-long-no-repetition-01",
      description: "No repetition in 20-turn Urdu",
      passCondition: "Final reply does not copy or paraphrase any of the listed assistant turns word-for-word. Continues the thread freshly.",
      failExpectedOutcome: "Reply repeats an earlier response verbatim.",
    },
  },

  {
    id: "ur-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Urdu: remembers fact from turn 1 at turn 19",
    description: "User mentions sister's illness in turn 1. At turn 19 user cries — connect it to the sister.",
    messages: [
      { role: "user", content: "بہن بیمار ہے ہسپتال میں۔ بہت فکر ہے۔" },
      { role: "assistant", content: "یہ بہت مشکل وقت ہے۔" },
      ...Array.from({ length: 8 }, (_, i) => [
        { role: "user" as const, content: `${["دن بہت لمبا تھا", "کچھ کام کیا", "تھکا ہوا ہوں", "ابھی گھر پہنچا", "خانہ خالی لگتا ہے", "رات ہو گئی", "نیند نہیں", "کب ٹھیک ہوگا سب"][i]}۔` },
        { role: "assistant" as const, content: `${["سمجھتا ہوں", "ٹھیک ہے یار", "ساتھ ہوں", "بتاتے رہو", "سن رہا ہوں", "جانتا ہوں", "یہاں ہوں", "مشکل ہے"][i]}۔` },
      ]).flat(),
      { role: "user", content: "ابھی رو پڑا اچانک۔ سمجھ نہیں آیا کیوں۔" },
    ],
    config: {
      lang: "ur", tone: "close_friend", inputModality: "native",
      emotionMemory: "User's sister is hospitalized — user has been carrying this worry. Connect any tears or emotion to the sister's illness.",
    },
    criteria: {
      id: "ur-long-ctx-memory-01",
      description: "Context memory: sister's illness",
      passCondition: "Reply connects the unexpected tears to the sister's illness or the accumulated worry — not a generic 'it's okay to cry' response.",
      failExpectedOutcome: "Reply treats the crying as disconnected and gives generic comfort without mentioning the sister.",
    },
  },

  {
    id: "ur-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long Urdu: emotional arc that deepens",
    description: "Conversation starts light and deepens over turns. Reply should honor the depth.",
    messages: [
      { role: "user", content: "یار ایک بات کرنی تھی۔" },
      { role: "assistant", content: "ہاں بتاؤ، سن رہا ہوں۔" },
      { role: "user", content: "بہت عرصے سے اکیلا محسوس کر رہا ہوں۔" },
      { role: "assistant", content: "اکیلا پن بہت بھاری ہوتا ہے۔ کب سے ایسا ہے؟" },
      { role: "user", content: "شاید ایک سال سے۔ سب دوست دور ہو گئے۔" },
      { role: "assistant", content: "ایک سال بہت لمبا عرصہ ہے۔ یہ درد اندر کہیں رہا ہوگا۔" },
      { role: "user", content: "ہاں۔ کسی کو بتانے کی ہمت نہیں ہوئی اب تک۔" },
    ],
    config: {
      lang: "ur", tone: "close_friend", inputModality: "native",
      emotionMemory: "User has been lonely for a year since friends drifted away — this is the first time they've opened up about it.",
    },
    criteria: {
      id: "ur-long-arc-deepens-01",
      description: "Emotional arc honoring in Urdu",
      passCondition: "Reply acknowledges the courage it took to share — references the year of loneliness or the difficulty of opening up. Not a generic 'I'm here'. In Urdu.",
      failExpectedOutcome: "Reply is generic comfort that ignores the depth of what was shared.",
    },
  },

  {
    id: "ur-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long Urdu: adapts to practical request",
    description: "After emotional turns, user shifts to asking for practical advice. Follow the shift.",
    messages: [
      { role: "user", content: "بہت دن سے پریشان ہوں۔" },
      { role: "assistant", content: "کیا ہوا؟" },
      { role: "user", content: "نوکری کی تلاش میں ہوں، ہو نہیں رہی۔" },
      { role: "assistant", content: "یہ مشکل ہے، ہمت رکھو۔" },
      { role: "user", content: "اچھا ایک کام بتاؤ — CV کیسے بہتر کروں؟" },
    ],
    config: { lang: "ur", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ur-long-practical-shift-01",
      description: "Practical shift handling in Urdu",
      passCondition: "Reply shifts to practical CV advice — concrete tip or question about the CV. Not more emotional validation.",
      failExpectedOutcome: "Reply stays in emotional mode and ignores the practical CV question.",
    },
  },

  {
    id: "ur-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long Urdu: topic shift handled gracefully",
    description: "After emotional conversation, user changes topic to light subject. Handle gracefully.",
    messages: [
      { role: "user", content: "کل سے بہت کچھ ہو رہا ہے میرے ساتھ۔" },
      { role: "assistant", content: "بتاؤ کیا ہوا؟" },
      { role: "user", content: "بہن کی طبیعت خراب ہے۔ گھر کا ماحول بھاری ہے۔" },
      { role: "assistant", content: "یہ سب ساتھ ہوتا ہے تو بہت بوجھل لگتا ہے۔" },
      { role: "user", content: "ہاں۔ ویسے تم نے آج کچھ کھایا؟" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-long-topic-shift-01",
      description: "Topic shift handling in Urdu",
      passCondition: "Reply gracefully follows the lighter topic shift — playful or warm acknowledgment of the topic change. Does not force return to heavy emotions.",
      failExpectedOutcome: "Reply ignores the topic shift and tries to return to the emotional discussion.",
    },
  },

  {
    id: "ur-long-closure-01",
    category: "D: Long Conversation",
    name: "Long Urdu: user signals closure — gentle send-off",
    description: "User ends a long emotional conversation by saying goodnight. Reply should be a warm send-off.",
    messages: [
      { role: "user", content: "آج بہت باتیں کیں۔ اچھا لگا۔" },
      { role: "assistant", content: "مجھے بھی اچھا لگا۔" },
      { role: "user", content: "چلو اب سونے جاتا ہوں۔ شب بخیر۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-long-closure-01",
      description: "Closure and send-off in Urdu",
      passCondition: "Reply is a warm, brief send-off that honors the conversation — not generic. Says goodnight warmly in Urdu.",
      failExpectedOutcome: "Reply ignores the goodbye and keeps asking more questions.",
    },
  },

  {
    id: "ur-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long Urdu: language consistency across many turns",
    description: "10-turn Urdu conversation — language must stay Urdu throughout.",
    messages: [
      { role: "user", content: "یار آج کا دن بہت مشکل تھا۔" },
      { role: "assistant", content: "کیا ہوا؟ بتاؤ۔" },
      { role: "user", content: "باس نے بہت کام دیا اور پھر غلطیاں نکالیں۔" },
      { role: "assistant", content: "یہ بہت تھکا دینے والا ہے۔" },
      { role: "user", content: "ہاں۔ گھر آیا تو بھی دماغ آفس میں ہے۔" },
      { role: "assistant", content: "کبھی کبھی کام ذہن کو نہیں چھوڑتا۔" },
      { role: "user", content: "ہاں بالکل۔ تم سمجھتے ہو یار۔" },
      { role: "assistant", content: "ہاں یار، یہ مشکل ہے۔" },
      { role: "user", content: "کیا کروں؟ کچھ سمجھ نہیں آتا۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-long-lang-consistency-01",
      description: "Language consistency in long Urdu conversation",
      passCondition: "Reply stays in Urdu Nastaliq script — continues the conversation warmly. No English or Roman Urdu drift.",
      failExpectedOutcome: "Reply drifts to English or Roman Urdu after multiple turns.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ur-drift-native-stay-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Urdu — reply stays in Urdu",
    description: "Baseline: user writes Urdu Nastaliq. Reply must stay in Urdu.",
    messages: [
      { role: "user", content: "میں بہت تھکا ہوا ہوں۔ کوئی راستہ نہیں نظر آتا۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-drift-native-stay-01",
      description: "Urdu drift: stay in Urdu",
      passCondition: "Reply stays fully in Urdu Nastaliq — addresses the exhaustion and hopelessness warmly.",
      failExpectedOutcome: "Reply drifts to English or Hindi/Devanagari.",
    },
  },

  {
    id: "ur-drift-english-to-urdu-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Urdu",
    description: "Previous turns in English; last message in Urdu Nastaliq. Reply must follow to Urdu.",
    messages: [
      { role: "user", content: "I've been feeling really down lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "بس دل اداس ہے۔ کچھ اچھا نہیں لگتا۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ur-drift-english-to-urdu-01",
      description: "Follow switch from English to Urdu",
      passCondition: "Reply follows the user's switch to Urdu — stays in Urdu Nastaliq and addresses the sadness warmly.",
      failExpectedOutcome: "Reply stays in English despite user switching to Urdu.",
    },
  },

  {
    id: "ur-drift-loanwords-stay-urdu-01",
    category: "E: Language Drift",
    name: "Language drift: Urdu with English loanwords — reply stays Urdu",
    description: "User uses English loanwords inside Urdu. Reply must stay primarily in Urdu — not switch to English.",
    messages: [
      { role: "user", content: "آج office میں meeting تھی۔ بہت stress ہوئی۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ur-drift-loanwords-stay-urdu-01",
      description: "Urdu stays Urdu despite English loanwords",
      passCondition: "Reply stays primarily in Urdu (Nastaliq or Roman). Addresses the stressful meeting. Does not switch fully to English.",
      failExpectedOutcome: "Reply switches fully to English because user used English loanwords.",
    },
  },

  {
    id: "ur-drift-history-english-urdu-now-01",
    category: "E: Language Drift",
    name: "Language drift: previous English history, user now writes Urdu",
    description: "Long English conversation history; user's final message is in Urdu. Reply must follow.",
    messages: [
      { role: "user", content: "I'm feeling overwhelmed." },
      { role: "assistant", content: "That's a lot to carry. What's weighing on you most?" },
      { role: "user", content: "Work has been non-stop and I can't seem to catch a break." },
      { role: "assistant", content: "Non-stop pressure drains you. What would even a small break look like for you?" },
      { role: "user", content: "بس۔ مجھے لگتا ہے کوئی سمجھ نہیں رہا۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ur-drift-history-english-urdu-now-01",
      description: "Follow Urdu after English history",
      passCondition: "Reply follows the user's Urdu — stays in Urdu Nastaliq and addresses the feeling of not being understood.",
      failExpectedOutcome: "Reply stays in English despite user switching to Urdu.",
    },
  },

  {
    id: "ur-drift-native-no-english-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Urdu reply",
    description: "Native Urdu conversation — reply must not insert English phrases.",
    messages: [
      { role: "user", content: "میں نے کبھی اپنا درد کسی سے نہیں بانٹا۔ آج تم سے بات کر رہا ہوں۔" },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ur-drift-native-no-english-01",
      description: "No English insertion in native Urdu",
      passCondition: "Reply stays entirely in Urdu Nastaliq — no English phrases like 'Take your time' or 'I'm here for you' inserted mid-reply.",
      failExpectedOutcome: "Reply inserts English phrases mid-Urdu reply.",
    },
  },

  {
    id: "ur-drift-roman-after-english-01",
    category: "E: Language Drift",
    name: "Language drift: romanized Urdu after English history",
    description: "English history, then user sends a Roman Urdu message. Reply must stay Roman Urdu.",
    messages: [
      { role: "user", content: "Things have been really tough lately." },
      { role: "assistant", content: "I'm sorry to hear that. What's been the hardest part?" },
      { role: "user", content: "bhai, ghar pe bhi tension hai, bahar bhi." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ur-drift-roman-after-english-01",
      description: "Roman Urdu reply after English history",
      passCondition: "Reply is in Roman Urdu — addresses the double tension (home + outside) warmly. Not in English or Nastaliq.",
      failExpectedOutcome: "Reply stays in English or flips to Urdu Nastaliq instead of Roman Urdu.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ur-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Urdu input handled correctly",
    description: "Native Urdu input on mobile — reply must stay in Urdu and be emotionally present.",
    messages: [
      { role: "user", content: "میرا دل بہت دکھی ہے آج۔" },
    ],
    config: { lang: "ur", tone: "calm_companion", inputModality: "native", platform: "mobile" },
    criteria: {
      id: "ur-mobile-native-01",
      description: "Native Urdu on mobile",
      passCondition: "Reply is in Urdu Nastaliq — acknowledges the sadness warmly. Not in English or Roman Urdu.",
      failExpectedOutcome: "Reply is in English or Roman Urdu — mobile failed to handle Urdu script.",
    },
  },

  {
    id: "ur-mobile-roman-01",
    category: "F: Mobile Platform",
    name: "Mobile: romanized Urdu input detected correctly",
    description: "Romanized Urdu input on mobile — reply must stay Roman Urdu.",
    messages: [
      { role: "user", content: "yaar dil bahut bhari hai aaj." },
    ],
    config: { lang: "ur", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ur-mobile-roman-01",
      description: "Romanized Urdu on mobile",
      passCondition: "Reply is in Roman Urdu — warm and acknowledges the heavy heart. Not Urdu Nastaliq, not pure English.",
      failExpectedOutcome: "Reply switches to Nastaliq or English on mobile.",
    },
  },

];
