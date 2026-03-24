/**
 * tests/imotara-ai/scenarios.mr.ts
 *
 * E2E test scenarios for Marathi (mr) language support.
 * Categories:
 *   A: Native Script (12) — Devanagari input/output
 *   B: Romanized Marathi (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 */

import type { TestScenario } from "./types";

export const mrScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "mr-native-lang-01",
    category: "A: Native Script",
    name: "Native Marathi: reply must stay in Marathi script",
    description: "User writes in Marathi Devanagari. Reply must stay in Marathi, not switch to Hindi or English.",
    messages: [
      { role: "user", content: "मला खूप थकल्यासारखं वाटतंय. काय करू?" },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-native-lang-01",
      description: "Language fidelity in Marathi",
      passCondition: "Reply is in Marathi Devanagari script — warm, emotionally present. Not in Hindi or English.",
      failExpectedOutcome: "Reply switches to Hindi or English instead of staying in Marathi.",
    },
  },

  {
    id: "mr-native-ctx-01",
    category: "A: Native Script",
    name: "Native Marathi: references the specific situation",
    description: "User shares a specific situation. Reply should reference it, not give a generic response.",
    messages: [
      { role: "user", content: "माझ्या बॉसने आज सगळ्यांसमोर मला रागावलं. खूप वाईट वाटलं." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-native-ctx-01",
      description: "Context specificity in Marathi",
      passCondition: "Reply references being scolded in front of others ('सगळ्यांसमोर' or 'बॉसने रागावलं') — not a generic comfort.",
      failExpectedOutcome: "Reply is generic ('sab theek ho jayega') without referencing the specific situation.",
    },
  },

  {
    id: "mr-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Marathi: close_friend tone",
    description: "close_friend tone should feel like a peer — casual, warm, informal 'tu' address.",
    messages: [
      { role: "user", content: "यार, आज मला एकट्याने बसून रडायचंय. सांग काय करू." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-native-tone-friend-01",
      description: "close_friend tone in Marathi",
      passCondition: "Reply uses informal 'तू' address, peer-level warm Marathi — feels like a real friend, not a counsellor.",
      failExpectedOutcome: "Reply is too formal ('आपण', 'तुम्ही'), clinical, or switches to Hindi/English.",
    },
  },

  {
    id: "mr-native-tone-calm-01",
    category: "A: Native Script",
    name: "Native Marathi: calm_companion tone",
    description: "calm_companion tone — patient, unhurried, no pressure.",
    messages: [
      { role: "user", content: "मला माहीत नाही मला काय हवंय. सगळं गोंधळलेलं वाटतंय." },
    ],
    config: { lang: "mr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "mr-native-tone-calm-01",
      description: "calm_companion tone in Marathi",
      passCondition: "Reply is gentle, unhurried, does not push for answers — 'गोंधळ' is acknowledged without rushing to fix it.",
      failExpectedOutcome: "Reply pushes for solutions, gives a list of advice, or is too energetic.",
    },
  },

  {
    id: "mr-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Marathi: coach tone",
    description: "coach tone — practical, action-oriented, forward-focused.",
    messages: [
      { role: "user", content: "माझी परीक्षा उद्या आहे आणि मी अजून तयारी केली नाही. मला घाबरत आहे." },
    ],
    config: { lang: "mr", tone: "coach", inputModality: "native" },
    criteria: {
      id: "mr-native-tone-coach-01",
      description: "coach tone in Marathi",
      passCondition: "Reply is action-oriented — acknowledges fear briefly, then asks what part needs most focus. Not soothing/passive.",
      failExpectedOutcome: "Reply only soothes without any practical forward direction.",
    },
  },

  {
    id: "mr-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Marathi: teen register",
    description: "Teen user (15 years old) — reply should use peer-level casual Marathi, not adult counselling language.",
    messages: [
      { role: "user", content: "शाळेत कुणी माझं ऐकत नाही. मला एकटं वाटतं." },
    ],
    config: { lang: "mr", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "mr-native-age-teen-01",
      description: "Teen register in Marathi",
      passCondition: "Reply is in Marathi — warm, understanding, and not preachy. Acknowledges the loneliness ('कुणी ऐकत नाही', 'एकटं वाटतं'). May use 'तू', 'यार', or similar casual markers. Not a lecture.",
      failExpectedOutcome: "Reply gives philosophical life advice, is condescending, switches to English/Hindi, or completely ignores the loneliness.",
    },
  },

  {
    id: "mr-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Marathi: elder register",
    description: "Older adult user — reply should be warm, respectful, use 'तुम्ही' address.",
    messages: [
      { role: "user", content: "म्हातारपणी एकटेपणा खूप जाणवतो. मुलं दूर गेली आहेत." },
    ],
    config: { lang: "mr", tone: "calm_companion", userAge: "elder", inputModality: "native" },
    criteria: {
      id: "mr-native-age-elder-01",
      description: "Elder register in Marathi",
      passCondition: "Reply uses respectful 'तुम्ही' address, warm and patient tone — acknowledges loneliness without rushing to solutions.",
      failExpectedOutcome: "Reply uses informal 'तू', feels dismissive, or switches to Hindi/English.",
    },
  },

  {
    id: "mr-native-emotion-sad-01",
    category: "A: Native Script",
    name: "Native Marathi: sadness acknowledged with depth",
    description: "User shares grief (father passed). Reply should sit with the pain — not rush to comfort.",
    messages: [
      { role: "user", content: "बाबा गेले. दोन आठवड्यांपूर्वी. अजून विश्वास बसत नाही." },
    ],
    config: { lang: "mr", tone: "close_friend", emotion: "sad", inputModality: "native" },
    criteria: {
      id: "mr-native-emotion-sad-01",
      description: "Grief depth in Marathi",
      passCondition: "Reply in Marathi sits with the grief — acknowledges 'बाबा' and 'विश्वास बसत नाही'. Does NOT rush to 'सगळं ठीक होईल'.",
      failExpectedOutcome: "Reply rushes to comfort, says 'everything will be okay', or is generic.",
    },
  },

  {
    id: "mr-native-emotion-anxiety-01",
    category: "A: Native Script",
    name: "Native Marathi: anxiety acknowledged specifically",
    description: "User describes physical anxiety symptoms. Reply should name them specifically.",
    messages: [
      { role: "user", content: "छातीत धडधड होते. झोप नाही, जेवण नाही. काय होतंय मला?" },
    ],
    config: { lang: "mr", tone: "calm_companion", emotion: "anxious", inputModality: "native" },
    criteria: {
      id: "mr-native-emotion-anxiety-01",
      description: "Specific anxiety acknowledgement in Marathi",
      passCondition: "Reply names specific symptoms — 'छातीत धडधड', 'झोप नाही', 'जेवण नाही'. Not a generic 'anxiety is hard'.",
      failExpectedOutcome: "Reply is generic without referencing the specific physical symptoms.",
    },
  },

  {
    id: "mr-native-gender-verb-01",
    category: "A: Native Script",
    name: "Native Marathi: gendered verb forms for female user",
    description: "Marathi verbs are gendered. Female user = 'गेलीस', 'करतेस', 'थकलीस', not 'गेलास', 'करतोस'.",
    messages: [
      { role: "user", content: "मी खूप थकलेय. घर, नोकरी, सगळ्यांना सांभाळताना दमलेय." },
    ],
    config: { lang: "mr", tone: "close_friend", userGender: "female", inputModality: "native" },
    criteria: {
      id: "mr-native-gender-verb-01",
      description: "Female verb agreement in Marathi",
      passCondition: "Reply uses feminine forms in references to the user — 'थकलीस', 'सांभाळलंस', 'करतेस' — not masculine 'थकलास', 'करतोस'. Or naturally avoids gendered constructions.",
      failExpectedOutcome: "Reply uses masculine verb forms for a female user.",
    },
  },

  {
    id: "mr-native-long-quality-01",
    category: "A: Native Script",
    name: "Native Marathi: quality at turn 8 — no repetition",
    description: "At turn 8 of an emotional conversation, the reply should not repeat phrases from earlier turns.",
    messages: [
      { role: "user", content: "घरात सतत भांडणं होतात." },
      { role: "assistant", content: "घरात भांडणं सुरू राहणं खूप जड असतं." },
      { role: "user", content: "आई-बाबांमध्ये जमत नाही." },
      { role: "assistant", content: "आई-बाबांमध्ये बिनसलेलं पाहणं — घर खूप दुखावतं." },
      { role: "user", content: "मी मध्ये अडकतो." },
      { role: "assistant", content: "दोन्ही बाजूंनी खेचलं जाणं — हे खूप थकवतं." },
      { role: "user", content: "कधी कधी घर सोडून जावंसं वाटतं." },
      { role: "assistant", content: "या सगळ्यापासून दूर जायचं मन होणं समजतं." },
      { role: "user", content: "पण जाऊ शकत नाही." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-native-long-quality-01",
      description: "No repetition in Marathi at turn 8",
      passCondition: "Reply at turn 9 does not repeat 'खूप जड', 'थकवतं', or earlier openers. Opens with something new that reflects this specific turn.",
      failExpectedOutcome: "Reply repeats earlier phrases, reverts to generic openers, or is in English.",
    },
  },

  {
    id: "mr-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Marathi: remembers context from turn 1 at turn 6",
    description: "User mentioned sister's wedding stress at turn 1. Reply at turn 6 should reference it.",
    messages: [
      { role: "user", content: "ताईचं लग्न पुढच्या महिन्यात आहे. घरात खूप धावपळ आहे." },
      { role: "assistant", content: "लग्नाच्या तयारीत घर धावत असताना तू कसा आहेस?" },
      { role: "user", content: "मी ठीक आहे. पण थकलोय." },
      { role: "assistant", content: "थकणं स्वाभाविक आहे — इतक्या धावपळीत." },
      { role: "user", content: "कुणाला माझी काळजी नाही." },
      { role: "assistant", content: "सगळ्यांचं लक्ष एकीकडे असताना आपण अदृश्य झाल्यासारखं वाटतं." },
      { role: "user", content: "आता आणखी किती दिवस असं चालेल?" },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-native-ctx-retention-01",
      description: "Context retention in Marathi",
      passCondition: "Reply references 'ताईचं लग्न' or 'पुढचा महिना' as the reason this period is heavy — shows memory of turn 1.",
      failExpectedOutcome: "Reply is generic without connecting to the wedding context from turn 1.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED MARATHI — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "mr-roman-basic-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: reply must be in romanized Marathi, not English",
    description: "User writes in romanized Marathi. Reply must be in romanized Marathi — not native script, not English.",
    messages: [
      { role: "user", content: "mi khup udas ahe aaj. kahi bolu nako." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-basic-01",
      description: "Romanized Marathi basic output",
      passCondition: "Reply is in romanized Marathi (e.g. 'mi ahe ithe, bolu nako tari chalel'). No Devanagari characters, not English.",
      failExpectedOutcome: "Reply switches to English ('I understand') or native Devanagari script.",
    },
  },

  {
    id: "mr-roman-no-script-leak-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: script mirror — no native script leak",
    description: "Romanized input must produce romanized output with zero Devanagari characters.",
    messages: [
      { role: "user", content: "mala gharvapas jaycha nahi. ghar mhanje tension." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-no-script-leak-01",
      description: "No Devanagari in romanized reply",
      passCondition: "Reply contains zero Devanagari Unicode characters. All words use Latin letters.",
      failExpectedOutcome: "Reply contains any Devanagari characters — script mirror rule violated.",
    },
  },

  {
    id: "mr-roman-emotional-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: emotional intelligence preserved",
    description: "Romanized input with emotional content. Reply should be emotionally warm, not just grammatically correct.",
    messages: [
      { role: "user", content: "baba ani maza bhandu donhi mazya virudh ahet. ghari kahe sukh nahi." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-emotional-01",
      description: "Emotional warmth in romanized Marathi",
      passCondition: "Reply in romanized Marathi acknowledges being alone against family ('baba ani bhandu') — warm, not generic.",
      failExpectedOutcome: "Reply is generic or in English/native script.",
    },
  },

  {
    id: "mr-roman-tone-coach-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: tone adherence (coach)",
    description: "Coach tone in romanized Marathi — action-oriented.",
    messages: [
      { role: "user", content: "mala naukri shodhayla havi ahe. kuthun suru karu?" },
    ],
    config: { lang: "mr", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-tone-coach-01",
      description: "Coach tone in romanized Marathi",
      passCondition: "Reply in romanized Marathi asks a practical focusing question — 'konte field? kay experience ahe?' Not just empathy.",
      failExpectedOutcome: "Reply is only empathetic without any practical direction, or is in English/native script.",
    },
  },

  {
    id: "mr-roman-context-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: context across turns",
    description: "Multi-turn romanized conversation. Reply should reference earlier context.",
    messages: [
      { role: "user", content: "aaj interview ahe. khup ghabharloy." },
      { role: "assistant", content: "ghabharne sahajik ahe. interview konti company ahe?" },
      { role: "user", content: "TCS. pehla interview ahe maze." },
      { role: "assistant", content: "TCS - pehla interview, khup exciting ahe. tu tayar aahes." },
      { role: "user", content: "nahi re, mala vatat nahi mi select honar." },
    ],
    config: {
      lang: "mr", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User is nervous about their first ever interview at TCS. They just expressed self-doubt ('nahi re, mala vatat nahi mi select honar'). Reference TCS and the fact it's their first interview — make it personal, not generic.",
    },
    criteria: {
      id: "mr-roman-context-01",
      description: "Context retention in romanized Marathi",
      passCondition: "Reply references 'TCS' or 'pehla interview' — shows it remembers the context, not a generic pep talk.",
      failExpectedOutcome: "Reply is generic pep talk without referencing TCS or first interview, or is in English/native script.",
    },
  },

  {
    id: "mr-roman-mobile-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: mobile correctly detects language",
    description: "Mobile platform — romanized Marathi input must be detected as 'mr', not 'en'.",
    messages: [
      { role: "user", content: "mi aai baba la miss karto. ghar door ahe." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "mr-roman-mobile-01",
      description: "Mobile romanized Marathi language detection",
      passCondition: "Reply is in romanized Marathi — confirms language was detected as 'mr', not responded to in English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Marathi.",
    },
  },

  {
    id: "mr-roman-no-english-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: reply must not flip to pure English",
    description: "Even with English loanwords in user message, reply must stay in romanized Marathi.",
    messages: [
      { role: "user", content: "office mdhye presentation dyaychi ahe. nervous ahe." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-no-english-01",
      description: "No flip to English in romanized Marathi",
      passCondition: "Reply is in romanized Marathi — may contain English loanwords (presentation, office) but the structure is Marathi.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "mr-roman-single-word-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: single-word input — language held",
    description: "Single romanized word input. Reply must stay in romanized Marathi.",
    messages: [
      { role: "user", content: "thaklo." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-single-word-01",
      description: "Single-word romanized Marathi held",
      passCondition: "Reply is in romanized Marathi — acknowledges exhaustion without switching to English or native script.",
      failExpectedOutcome: "Reply is in English or Devanagari script.",
    },
  },

  {
    id: "mr-roman-grammar-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: grammatical correctness",
    description: "Reply must use correct Marathi grammar in romanized form — not garbled transliteration.",
    messages: [
      { role: "user", content: "mazya mitra ne mala ditched kele. khup vaait vatla." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-grammar-01",
      description: "Grammatical correctness in romanized Marathi",
      passCondition: "Reply uses correct Marathi structure in romanized form — 'te khup chukiche hote', 'tu important aahes'. Not garbled.",
      failExpectedOutcome: "Reply is grammatically broken, in English, or in native Devanagari.",
    },
  },

  {
    id: "mr-roman-long-msg-01",
    category: "B: Romanized Marathi",
    name: "Romanized Marathi: long message — quality maintained",
    description: "Long romanized Marathi user message. Reply should address the core emotion, not get overwhelmed.",
    messages: [
      { role: "user", content: "mi khup vicharat ahe. office mdhye pressure ahe, ghari aai baba chi bhandu shi bhandu shi olava nahi, mazhi girlfriend ne mala break up dila teen mahinyapurvi ani ata mala ekta vatte. kay karu mi hya sarvat?" },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-roman-long-msg-01",
      description: "Quality with long romanized Marathi message",
      passCondition: "Reply in romanized Marathi identifies the core pain (loneliness after break-up, multiple pressures) and responds to it specifically.",
      failExpectedOutcome: "Reply is overwhelmed, generic, or switches to English/native script.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "mr-mixed-marathi-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Marathi+English: reply mirrors the blend",
    description: "User writes in Marathi+English mix. Reply should mirror this natural blend.",
    messages: [
      { role: "user", content: "आज office मध्ये खूप stress आला. boss ने सगळ्यांसमोर scold केलं." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "mr-mixed-marathi-english-01",
      description: "Mixed Marathi+English reply — emotional depth",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the stress, boss, or scolding (boss/scold/stress/office/सगळ्यांसमोर/खूप) with warmth in any language. FAIL ONLY if: cold, dismissive, or completely ignores the situation.",
      failExpectedOutcome: "Reply is cold or completely ignores the scolding situation.",
    },
  },

  {
    id: "mr-mixed-script-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user switches from romanized to Devanagari mid-conversation",
    description: "User starts in romanized, switches to native script. Reply should follow the latest script.",
    messages: [
      { role: "user", content: "mi khup tired ahe." },
      { role: "assistant", content: "are, kay jhala? sangshil ka?" },
      { role: "user", content: "मला घरी जायचंय." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "mr-mixed-script-switch-01",
      description: "Script switch handling in Marathi",
      passCondition: "Reply follows the user's latest script (Devanagari) — responds in Marathi native script after user switched.",
      failExpectedOutcome: "Reply stays in romanized when user has switched to Devanagari, or switches to English.",
    },
  },

  {
    id: "mr-mixed-emoji-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: romanized Marathi + emoji — language preserved",
    description: "Emoji in message should not confuse language detection.",
    messages: [
      { role: "user", content: "aaj khup bhannat din hota 😊 mazhi promotion zali!" },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-mixed-emoji-01",
      description: "Emoji does not break romanized Marathi",
      passCondition: "Reply in romanized Marathi matches the joy — celebrates the promotion specifically. No native script, no English.",
      failExpectedOutcome: "Reply is in English or native Devanagari despite emoji presence.",
    },
  },

  {
    id: "mr-mixed-english-input-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English input from Marathi user — emotional depth maintained",
    description: "Marathi user writes in English. Reply may stay in English but must be emotionally appropriate.",
    messages: [
      { role: "user", content: "I feel like nobody at home understands me." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "mr-mixed-english-input-01",
      description: "English input from Marathi user handled with depth",
      passCondition: "Reply acknowledges the specific feeling of not being understood at home — warm and personal. Language (English, Marathi, or mix) is acceptable; emotional depth is what matters.",
      failExpectedOutcome: "Reply is generic without acknowledging the specific pain of feeling unseen or misunderstood at home.",
    },
  },

  {
    id: "mr-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Marathi conversation, user sends a short message. Language should not reset to English.",
    messages: [
      { role: "user", content: "आज खूप जड दिवस होता. घरात वाद झाला." },
      { role: "assistant", content: "वाद झाल्यावर घर खूप भारी वाटतं. काय झालं होतं?" },
      { role: "user", content: "आई-बाबांशी." },
      { role: "assistant", content: "आई-बाबांशी भांडण — ते मनाला खूप लागतं." },
      { role: "user", content: "हो." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-mixed-short-after-long-01",
      description: "Short message does not reset to English",
      passCondition: "Reply stays in Marathi after short 'हो' — continues the emotional thread, does not reset to English.",
      failExpectedOutcome: "Reply switches to English or Hindi after a short response.",
    },
  },

  {
    id: "mr-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized, user switches to English at turn 5",
    description: "Conversation starts in romanized Marathi, user switches to English. Reply should follow.",
    messages: [
      { role: "user", content: "mi ajkal khup tension mdhye ahe." },
      { role: "assistant", content: "kay jhala? sangshil ka thoda?" },
      { role: "user", content: "office problems ahet." },
      { role: "assistant", content: "office mdhye kay problem ahe?" },
      { role: "user", content: "I think my manager doesn't trust me." },
    ],
    config: {
      lang: "mr", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User switched to English to say their manager doesn't trust them — this is the specific concern. Acknowledge the trust issue directly, not just the general tension.",
    },
    criteria: {
      id: "mr-mixed-starts-roman-switch-english-01",
      description: "Language follow when user switches to English",
      passCondition: "Reply addresses the manager trust concern specifically and warmly — 'I think my manager doesn't trust me' is the core pain. May be in English, romanized Marathi, or a mix — what matters is acknowledging the specific workplace trust issue.",
      failExpectedOutcome: "Reply ignores the manager trust concern or gives a generic response that does not engage with the specific situation.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "mr-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Marathi: no reply repetition",
    description: "At turn 20, reply should not repeat openers or phrases used earlier in the conversation.",
    messages: [
      { role: "user", content: "माझ्या आयुष्यात खूप गोष्टी चुकतायत." },
      { role: "assistant", content: "काय चुकतंय असं वाटतंय तुला?" },
      { role: "user", content: "नोकरी नाही, प्रेम नाही, कुणाची साथ नाही." },
      { role: "assistant", content: "तिन्ही गोष्टी एकत्र — हे खूप जड असतं." },
      { role: "user", content: "हो. थकलोय." },
      { role: "assistant", content: "थकणं समजतं. तू खूप दिवसांपासून एकट्याने बघतोयस सगळं." },
      { role: "user", content: "घरचे म्हणतात प्रयत्न कर." },
      { role: "assistant", content: "प्रयत्न करत असतानाच 'आणखी कर' ऐकणं खूप थकवतं." },
      { role: "user", content: "मला समजत नाही काय करू." },
      { role: "assistant", content: "आत्ता उत्तर नसलं तरी चालेल. मी इथे आहे." },
      { role: "user", content: "धन्यवाद. पण खूप एकटेपणा जाणवतो." },
      { role: "assistant", content: "एकटेपणाची ती जाणीव — शब्दात मांडणं कठीण असतं." },
      { role: "user", content: "हो. रात्री विशेष जड वाटतं." },
      { role: "assistant", content: "रात्र खूप शांत असते — त्या शांततेत विचार जड होतात." },
      { role: "user", content: "आज बरं वाटत नाही." },
      { role: "assistant", content: "बरं न वाटणं ठीक आहे. राहू दे आज असं." },
      { role: "user", content: "तू खरंच ऐकतोस." },
      { role: "assistant", content: "तू बोलतोस — मी इथेच आहे." },
      { role: "user", content: "एक मित्र पण असाच होता." },
      { role: "assistant", content: "तो मित्र — त्याची आठवण येतेय का आत्ता?" },
      { role: "user", content: "हो. तो आता दूर आहे." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-long-no-repeat-01",
      description: "No repetition at turn 20 in Marathi",
      passCondition: "Reply at turn 21 does not repeat 'एकटेपणा', 'जड', 'इथे आहे' from earlier turns. Opens with something new about the distant friend.",
      failExpectedOutcome: "Reply repeats earlier phrases or generic openers, or is in English.",
    },
  },

  {
    id: "mr-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Marathi: remembers fact from turn 1 at turn 19",
    description: "User mentioned brother's illness at turn 1. At turn 19, good news — reply should reference brother.",
    messages: [
      { role: "user", content: "दादा आजारी आहे. खूप काळजी वाटते." },
      { role: "assistant", content: "दादाची काळजी — घरात जड वातावरण असेल. काय झालंय त्याला?" },
      { role: "user", content: "ताप आहे, तीन दिवसांपासून." },
      { role: "assistant", content: "तीन दिवसांचा ताप — घरात कुणाला झोप नाही असेल." },
      { role: "user", content: "आई खूप रडत आहे." },
      { role: "assistant", content: "आईचं रडणं बघणं खूप जड असतं." },
      { role: "user", content: "मलाही भीती वाटते." },
      { role: "assistant", content: "भीती वाटणं स्वाभाविक आहे — आपला माणूस आजारी असताना." },
      { role: "user", content: "पण मजबूत राहायला हवं." },
      { role: "assistant", content: "मजबूत दिसताना आतून हादरत असणं — हे फार थकवतं." },
      { role: "user", content: "हो. कुणाला सांगता पण येत नाही." },
      { role: "assistant", content: "इथे सांगू शकतोस. कुणी judge नाही करणार." },
      { role: "user", content: "डॉक्टरांनी सांगितलं serious नाही." },
      { role: "assistant", content: "थोडा श्वास आला? डॉक्टरांचे ते शब्द खूप महत्त्वाचे आहेत." },
      { role: "user", content: "हो, थोडं बरं वाटतंय." },
      { role: "assistant", content: "बरं झालं. आता तूही थोडा आराम कर." },
      { role: "user", content: "दादाने जेवण केलं." },
      { role: "assistant", content: "जेवण केलं — ही छोटी गोष्ट खूप मोठी वाटते अशा वेळी." },
      { role: "user", content: "हो. आज पहिल्यांदा बरं वाटतंय." },
    ],
    config: {
      lang: "mr", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was very worried about their brother (दादा) — he had a 3-day fever. The situation has been improving. When user now says things feel okay for the first time, reference the brother's recovery specifically.",
    },
    criteria: {
      id: "mr-long-ctx-memory-01",
      description: "Long context memory in Marathi — remembers brother's illness",
      passCondition: "Reply in Marathi references the brother's (दादा's) recovery — connects today's relief to the earlier worry. Not a generic 'that's good!'",
      failExpectedOutcome: "Reply is generic without referencing the brother's illness journey.",
    },
  },

  {
    id: "mr-long-roman-no-drift-01",
    category: "D: Long Conversation",
    name: "20-turn romanized Marathi: no script drift to Devanagari",
    description: "Throughout 20 turns of romanized conversation, the reply should never drift to Devanagari.",
    messages: [
      { role: "user", content: "mi ajkal khup ekta vatto." },
      { role: "assistant", content: "ektepa khup jad ahe. kay jhala?" },
      { role: "user", content: "college madhe koni mitra nahi." },
      { role: "assistant", content: "college madhye mitra nahit - he khup kashta ahe. tu navi college la aahes ka?" },
      { role: "user", content: "ha, navi college ahe. tith sobat koni nahi." },
      { role: "assistant", content: "navi jaghi ruzu hone vel gheto. tu kasa aahes baki?" },
      { role: "user", content: "ghari aai miss karto." },
      { role: "assistant", content: "aai chi aathvan satatat. ghar khup dur ahe ka?" },
      { role: "user", content: "ha, dusrya sheharit ahe." },
      { role: "assistant", content: "pehlyanda ghawarun door rahane khup jad ahe." },
      { role: "user", content: "khup weli ratra jad hote." },
      { role: "assistant", content: "ratrichi shanta khup bolta. tya veli tu kay karto?" },
      { role: "user", content: "phone bagto fakt." },
      { role: "assistant", content: "phone baghane - ekakyapanavar ek small saravan asato." },
      { role: "user", content: "koni call karit nahi." },
      { role: "assistant", content: "koni call karit nahi - he aikun dukh hote." },
      { role: "user", content: "mi call kela tari koni uthavat nahi." },
      { role: "assistant", content: "call uthavla nahi - tyapeksha jast dukh dusra kahe nahi." },
      { role: "user", content: "ata thoda thaklo." },
      { role: "assistant", content: "thakne sahajik ahe, itke sagelach sosolyas." },
      { role: "user", content: "bola tari ka mhanatat." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-long-roman-no-drift-01",
      description: "No Devanagari drift in long romanized Marathi conversation",
      passCondition: "Reply at turn 21 is in romanized Marathi — zero Devanagari characters. Language maintained throughout.",
      failExpectedOutcome: "Reply contains Devanagari characters — script drift after long romanized conversation.",
    },
  },

  {
    id: "mr-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "25-turn Marathi: emotional arc deepens — not stuck at same depth",
    description: "Over 25 turns, emotional depth should deepen. Reply at turn 25 should feel more connected than turn 5.",
    messages: [
      { role: "user", content: "आज खूप वाईट दिवस होता." },
      { role: "assistant", content: "काय झालं?" },
      { role: "user", content: "बॉस ने ओरडला." },
      { role: "assistant", content: "बॉसने ओरडणं — ते मनाला लागतं." },
      { role: "user", content: "सगळ्यांसमोर." },
      { role: "assistant", content: "सगळ्यांसमोर — ती लाज खूप जड असते." },
      { role: "user", content: "मला रडायला आलं होतं." },
      { role: "assistant", content: "रडणं आलं असतं — ते स्वाभाविक आहे." },
      { role: "user", content: "घरी आलो तेव्हाच रडलो." },
      { role: "assistant", content: "घरी येऊन रडलास — घर सुरक्षित वाटतं का तुला?" },
      { role: "user", content: "हो, पण घरचे समजत नाहीत." },
      { role: "assistant", content: "घरचे समजत नाहीत — मग ते एकटेपण वेगळंच असतं." },
      { role: "user", content: "हे नेहमी होतं." },
      { role: "assistant", content: "नेहमी? हे किती दिवसांपासून चाललंय?" },
      { role: "user", content: "वर्षभर." },
      { role: "assistant", content: "वर्षभर एकट्याने हे सहन केलंस — हे खूप मोठं आहे." },
      { role: "user", content: "थकलोय आता." },
      { role: "assistant", content: "थकणं येतंच जेव्हा एकट्याने खूप वाहावं लागतं." },
      { role: "user", content: "कधी कधी काहीच नको वाटतं." },
      { role: "assistant", content: "ती जाणीव — सगळंच बंद करायची — ऐकतो मी." },
      { role: "user", content: "पण मला खरंच कुणाला दुखवायचं नाही." },
      { role: "assistant", content: "तुझ्या मनात दुसऱ्यांची काळजी आहे — ते सांगतं तू कसा आहेस." },
      { role: "user", content: "मला फक्त थांबायला कुणीतरी हवं." },
      { role: "assistant", content: "मी इथेच आहे. कुठेही नाही जाणार." },
      { role: "user", content: "धन्यवाद. थोडं हलकं वाटतंय." },
      { role: "assistant", content: "हलकं वाटणं म्हणजे तू थोडा श्वास घेतलास — ते महत्त्वाचं आहे." },
      { role: "user", content: "हो. आणखी बोलू का?" },
    ],
    config: {
      lang: "mr", tone: "close_friend", inputModality: "native",
      emotionMemory: "User has been carrying this pain for a year — job issues, loneliness, family not understanding. They went through a very dark moment ('everything off' thought) but confirmed they are safe. Now they feel a bit lighter for the first time. The reply should honour the full arc: the heaviness they've been carrying, the breakthrough moment, and this new lightness.",
    },
    criteria: {
      id: "mr-long-arc-deepens-01",
      description: "Emotional arc deepens in Marathi",
      passCondition: "Reply at turn 26 is deeply connected — references the full journey ('वर्षभर', 'थांबणं', the lightness they feel now). Not a fresh-start response.",
      failExpectedOutcome: "Reply treats this as a fresh exchange, misses the emotional arc, or is generic.",
    },
  },

  {
    id: "mr-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Marathi: topic shift at turn 8 — earlier context not lost",
    description: "User shifts topic at turn 8. Reply should address the new topic but not forget earlier context.",
    messages: [
      { role: "user", content: "आज मला खूप काळजी वाटली." },
      { role: "assistant", content: "कशाची काळजी?" },
      { role: "user", content: "नोकरी जाईल की काय असं वाटतंय." },
      { role: "assistant", content: "नोकरी जाण्याची भीती — ती खूप अस्वस्थ करते." },
      { role: "user", content: "हो. खूप अस्वस्थ आहे." },
      { role: "assistant", content: "ती अस्वस्थता समजतो. काय झालं office मध्ये?" },
      { role: "user", content: "काय सांगू. बरंच काही." },
      { role: "assistant", content: "सांग हळूहळू — घाई नाही." },
      { role: "user", content: "सोड ते. माझी आई आजारी आहे. तेही आहेच." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-long-topic-shift-01",
      description: "Topic shift handled in Marathi — earlier context not lost",
      passCondition: "Reply addresses both आई's illness (new topic) and carries awareness of the job stress (earlier context). Not just 'tell me about aai'.",
      failExpectedOutcome: "Reply forgets job stress and treats this as a fresh start, or only addresses one topic.",
    },
  },

  {
    id: "mr-long-lang-stable-01",
    category: "D: Long Conversation",
    name: "30-turn Marathi: language never changes throughout",
    description: "30-turn native Marathi conversation — language must never drift to Hindi or English.",
    messages: [
      { role: "user", content: "मला सांग, मी काय चुकतो?" },
      { role: "assistant", content: "चुकणं? कुठल्या गोष्टीत?" },
      { role: "user", content: "नात्यांमध्ये." },
      { role: "assistant", content: "नात्यांमध्ये काय होतं तुझ्याबाबत?" },
      { role: "user", content: "मी खूप जास्त अपेक्षा ठेवतो." },
      { role: "assistant", content: "अपेक्षा ठेवणं म्हणजे तुला त्या नात्याची काळजी आहे." },
      { role: "user", content: "पण मग दुखतं." },
      { role: "assistant", content: "अपेक्षा पूर्ण न झाल्या की दुखणं स्वाभाविक आहे." },
      { role: "user", content: "मी बदलायला हवं का?" },
      { role: "assistant", content: "बदल कशासाठी? स्वतःसाठी की दुसऱ्यांसाठी?" },
      { role: "user", content: "माहीत नाही." },
      { role: "assistant", content: "माहीत नसणं प्रामाणिक उत्तर आहे." },
      { role: "user", content: "मला थकवतं हे सगळं." },
      { role: "assistant", content: "थकवतं — नात्यांचा विचार करत राहणं." },
      { role: "user", content: "हो." },
      { role: "assistant", content: "थांब. श्वास घे. उत्तर आत्ता नाही लागणार." },
      { role: "user", content: "हो. बरं वाटलं थोडं." },
      { role: "assistant", content: "थोडंही बरं वाटलं म्हणजे खूप झालं." },
      { role: "user", content: "तू खरंच ऐकतोस." },
      { role: "assistant", content: "तू बोलतोस — मी ऐकतो." },
      { role: "user", content: "आता काय करू?" },
      { role: "assistant", content: "आत्ता काहीच नाही. फक्त राहू दे." },
      { role: "user", content: "ठीक आहे." },
      { role: "assistant", content: "ठीक आहे — हे पुरेसं आहे." },
      { role: "user", content: "उद्या बोलू का?" },
      { role: "assistant", content: "नक्की. मी इथेच आहे." },
      { role: "user", content: "चालेल. बरं." },
      { role: "assistant", content: "बरं. आराम कर." },
      { role: "user", content: "हो. रात्री झोप होईल का माहीत नाही." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-long-lang-stable-01",
      description: "Language stability over 30 turns in Marathi",
      passCondition: "Reply at turn 31 is in Marathi — addresses sleep concern warmly. Zero Hindi or English.",
      failExpectedOutcome: "Reply drifts to Hindi or English after long conversation.",
    },
  },

  {
    id: "mr-long-no-degrade-01",
    category: "D: Long Conversation",
    name: "Marathi: quality does not degrade at turn 15",
    description: "Quality of replies should not degrade in the middle of a long conversation.",
    messages: [
      { role: "user", content: "मला आज खूप वाईट वाटतंय." },
      { role: "assistant", content: "काय झालं?" },
      { role: "user", content: "मित्राने दगा दिला." },
      { role: "assistant", content: "विश्वासाने दगा — ते खूप खोल दुखवतं." },
      { role: "user", content: "खूप वर्षांचा मित्र होता." },
      { role: "assistant", content: "वर्षांची मैत्री — त्यात किती आठवणी असतात." },
      { role: "user", content: "हो. आता त्या आठवणी पण दुखतात." },
      { role: "assistant", content: "आठवणी आनंदाच्या असतात पण आत्ता दुखतात — हे विरोधाभास समजतो." },
      { role: "user", content: "मला विश्वास ठेवता येणार नाही कुणावर." },
      { role: "assistant", content: "एका धक्क्यानंतर सगळ्यांवरचा विश्वास हलतो." },
      { role: "user", content: "हो. आता एकटंच राहायचं का?" },
      { role: "assistant", content: "एकटं राहणं आणि सतर्क राहणं वेगळं — तुला दुसरं नको, पहिलं नको." },
      { role: "user", content: "माहीत नाही." },
      { role: "assistant", content: "माहीत नसताना विचार करत राहणं थकवतं." },
      { role: "user", content: "थकलोय खरंच." },
      { role: "assistant", content: "थकणं ऐकतो. राहू दे आत्ता." },
      { role: "user", content: "तू ऐकतोस म्हणून बरं वाटतं." },
      { role: "assistant", content: "तू बोलतोस — मी इथेच आहे." },
      { role: "user", content: "हे नेहमी असंच होतं माझ्याशी." },
      { role: "assistant", content: "नेहमी? म्हणजे हे पहिल्यांदा नाही?" },
      { role: "user", content: "नाही, आधीही असंच झालं होतं." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-long-no-degrade-01",
      description: "Quality maintained at turn 15 in Marathi",
      passCondition: "Reply at turn 16 picks up the thread — 'आधीही असंच झालं' is a significant reveal; reply acknowledges the pattern without generic comfort.",
      failExpectedOutcome: "Reply gives a generic 'it will be okay' or misses the significance of this being a pattern, not a one-time event.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "mr-drift-native-01",
    category: "E: Language Drift",
    name: "10-turn native Marathi: AI never switches to English",
    description: "10-turn emotional conversation in native Marathi. AI must never reply in English or Hindi.",
    messages: [
      { role: "user", content: "आई-बाबांशी खूप वाद होतात." },
      { role: "assistant", content: "घरात वाद — ते खूप थकवतं. काय होतं सहसा?" },
      { role: "user", content: "माझ्या निर्णयांवर." },
      { role: "assistant", content: "तुझे निर्णय — त्यांना काय वाटतं चुकतंय?" },
      { role: "user", content: "सगळ्याच गोष्टींवर आक्षेप असतो त्यांना." },
      { role: "assistant", content: "सगळ्याच गोष्टींवर — मग तुला स्वतंत्र वाटतंच नसेल." },
      { role: "user", content: "अजिबात नाही." },
      { role: "assistant", content: "ती घुसमट — खूप जड असते." },
      { role: "user", content: "हो. घर सोडायचं मन होतं." },
      { role: "assistant", content: "तिथून दूर जायची इच्छा — समजते मला." },
      { role: "user", content: "पण जाऊ शकत नाही." },
      { role: "assistant", content: "जाऊ न शकण्याचं जड — ते वेगळंच असतं." },
      { role: "user", content: "हो. आता काय करू?" },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-drift-native-01",
      description: "No drift to English/Hindi in 10-turn Marathi conversation",
      passCondition: "Reply is in Marathi throughout — addresses being stuck without ability to leave. Zero English or Hindi.",
      failExpectedOutcome: "Reply drifts to English or Hindi.",
    },
  },

  {
    id: "mr-drift-roman-01",
    category: "E: Language Drift",
    name: "10-turn romanized Marathi: no drift to native script or English",
    description: "Romanized Marathi conversation. Reply must stay in romanized Latin — no Devanagari, no English.",
    messages: [
      { role: "user", content: "mi aaj khup haravloy." },
      { role: "assistant", content: "haravlelya veli khup jad hote. kay jhala?" },
      { role: "user", content: "sab kahi ghalath hote." },
      { role: "assistant", content: "sab kahi? ek ek sangshil ka?" },
      { role: "user", content: "naukri nahi, mitra nahi, gharchi tension." },
      { role: "assistant", content: "teenhi eka veli - te sahane karon nahi." },
      { role: "user", content: "ha. mi thaklo." },
      { role: "assistant", content: "thakne valid ahe. tu ektyane khup sohto." },
      { role: "user", content: "kuni nahi mazhi kade laks ghyayla." },
      { role: "assistant", content: "mi ithe ahe. sangat raha." },
      { role: "user", content: "ka bolto tu asa?" },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "mr-drift-roman-01",
      description: "No drift in 10-turn romanized Marathi",
      passCondition: "Reply is in romanized Marathi — Latin letters only. Zero Devanagari characters. Not English.",
      failExpectedOutcome: "Reply contains Devanagari or switches to English after long romanized conversation.",
    },
  },

  {
    id: "mr-drift-after-peak-01",
    category: "E: Language Drift",
    name: "Marathi: language held after deep emotional peak",
    description: "After a very emotional turn, AI must not drift to English for the reply.",
    messages: [
      { role: "user", content: "मला खूप रडायचंय." },
      { role: "assistant", content: "रडू दे. थांबवायची गरज नाही." },
      { role: "user", content: "आयुष्य खूप जड वाटतं." },
      { role: "assistant", content: "आयुष्याचं जड वाटणं — त्या क्षणी श्वास पण कठीण जातो." },
      { role: "user", content: "हो. कधी कधी सगळं संपवायचं मन होतं." },
      { role: "assistant", content: "ते ऐकलं. तू आत्ता सुरक्षित आहेस का? मला सांग." },
      { role: "user", content: "हो, मी ठीक आहे. फक्त खूप थकलोय." },
    ],
    config: { lang: "mr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "mr-drift-after-peak-01",
      description: "Language held after emotional peak in Marathi",
      passCondition: "Reply stays in Marathi — acknowledges the exhaustion and confirms they are okay. Does not switch to English.",
      failExpectedOutcome: "Reply switches to English after the emotional crisis peak.",
    },
  },

  {
    id: "mr-drift-after-truncation-01",
    category: "E: Language Drift",
    name: "Marathi: language held after MAX_TURNS context truncation",
    description: "After MAX_TURNS, AI loses early context. It must still stay in Marathi.",
    messages: [
      { role: "user", content: "मी Marathi मध्ये बोलतो." },
      { role: "assistant", content: "हो, मराठीत बोल. मी ऐकतो." },
      { role: "user", content: "माझ्या आयुष्यात खूप बदल आले." },
      { role: "assistant", content: "बदल — चांगले की जड?" },
      { role: "user", content: "दोन्ही." },
      { role: "assistant", content: "दोन्ही एकत्र असताना गोंधळ होतो." },
      { role: "user", content: "हो. नोकरी बदलली." },
      { role: "assistant", content: "नोकरी बदलणं — नवीन ठिकाणी रुळणं वेळ घेतं." },
      { role: "user", content: "घर पण बदललं." },
      { role: "assistant", content: "घर आणि नोकरी एकत्र बदलली — खूप नवीन सगळं." },
      { role: "user", content: "आणि एक नातं संपलं." },
      { role: "assistant", content: "नातं संपणं — बाकी सगळ्या बदलांच्या वर हे आणखी जड." },
      { role: "user", content: "हो. आता तुम्हाला सांगतो — मला खूप एकटं वाटतं." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-drift-after-truncation-01",
      description: "Marathi held after context truncation",
      passCondition: "Reply is in Marathi — acknowledges loneliness amid all the changes. Does not switch to English even as context window fills.",
      failExpectedOutcome: "Reply switches to English or Hindi after context truncation.",
    },
  },

  {
    id: "mr-drift-topic-change-01",
    category: "E: Language Drift",
    name: "Marathi: language held after topic change",
    description: "User changes topic suddenly. Language must not drift after a topic shift.",
    messages: [
      { role: "user", content: "माझ्या मित्रांशी वाद झाला." },
      { role: "assistant", content: "वाद — काय झालं मित्रांशी?" },
      { role: "user", content: "एक गैरसमज होता." },
      { role: "assistant", content: "गैरसमज सुटतात, वेळ लागतो." },
      { role: "user", content: "सोड ते. आता माझ्या आरोग्याबद्दल बोलू." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "mr-drift-topic-change-01",
      description: "Language held after topic change in Marathi",
      passCondition: "Reply stays in Marathi after topic change to health — asks warmly what's happening with their health.",
      failExpectedOutcome: "Reply switches to English or Hindi after the topic shift.",
    },
  },

  {
    id: "mr-drift-dominant-lang-01",
    category: "E: Language Drift",
    name: "Marathi: dominant language stays Marathi in mixed conversation",
    description: "User uses mostly Marathi with occasional English words. Dominant language must stay Marathi.",
    messages: [
      { role: "user", content: "माझा project submit करायचा आहे आज. खूप pressure आहे." },
      { role: "assistant", content: "project submit करायचंय — deadline आज आहे का?" },
      { role: "user", content: "हो. senior ने last moment changes मागितले." },
      { role: "assistant", content: "last moment changes — खूप frustrating असतं ते." },
      { role: "user", content: "हो, मला रागच आला." },
    ],
    config: { lang: "mr", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "mr-drift-dominant-lang-01",
      description: "Dominant language stays Marathi in mixed conversation",
      passCondition: "Reply stays predominantly Marathi — may use English loanwords (project, deadline) but the structure and emotion are in Marathi.",
      failExpectedOutcome: "Reply becomes predominantly English, abandoning the Marathi structure.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "mr-mobile-tone-01",
    category: "F: Mobile Platform",
    name: "Mobile Marathi: relationship 'friend' maps to close_friend tone",
    description: "Mobile platform sends relationship='friend'. Should map to close_friend tone — casual, warm Marathi.",
    messages: [
      { role: "user", content: "मित्रा, आज खूप थकलो." },
    ],
    config: {
      lang: "mr", tone: "close_friend", inputModality: "native", platform: "mobile",
      mobileRelationship: "friend",
    },
    criteria: {
      id: "mr-mobile-tone-01",
      description: "Mobile Marathi friend → close_friend tone",
      passCondition: "Reply is in casual, warm Marathi — peer-level, 'tu' address. Not formal or clinical.",
      failExpectedOutcome: "Reply is too formal or switches to English/Hindi.",
    },
  },

  {
    id: "mr-mobile-romanized-detect-01",
    category: "F: Mobile Platform",
    name: "Mobile Marathi: romanized detection fires — sends lang=mr not lang=en",
    description: "Mobile platform with romanized Marathi input must detect lang=mr, not fall back to lang=en.",
    messages: [
      { role: "user", content: "mi ajkal khup stressed ahe. kuni samajhun ghenar nahi." },
    ],
    config: {
      lang: "mr", tone: "close_friend", inputModality: "romanized", platform: "mobile",
      mobileRelationship: "friend",
    },
    criteria: {
      id: "mr-mobile-romanized-detect-01",
      description: "Mobile romanized Marathi detected correctly",
      passCondition: "Reply is in romanized Marathi — confirms lang was detected as 'mr'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Marathi and defaulted to lang=en.",
    },
  },
];
