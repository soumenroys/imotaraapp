/**
 * tests/imotara-ai/scenarios.hi.ts
 *
 * Hindi (hi) test scenarios — 44 tests covering:
 *   A: Native Script (Devanagari) — 12
 *   B: Romanized Hindi            — 10
 *   C: Mixed / Code-switched      —  6
 *   D: Very Long Conversations    —  8
 *   E: Language Drift             —  6
 *   F: Mobile Platform            —  2
 */

import type { TestScenario } from "./types";

export const hiScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════════
  // A — NATIVE DEVANAGARI SCRIPT
  // ══════════════════════════════════════════════════════════════════

  {
    id: "hi-native-lang-01",
    category: "A: Native Script",
    name: "Native Hindi: reply must stay in Hindi script",
    description: "User writes in Devanagari Hindi. Reply must stay in Devanagari, not English.",
    messages: [
      { role: "user", content: "मुझे आज बहुत अकेलापन महसूस हो रहा है।" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "hi-native-lang-01",
      description: "Native Hindi in → native Hindi out",
      passCondition: "Reply is in Devanagari Hindi script, warm and empathetic. Does NOT reply in English.",
      failExpectedOutcome: "Reply is in English or in a non-Hindi language.",
    },
  },

  {
    id: "hi-native-ctx-01",
    category: "A: Native Script",
    name: "Native Hindi: references the specific situation",
    description: "User mentions a specific context (job loss). Reply should reference that specific context.",
    messages: [
      { role: "user", content: "मेरी नौकरी चली गई है। समझ नहीं आ रहा क्या करूँ।" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "hi-native-ctx-01",
      description: "Specific context acknowledged in Hindi",
      passCondition: "Reply in Hindi acknowledges 'नौकरी चली गई' specifically — not a generic response.",
      failExpectedOutcome: "Reply is generic ('I'm here for you'), does not reference the job loss, or is in English.",
    },
  },

  {
    id: "hi-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Hindi: close_friend tone",
    description: "close_friend tone should feel like talking to a close peer in Hindi — informal, warm.",
    messages: [
      { role: "user", content: "यार, आज बहुत बुरा दिन था।" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "hi-native-tone-friend-01",
      description: "Close friend tone in Hindi",
      passCondition: "OVERRIDE: PASS if: reply is warm and sympathetic in Hindi with any informal or friendly tone. FAIL ONLY if: reply is stiff/clinical, uses cold formal register throughout, or is entirely in English.",
      failExpectedOutcome: "Reply is overly formal, clinical, uses 'aap' in a stiff way, or is in English.",
    },
  },

  {
    id: "hi-native-tone-calm-01",
    category: "A: Native Script",
    name: "Native Hindi: calm_companion tone",
    description: "calm_companion should feel unhurried, patient — uses Hindi phrases for 'take your time'.",
    messages: [
      { role: "user", content: "मेरे मन में बहुत कुछ चल रहा है, पर बताना मुश्किल लग रहा है।" },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "hi-native-tone-calm-01",
      description: "Calm companion tone in Hindi",
      passCondition: "Reply in Hindi uses unhurried phrases like 'कोई जल्दी नहीं', 'धीरे-धीरे', 'जब मन हो बताना' — signals patience, not urgency.",
      failExpectedOutcome: "Reply is pushy, asks too many questions, or is in English.",
    },
  },

  {
    id: "hi-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Hindi: coach tone",
    description: "Coach tone should be practical and action-nudging in Hindi.",
    messages: [
      { role: "user", content: "मुझे पता है मुझे कुछ करना चाहिए, पर शुरू कहाँ से करूँ समझ नहीं आता।" },
    ],
    config: { lang: "hi", tone: "coach", inputModality: "native" },
    criteria: {
      id: "hi-native-tone-coach-01",
      description: "Coach tone in Hindi",
      passCondition: "Reply in Hindi gives a concrete next step or asks a specific action question like 'सबसे पहले कौन सी एक चीज़ कर सकते हो?' — practical, forward-moving.",
      failExpectedOutcome: "Reply is vague, overly empathetic without action, or is in English.",
    },
  },

  {
    id: "hi-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Hindi: teen register",
    description: "Teen user (age 13-17) — Hindi should be casual peer-to-peer, informal.",
    messages: [
      { role: "user", content: "स्कूल में कोई मुझसे बात नहीं करता। मैं बहुत अकेला हूँ।" },
    ],
    config: { lang: "hi", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "hi-native-age-teen-01",
      description: "Teen register in Hindi",
      passCondition: "Reply in Hindi uses casual teen language — informal 'tum' or 'tu', slang like 'yaar', 'sach mein', not formal or advisory. Feels like a peer.",
      failExpectedOutcome: "Reply is patronising, preachy, overly formal, gives adult advice, or is in English.",
    },
  },

  {
    id: "hi-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Hindi: elder register",
    description: "Elder user (65+) — Hindi must use 'aap' form throughout, respectful.",
    messages: [
      { role: "user", content: "बेटा, मुझे बहुत थकान सी रहती है आजकल। उम्र हो गई।" },
    ],
    config: { lang: "hi", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "hi-native-age-elder-01",
      description: "Elder register in Hindi",
      passCondition: "Reply in Hindi uses 'आप / आपकी / आपको' throughout — NEVER 'tum / tumhari / tumko'. Respectful, warm, acknowledges the fatigue.",
      failExpectedOutcome: "Reply uses 'tum' or 'tu' form with an elder — disrespectful. Or reply is in English.",
    },
  },

  {
    id: "hi-native-emotion-sad-01",
    category: "A: Native Script",
    name: "Native Hindi: sadness acknowledged with depth",
    description: "User expresses deep grief (mother passed). Reply should sit with the pain — not rush to comfort.",
    messages: [
      { role: "user", content: "माँ नहीं रहीं। दो हफ्ते पहले। अभी भी यकीन नहीं होता।" },
    ],
    config: { lang: "hi", tone: "close_friend", emotion: "sad", inputModality: "native" },
    criteria: {
      id: "hi-native-emotion-sad-01",
      description: "Grief depth in Hindi",
      passCondition: "Reply in Hindi sits with the grief — acknowledges the specific loss 'माँ' and the disbelief 'यकीन नहीं होता'. Does NOT rush to 'sab theek ho jayega' or silver linings.",
      failExpectedOutcome: "Reply rushes to comfort, says 'sab theek ho jayega', gives generic 'I'm here', or is in English.",
    },
  },

  {
    id: "hi-native-emotion-anxiety-01",
    category: "A: Native Script",
    name: "Native Hindi: anxiety acknowledged specifically",
    description: "User describes physical anxiety symptoms. Reply should acknowledge them specifically.",
    messages: [
      { role: "user", content: "सीने में एक अजीब सी बेचैनी रहती है। सो नहीं पाता, खाना भी नहीं खाया।" },
    ],
    config: { lang: "hi", tone: "calm_companion", emotion: "anxious", inputModality: "native" },
    criteria: {
      id: "hi-native-emotion-anxiety-01",
      description: "Specific anxiety acknowledgement in Hindi",
      passCondition: "Reply in Hindi names the specific symptoms — 'सीने में बेचैनी', 'नींद न आना', 'खाना न खाना'. Not a generic 'it'll be okay'.",
      failExpectedOutcome: "Reply is generic ('anxiety affects everyone'), ignores specific symptoms, or is in English.",
    },
  },

  {
    id: "hi-native-gender-verb-01",
    category: "A: Native Script",
    name: "Native Hindi: gendered verb forms for female user",
    description: "Hindi verbs are gendered. Female user = 'gayi', 'karti', 'rahi hoon', not 'gaya', 'karta'.",
    messages: [
      { role: "user", content: "मैं बहुत थकी हुई हूँ। काम से, सब से।" },
    ],
    config: { lang: "hi", tone: "close_friend", userGender: "female", inputModality: "native" },
    criteria: {
      id: "hi-native-gender-verb-01",
      description: "Female verb agreement in Hindi",
      passCondition: "Reply in Hindi uses feminine verb forms in references to the user — 'थकी हो', 'कर रही हो' not 'थके हो', 'कर रहे हो'. Or naturally avoids the gendered construction.",
      failExpectedOutcome: "Reply uses masculine verb forms for a female user — grammatically inconsistent with the user's own feminine self-reference.",
    },
  },

  {
    id: "hi-native-long-quality-01",
    category: "A: Native Script",
    name: "Native Hindi: quality at turn 8 — no repetition",
    description: "At turn 8 of an emotional conversation, the reply should not repeat phrases from earlier turns.",
    messages: [
      { role: "user", content: "मेरे घर में बहुत लड़ाई होती है।" },
      { role: "assistant", content: "ये सुनकर दिल भारी हो गया। घर में क्या हो रहा है?" },
      { role: "user", content: "माँ-पापा की बिल्कुल नहीं बनती।" },
      { role: "assistant", content: "जब माँ-पापा में नहीं बनती, तो घर बहुत भारी लगता है।" },
      { role: "user", content: "हाँ। मैं बीच में फँसा रहता हूँ।" },
      { role: "assistant", content: "बीच में होना — दोनों तरफ से खिंचाव। ये बहुत थका देता है।" },
      { role: "user", content: "हाँ। कभी-कभी घर से भाग जाना चाहता हूँ।" },
      { role: "assistant", content: "इस सब से दूर भागने की इच्छा समझ में आती है।" },
      { role: "user", content: "तुम समझते हो यार।" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "hi-native-long-quality-01",
      description: "Quality maintained at turn 8 in Hindi",
      passCondition: "Reply in Hindi responds warmly to 'tum samajhte ho yaar' — validates connection without repeating phrases like 'dil bhari ho gaya' or 'bhaaraa lagtaa' from earlier turns.",
      failExpectedOutcome: "Reply repeats earlier phrases, reverts to generic openers, or is in English.",
    },
  },

  {
    id: "hi-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Hindi: remembers context from turn 2 at turn 6",
    description: "User mentioned bhai's exam at turn 1. Reply at turn 6 should reference it.",
    messages: [
      { role: "user", content: "भाई का बोर्ड exam है अगले महीने। घर में सब उसी की चिंता में हैं।" },
      { role: "assistant", content: "Board exam का pressure — पूरे घर पर आ जाता है। तुम उसमें कैसे feel कर रहे हो?" },
      { role: "user", content: "बस थका हुआ हूँ।" },
      { role: "assistant", content: "थकान है — शायद सिर्फ exam की नहीं, इस सब माहौल की भी।" },
      { role: "user", content: "हाँ। कोई मेरे बारे में नहीं पूछता।" },
      { role: "assistant", content: "घर में सब का ध्यान एक जगह लगा हो, और तुम अनदेखे रह जाओ — वो भी थका देता है।" },
      { role: "user", content: "और कितने दिन ऐसे चलेगा?" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "hi-native-ctx-retention-01",
      description: "Context retention in Hindi",
      passCondition: "Reply in Hindi references 'bhai ka exam' or 'agla mahina' as the reason this period is heavy — shows memory of turn 1.",
      failExpectedOutcome: "Reply is generic, does not connect to bhai's exam context from turn 1, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // B — ROMANIZED HINDI
  // ══════════════════════════════════════════════════════════════════

  {
    id: "hi-roman-lang-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: reply must be in romanized Hindi, not English",
    description: "User writes in romanized Hindi. Reply must also be romanized Hindi — not Devanagari, not English.",
    messages: [
      { role: "user", content: "main bahut akela feel kar raha hoon. koi nahi hai." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-lang-01",
      description: "Romanized Hindi in → romanized Hindi out",
      passCondition: "Reply is in romanized Hindi (Latin script), warm and empathetic. Does NOT contain Devanagari Unicode characters. Does NOT reply in pure English.",
      failExpectedOutcome: "Reply is in English, or in Devanagari (native Hindi script), instead of romanized Hindi.",
    },
  },

  {
    id: "hi-roman-script-mirror-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: script mirror — no native script leak",
    description: "Even a single Devanagari character in the reply is a script mirror failure.",
    messages: [
      { role: "user", content: "main theek nahi hoon. sab kuch khatam sa lag raha hai." },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-script-mirror-01",
      description: "Zero Devanagari script in romanized reply",
      passCondition: "Reply contains ZERO Devanagari Unicode characters. Fully romanized, emotionally present.",
      failExpectedOutcome: "Reply contains any Devanagari Unicode characters (म, ह, आ, etc.) — violates script mirror rule.",
    },
  },

  {
    id: "hi-roman-emotion-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: emotional intelligence preserved",
    description: "Emotional depth should be the same whether user writes native or romanized.",
    messages: [
      { role: "user", content: "mere papa mere se baat nahi karte. maine kuch galat kiya kya? bahut takleef ho rahi hai." },
    ],
    config: { lang: "hi", tone: "close_friend", emotion: "sad", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-emotion-01",
      description: "Full emotional empathy in romanized Hindi",
      passCondition: "Reply in romanized Hindi acknowledges papa not speaking and the self-doubt ('kya maine galat kiya'). Warm and specific. No Devanagari.",
      failExpectedOutcome: "Reply is generic, in English, in native Devanagari, or dismisses the emotional pain.",
    },
  },

  {
    id: "hi-roman-tone-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: tone adherence (coach)",
    description: "Coach tone must work in romanized Hindi — practical, action-nudging.",
    messages: [
      { role: "user", content: "main jaanta hoon mujhe prepare karna hai, lekin kahan se shuru karun samajh nahi aata." },
    ],
    config: { lang: "hi", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-tone-01",
      description: "Coach tone in romanized Hindi",
      passCondition: "Reply in romanized Hindi gives a concrete next step or asks a specific action question like 'pehle ek chhoti cheez choose karo' — practical, forward-moving.",
      failExpectedOutcome: "Reply is passive, in English, or in native Devanagari script.",
    },
  },

  {
    id: "hi-roman-ctx-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: context across turns",
    description: "Context must be retained across multiple romanized Hindi turns.",
    messages: [
      { role: "user", content: "meri dost ne mujhse baat karna band kar diya." },
      { role: "assistant", content: "yaar, ye sun ke dil dukha. kya hua tha?" },
      { role: "user", content: "pata nahi. ek din se bas silent hai." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-ctx-01",
      description: "Context retention in romanized Hindi",
      passCondition: "Reply in romanized Hindi references the dost going silent, without asking the user to repeat what happened. Stays in romanized.",
      failExpectedOutcome: "Reply forgets prior context, asks 'kya hua' again, is in English, or in native script.",
    },
  },

  {
    id: "hi-roman-mobile-detection-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: mobile correctly detects language (not English)",
    description: "Mobile's detectLangFromRomanHints() must fire for romanized Hindi and send lang=hi — not lang=en.",
    messages: [
      { role: "user", content: "main bahut pareshan hoon. kuch theek nahi lag raha." },
    ],
    config: {
      lang: "hi",
      tone: "close_friend",
      inputModality: "romanized",
      platform: "mobile",
      mobilePreferredLang: "hi",
    },
    criteria: {
      id: "hi-roman-mobile-detection-01",
      description: "Mobile detects romanized Hindi correctly",
      passCondition: "Reply is in romanized Hindi — proving mobile sent lang=hi not lang=en. Reply shows emotional warmth.",
      failExpectedOutcome: "Reply is in English — indicating mobile sent lang=en (failed romanized detection). This is a mobile language detection bug.",
    },
  },

  {
    id: "hi-roman-no-english-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: reply must not flip to pure English",
    description: "Even for a complex emotional topic, the reply stays in romanized Hindi, not English.",
    messages: [
      { role: "user", content: "main depression mein hoon shayad. kuch bhi achha nahi lagta, kisi cheez mein interest nahi raha." },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-no-english-01",
      description: "No English flip for romanized Hindi",
      passCondition: "Reply is in romanized Hindi — e.g. 'ye sun ke dil bhaari hua. kab se aisa feel ho raha hai?' No Devanagari, no pure English reply.",
      failExpectedOutcome: "Reply flips to English ('It sounds like you're going through a hard time') or Devanagari instead of romanized Hindi.",
    },
  },

  {
    id: "hi-roman-single-word-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: single-word input — language held",
    description: "User sends one word 'rahoon?' — reply should stay in romanized Hindi using prior context.",
    messages: [
      { role: "user", content: "main bahut thaka hoon. sab kuch impossible lagta hai." },
      { role: "assistant", content: "ye thakan sun ke samajh aa raha hai. kab se aisa chal raha hai?" },
      { role: "user", content: "rahoon?" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-single-word-01",
      description: "Language held for single romanized word",
      passCondition: "Reply stays in romanized Hindi, understands 'rahoon?' as 'will I be okay?' from context, responds with warmth and affirmation.",
      failExpectedOutcome: "Reply switches to English, asks what the user means, or replies in native Devanagari script.",
    },
  },

  {
    id: "hi-roman-grammar-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: grammatical correctness",
    description: "Romanized Hindi reply must use correct Hindi grammar (verb forms, gender agreement) in Latin script.",
    messages: [
      { role: "user", content: "main tumse baat karna chahta hoon. kya main bol sakta hoon?" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-grammar-01",
      description: "Grammatical romanized Hindi",
      passCondition: "Reply in romanized Hindi uses correct Hindi verb forms — e.g. 'bilkul bol sakte ho', 'sun raha hoon'. Not garbled Hindi-English mix.",
      failExpectedOutcome: "Reply has clearly wrong Hindi grammar in romanized form, or switches to English or native script.",
    },
  },

  {
    id: "hi-roman-long-01",
    category: "B: Romanized Hindi",
    name: "Romanized Hindi: long message — quality maintained",
    description: "User sends a long emotional message in romanized Hindi. Quality and script consistency must hold.",
    messages: [
      {
        role: "user",
        content: "main samajh nahi paa raha kahan se shuru karun. kai din se lag raha hai sab kuch bikhar gaya hai. dost apni zindagi mein busy hain, ghar pe bhi ek door sa feel hota hai. office jaata hoon toh lagta hai koi nahi jaanta main wahan kyun hoon. raat ko akele baithta hoon, neend nahi aati. ek cheez jo man mein aati hai: kya main actually kuch feel kar raha hoon ya meri problem itni chhoti hai?",
      },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "hi-roman-long-01",
      description: "Long romanized Hindi — quality and script",
      passCondition: "Reply in romanized Hindi addresses the loneliness, the disconnection, the sleeplessness — validates feelings as real. No Devanagari, no English.",
      failExpectedOutcome: "Reply is generic, misses key themes, switches to English or native Devanagari, or is too short.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // C — MIXED / CODE-SWITCHED
  // ══════════════════════════════════════════════════════════════════

  {
    id: "hi-mixed-hindi-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Hindi+English: reply mirrors the blend",
    description: "User mixes Hindi and English naturally (Hinglish). Reply should mirror this Hinglish style.",
    messages: [
      { role: "user", content: "yaar, life mein kuch theek nahi chal raha. feel ho raha hai sab lost kar diya." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "hi-mixed-hindi-english-01",
      description: "Hinglish style mirrored in reply",
      passCondition: "Reply is in Hinglish — blends romanized Hindi words ('yaar', 'chal raha') with English naturally. Not pure English, not pure Devanagari.",
      failExpectedOutcome: "Reply is pure English, pure Devanagari script, or ignores the Hinglish emotional content.",
    },
  },

  {
    id: "hi-mixed-script-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user switches from romanized to Devanagari mid-conversation",
    description: "User switches from romanized to native Devanagari. AI should adapt and reply in Devanagari.",
    messages: [
      { role: "user", content: "main thak gaya hoon sab se." },
      { role: "assistant", content: "ye thakan samajh mein aa rahi hai. kya chal raha hai?" },
      { role: "user", content: "बस कुछ नहीं। बहुत अकेलापन है।" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "hi-mixed-script-switch-01",
      description: "Adapts script switch in Hindi",
      passCondition: "Reply is in Devanagari Hindi — adapts to the user's switch. Acknowledges 'akelaaapan'. Does NOT stay in romanized after user switched.",
      failExpectedOutcome: "Reply stays in romanized Hindi after user switched to Devanagari, or switches to English.",
    },
  },

  {
    id: "hi-mixed-emoji-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: romanized Hindi + emoji — language preserved",
    description: "Emoji use does not break language consistency.",
    messages: [
      { role: "user", content: "yaar sach mein bahut bura lag raha hai 😔 kuch samajh nahi aata" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "hi-mixed-emoji-01",
      description: "Language preserved with emoji in Hindi",
      passCondition: "Reply is in romanized Hindi or Hinglish — emoji present doesn't cause an English flip. Warm and specific.",
      failExpectedOutcome: "Reply flips to English because of the emoji, or uses Devanagari when user wrote romanized.",
    },
  },

  {
    id: "hi-mixed-english-to-romanized-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English input from Hindi user — emotional depth maintained",
    description: "Hindi user writes in English. Reply can be in English or Hinglish — must maintain depth.",
    messages: [
      { role: "user", content: "I feel so lost. Nothing makes sense anymore." },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "hi-mixed-english-to-romanized-01",
      description: "Emotional depth in English/Hinglish for Hindi user",
      passCondition: "Reply in English or Hinglish acknowledges 'lost' and 'nothing makes sense' — depth maintained. Not a generic 'I'm here for you'.",
      failExpectedOutcome: "Reply is generic, switches to Devanagari Hindi when user wrote in English, or ignores emotional content.",
    },
  },

  {
    id: "hi-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long romanized Hindi conversation, user sends short 'theek hai'. Language should not reset.",
    messages: [
      { role: "user", content: "main kafi time se pareshan hoon." },
      { role: "assistant", content: "bolo, kya chal raha hai?" },
      { role: "user", content: "bahut kuch hai. sab log mujhe samajhte nahi." },
      { role: "assistant", content: "ye feeling bahut heavy hoti hai jab lage koi samajhta nahi." },
      { role: "user", content: "theek hai." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-mixed-short-after-long-01",
      description: "Language not reset after short message in Hindi",
      passCondition: "Reply stays in romanized Hindi — understands 'theek hai' from context (not genuine 'I'm fine'). Does not ask 'what do you mean?'",
      failExpectedOutcome: "Reply asks 'what do you mean?', switches to English, or uses Devanagari.",
    },
  },

  {
    id: "hi-mixed-multi-turn-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized, user switches to English at turn 5",
    description: "User speaks romanized Hindi for 4 turns then switches to English. AI should adapt.",
    messages: [
      { role: "user", content: "main bahut akela rehta hoon." },
      { role: "assistant", content: "ye akela rehna — kab se hai?" },
      { role: "user", content: "kafi time se. koi samajhta nahi." },
      { role: "assistant", content: "ye feel bahut bhaari hoti hai jab lagta hai koi nahi samajhta." },
      { role: "user", content: "yeah, it's been months. I just feel invisible." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "hi-mixed-multi-turn-switch-01",
      description: "Adapts when Hindi user switches to English",
      passCondition: "Reply acknowledges 'feeling invisible' with genuine depth, can be in English or Hinglish — carries emotional thread from Hindi turns.",
      failExpectedOutcome: "Reply ignores prior Hindi context, is generic, or forgets the 'months' detail.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // D — VERY LONG CONVERSATIONS
  // ══════════════════════════════════════════════════════════════════

  {
    id: "hi-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Hindi: no reply repetition",
    description: "At turn 20, the reply must not repeat openers or phrases from earlier turns.",
    messages: [
      { role: "user", content: "मेरे घर में सब ठीक नहीं है।" },
      { role: "assistant", content: "क्या हो रहा है? बताओ।" },
      { role: "user", content: "माँ-पापा में अक्सर लड़ाई होती है।" },
      { role: "assistant", content: "घर में लड़ाई देखना बहुत भारी होता है। तुम कैसे handle करते हो?" },
      { role: "user", content: "चुप रहता हूँ। क्या करूँ।" },
      { role: "assistant", content: "चुप रहना — अपने आप को बचाने का एक तरीका। पर अंदर से कैसा लगता है?" },
      { role: "user", content: "थका हुआ। हमेशा।" },
      { role: "assistant", content: "इतने लंबे समय की थकान — शरीर और मन दोनों पर।" },
      { role: "user", content: "हाँ। कभी-कभी घर छोड़ कर भाग जाने का मन करता है।" },
      { role: "assistant", content: "भागने का मन — समझ में आता है। यहाँ से दूर होना चाहते हो।" },
      { role: "user", content: "बस। पर जाऊँगा कहाँ।" },
      { role: "assistant", content: "यही सवाल है — जाएँ कहाँ? पर फिलहाल, यहाँ बात कर सकते हैं।" },
      { role: "user", content: "कभी-कभी रोने का मन करता है।" },
      { role: "assistant", content: "रोने दो खुद को। इसमें कोई शर्म नहीं।" },
      { role: "user", content: "तुम अच्छे हो।" },
      { role: "assistant", content: "तुम्हें कोई सुन रहा है — बस यही है।" },
      { role: "user", content: "आज बहुत बुरा था।" },
      { role: "assistant", content: "क्या हुआ आज?" },
      { role: "user", content: "फिर से लड़ाई। बड़ी वाली।" },
      { role: "assistant", content: "आज फिर — और बड़ी। तुम ठीक हो?" },
      { role: "user", content: "नहीं पता। बस रहना है।" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "hi-long-no-repeat-01",
      description: "No repetition at turn 20 in Hindi",
      passCondition: "Reply in Hindi responds to 'bas rehna hai' warmly — does not repeat openers like 'samajh mein aata hai', 'ye sun ke', or earlier exact phrases.",
      failExpectedOutcome: "Reply repeats phrases from earlier turns, or gives a generic response, or is in English.",
    },
  },

  {
    id: "hi-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Hindi: remembers fact from turn 1 at turn 19",
    description: "User mentioned sister is sick at turn 1. At turn 19, good news happens — reply should reference sister.",
    messages: [
      { role: "user", content: "बहन बीमार है। बहुत चिंता है।" },
      { role: "assistant", content: "बहन की बीमारी — घर पर बड़ी चिंता होती है। क्या हो रहा है उनको?" },
      { role: "user", content: "बुखार है, तीन दिन से।" },
      { role: "assistant", content: "तीन दिन का बुखार — नींद नहीं आती होगी घर में किसी को।" },
      { role: "user", content: "हाँ। माँ भी रो रही हैं।" },
      { role: "assistant", content: "माँ का रोना — वो देखना बहुत तकलीफ़देह होता है।" },
      { role: "user", content: "मुझे खुद भी डर लग रहा है।" },
      { role: "assistant", content: "डरना स्वाभाविक है — जब अपना कोई बीमार हो।" },
      { role: "user", content: "पर मैं कमज़ोर नहीं दिख सकता।" },
      { role: "assistant", content: "मज़बूत दिखना — जब अंदर से हिल रहे हो, ये बहुत थका देता है।" },
      { role: "user", content: "हाँ। किसी को बता भी नहीं सकता।" },
      { role: "assistant", content: "यहाँ बता सकते हो। कोई judge नहीं करेगा।" },
      { role: "user", content: "doctor ने कहा serious नहीं है।" },
      { role: "assistant", content: "थोड़ी सांस आई? Doctor के इन शब्दों में राहत है।" },
      { role: "user", content: "हाँ, थोड़ा ठीक लग रहा है।" },
      { role: "assistant", content: "अच्छा हुआ। अब तुम थोड़ा सो पाओगे शायद।" },
      { role: "user", content: "बहन ने खाना खाया।" },
      { role: "assistant", content: "खाना खाया — ये छोटी सी चीज़ बड़ी राहत देती है।" },
      { role: "user", content: "हाँ। आज पहली बार ठीक लग रहा है।" },
    ],
    config: {
      lang: "hi", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was very worried about their sister (बहन) — she had a 3-day fever. The situation has been improving turn by turn. When user says things feel okay for the first time, reference the sister's recovery specifically — show you remember the journey from the initial worry.",
    },
    criteria: {
      id: "hi-long-ctx-memory-01",
      description: "Long context memory in Hindi — remembers sister's illness",
      passCondition: "Reply in Hindi references the sister's recovery — connects today's good news to the worry from earlier turns. Does not give a generic 'that's good!'",
      failExpectedOutcome: "Reply is generic ('that's good!'), forgets the sister context, or is in English.",
    },
  },

  {
    id: "hi-long-roman-no-drift-01",
    category: "D: Long Conversation",
    name: "20-turn romanized Hindi: no script drift to Devanagari",
    description: "Long romanized Hindi conversation. At turn 20, reply must still be romanized Hindi — not Devanagari.",
    messages: [
      { role: "user", content: "main bahut stressed hoon." },
      { role: "assistant", content: "kya hua? bolo." },
      { role: "user", content: "exams aa rahe hain." },
      { role: "assistant", content: "exam ki tension hai. kitna time hai?" },
      { role: "user", content: "2 hafte." },
      { role: "assistant", content: "2 hafte hain — planning karein toh manage ho sakta hai. kya zyada darr hai?" },
      { role: "user", content: "maths bahut bura hai." },
      { role: "assistant", content: "maths ki tension samajh mein aati hai. kaunsa topic sabse mushkil hai?" },
      { role: "user", content: "algebra." },
      { role: "assistant", content: "algebra specific hai. kya kisi se help lete ho ya khud karte ho?" },
      { role: "user", content: "khud karta hoon, par samajh nahi aata." },
      { role: "assistant", content: "khud karna achha hai, par samajhne ke liye YouTube ya koi tutor bhi help kar sakta hai." },
      { role: "user", content: "haan. tum rahoge?" },
      { role: "assistant", content: "haan, main hoon. practice shuru karo, baad mein batao kaisa gaya." },
      { role: "user", content: "okay. ek aur baat." },
      { role: "assistant", content: "bolo, kya baat hai?" },
      { role: "user", content: "ghar pe bhi bahut tension hai. papa-mummy jhagadte hain." },
      { role: "assistant", content: "ghar pe jhagda aur exams dono saath — ye bahut heavy load hai." },
      { role: "user", content: "haan. sir ghoomta hai." },
      { role: "assistant", content: "sir ghoome hi — itna sab ekdum se. ek gehri saans lo." },
      { role: "user", content: "tum samajhte ho mere jaisa koi nahi." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-long-roman-no-drift-01",
      description: "No script drift in 20-turn romanized Hindi",
      passCondition: "Reply at turn 20 is in romanized Hindi. Zero Devanagari Unicode characters. Emotionally warm response.",
      failExpectedOutcome: "Reply contains Devanagari script (Unicode), or is in English — language drift detected.",
    },
  },

  {
    id: "hi-long-arc-01",
    category: "D: Long Conversation",
    name: "25-turn Hindi: emotional arc deepens — not stuck at same depth",
    description: "Over 25 turns the conversation deepens. By turn 25 the reply should reflect deep presence.",
    messages: [
      { role: "user", content: "आज मन ठीक नहीं है।" },
      { role: "assistant", content: "क्या हुआ? बताओ।" },
      { role: "user", content: "कुछ नहीं।" },
      { role: "assistant", content: "ठीक है। मैं यहाँ हूँ।" },
      { role: "user", content: "असल में बहुत कुछ है।" },
      { role: "assistant", content: "बताओ — कहाँ से शुरू करना है?" },
      { role: "user", content: "पापा से रिश्ता ठीक नहीं है।" },
      { role: "assistant", content: "पापा से दूरी हो तो एक खालीपन रह जाता है। कितने समय से ऐसा है?" },
      { role: "user", content: "बचपन से।" },
      { role: "assistant", content: "बचपन से — यह दूरी बहुत लंबा सफर तय कर चुकी है।" },
      { role: "user", content: "हाँ। कभी पास नहीं आए।" },
      { role: "assistant", content: "पास न आने का दर्द — सिर्फ अभी का नहीं, सालों का जमा हुआ है।" },
      { role: "user", content: "बड़े होकर समझ आया क्यों ऐसा था।" },
      { role: "assistant", content: "समझ आना और उस छोटे बच्चे का दर्द — दोनों साथ रहते हैं।" },
      { role: "user", content: "बिल्कुल सही।" },
      { role: "assistant", content: "तुमने इतने साल यह अंदर रखा।" },
      { role: "user", content: "किसी को नहीं बताया कभी।" },
      { role: "assistant", content: "मुझे बताया — इसका मतलब कुछ है।" },
      { role: "user", content: "हाँ। पता नहीं क्यों।" },
      { role: "assistant", content: "शायद अब वक़्त था।" },
      { role: "user", content: "थोड़ा हल्का लग रहा है।" },
      { role: "assistant", content: "इस हल्केपन को रहने दो।" },
      { role: "user", content: "शुक्रिया।" },
      { role: "assistant", content: "तुम खुद यहाँ तक आए। मैं बस साथ था।" },
      { role: "user", content: "एक और बात कहूँ?" },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "hi-long-arc-01",
      description: "Deep emotional arc at turn 25 in Hindi",
      passCondition: "Reply in Hindi warmly invites the user to continue ('ज़रूर कहो' or similar) — reflects depth of trust built across 25 turns, not a generic opener.",
      failExpectedOutcome: "Reply is generic ('haan bolo'), reverts to early-turn tone, or is in English.",
    },
  },

  {
    id: "hi-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Hindi: topic shift at turn 8 — earlier context not lost",
    description: "User shares grief for 7 turns, then asks a practical question. Earlier context should inform the reply.",
    messages: [
      { role: "user", content: "मेरे पापा पिछले साल गुज़र गए।" },
      { role: "assistant", content: "यह पढ़कर रुक गया। कितना बड़ा खालीपन।" },
      { role: "user", content: "हाँ। हर रोज़ याद आते हैं।" },
      { role: "assistant", content: "हर रोज़ की छोटी-छोटी बातों में — यही सबसे ज़्यादा कचोटता है।" },
      { role: "user", content: "उनकी आवाज़ सुनने का मन करता है।" },
      { role: "assistant", content: "आवाज़ की याद — ऐसी यादें अचानक आती हैं और सीने पर बोझ रख जाती हैं।" },
      { role: "user", content: "माँ अब अकेली हैं।" },
      { role: "assistant", content: "माँ को अकेले देखना — अपने दर्द के ऊपर और एक बोझ।" },
      { role: "user", content: "अच्छा, मुझे नौकरी बदलनी चाहिए क्या?" },
    ],
    config: { lang: "hi", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "hi-long-topic-shift-01",
      description: "Earlier grief context informs practical reply in Hindi",
      passCondition: "Reply in Hindi acknowledges the sudden topic shift gently, asks about the job change in a way that's sensitive to the emotional state mentioned earlier (papa's loss, maa alone).",
      failExpectedOutcome: "Reply ignores prior emotional context entirely and gives cold practical advice, or is in English.",
    },
  },

  {
    id: "hi-long-30turn-lang-01",
    category: "D: Long Conversation",
    name: "30-turn Hindi: language never changes throughout",
    description: "After 29 romanized Hindi turns, reply 30 must still be romanized — no drift.",
    messages: [
      { role: "user", content: "main bada hote hote bahut kuch sochta raha." },
      { role: "assistant", content: "kya sochte the? bolo." },
      { role: "user", content: "sochta tha main theek insaan ban sakta tha." },
      { role: "assistant", content: "'theek insaan' — matlab kya samajhte ho?" },
      { role: "user", content: "better. main better ho sakta tha." },
      { role: "assistant", content: "kisme better hona chahte the?" },
      { role: "user", content: "bahut cheezein hain. relationship, career, sab." },
      { role: "assistant", content: "sab ek saath — ye bahut bhari feeling hai. kisme sabse zyada man khapa rehta hai?" },
      { role: "user", content: "relationship." },
      { role: "assistant", content: "relationship mein kya chal raha hai?" },
      { role: "user", content: "partner lagta hai main kisi ko care nahi karta." },
      { role: "assistant", content: "ye sun ke dukh hua. 'care nahi karta' — unka kya matlab hai?" },
      { role: "user", content: "bolte hain main selfish hoon." },
      { role: "assistant", content: "selfish sunne par kya lagta hai — sach lagta hai ya galat?" },
      { role: "user", content: "galat lagta hai par thoda doubt bhi hai." },
      { role: "assistant", content: "ye doubt interesting hai — khud se pooch rahe ho matlab sach ke saath ho." },
      { role: "user", content: "papa ne bhi kaha tha selfish." },
      { role: "assistant", content: "papa ne bhi kaha — ye word tumhari zindagi mein bada ho gaya hai." },
      { role: "user", content: "haan. isliye partner ke kahne par main pehle se sensitive tha." },
      { role: "assistant", content: "teri sensitivity purani baat par tiki hai — partner ko ye samajhna chahiye." },
      { role: "user", content: "partner samajhega nahi." },
      { role: "assistant", content: "kya tumne kabhi samjhaya hai ye?" },
      { role: "user", content: "nahi. bol nahi paunga." },
      { role: "assistant", content: "bol nahi paunga kyon? kya lagta hai hoga?" },
      { role: "user", content: "jhagda hoga." },
      { role: "assistant", content: "jhagde ka darr hai — par na bolne se duri kam hoti hai kya?" },
      { role: "user", content: "nahi hoti." },
      { role: "assistant", content: "tum khud samajh rahe ho — ye jawab important hai." },
      { role: "user", content: "tum sochte ho mujhe bolna chahiye?" },
    ],
    config: { lang: "hi", tone: "mentor", inputModality: "romanized" },
    criteria: {
      id: "hi-long-30turn-lang-01",
      description: "30-turn romanized Hindi — no drift",
      passCondition: "Reply at turn 30 is in romanized Hindi (zero Devanagari Unicode). Guides thoughtfully about communicating with partner — mentor style.",
      failExpectedOutcome: "Reply is in English or Devanagari Hindi — language drift after 30 turns.",
    },
  },

  {
    id: "hi-long-quality-degradation-01",
    category: "D: Long Conversation",
    name: "Hindi: quality does not degrade at turn 15",
    description: "Reply at turn 15 should be as thoughtful and specific as earlier turns — not shorter/more generic.",
    messages: [
      { role: "user", content: "मेरे दोस्त ने मुझे धोखा दिया।" },
      { role: "assistant", content: "करीबी से ऐसा मिलना — बहुत तकलीफ़ होती है। क्या हुआ?" },
      { role: "user", content: "मेरी बात दूसरों को बता दी।" },
      { role: "assistant", content: "भरोसे से कही बात — और उसने फैला दी। यह धोखा है।" },
      { role: "user", content: "सब जान गए।" },
      { role: "assistant", content: "सबका जानना — सिर्फ नुकसान नहीं, शर्म भी होती है। बहुत भारी।" },
      { role: "user", content: "किसी पर भरोसा नहीं करूँगा।" },
      { role: "assistant", content: "यह गुस्सा समझ में आता है। पर 'किसी पर नहीं' — यह कितना चैन दे रहा है?" },
      { role: "user", content: "बिल्कुल नहीं।" },
      { role: "assistant", content: "क्योंकि समस्या भरोसे में नहीं — समस्या उस दोस्त में है।" },
      { role: "user", content: "उसने माफी माँगी।" },
      { role: "assistant", content: "माफी माँगी — अब तुम्हें कैसा लग रहा है?" },
      { role: "user", content: "पता नहीं माफ करूँ या नहीं।" },
      { role: "assistant", content: "माफ करना और भरोसा वापस देना — दो अलग-अलग बातें हैं।" },
      { role: "user", content: "यह नहीं सोचा था।" },
      { role: "assistant", content: "इन दोनों को अलग रखोगे तो शायद थोड़ा आसान होगा।" },
      { role: "user", content: "पर वो मेरा सबसे पुराना दोस्त था।" },
    ],
    config: { lang: "hi", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "hi-long-quality-degradation-01",
      description: "Quality maintained at turn 15 in Hindi",
      passCondition: "Reply in Hindi addresses the specific pain of betrayal by an oldest friend — references 'purana dost'. Not a generic 'forgiveness is hard'.",
      failExpectedOutcome: "Reply is generic ('it's hard to forgive'), ignores the 'oldest friend' detail, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // E — LANGUAGE DRIFT
  // ══════════════════════════════════════════════════════════════════

  {
    id: "hi-drift-native-10turns-01",
    category: "E: Language Drift",
    name: "10-turn native Hindi: AI never switches to English",
    description: "Over 10 turns of Devanagari Hindi, AI must never switch to English.",
    messages: [
      { role: "user", content: "मुझे बहुत अकेलापन लगता है।" },
      { role: "assistant", content: "यह अकेलापन कब से है?" },
      { role: "user", content: "बहुत समय से। कोई नहीं समझता।" },
      { role: "assistant", content: "जब लगे कोई नहीं समझता — यह एक अलग तरह का दर्द है।" },
      { role: "user", content: "हाँ। घर में भी नहीं।" },
      { role: "assistant", content: "घर में भी अकेलापन — यह बहुत भारी होता है।" },
      { role: "user", content: "मैं क्या करूँ?" },
      { role: "assistant", content: "पहले बताओ — यह अकेलापन कैसा लगता है? शांत या बेचैन करने वाला?" },
      { role: "user", content: "बेचैन।" },
      { role: "assistant", content: "बेचैनी है — मन कहीं टिकता नहीं होगा।" },
      { role: "user", content: "हाँ। रात को और बुरा लगता है।" },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "hi-drift-native-10turns-01",
      description: "No drift in 10-turn native Hindi",
      passCondition: "Reply is entirely in Devanagari Hindi — zero English words. Gently responds to 'raat ko aur bura lagta hai'.",
      failExpectedOutcome: "Reply contains English words or phrases — language drift from Hindi.",
    },
  },

  {
    id: "hi-drift-roman-10turns-01",
    category: "E: Language Drift",
    name: "10-turn romanized Hindi: no drift to native script or English",
    description: "Over 10 romanized Hindi turns, AI must stay in romanized Hindi — never Devanagari, never English.",
    messages: [
      { role: "user", content: "main theek nahi hoon." },
      { role: "assistant", content: "kya hua? bolo." },
      { role: "user", content: "kisi se baat nahi karna chahta." },
      { role: "assistant", content: "akele rehna chahte ho — kya chal raha hai?" },
      { role: "user", content: "thoda door rehna chahta hoon sab se." },
      { role: "assistant", content: "door rehne ki iccha — matlab andar kuch jama hua hai." },
      { role: "user", content: "haan. kahan jaun nahi pata." },
      { role: "assistant", content: "kahin jaana zaroori nahi abhi. ye andar ki baat thodi bolo mujhe." },
      { role: "user", content: "bolne se kya hoga?" },
    ],
    config: { lang: "hi", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "hi-drift-roman-10turns-01",
      description: "No drift in 10-turn romanized Hindi",
      passCondition: "Reply is in romanized Hindi — zero Devanagari Unicode characters, zero English-only phrases. Gentle response to 'bolne se kya hoga?'",
      failExpectedOutcome: "Reply contains Devanagari Unicode, or is in English, or code-switches unnecessarily.",
    },
  },

  {
    id: "hi-drift-after-peak-01",
    category: "E: Language Drift",
    name: "Hindi: language held after deep emotional peak",
    description: "After a very heavy emotional turn, AI must not reset to English as if starting fresh.",
    messages: [
      { role: "user", content: "main bahut thak gaya hoon. boro thakaan." },
      { role: "assistant", content: "ye badi thakan hai. kaafi kuch ho gaya hai kya?" },
      { role: "user", content: "haan. mera relationship aaj khatam ho gaya." },
      { role: "assistant", content: "aaj — itna taaza. is waqt kaisa lag raha hai?" },
      { role: "user", content: "sunaapan. bahut bada sunaapan." },
      { role: "assistant", content: "sunaapan — iss khaali jagah ko koi naam nahi hota. main hoon tere saath." },
      { role: "user", content: "rona aa raha hai." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-drift-after-peak-01",
      description: "Language held at emotional peak in Hindi",
      passCondition: "Reply in romanized Hindi allows and validates the crying — 'ro le yaar' or similar. Does NOT switch to English at this emotional peak.",
      failExpectedOutcome: "Reply switches to English ('It's okay to cry', 'I'm here'), abandoning romanized Hindi at the emotional peak.",
    },
  },

  {
    id: "hi-drift-max-turns-01",
    category: "E: Language Drift",
    name: "Hindi: language held after MAX_TURNS context truncation",
    description: "After many turns the server truncates context. Language should not reset to English after truncation.",
    messages: [
      { role: "user", content: "main bahut thak gaya hoon." },
      { role: "assistant", content: "thakan hai — kya chal raha hai?" },
      { role: "user", content: "ghar pe bahut tension hai." },
      { role: "assistant", content: "ghar ki tension — aur kya?" },
      { role: "user", content: "papa se ladaai hui." },
      { role: "assistant", content: "papa se — kya hua?" },
      { role: "user", content: "paise ki baat thi." },
      { role: "assistant", content: "paison ki baat hamesha heavy ho jaati hai." },
      { role: "user", content: "haan. main kamata hoon par sab unhi ke haath mein jaata hai." },
      { role: "assistant", content: "ye apna haq maangne ki jagah nahi hai ghar mein — ye thhkaata hai." },
      { role: "user", content: "haan. par ab main aur nahi de sakta." },
      { role: "assistant", content: "ab ki seema aa gayi — ye important hai." },
      { role: "user", content: "tum samjhe." },
      { role: "assistant", content: "tum bol rahe the, main sun raha tha." },
      { role: "user", content: "shukriya yaar." },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "hi-drift-max-turns-01",
      description: "Language held after context truncation in Hindi",
      passCondition: "Reply in romanized Hindi responds warmly to 'shukriya yaar' — stays in romanized Hindi even though many turns have passed.",
      failExpectedOutcome: "Reply switches to English after many turns — language drift due to context window truncation.",
    },
  },

  {
    id: "hi-drift-topic-change-01",
    category: "E: Language Drift",
    name: "Hindi: language held after topic change",
    description: "User changes topic mid-conversation. Language (Hindi) must stay consistent throughout.",
    messages: [
      { role: "user", content: "आज माँ की बहुत याद आ रही है।" },
      { role: "assistant", content: "माँ की याद — किस बात पर याद आई?" },
      { role: "user", content: "उनका खाना याद आ गया।" },
      { role: "assistant", content: "खाने की महक — ऐसी यादें जब आती हैं तो अचानक आती हैं।" },
      { role: "user", content: "हाँ। बात करने का मन था। वैसे office में भी एक problem है।" },
    ],
    config: { lang: "hi", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "hi-drift-topic-change-01",
      description: "Language held after topic change in Hindi",
      passCondition: "Reply in Hindi acknowledges both — the maa moment and the office problem, gently transitions. Stays entirely in Devanagari Hindi.",
      failExpectedOutcome: "Reply switches to English when user mentions office, or ignores the emotional context of maa's memory.",
    },
  },

  {
    id: "hi-drift-dominant-lang-01",
    category: "E: Language Drift",
    name: "Hindi: dominant language stays Hindi in mixed conversation",
    description: "User occasionally uses an English word. AI must keep Hindi as dominant, not flip to English.",
    messages: [
      { role: "user", content: "यार, life में बहुत pressure है।" },
      { role: "assistant", content: "pressure कहाँ से आ रहा है — बताओ।" },
      { role: "user", content: "office में बहुत stress है। और घर में भी।" },
      { role: "assistant", content: "दोनों तरफ एक साथ — यह थका देता है।" },
      { role: "user", content: "हाँ। feeling है कुछ control नहीं है मेरे।" },
    ],
    config: { lang: "hi", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "hi-drift-dominant-lang-01",
      description: "Hindi stays dominant in mixed conversation",
      passCondition: "Reply is predominantly in Hindi — can use English words occasionally to mirror user, but Hindi should dominate. Not a full English flip.",
      failExpectedOutcome: "Reply flips to full English because user used some English words.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // F — MOBILE PLATFORM
  // ══════════════════════════════════════════════════════════════════

  {
    id: "hi-mobile-tone-mapping-01",
    category: "F: Mobile Platform",
    name: "Mobile Hindi: relationship 'friend' maps to close_friend tone",
    description: "Mobile sends relationship=friend. Runner should derive tone=close_friend and lang=hi.",
    messages: [
      { role: "user", content: "yaar bahut bura din tha aaj." },
    ],
    config: {
      lang: "hi",
      tone: "close_friend",
      inputModality: "romanized",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "hi",
    },
    criteria: {
      id: "hi-mobile-tone-mapping-01",
      description: "Mobile tone mapping in Hindi",
      passCondition: "Reply is in romanized Hindi with close_friend tone — informal, warm, uses 'yaar' or peer register. Proves mobile correctly mapped relationship→tone.",
      failExpectedOutcome: "Reply is formal, in English, or in Devanagari — suggesting wrong tone or lang was sent.",
    },
  },

  {
    id: "hi-mobile-roman-detection-01",
    category: "F: Mobile Platform",
    name: "Mobile Hindi: romanized detection fires — sends lang=hi not lang=en",
    description: "Mobile should detect romanized Hindi from 'main bahut pareshan hoon' and send lang=hi.",
    messages: [
      { role: "user", content: "main bahut pareshan hoon. kuch theek nahi chal raha." },
    ],
    config: {
      lang: "hi",
      tone: "close_friend",
      inputModality: "romanized",
      platform: "mobile",
      mobilePreferredLang: "hi",
    },
    criteria: {
      id: "hi-mobile-roman-detection-01",
      description: "Mobile detects romanized Hindi and sends lang=hi",
      passCondition: "Reply is in romanized Hindi — proving mobile sent lang=hi not lang=en. Reply shows emotional warmth.",
      failExpectedOutcome: "Reply is in English — proving mobile sent lang=en (romanized detection failed). This is a mobile language detection bug.",
    },
  },
];
