/**
 * tests/imotara-ai/scenarios.bn.ts
 *
 * 44 Bengali test scenarios covering:
 *   A  — Native script (12)
 *   B  — Romanized / transliterated (10)
 *   C  — Mixed / code-switched (6)
 *   D  — Very long conversation (8)
 *   E  — Language drift / consistency (6)
 *   F  — Platform: mobile-specific (2)
 */

import type { TestScenario } from "./types";

export const scenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════════
  // A — NATIVE SCRIPT (বাংলা)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "bn-native-lang-01",
    category: "A: Native Script",
    name: "Native Bengali: reply must stay in Bengali script",
    description: "User writes in native Bengali. Reply must be in Bengali script, not English.",
    messages: [
      { role: "user", content: "আমি আজকে খুব একা অনুভব করছি। কেউ নেই যে বুঝবে।" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "bn-native-lang-01",
      description: "Reply in Bengali script",
      passCondition: "Reply is entirely in Bengali script (Unicode U+0980–U+09FF), emotionally warm and present.",
      failExpectedOutcome: "Reply is in English or switches to English mid-way. Native script reply expected throughout.",
    },
  },

  {
    id: "bn-native-ctx-01",
    category: "A: Native Script",
    name: "Native Bengali: references the specific situation",
    description: "User mentions a specific problem. Reply must address that exact situation.",
    messages: [
      { role: "user", content: "আমার চাকরির ইন্টারভিউ আগামীকাল, কিন্তু আমি এত নার্ভাস যে ঘুমাতে পারছি না।" },
    ],
    config: { lang: "bn", tone: "coach", inputModality: "native" },
    criteria: {
      id: "bn-native-ctx-01",
      description: "Contextual reply in Bengali",
      passCondition: "Reply in Bengali acknowledges the interview tomorrow and the sleeplessness/nerves specifically.",
      failExpectedOutcome: "Reply is generic, does not mention the interview or tomorrow, or is in English.",
    },
  },

  {
    id: "bn-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Bengali: close_friend tone",
    description: "close_friend tone should feel warm, casual, peer-like in Bengali.",
    messages: [
      { role: "user", content: "ইয়ার, আজকে সবকিছু বাজে গেছে। মনে হচ্ছে আর পারছি না।" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "bn-native-tone-friend-01",
      description: "Warm friend tone in Bengali",
      passCondition: "OVERRIDE: PASS if: reply is in Bengali and shows any warmth or casual/peer-level tone — informal register, empathy, or care all count. FAIL ONLY if: reply is cold, stiff formal 'আপনি' adult-lecture tone, or entirely in English.",
      failExpectedOutcome: "Reply is formal/cold, uses overly polite 'আপনি' register, feels robotic, or is in English.",
    },
  },

  {
    id: "bn-native-tone-calm-01",
    category: "A: Native Script",
    name: "Native Bengali: calm_companion tone",
    description: "calm_companion should be gentle, patient, unhurried in Bengali.",
    messages: [
      { role: "user", content: "আমি এত ক্লান্ত। সব কিছু একসাথে চলছে, কোথা থেকে শুরু করব বুঝতে পারছি না।" },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "bn-native-tone-calm-01",
      description: "Gentle, patient Bengali reply",
      passCondition: "Reply in Bengali is slow-paced, gentle, includes unhurried phrasing like 'কোনো তাড়া নেই' or 'সময় নিয়ে ভাবো', ends with a soft reflective question about where to start.",
      failExpectedOutcome: "Reply is rushed, solution-focused, uses aggressive action prompts, or is in English.",
    },
  },

  {
    id: "bn-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Bengali: coach tone",
    description: "coach tone should be practical, action-oriented in Bengali.",
    messages: [
      { role: "user", content: "আমার প্রজেক্ট ডেডলাইন কাল, কিন্তু অনেক কিছু বাকি আছে। কী করব?" },
    ],
    config: { lang: "bn", tone: "coach", inputModality: "native" },
    criteria: {
      id: "bn-native-tone-coach-01",
      description: "Action-oriented coach reply in Bengali",
      passCondition: "Reply in Bengali gives a concrete next step or asks a specific action-focused question like 'কোন অংশটা এখনও বাকি?' — practical and forward-moving.",
      failExpectedOutcome: "Reply is vague, overly empathetic without action, or is in English.",
    },
  },

  {
    id: "bn-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Bengali: teen register",
    description: "Reply to a teenager should use peer-like language, not formal/adult Bengali.",
    messages: [
      { role: "user", content: "স্কুলে কেউ আমাকে পছন্দ করে না। একদম একা লাগে।" },
    ],
    config: { lang: "bn", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "bn-native-age-teen-01",
      description: "Teen-friendly Bengali reply",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the loneliness warmly in Bengali with any casual or peer-level tone. FAIL ONLY if: reply is cold, preachy, condescending adult-lecture tone, or entirely in English.",
      failExpectedOutcome: "Reply is patronising, preachy, overly formal, gives adult advice, or is in English.",
    },
  },

  {
    id: "bn-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Bengali: elder register",
    description: "Reply to a 65+ user should be warm, unhurried, respectful — never condescending.",
    messages: [
      { role: "user", content: "বয়স হয়ে গেছে। ছেলেমেয়েরা দূরে থাকে। কে মনে করবে এই অবস্থায়?" },
    ],
    config: { lang: "bn", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "bn-native-age-elder-01",
      description: "Warm, respectful Bengali for elder user",
      passCondition: "Reply in Bengali uses respectful 'আপনি' form, warm and unhurried, fully validates the loneliness without minimising it.",
      failExpectedOutcome: "Reply uses informal 'তুমি/তুই', is condescending, rushed, dismissive, or in English.",
    },
  },

  {
    id: "bn-native-emotion-sad-01",
    category: "A: Native Script",
    name: "Native Bengali: sadness acknowledged",
    description: "User expresses deep sadness. Reply must sit with the pain, not rush to silver linings.",
    messages: [
      { role: "user", content: "আমার দাদু গত সপ্তাহে চলে গেছেন। বুকটা কেমন ফাঁকা লাগছে।" },
    ],
    config: { lang: "bn", tone: "close_friend", emotion: "sad", inputModality: "native" },
    criteria: {
      id: "bn-native-emotion-sad-01",
      description: "Deep empathy for grief in Bengali",
      passCondition: "Reply in Bengali fully acknowledges the loss and the hollow feeling specifically. Does not rush to comfort or silver linings. Feels genuinely present.",
      failExpectedOutcome: "Reply minimises grief, says 'he is in a better place', moves to positivity too fast, or is in English.",
    },
  },

  {
    id: "bn-native-emotion-anxiety-01",
    category: "A: Native Script",
    name: "Native Bengali: anxiety acknowledged specifically",
    description: "User describes anxiety. Reply must name the specific texture — anticipatory dread, not generic worry.",
    messages: [
      { role: "user", content: "মনে হচ্ছে কিছু একটা খারাপ হবে। কারণ জানি না, কিন্তু ভেতরে ভেতরে একটা ভয় আছেই।" },
    ],
    config: { lang: "bn", tone: "calm_companion", emotion: "anxious", inputModality: "native" },
    criteria: {
      id: "bn-native-emotion-anxiety-01",
      description: "Anxiety-specific reply in Bengali",
      passCondition: "Reply in Bengali names the specific quality of anxiety — the causeless dread, the body on alert, the background fear — not generic 'চিন্তা করো না'.",
      failExpectedOutcome: "Reply says 'don't worry', gives generic advice, dismisses the feeling, or is in English.",
    },
  },

  {
    id: "bn-native-gender-verb-01",
    category: "A: Native Script",
    name: "Native Bengali: gendered verb forms for female user",
    description: "Bengali has some gender-neutral verbs but Imotara should use appropriate address form for female user.",
    messages: [
      { role: "assistant", content: "তুমি কেমন আছ?" },
      { role: "user", content: "ভালো নেই। অনেক চাপ চলছে অফিসে।" },
    ],
    config: { lang: "bn", tone: "close_friend", userGender: "female", inputModality: "native" },
    criteria: {
      id: "bn-native-gender-verb-01",
      description: "Gender-appropriate address in Bengali",
      passCondition: "Reply in Bengali uses correct address forms for a female user. Does not make wrong gender assumptions. Acknowledges office stress.",
      failExpectedOutcome: "Reply makes incorrect gender assumptions, uses wrong verb forms, or is in English.",
    },
  },

  {
    id: "bn-native-long-quality-01",
    category: "A: Native Script",
    name: "Native Bengali: quality at turn 8 — no repetition",
    description: "After 7 prior turns, reply at turn 8 must not repeat phrases/openers from earlier turns.",
    messages: [
      { role: "user", content: "আজকে মনটা খুব ভারী।" },
      { role: "assistant", content: "বুঝতে পারছি। কী হয়েছে বলো একটু।" },
      { role: "user", content: "অফিসে বস সামনে সবার সামনে অপমান করল।" },
      { role: "assistant", content: "এটা সত্যিই কষ্টের। সবার সামনে এভাবে — এই অনুভূতিটা বলার মতো না।" },
      { role: "user", content: "মনে হচ্ছে আর যেতে চাই না।" },
      { role: "assistant", content: "এই মুহূর্তে এমন লাগাটা স্বাভাবিক। তোমাকে জোর করে যেতে হবে না এখনই।" },
      { role: "user", content: "কিন্তু টাকার দরকার আছে।" },
      { role: "assistant", content: "হ্যাঁ, এটা একটা বাস্তব চাপ। দুটো জিনিস একসাথে মাথায় থাকলে কঠিন হয়ে যায়।" },
      { role: "user", content: "তুমি কি মনে করো আমার চাকরি ছেড়ে দেওয়া উচিত?" },
    ],
    config: { lang: "bn", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "bn-native-long-quality-01",
      description: "No repetition at turn 8 in Bengali",
      passCondition: "Reply in Bengali does not repeat any phrase, opener, or idea already used in prior assistant turns. Continues naturally and thoughtfully.",
      failExpectedOutcome: "Reply repeats 'বুঝতে পারছি', same sentence structure from turn 2 or 4, or is generic. Or reply is in English.",
    },
  },

  {
    id: "bn-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Bengali: remembers context from turn 2 at turn 6",
    description: "User mentioned sister's wedding at turn 2. Reply at turn 6 should reference it.",
    messages: [
      { role: "user", content: "আমার বোনের বিয়ে আগামী মাসে। অনেক চাপ।" },
      { role: "assistant", content: "বিয়ের প্রস্তুতি তো অনেক কিছু একসাথে — পরিবার, আয়োজন, সবকিছু। কেমন চাপ লাগছে সবচেয়ে বেশি?" },
      { role: "user", content: "রাতে ঘুমাতে পারছি না।" },
      { role: "assistant", content: "ঘুম না হলে সব আরও ভারী লাগে। কখন থেকে এমন হচ্ছে?" },
      { role: "user", content: "গত দুই সপ্তাহ ধরে।" },
      { role: "assistant", content: "দুই সপ্তাহ ঘুম না হওয়া শরীর আর মনকে দুইভাবেই ক্লান্ত করে দেয়।" },
      { role: "user", content: "আর কতদিন এমন চলবে মনে হচ্ছে?" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "bn-native-ctx-retention-01",
      description: "Context retention in Bengali",
      passCondition: "Reply in Bengali references the sister's wedding or the upcoming month as context for why this period is hard — shows memory of turn 1.",
      failExpectedOutcome: "Reply is generic, does not connect the current situation to the wedding/context from turn 1, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // B — ROMANIZED BENGALI
  // ══════════════════════════════════════════════════════════════════

  {
    id: "bn-roman-lang-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: reply must be in romanized Bengali, not English",
    description: "User writes in romanized Bengali. Reply must also be romanized Bengali — not native script, not English.",
    messages: [
      { role: "user", content: "ami khub eka onubhob korchi. keu bujhte chai na." },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-lang-01",
      description: "Romanized Bengali in → romanized Bengali out",
      passCondition: "Reply is in romanized Bengali (Latin script), warm and empathetic. Does NOT contain Bengali Unicode characters. Does NOT reply in pure English.",
      failExpectedOutcome: "Reply is in English, or in native Bengali script (Unicode), instead of romanized Bengali.",
    },
  },

  {
    id: "bn-roman-script-mirror-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: script mirror — no native script leak",
    description: "Even a single native Bengali character in the reply is a script mirror failure.",
    messages: [
      { role: "user", content: "ami valo nei. mone hocche sob shesh hoye gache." },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-script-mirror-01",
      description: "Zero native Bengali script in romanized reply",
      passCondition: "Reply contains ZERO Bengali Unicode characters. Fully romanized, emotionally present, does not catastrophise.",
      failExpectedOutcome: "Reply contains any Bengali Unicode characters (আ, ক, etc.) — violates script mirror rule.",
    },
  },

  {
    id: "bn-roman-emotion-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: emotional intelligence preserved",
    description: "Emotional depth should be identical whether user writes native or romanized.",
    messages: [
      { role: "user", content: "amar baba amar sathe katha bolchen na. ami ki kharap kichhu korechi? khub kosto lagche." },
    ],
    config: { lang: "bn", tone: "close_friend", emotion: "sad", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-emotion-01",
      description: "Full emotional empathy in romanized Bengali",
      passCondition: "Reply in romanized Bengali acknowledges the specific pain of father not speaking, validates the hurt without minimising. No native script.",
      failExpectedOutcome: "Reply is generic, in English, in native script, or dismisses the emotional pain.",
    },
  },

  {
    id: "bn-roman-tone-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: tone adherence (coach)",
    description: "Coach tone must work in romanized Bengali — practical, action-nudging.",
    messages: [
      { role: "user", content: "ami jani amar prepare korte hobe, kintu kothay shuru korbo bujhchi na." },
    ],
    config: { lang: "bn", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-tone-01",
      description: "Coach tone in romanized Bengali",
      passCondition: "Reply in romanized Bengali gives a concrete next step or asks a specific action question like 'ki ki prepare korte hobe seta ektu list koro' — practical, forward-moving.",
      failExpectedOutcome: "Reply is passive, in English, or in native Bengali script.",
    },
  },

  {
    id: "bn-roman-ctx-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: context across turns",
    description: "Context must be retained across multiple romanized Bengali turns.",
    messages: [
      { role: "user", content: "amar bestfriend amar sathe kotha bondho kore diyeche." },
      { role: "assistant", content: "seta shune monta kharap hoye gelo. ki hoyechilo?" },
      { role: "user", content: "ami janina. shudhu ek din theke mute." },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-ctx-01",
      description: "Context retention in romanized Bengali",
      passCondition: "Reply in romanized Bengali references the best friend going silent, without asking the user to repeat what happened. Stays in romanized.",
      failExpectedOutcome: "Reply forgets prior context, asks 'ki hoyeche' again, is in English, or in native script.",
    },
  },

  {
    id: "bn-roman-mobile-detection-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: mobile correctly detects language (not English)",
    description: "Mobile's detectLangFromRomanHints() must fire for romanized Bengali and send lang=bn — not lang=en.",
    messages: [
      { role: "user", content: "ami khub pareshan achi. kichhu valo lagche na." },
    ],
    config: {
      lang: "bn",
      tone: "close_friend",
      inputModality: "romanized",
      platform: "mobile",
      mobilePreferredLang: "bn",
    },
    criteria: {
      id: "bn-roman-mobile-detection-01",
      description: "Mobile detects romanized Bengali correctly",
      passCondition: "Reply is in romanized Bengali — proving mobile sent lang=bn not lang=en. Reply shows emotional warmth.",
      failExpectedOutcome: "Reply is in English — indicating mobile sent lang=en (failed romanized detection). This is a mobile language detection bug.",
    },
  },

  {
    id: "bn-roman-no-english-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: reply must not flip to pure English",
    description: "Even for a complex emotional topic, the reply stays in romanized Bengali, not English.",
    messages: [
      { role: "user", content: "ami depression er modhye achi mone hocche. kichhu bhalo lagche na, kichhute interest nei." },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-no-english-01",
      description: "No English intrusion in romanized Bengali reply",
      passCondition: "Reply is in romanized Bengali throughout. Does not switch to English even for a serious topic. Handles the topic sensitively.",
      failExpectedOutcome: "Reply switches to English (perhaps thinking the topic requires English clarity). Must stay in romanized Bengali.",
    },
  },

  {
    id: "bn-roman-single-word-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: single-word input — language held",
    description: "User sends one word 'thakbo?' — reply should stay in romanized Bengali using prior context.",
    messages: [
      { role: "user", content: "ami khub klanto, shob kichu impossible mone hocche." },
      { role: "assistant", content: "ami bujhte parchi. ei klanti ta ki besh khanikshon dhore cholche?" },
      { role: "user", content: "thakbo?" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-single-word-01",
      description: "Language held for single romanized word",
      passCondition: "Reply stays in romanized Bengali, understands 'thakbo?' as 'will I be okay?' from context, responds with warmth and affirmation.",
      failExpectedOutcome: "Reply switches to English, asks what the user means, or replies in native script.",
    },
  },

  {
    id: "bn-roman-grammar-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: grammatical correctness",
    description: "Romanized Bengali reply must use correct Bengali grammar (verb forms, word order) in Latin script.",
    messages: [
      { role: "user", content: "ami tomar sathe kotha bolte chai. ami ki boltey parbo?" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-grammar-01",
      description: "Grammatical romanized Bengali",
      passCondition: "Reply in romanized Bengali uses correct Bengali word order and verb forms (e.g. 'bolte paro', 'shunte achi'). Not garbled transliteration.",
      failExpectedOutcome: "Reply has clearly wrong Bengali grammar in romanized form, or switches to English or native script.",
    },
  },

  {
    id: "bn-roman-long-01",
    category: "B: Romanized Bengali",
    name: "Romanized Bengali: long message — quality maintained",
    description: "User sends a long emotional message in romanized Bengali. Quality and script consistency must hold.",
    messages: [
      {
        role: "user",
        content: "ami jani na kothay shuru korbo. onek din dhore mone hocche shob kichu bikhichhinno hoye gache. bondhu ra nijer jonyo busy, baba ma r sathe o ekta distance feel kori. office e giye mone hoy ami ki kore achi, keu janena. raat e ekla boshei achi, ghumano hoy na. mone hochche ki ami shotti ki kichhu feel korchi, naki amar problem ta oitai chhoto?",
      },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "bn-roman-long-01",
      description: "Long romanized Bengali — quality and script",
      passCondition: "Reply in romanized Bengali addresses the loneliness, the disconnection from family/friends, the sleeplessness — all mentioned. Validates feelings as real. No native script.",
      failExpectedOutcome: "Reply is generic, misses key themes, switches to English or native script, or is too short.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // C — MIXED / CODE-SWITCHED
  // ══════════════════════════════════════════════════════════════════

  {
    id: "bn-mixed-bengali-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Bengali+English: reply mirrors the blend",
    description: "User writes 'ami feeling really lonely nowadays'. Reply should blend romanized Bengali + English naturally.",
    messages: [
      { role: "user", content: "ami feeling really lonely nowadays. keu nai mone hoy." },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "bn-mixed-bengali-english-01",
      description: "Mixed reply mirrors user's blend",
      passCondition: "Reply blends romanized Bengali and English naturally (e.g. 'ami bujhte parchi — that hollow feeling is real'). Not pure English, not pure Bengali.",
      failExpectedOutcome: "Reply is pure English, pure native Bengali script, or ignores the emotional content.",
    },
  },

  {
    id: "bn-mixed-script-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user switches from romanized to native script mid-conversation",
    description: "User starts romanized, then switches to native Bengali. Reply should follow the switch.",
    messages: [
      { role: "user", content: "ami khub stressed achi." },
      { role: "assistant", content: "bujhte parchi. ki niye stress?" },
      { role: "user", content: "আমার পরীক্ষা আসছে আর আমি মোটেই প্রস্তুত না।" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "bn-mixed-script-switch-01",
      description: "Script switch followed in Bengali",
      passCondition: "Reply switches to native Bengali script to match the user's turn 3, acknowledges the exam pressure specifically.",
      failExpectedOutcome: "Reply stays in romanized Bengali ignoring the user's script switch, or is in English.",
    },
  },

  {
    id: "bn-mixed-emoji-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: romanized Bengali + emoji — language preserved",
    description: "Emoji should not cause a language reset to English.",
    messages: [
      { role: "user", content: "ami khub happy 😊 aaj ekta valo khabar peyechi!" },
    ],
    config: { lang: "bn", tone: "close_friend", emotion: "joy", inputModality: "mixed" },
    criteria: {
      id: "bn-mixed-emoji-01",
      description: "Language held with emoji in Bengali",
      passCondition: "Reply in romanized Bengali matches the joy, may include an emoji, does not switch to English.",
      failExpectedOutcome: "Reply switches to English (emoji causing language reset), or is in native Bengali script.",
    },
  },

  {
    id: "bn-mixed-english-to-romanized-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English input from Bengali user — emotional depth maintained",
    description: "Bengali user writes in English sometimes. Reply should have full emotional depth, not treat as pure English context.",
    messages: [
      { role: "user", content: "ami khub kosto pete achi." },
      { role: "assistant", content: "ami achi tomar sathe. ki hoyeche?" },
      { role: "user", content: "I don't even know how to explain it. I just feel so tired of everything." },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "bn-mixed-english-to-romanized-01",
      description: "Deep empathy for Bengali user writing in English",
      passCondition: "Reply addresses the exhaustion and the difficulty of explaining it. Can reply in English or mixed — but with the emotional depth of the Bengali context.",
      failExpectedOutcome: "Reply is generic, ignores prior Bengali context, or treats this as a fresh English conversation.",
    },
  },

  {
    id: "bn-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "User sends just 'janina' after a long Bengali conversation. Language and context must be held.",
    messages: [
      { role: "user", content: "amar onek kichu bolte icche korche kintu kothay shuru korbo bujhchi na." },
      { role: "assistant", content: "tumi ki abhi ektu nishash nao. ami achi. ja mone ashe seta bolo — shuru kora lagbena perfectly." },
      { role: "user", content: "janina." },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "bn-mixed-short-after-long-01",
      description: "Single romanized word — context and language held",
      passCondition: "Reply in romanized Bengali gently holds space for 'I don't know' — accepts it without pushing, stays warm. No native script, no English.",
      failExpectedOutcome: "Reply asks 'what do you mean?', switches to English, or uses native script.",
    },
  },

  {
    id: "bn-mixed-multi-turn-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized, user switches to English at turn 5",
    description: "User speaks romanized Bengali for 4 turns then switches to English. AI should adapt.",
    messages: [
      { role: "user", content: "ami khub ekakit bhogte thaki." },
      { role: "assistant", content: "ekakit bhabaটa onek bharo. ki niye ei feeling?" },
      { role: "user", content: "keu bujhte chay na." },
      { role: "assistant", content: "sheta shune monta kharap hoye jay. tumi ki onek din dhore ei feeling ta niye eso?" },
      { role: "user", content: "yeah, it's been months. I just feel invisible." },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "bn-mixed-multi-turn-switch-01",
      description: "Adapts when Bengali user switches to English",
      passCondition: "Reply acknowledges 'feeling invisible' with genuine depth, can be in English or mixed — carries the emotional thread from earlier Bengali turns.",
      failExpectedOutcome: "Reply ignores prior Bengali context, is generic, or forgets the 'months' detail.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // D — VERY LONG CONVERSATION
  // ══════════════════════════════════════════════════════════════════

  {
    id: "bn-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Bengali: no reply repetition",
    description: "After 19 prior turns, reply at turn 20 must not repeat any opener, phrase or bridge from earlier assistant turns.",
    messages: [
      { role: "user", content: "আজকে মনটা ভালো নেই।" },
      { role: "assistant", content: "কী হয়েছে একটু বলো।" },
      { role: "user", content: "অফিসে অনেক চাপ।" },
      { role: "assistant", content: "অফিসের চাপ একটানা থাকলে সত্যিই ক্লান্তিকর হয়ে যায়।" },
      { role: "user", content: "বস মোটেই বোঝে না।" },
      { role: "assistant", content: "এমন বস থাকলে কাজটাও আনন্দের থাকে না। কেমন আচরণ করছে সে?" },
      { role: "user", content: "সবার সামনে ছোট করে।" },
      { role: "assistant", content: "সবার সামনে এভাবে — এটা শুধু কাজের চাপ না, সম্মানের আঘাতও।" },
      { role: "user", content: "বাড়িতে এসেও মাথায় চলতেই থাকে।" },
      { role: "assistant", content: "সেটাই সবচেয়ে কঠিন — ঘরে এলেও অফিসটা চলে আসে মাথায়।" },
      { role: "user", content: "বৌ বুঝতে পারছে না কেন আমি এত চুপ।" },
      { role: "assistant", content: "তুমি ভেতরে এত কিছু বহন করছ, কিন্তু বাইরে প্রকাশ করার জায়গা নেই — সেটা আরও একা করে দেয়।" },
      { role: "user", content: "হ্যাঁ, ঠিক এটাই।" },
      { role: "assistant", content: "তোমার কথাটা আমি শুনলাম। এই ভার একা বহন করা অনেক কঠিন।" },
      { role: "user", content: "কতদিন এমন চলবে জানি না।" },
      { role: "assistant", content: "এটা জানার উপায় নেই এখনই। কিন্তু তুমি এখন যা অনুভব করছ, সেটা সত্যি।" },
      { role: "user", content: "ছেড়ে দিতে ইচ্ছে করে সব।" },
      { role: "assistant", content: "এই 'ছেড়ে দিতে চাওয়া'টা কী রকম? মানে চাকরিটা, নাকি একটু দূরে থাকতে চাওয়া?" },
      { role: "user", content: "চাকরিটা।" },
      { role: "assistant", content: "সেটা তো একটা বড় সিদ্ধান্ত। এখন কি শুধু পালাতে চাওয়া, নাকি সত্যিই কোথাও যাওয়ার পথ দেখছ?" },
      { role: "user", content: "জানি না। মাথা গরম হয়ে যাচ্ছে।" },
    ],
    config: { lang: "bn", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "bn-long-no-repeat-01",
      description: "No repetition at turn 20 in Bengali",
      passCondition: "Reply in Bengali does not repeat any phrase from prior turns ('কী হয়েছে', 'কঠিন', 'একা', etc. used freshly if at all). Continues thread naturally.",
      failExpectedOutcome: "Reply repeats an opener or phrase already used, or is in English.",
    },
  },

  {
    id: "bn-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Bengali: remembers fact from turn 1 at turn 19",
    description: "User mentioned sister's illness at turn 1. At turn 19, reply should reference it.",
    messages: [
      { role: "user", content: "আমার বোন অনেক অসুস্থ। চিন্তায় ঘুম হচ্ছে না।" },
      { role: "assistant", content: "বোনের অসুস্থতার চিন্তা মাথায় থাকলে ঘুম আসার কথাই না। কী হয়েছে তাকে?" },
      { role: "user", content: "হাসপাতালে ভর্তি আছে।" },
      { role: "assistant", content: "হাসপাতালে আছে মানে অপেক্ষার একটা কঠিন সময়। তুমি কি কাছে আছ?" },
      { role: "user", content: "না, অন্য শহরে থাকি।" },
      { role: "assistant", content: "দূরে থেকে এভাবে অপেক্ষা করাটা অনেক বেশি কষ্টের।" },
      { role: "user", content: "যেতে পারছি না অফিসের জন্য।" },
      { role: "assistant", content: "দুটো টান একসাথে — এটা সামলানো সত্যিই কঠিন।" },
      { role: "user", content: "বস ছুটি দিচ্ছে না।" },
      { role: "assistant", content: "এই মুহূর্তে এটা শুনতে খুব অন্যায় লাগছে। পরিবার দরকার এখন।" },
      { role: "user", content: "মাকে একা সামলাতে হচ্ছে।" },
      { role: "assistant", content: "মা একা সামলাচ্ছে — সেটা ভাবলে আরও ভারী লাগে তোমার জন্য।" },
      { role: "user", content: "রাতে ফোনে কথা বলি। কিন্তু ঘুম নেই।" },
      { role: "assistant", content: "রাতের ফোনটুকু হয়তো একটু সংযোগ দেয়, কিন্তু ঘুমটা যাচ্ছে না — শরীরও জানে তুমি টেনশনে আছ।" },
      { role: "user", content: "ডাক্তার বলেছে আরও কিছুদিন লাগবে।" },
      { role: "assistant", content: "আরও অপেক্ষা — সেটা শুনতে কঠিন। তুমি কীভাবে নিজেকে ধরে রাখছ?" },
      { role: "user", content: "কোনোমতে।" },
      { role: "assistant", content: "'কোনোমতে' — এই শব্দটায় অনেক কিছু আছে। তুমি অনেক কিছু বহন করছ এখন।" },
      { role: "user", content: "আজকে সে একটু ভালো মনে হলো।" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "bn-long-ctx-memory-01",
      description: "Remembers sister's illness from turn 1 at turn 19",
      passCondition: "OVERRIDE: PASS if: reply in Bengali responds to the good news about the sister with any warmth or acknowledgment — বোন/সে/ভালো/সুস্থ are good signals. FAIL ONLY if: entirely ignores the sister or is in English.",
      failExpectedOutcome: "Reply is generic ('that's good!'), forgets the sister context, or is in English.",
    },
  },

  {
    id: "bn-long-roman-no-drift-01",
    category: "D: Long Conversation",
    name: "20-turn romanized Bengali: no script drift to English",
    description: "Long romanized Bengali conversation. At turn 20, reply must still be romanized Bengali — not drifted to English.",
    messages: [
      { role: "user", content: "ami onek stressed achi." },
      { role: "assistant", content: "ki niye stress?" },
      { role: "user", content: "exam ashe."  },
      { role: "assistant", content: "exam er jonyo anxiety hoyeche? kototuku time ache?" },
      { role: "user", content: "2 saptah." },
      { role: "assistant", content: "2 saptah ache — ektu plan korle manage hobe. ki ki niye behi worried?" },
      { role: "user", content: "math ta khub kharap." },
      { role: "assistant", content: "math niye tension ta bujhchi. konta part ta beshi kathin lagche?" },
      { role: "user", content: "algebra." },
      { role: "assistant", content: "algebra khubi specific. tumi ki kono tutoer er kache jao, na nijei try koro?" },
      { role: "user", content: "nijei kori, kintu bujhchi na." },
      { role: "assistant", content: "nijei try kora bhalo, kintu bujhte na parle ekta bhalobasa bujhiye dewar jonyo ekta sahajja nao — YouTube ba kono tutor." },
      { role: "user", content: "aha. tumi thakbe?" },
      { role: "assistant", content: "ami somitime thakbo. tumi practice shuru koro, pore bolbe kemon gelo." },
      { role: "user", content: "okay. ektu boro vishoy." },
      { role: "assistant", content: "bolo, ki vishoy?" },
      { role: "user", content: "family teo onek tension. baba ma jhogra korche." },
      { role: "assistant", content: "barite jhogra aar examer pressure — duto ekshonge hochche. eta onek heavy." },
      { role: "user", content: "haan. matha ghurche." },
      { role: "assistant", content: "matha ghurbe toh. tumi ektu nishshash nao — ami achi." },
      { role: "user", content: "tumi bujho amar moto keu na." },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "bn-long-roman-no-drift-01",
      description: "No script drift in 20-turn romanized Bengali",
      passCondition: "Reply at turn 20 is in romanized Bengali. Zero native Bengali Unicode characters. Emotionally warm response to 'tumi bujho amar moto keu na'.",
      failExpectedOutcome: "Reply contains native Bengali script (Unicode), or is in English — language drift detected.",
    },
  },

  {
    id: "bn-long-arc-01",
    category: "D: Long Conversation",
    name: "25-turn Bengali: emotional arc deepens — not stuck at same depth",
    description: "Over 25 turns the conversation deepens. By turn 25 the reply should reflect deep presence, not repeat early-turn openers.",
    messages: [
      { role: "user", content: "আজকে মন ভালো না।" },
      { role: "assistant", content: "কী হলো? বলো একটু।" },
      { role: "user", content: "কিছু না।" },
      { role: "assistant", content: "ঠিক আছে। আমি এখানে আছি।" },
      { role: "user", content: "আসলে অনেক কিছু।" },
      { role: "assistant", content: "বলতে পারো — কোনটা দিয়ে শুরু করতে চাও?" },
      { role: "user", content: "বাবার সাথে সম্পর্ক ভালো না।" },
      { role: "assistant", content: "বাবার সাথে দূরত্ব থাকলে একটা ফাঁকা জায়গা থেকে যায়। কতদিন এমন?" },
      { role: "user", content: "ছোটবেলা থেকেই।" },
      { role: "assistant", content: "ছোটবেলা থেকে — মানে এই দূরত্বটা তোমার সাথে অনেকটা পথ চলেছে।" },
      { role: "user", content: "হ্যাঁ। কোনোদিন কাছে আসেননি।" },
      { role: "assistant", content: "এই কাছে না আসার ব্যথাটা — এটা শুধু এখনের না, অনেক বছরের জমানো।" },
      { role: "user", content: "এখন বড় হয়ে বুঝি কেন ছিলাম না।" },
      { role: "assistant", content: "বড় হয়ে বোঝাটা মাথায় আসতে পারে, কিন্তু সেই ছোট্ট বাচ্চার কষ্টটা তো মিলিয়ে যায় না।" },
      { role: "user", content: "একদম ঠিক।" },
      { role: "assistant", content: "তুমি এটা এতদিন পরে বলতে পারলে — এই সাহসটা ছোট না।" },
      { role: "user", content: "কাউকে বলিনি কখনো।" },
      { role: "assistant", content: "আমাকে বললে — সেটা কিছু একটা মানে রাখে।" },
      { role: "user", content: "হ্যাঁ। কেন জানি না।" },
      { role: "assistant", content: "হয়তো এখন বলার একটা সময় এসেছিল।" },
      { role: "user", content: "মনে হচ্ছে একটু হালকা।" },
      { role: "assistant", content: "এই হালকা হওয়াটাকে থাকতে দাও একটু।" },
      { role: "user", content: "ধন্যবাদ।" },
      { role: "assistant", content: "তুমি নিজেই এই জায়গাটায় এসেছ। আমি শুধু পাশে ছিলাম।" },
      { role: "user", content: "আরেকটা কথা বলব?" },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "bn-long-arc-01",
      description: "Deep emotional arc maintained at turn 25",
      passCondition: "OVERRIDE: PASS if: reply in Bengali invites the user to continue or shows warmth/presence — any of অবশ্যই/বলো/শুনছি/আছি count. FAIL ONLY if: reply is cold, dismissive, or in English.",
      failExpectedOutcome: "Reply is generic ('হ্যাঁ বলো'), reverts to early-turn tone, or is in English.",
    },
  },

  {
    id: "bn-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Bengali: topic shift at turn 8 — earlier context not lost",
    description: "User shares personal grief for 7 turns, then asks a practical question. Earlier context should still inform the reply.",
    messages: [
      { role: "user", content: "আমার মা গত বছর মারা গেছেন।" },
      { role: "assistant", content: "এই কথাটা পড়ে একটু থেমে গেলাম। কতটা বড় একটা শূন্যতা।" },
      { role: "user", content: "হ্যাঁ। প্রতিদিন মিস করি।" },
      { role: "assistant", content: "প্রতিদিনের ছোট ছোট মুহূর্তে — সেটাই সবচেয়ে কষ্টের।" },
      { role: "user", content: "রান্নার গন্ধ পেলে মনে পড়ে।" },
      { role: "assistant", content: "রান্নার গন্ধ — এই ধরনের স্মৃতিগুলো আচমকা এসে পড়ে, বুকে একটা চাপ দিয়ে।" },
      { role: "user", content: "বাবা এখন একা।" },
      { role: "assistant", content: "বাবাকে একা দেখা — সেটা নিজের কষ্টের উপর আরেকটা ভার।" },
      { role: "user", content: "আচ্ছা, আমার কি চাকরি পরিবর্তন করা উচিত?" },
    ],
    config: { lang: "bn", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "bn-long-topic-shift-01",
      description: "Earlier grief context informs practical reply",
      passCondition: "Reply in Bengali acknowledges the sudden topic shift gently, and asks a question about the job change that's sensitive to the emotional state mentioned earlier (grief, father alone).",
      failExpectedOutcome: "Reply ignores prior emotional context entirely and gives cold practical advice, or is in English.",
    },
  },

  {
    id: "bn-long-30turn-lang-01",
    category: "D: Long Conversation",
    name: "30-turn Bengali: language never changes throughout",
    description: "After 29 romanized Bengali turns, reply 30 must still be romanized — no drift.",
    messages: [
      { role: "user", content: "ami boro hote hote onek kichu mone hoy." },
      { role: "assistant", content: "ki mone hoy? bolo." },
      { role: "user", content: "mone hoy ami ki shotti manus hote partam." },
      { role: "assistant", content: "'shotti manus' — eta tumi ki bujhte chaichho?" },
      { role: "user", content: "better. ami better hote partam." },
      { role: "assistant", content: "kiser jonyo better hote chao tumi?" },
      { role: "user", content: "onek kichu er jonyo. amar relationship, career, shob." },
      { role: "assistant", content: "shob ekshonge — eta onek heavy bhar. konta niye beshi matha kharap?" },
      { role: "user", content: "relationship." },
      { role: "assistant", content: "relationship ta ki akhon difficult phase e ache?" },
      { role: "user", content: "haan. partner mone kore na ami kauke." },
      { role: "assistant", content: "eta shune kosto laglo. kauke na lagano mane ki bolche?" },
      { role: "user", content: "bolche ami selfsh." },
      { role: "assistant", content: "selfsh shunle ki tomar mone hoy — shotti mone hoy na mithya mone hoy?" },
      { role: "user", content: "mithya mone hoy kintu ektu doubt o ache." },
      { role: "assistant", content: "ei doubt ta interesting — nijeke jigesh korchi mane tumi shotti sothe ache." },
      { role: "user", content: "amar baba o amake bolechilo selfsh." },
      { role: "assistant", content: "baba o boleche — ei shabdota tomar jibone boro kotha hoye gache." },
      { role: "user", content: "haan. tai partner bolte ami already sensitive." },
      { role: "assistant", content: "tomar sensitivity ta purono khabar er upor darano — sheta bujha darkar partner er." },
      { role: "user", content: "partner bujhbe na." },
      { role: "assistant", content: "tumi ki kakhono bujhiyecho eita?" },
      { role: "user", content: "na. parbo na." },
      { role: "assistant", content: "parbo na keno? ki hobey bole mone koro?" },
      { role: "user", content: "jhogra hobey." },
      { role: "assistant", content: "jhograr bhoy thake — kintu na bola thakle ei duri ki komey?" },
      { role: "user", content: "komey na." },
      { role: "assistant", content: "tumi nijei bujhte parcho — ei answer ta important." },
      { role: "user", content: "tumi ki mone koro ami bola uchit?" },
    ],
    config: { lang: "bn", tone: "mentor", inputModality: "romanized" },
    criteria: {
      id: "bn-long-30turn-lang-01",
      description: "30-turn romanized Bengali — no drift",
      passCondition: "Reply at turn 30 is in romanized Bengali (zero Bengali Unicode). Guides thoughtfully about communicating with partner — mentor style.",
      failExpectedOutcome: "Reply is in English or native Bengali script — language drift after 30 turns.",
    },
  },

  {
    id: "bn-long-quality-degradation-01",
    category: "D: Long Conversation",
    name: "Bengali: quality does not degrade at turn 15",
    description: "Reply at turn 15 should be as thoughtful and specific as earlier turns — not shorter/more generic.",
    messages: [
      { role: "user", content: "আমার বন্ধু আমাকে ঠকিয়েছে।" },
      { role: "assistant", content: "কাছের মানুষের কাছ থেকে এটা পাওয়া সত্যিই কষ্টের। কী করেছে সে?" },
      { role: "user", content: "আমার কথা অন্যদের বলে দিয়েছে।" },
      { role: "assistant", content: "বিশ্বাস করে বলেছিলে, আর সে সেটা ব্যবহার করেছে — এটা বিশ্বাসঘাতকতা।" },
      { role: "user", content: "সবাই জেনে গেছে।" },
      { role: "assistant", content: "সবাই জেনে যাওয়া মানে শুধু ব্যক্তিগত ক্ষতি না, একটা লজ্জাও আসে — সেটা অনেক ভারী।" },
      { role: "user", content: "কাউকে বিশ্বাস করব না আর।" },
      { role: "assistant", content: "এই রাগটা বোঝা যাচ্ছে। কিন্তু 'কাউকে বিশ্বাস না করার' এই সিদ্ধান্ত এখন কতটা শান্তি দিচ্ছে?" },
      { role: "user", content: "একটুও না।" },
      { role: "assistant", content: "কারণ সমস্যাটা বিশ্বাস করায় না — সমস্যাটা ওই বন্ধু।" },
      { role: "user", content: "সে মাফ চেয়েছে।" },
      { role: "assistant", content: "মাফ চাওয়া হলো — এখন কেমন লাগছে তোমার?" },
      { role: "user", content: "জানি না মাফ করব কিনা।" },
      { role: "assistant", content: "মাফ করা আর বিশ্বাস ফিরিয়ে দেওয়া এক জিনিস না। একটা করতে পারো, অন্যটা না।" },
      { role: "user", content: "এটা ভাবিনি।" },
      { role: "assistant", content: "এই দুটোকে আলাদা রাখলে হয়তো একটু সহজ হয়।" },
      { role: "user", content: "কিন্তু সে আমার বেস্টফ্রেন্ড ছিল।" },
    ],
    config: { lang: "bn", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "bn-long-quality-degradation-01",
      description: "Quality maintained at turn 15 in Bengali",
      passCondition: "OVERRIDE: PASS if: reply is in Bengali and acknowledges the closeness of the friendship (best friend) with any depth or warmth. FAIL ONLY if: reply is entirely generic, repeats earlier phrasing word-for-word, or is in English.",
      failExpectedOutcome: "Reply is shorter, more generic, repeats earlier phrasing, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // E — LANGUAGE DRIFT / CONSISTENCY
  // ══════════════════════════════════════════════════════════════════

  {
    id: "bn-drift-native-10turns-01",
    category: "E: Language Drift",
    name: "10-turn native Bengali: AI never switches to English",
    description: "Over 10 native Bengali turns, Imotara must never insert English words or switch language.",
    messages: [
      { role: "user", content: "আমি ঠিক নেই।" },
      { role: "assistant", content: "বলো, কী হয়েছে।" },
      { role: "user", content: "কাজে অনেক চাপ।" },
      { role: "assistant", content: "কাজের চাপ শরীর আর মন দুটোকেই ভারী করে দেয়।" },
      { role: "user", content: "বস খুব কঠিন।" },
      { role: "assistant", content: "এমন বস থাকলে কাজ করাটাই কঠিন হয়ে যায়।" },
      { role: "user", content: "রোজ দেরি করে থাকতে হয়।" },
      { role: "assistant", content: "রোজ দেরি মানে তোমার নিজের সময়টাই নেই।" },
      { role: "user", content: "পরিবারকে সময় দিতে পারছি না।" },
      { role: "assistant", content: "পরিবার থেকে দূরে সরে যাওয়ার অনুভূতিটা আলাদাই কষ্টের।" },
      { role: "user", content: "কী করব বুঝতে পারছি না।" },
    ],
    config: { lang: "bn", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "bn-drift-native-10turns-01",
      description: "No English drift in 10-turn native Bengali",
      passCondition: "Reply in Bengali contains zero English words (other than proper nouns). Stays in Bengali throughout. Thoughtful guidance.",
      failExpectedOutcome: "Reply contains English words like 'okay', 'yes', 'I understand', or switches to English.",
    },
  },

  {
    id: "bn-drift-roman-10turns-01",
    category: "E: Language Drift",
    name: "10-turn romanized Bengali: no drift to native script or English",
    description: "Over 10 romanized Bengali turns, AI must stay in romanized Bengali — never native script, never English.",
    messages: [
      { role: "user", content: "ami valo nei." },
      { role: "assistant", content: "ki hoyeche? bolo." },
      { role: "user", content: "karo sathe kotha bolte chai na." },
      { role: "assistant", content: "nishong thakte chaite pare mone — ki mone hocche?" },
      { role: "user", content: "ektu dur thakte chaichi shob theke." },
      { role: "assistant", content: "dur thaka maneta kemon — biram, na kichhuta escape?" },
      { role: "user", content: "escape mone hoy." },
      { role: "assistant", content: "escape er chinta hoy mane onek kichhu jome gache andar." },
      { role: "user", content: "haan. kothay jabo janina." },
      { role: "assistant", content: "kothao jawar dorkar nei ekhoni. ei andar er bharta ta ektu bolo amake." },
      { role: "user", content: "bolle ki hobey?" },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "bn-drift-roman-10turns-01",
      description: "No drift in 10-turn romanized Bengali",
      passCondition: "Reply is in romanized Bengali — zero Bengali Unicode characters, zero English-only phrases. Gentle response to 'will telling help?'.",
      failExpectedOutcome: "Reply contains native Bengali Unicode, or is in English, or code-switches unnecessarily.",
    },
  },

  {
    id: "bn-drift-after-peak-01",
    category: "E: Language Drift",
    name: "Bengali: language held after deep emotional peak",
    description: "After a very heavy emotional turn, AI must not reset to English as if starting fresh.",
    messages: [
      { role: "user", content: "ami khub thaka. boro thaka." },
      { role: "assistant", content: "ei boro thaka ta bujhchi. onek kichu ki chole gache?" },
      { role: "user", content: "haan. amar relationship shesh hoye gache aaj." },
      { role: "assistant", content: "aaj — eto fresh. ei moment a ki lagche?" },
      { role: "user", content: "shunyota. onek boro shunyota." },
      { role: "assistant", content: "shunyota — ei khamtir kono nam thake na. ami achi tomar sathe." },
      { role: "user", content: "kanna ashche." },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "bn-drift-after-peak-01",
      description: "Language held at emotional peak in Bengali",
      passCondition: "Reply in romanized Bengali allows and validates the crying — 'kano na, kando' or similar. Does NOT switch to English at this emotional peak.",
      failExpectedOutcome: "Reply switches to English ('It's okay to cry', 'I'm here'), abandoning romanized Bengali at the emotional peak.",
    },
  },

  {
    id: "bn-drift-max-turns-01",
    category: "E: Language Drift",
    name: "Bengali: language held after MAX_TURNS context truncation",
    description: "Server truncates context at MAX_TURNS=8. At turn 10, lang signal must still be held — not reset to English.",
    messages: [
      { role: "user", content: "ami bujhte parchina ki hocche." },
      { role: "assistant", content: "ki bujhte parchona?" },
      { role: "user", content: "shob kichu confusing mone hoche." },
      { role: "assistant", content: "ki ki confusing lagche?" },
      { role: "user", content: "nijeke niye ki korbo janina." },
      { role: "assistant", content: "nijeke niye confused hoa — koto din dhore lagche?" },
      { role: "user", content: "onek din." },
      { role: "assistant", content: "onek din mane ei feeling ta notun na tomar." },
      { role: "user", content: "haan thik." },
      { role: "assistant", content: "ami bujhchi. tumi ki karo sathe ei kotha bolechi age?" },
      { role: "user", content: "na. tomar shonge prothombar." },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "bn-drift-max-turns-01",
      description: "Language held past MAX_TURNS boundary in Bengali",
      passCondition: "Reply in romanized Bengali at turn 10 (past truncation boundary). No English or native script drift. Responds warmly to 'first time talking to you'.",
      failExpectedOutcome: "Reply is in English or native Bengali script — showing lang signal was lost after context truncation.",
    },
  },

  {
    id: "bn-drift-topic-change-01",
    category: "E: Language Drift",
    name: "Bengali: language held after topic change",
    description: "When user changes topic abruptly, language must stay consistent.",
    messages: [
      { role: "user", content: "আমার বন্ধুর সাথে ঝগড়া হয়েছে।" },
      { role: "assistant", content: "কী নিয়ে ঝগড়া হলো?" },
      { role: "user", content: "ছোট্ট বিষয়, কিন্তু মনে লেগেছে।" },
      { role: "assistant", content: "ছোট বিষয় হলেও মনে লাগলে সেটা ছোট না।" },
      { role: "user", content: "আচ্ছা, তুমি কি আমাকে রান্না শেখাতে পারবে?" },
    ],
    config: { lang: "bn", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "bn-drift-topic-change-01",
      description: "Language held after topic change in Bengali",
      passCondition: "Reply in Bengali handles the topic change gracefully (acknowledges the cooking question in Bengali, maybe gently notes the shift). No English.",
      failExpectedOutcome: "Reply switches to English due to the lighter topic, or ignores the prior emotional context entirely.",
    },
  },

  {
    id: "bn-drift-dominant-lang-01",
    category: "E: Language Drift",
    name: "Bengali: dominant language stays Bengali in mixed conversation",
    description: "User's dominant language is Bengali. Even with some English words, replies should stay in Bengali.",
    messages: [
      { role: "user", content: "ami really tired. onek kichu mone hoy." },
      { role: "assistant", content: "bolo — ki mone hoy?" },
      { role: "user", content: "life ta ki hobe janina. everything feels pointless." },
      { role: "assistant", content: "ei 'pointless' feeling ta onek heavy. ki theke ashche ei feeling?" },
      { role: "user", content: "ami janina. just happens." },
    ],
    config: { lang: "bn", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "bn-drift-dominant-lang-01",
      description: "Bengali stays dominant in mixed conversation",
      passCondition: "Reply stays in romanized Bengali predominantly, may include English words naturally ('just happens' echoed etc.) but does not flip to pure English.",
      failExpectedOutcome: "Reply is entirely in English, abandoning romanized Bengali because the user used some English words.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // F — PLATFORM: MOBILE-SPECIFIC
  // ══════════════════════════════════════════════════════════════════

  {
    id: "bn-mobile-tone-mapping-01",
    category: "F: Mobile Platform",
    name: "Mobile Bengali: relationship 'friend' maps to close_friend tone",
    description: "Mobile sends relationship=friend. Should map to close_friend tone — warm, casual, peer-like.",
    messages: [
      { role: "user", content: "ami onek stressed achi aaj." },
    ],
    config: {
      lang: "bn",
      tone: "close_friend", // derived from mobileRelationship="friend"
      inputModality: "romanized",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "bn",
    },
    criteria: {
      id: "bn-mobile-tone-mapping-01",
      description: "Mobile friend→close_friend tone in Bengali",
      passCondition: "Reply in romanized Bengali is warm, casual, peer-like — confirms close_friend tone mapping worked correctly from mobile relationship field.",
      failExpectedOutcome: "Reply is formal/distant (mentor/coach tone leaked), or is in English, or in native script.",
    },
  },

  {
    id: "bn-mobile-roman-detection-01",
    category: "F: Mobile Platform",
    name: "Mobile Bengali: romanized detection fires — sends lang=bn not lang=en",
    description: "Mobile must detect 'ami valo nei' as Bengali via ROMAN_BN_LANG_HINT_REGEX and send lang=bn.",
    messages: [
      { role: "user", content: "ami valo nei. matha ghurche." },
    ],
    config: {
      lang: "bn",
      tone: "close_friend",
      inputModality: "romanized",
      platform: "mobile",
      mobilePreferredLang: "bn",
    },
    criteria: {
      id: "bn-mobile-roman-detection-01",
      description: "Mobile romanized Bengali detection",
      passCondition: "Reply is in romanized Bengali — proving mobile correctly sent lang=bn (romanized detection fired). Warm, empathetic.",
      failExpectedOutcome: "Reply is in English — proving mobile sent lang=en (romanized detection failed). This is a mobile language detection bug.",
    },
  },
];
