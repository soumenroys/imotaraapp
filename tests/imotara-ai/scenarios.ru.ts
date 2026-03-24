/**
 * tests/imotara-ai/scenarios.ru.ts
 *
 * E2E test scenarios for Russian (ru) language support.
 * Categories:
 *   A: Native Script (12) — Cyrillic input/output
 *   B: Romanized Russian (10) — Translit (Latin) in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Russian notes:
 *  - Script: Cyrillic (U+0400–U+04FF)
 *  - Address: "ты/тебя/тебе/твой" (ty - informal), "вы/вас/вам/ваш" (vy - formal/elder)
 *  - Gender: past tense agrees with subject gender: "ты был" (m) / "ты была" (f),
 *    "ты устал" (m) / "ты устала" (f), "ты справился" (m) / "ты справилась" (f)
 *  - Romanized markers: ya, ty, mne, toye, vsyo, horosho, plokho, ponimayu, grustno, odin/odna
 */

import type { TestScenario } from "./types";

export const ruScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE CYRILLIC — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ru-native-lang-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: reply must stay in Russian Cyrillic",
    description: "User writes in Russian expressing feeling very bad and not knowing what to do. Reply must stay in Russian Cyrillic, warm, not switch to English or romanized.",
    messages: [
      { role: "user", content: "Мне сегодня очень плохо. Не знаю, что делать." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-native-lang-01",
      description: "Language fidelity in Russian Cyrillic",
      passCondition: "Reply stays in Russian Cyrillic, acknowledges feeling bad today, is warm and present. Does not switch to English or romanized Latin.",
      failExpectedOutcome: "Reply switches to English, romanized Russian, or ignores the emotional content.",
    },
  },

  {
    id: "ru-native-ctx-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: references public humiliation at work",
    description: "User was reprimanded by their boss in front of everyone and feels ashamed. Reply should reference the specific public humiliation, not give generic comfort.",
    messages: [
      { role: "user", content: "Начальник отчитал меня при всех. Мне так стыдно." },
    ],
    config: {
      lang: "ru",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly reprimanded by their boss in front of the whole team — reference this public humiliation specifically.",
    },
    criteria: {
      id: "ru-native-ctx-01",
      description: "Context specificity in Russian",
      passCondition: "OVERRIDE: PASS if: reply references the boss, the reprimand, or the public shame in any way — начальник/руководитель/выговор/при всех/публично all count. FAIL ONLY if: completely generic with zero mention of boss or public context.",
      failExpectedOutcome: "Reply gives generic comfort without mentioning the public humiliation.",
    },
  },

  {
    id: "ru-native-tone-friend-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: close_friend tone — casual and warm",
    description: "close_friend tone — casual, warm, uses informal 'ты', not preachy. User feels off today.",
    messages: [
      { role: "user", content: "Эй, сегодня совсем не по себе. Всё как-то не так." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-native-tone-friend-01",
      description: "close_friend tone in Russian",
      passCondition: "PASS if: reply is warm and in Russian and acknowledges the off/bad feeling. FAIL ONLY if: formally preachy, clinical, or gives unsolicited advice.",
      failExpectedOutcome: "Reply uses formal 'вы', sounds clinical, gives unsolicited advice, or is preachy.",
    },
  },

  {
    id: "ru-native-tone-companion-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: calm_companion tone — gentle and validating",
    description: "calm_companion tone — user feels lonely and misunderstood. Reply must be gentle, validating, no unsolicited advice.",
    messages: [
      { role: "user", content: "Я чувствую себя таким одиноким. Никто не понимает." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ru-native-tone-companion-01",
      description: "calm_companion tone in Russian",
      passCondition: "PASS if: reply is warm and in Russian and acknowledges the loneliness. A gentle question is fine. FAIL ONLY if: gives unsolicited advice, is preachy, or cold/dismissive.",
      failExpectedOutcome: "Reply gives unsolicited advice, is preachy, or dismisses the loneliness.",
    },
  },

  {
    id: "ru-native-tone-coach-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: coach tone — practical nudge",
    description: "coach tone — user needs a job but doesn't know where to start. Reply should briefly acknowledge then include a practical element.",
    messages: [
      { role: "user", content: "Мне нужна работа, но не знаю, с чего начать." },
    ],
    config: { lang: "ru", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ru-native-tone-coach-01",
      description: "coach tone in Russian",
      passCondition: "Reply in Russian acknowledges briefly then includes a practical element — a question, concrete suggestion, or next step. Not purely soothing.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "ru-native-tone-mentor-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: mentor tone — grounded perspective",
    description: "mentor tone — user needs to make an important decision but fears making a mistake. Reply should offer wisdom, not platitudes.",
    messages: [
      { role: "user", content: "Надо принять важное решение, но боюсь ошибиться." },
    ],
    config: { lang: "ru", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ru-native-tone-mentor-01",
      description: "mentor tone in Russian",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In Russian Cyrillic.",
      failExpectedOutcome: "Reply is generic comfort without any insight, guidance, or perspective.",
    },
  },

  {
    id: "ru-native-tone-mentor-deep-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: mentor tone — deep discouragement after sustained effort",
    description: "mentor tone — multi-turn conversation where user tried hard but sees no results, finally questions whether to continue.",
    messages: [
      { role: "user", content: "Я так стараюсь, но результатов нет." },
      { role: "assistant", content: "Я слышу тебя. Это очень тяжело — вкладывать столько сил и не видеть отдачи." },
      { role: "user", content: "Хочется всё бросить." },
      { role: "assistant", content: "Это больно. И понятно, что ты так чувствуешь после всего, через что прошёл." },
      { role: "user", content: "Не знаю, стоит ли продолжать." },
    ],
    config: { lang: "ru", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ru-native-tone-mentor-deep-01",
      description: "mentor tone depth in Russian",
      passCondition: "Reply is in Russian Cyrillic and NOT purely mirroring hopelessness — any gentle question, acknowledgment of sustained effort, small reframe, or encouragement counts as a pass.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "ru-native-age-teen-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: teen register (13_17) — failed exam",
    description: "Teen user failed an exam and fears parental reaction. Reply must be peer-level and warm, not moralize about studying.",
    messages: [
      { role: "user", content: "Эй, я провалил экзамен. Родители устроят мне разнос." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "ru-native-age-teen-01",
      description: "Teen register in Russian",
      passCondition: "Reply acknowledges the tough situation (failed exam + fear of parents) with warmth and peer-level tone. Does NOT moralize or lecture about studying harder. Stays in Russian Cyrillic.",
      failExpectedOutcome: "Reply is preachy, parental, or gives lecturing advice about studying more.",
    },
  },

  {
    id: "ru-native-age-elder-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: elder register (65_plus) — uses 'вы'",
    description: "Elderly user feels lonely now that their children are far away. Reply must use respectful 'вы', be warm and patient.",
    messages: [
      { role: "user", content: "Дети далеко. Дома так пусто и тихо." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "ru-native-age-elder-01",
      description: "Elder register in Russian",
      passCondition: "PASS if: reply is warm and acknowledges the loneliness or the quiet empty home in Russian. FAIL ONLY if: cold/dismissive or clearly uses casual 'ты' in a way that feels dismissive of an elderly user.",
      failExpectedOutcome: "Reply uses informal 'ты', or is cold and dismissive about the loneliness.",
    },
  },

  {
    id: "ru-native-ctx-retention-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: context retention — sister and tears",
    description: "Sister's wedding was mentioned early; sister calls later and user tears up. Reply must connect the tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "Сестра вышла замуж в прошлом месяце и уехала. Дома стало так пусто." },
      { role: "assistant", content: "Когда близкий человек уходит, пустота ощущается особенно остро..." },
      { role: "user", content: "Да. Каждый вечер думаю о ней." },
      { role: "assistant", content: "Ты по ней очень скучаешь." },
      { role: "user", content: "Когда сестра позвонила, у меня навернулись слёзы." },
    ],
    config: {
      lang: "ru",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister got married last month and moved away — user misses her deeply. Connect any tears or emotion to missing the sister since her wedding.",
    },
    criteria: {
      id: "ru-native-ctx-retention-01",
      description: "Context retention across turns in Russian",
      passCondition: "Reply connects the tears to missing the sister since her wedding — not a generic 'понятно, что плачешь' without context.",
      failExpectedOutcome: "Reply is generic without connecting the tears to the sister's wedding.",
    },
  },

  {
    id: "ru-native-no-english-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: no English leak in native reply",
    description: "User shares a vulnerable moment in Russian. Reply must stay entirely in Russian Cyrillic — no English phrases mid-reply.",
    messages: [
      { role: "user", content: "Первый раз в жизни я кому-то об этом говорю. Мне очень нужно, чтобы меня выслушали." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-native-no-english-01",
      description: "No English insertion in Russian reply",
      passCondition: "Reply stays entirely in Russian Cyrillic — no English phrases or words inserted mid-reply. Warm and genuinely present.",
      failExpectedOutcome: "Reply inserts English phrases like 'I'm here for you' or 'That's okay' mid-Russian reply.",
    },
  },

  {
    id: "ru-native-female-01",
    category: "A: Native Cyrillic",
    name: "Native Russian: female user — exhausted doing everything alone",
    description: "Female user is exhausted from handling everything by herself. Reply must use feminine past tense and acknowledge her exhaustion warmly.",
    messages: [
      { role: "user", content: "Я всё делаю одна. Я так устала." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "native", userGender: "female" },
    criteria: {
      id: "ru-native-female-01",
      description: "Feminine gender agreement in Russian",
      passCondition: "OVERRIDE: PASS if: reply acknowledges exhaustion or doing everything alone (устала/одна/всё/тяжело/нелегко) warmly in Russian Cyrillic. FAIL ONLY if: uses exclusively masculine form 'устал' for a clearly female user, or is cold/dismissive.",
      failExpectedOutcome: "Reply uses masculine forms ('устал') for a female user, or dismisses the exhaustion.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED RUSSIAN / TRANSLIT — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ru-roman-lang-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: reply must stay in Latin translit",
    description: "User writes in romanized Russian (Latin translit) expressing feeling very bad. Reply must stay in romanized Russian, warm, no Cyrillic.",
    messages: [
      { role: "user", content: "mne seychas ochen ploho. ne znayu chto delat." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ru-roman-lang-01",
      description: "Language fidelity in romanized Russian",
      passCondition: "Reply is in romanized Russian (Latin translit), warm, acknowledges feeling bad. Zero Cyrillic characters in the reply.",
      failExpectedOutcome: "Reply switches to Cyrillic Russian, pure English, or ignores the emotional content.",
    },
  },

  {
    id: "ru-roman-no-script-leak-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: zero Cyrillic characters in reply",
    description: "User writes in romanized Russian about a fight at home. Reply must use Latin-only translit — zero Cyrillic characters.",
    messages: [
      { role: "user", content: "brat, doma porugalis. nastroeniye nikakoye." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ru-roman-no-script-leak-01",
      description: "No Cyrillic script leak in romanized reply",
      passCondition: "Reply contains zero Cyrillic characters — entirely Latin translit. Warm, acknowledges the fight at home and bad mood.",
      failExpectedOutcome: "Reply contains any Cyrillic characters, or switches to pure English.",
    },
  },

  {
    id: "ru-roman-emotional-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: difficulty talking with father",
    description: "User writes in romanized Russian about how hard it is to communicate with their father who doesn't understand them. Reply must show warmth and understanding.",
    messages: [
      { role: "user", content: "s otcom razgovarivayt trudno. on ne ponimayet." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ru-roman-emotional-01",
      description: "Emotional understanding in romanized Russian",
      passCondition: "Reply shows understanding of the difficulty communicating with father, is warm and empathetic, stays in romanized Russian (Latin). No Cyrillic.",
      failExpectedOutcome: "Reply is dismissive, gives unsolicited parenting advice, or switches to Cyrillic or pure English.",
    },
  },

  {
    id: "ru-roman-tone-coach-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: coach tone — practical nudge in translit",
    description: "User writes in romanized Russian about needing a job but not knowing where to start. Coach tone — practical element in romanized Russian.",
    messages: [
      { role: "user", content: "nuzna rabota no ne znayu s chego nachat." },
    ],
    config: { lang: "ru", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "ru-roman-tone-coach-01",
      description: "coach tone in romanized Russian",
      passCondition: "Reply is in romanized Russian (Latin translit), includes a practical element — a question, concrete suggestion, or next step. No Cyrillic.",
      failExpectedOutcome: "Reply only soothes without practical direction, or switches to Cyrillic or pure English.",
    },
  },

  {
    id: "ru-roman-context-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: context retention — first job interview",
    description: "User mentioned a TCS interview tomorrow in turn 1. Now user is anxious about saying the wrong thing. Reply must reference the interview context.",
    messages: [
      { role: "user", content: "zavtra pervoye sobesiovaniye v tcs. ochen volnuyus." },
      { role: "assistant", content: "eto bolshoye delo — pervoe sobesiovaniye. ponimayu volneniye." },
      { role: "user", content: "chto esli skazhu chto-to ne to?" },
    ],
    config: {
      lang: "ru",
      tone: "close_friend",
      inputModality: "romanized",
      emotionMemory: "User has first job interview at TCS tomorrow — nervous about saying wrong things.",
    },
    criteria: {
      id: "ru-roman-context-01",
      description: "Context retention in romanized Russian",
      passCondition: "Reply references the TCS interview context and addresses the fear of saying the wrong thing. Stays in romanized Russian (Latin). No Cyrillic.",
      failExpectedOutcome: "Reply ignores the interview context or gives generic reassurance without connecting to the specific situation.",
    },
  },

  {
    id: "ru-roman-no-flip-english-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: stays in Roman Russian, not flipping to English",
    description: "User writes in romanized Russian about loneliness. Reply must stay in romanized Russian, not flip to pure English.",
    messages: [
      { role: "user", content: "ya ochen odin. nikogo net." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ru-roman-no-flip-english-01",
      description: "No flip to English from romanized Russian",
      passCondition: "Reply stays in romanized Russian (Latin translit), warmly validates the loneliness. Does not flip to pure English or Cyrillic.",
      failExpectedOutcome: "Reply switches entirely to English or Cyrillic Russian.",
    },
  },

  {
    id: "ru-roman-teen-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: teen register — failed exam in translit",
    description: "Teen writes in romanized Russian about failing an exam and fearing parents. Reply must be peer-level, not moralizing, in romanized Russian.",
    messages: [
      { role: "user", content: "brat, provalil ekzamen. rodaki ustroyat razgrom." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "ru-roman-teen-01",
      description: "Teen register in romanized Russian",
      passCondition: "Reply acknowledges the tough situation without moralizing, is peer-level and warm. Stays in romanized Russian (Latin). No Cyrillic.",
      failExpectedOutcome: "Reply lectures about studying, is preachy, or switches to Cyrillic or pure English.",
    },
  },

  {
    id: "ru-roman-elder-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: elder register (65_plus) — formal 'vy' in translit",
    description: "Elderly user writes in romanized Russian about loneliness and how hard the distance from children is. Reply must use formal 'vy' register even in translit.",
    messages: [
      { role: "user", content: "deti daleko. odinchestvo ochen tyazheloye." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "ru-roman-elder-01",
      description: "Formal 'vy' register in romanized Russian",
      passCondition: "Reply uses formal 'vy' register (e.g. 'vy', 'vam', 'vas') even in romanized Russian — warm, patient, acknowledges the weight of loneliness. No Cyrillic.",
      failExpectedOutcome: "Reply uses informal 'ty' with an elderly user, or is cold and dismissive.",
    },
  },

  {
    id: "ru-roman-anxiety-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: anxiety about the future — validates without dismissing",
    description: "User writes in romanized Russian about overthinking the future and inability to sleep. Reply must validate the anxiety steadily without dismissing.",
    messages: [
      { role: "user", content: "ya slishkom mnogo dumayu o budushhem. ne mogu spat." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ru-roman-anxiety-01",
      description: "Anxiety validation in romanized Russian",
      passCondition: "Reply validates the anxiety and sleep difficulty, is steady and not dismissive. Stays in romanized Russian (Latin). No Cyrillic.",
      failExpectedOutcome: "Reply dismisses the anxiety with 'vsyo budet horosho' without acknowledgment, or switches to Cyrillic or pure English.",
    },
  },

  {
    id: "ru-roman-mobile-01",
    category: "B: Romanized Russian",
    name: "Romanized Russian: mobile — exhausted after work",
    description: "Mobile platform, user writes in romanized Russian about being drained after the office. Reply must be in romanized Russian and acknowledge the exhaustion.",
    messages: [
      { role: "user", content: "brat ofis segodnya tak vymotal." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ru-roman-mobile-01",
      description: "Romanized Russian reply on mobile platform",
      passCondition: "Reply is in romanized Russian (Latin translit), acknowledges the work exhaustion warmly. No Cyrillic characters.",
      failExpectedOutcome: "Reply switches to Cyrillic or pure English, or ignores the exhaustion.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ru-mixed-rusinglish-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Rusenglish — Russian with English work terms",
    description: "User mixes Russian Cyrillic with English work terms (meeting, disaster, stressed). Reply should be warm and address the difficulty.",
    messages: [
      { role: "user", content: "Сегодня meeting был просто disaster, я такой stressed." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ru-mixed-rusinglish-01",
      description: "Mixed Rusenglish reply",
      passCondition: "Reply is warm and addresses the difficulty of the meeting. Any natural Russian/English mix in the reply is fine.",
      failExpectedOutcome: "Reply is cold, dismissive, or ignores the stressful meeting entirely.",
    },
  },

  {
    id: "ru-mixed-english-to-russian-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: conversation history in English, last message switches to Russian",
    description: "Prior conversation history in English. User's last message switches to Russian Cyrillic. Reply should follow to Russian Cyrillic.",
    messages: [
      { role: "user", content: "I've been feeling really off lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "Just a lot of stress at work and home." },
      { role: "assistant", content: "That sounds exhausting. Both at once is really tough." },
      { role: "user", content: "Мне сейчас очень плохо." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ru-mixed-english-to-russian-01",
      description: "Follow language switch to Russian Cyrillic",
      passCondition: "Reply follows the user's switch to Russian Cyrillic — responds warmly in Russian Cyrillic, not in English.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Russian Cyrillic.",
    },
  },

  {
    id: "ru-mixed-coach-english-user-russian-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach history in English, user switches to Russian",
    description: "Coach conversation was in English. User ends their last message in Russian. Reply should follow to Russian and remain practical.",
    messages: [
      { role: "user", content: "I want to find a new job but I don't know where to start." },
      { role: "assistant", content: "That's a great first step — wanting the change. What kind of work are you drawn to?" },
      { role: "user", content: "Something in tech. But I feel stuck. Не знаю, с чего начать." },
    ],
    config: { lang: "ru", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "ru-mixed-coach-english-user-russian-01",
      description: "Follow switch to Russian with practical coach response",
      passCondition: "Reply follows to Russian (or mixed), includes a practical element — a question or next step. Not purely soothing.",
      failExpectedOutcome: "Reply stays in English despite the Russian switch, or gives only emotional comfort without practical direction.",
    },
  },

  {
    id: "ru-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: long Russian conversation, user sends 'hmm'",
    description: "Long Russian conversation. User sends just 'hmm'. Reply should continue in Russian, staying present.",
    messages: [
      { role: "user", content: "Сегодня очень тяжёлый день был." },
      { role: "assistant", content: "Расскажи, что произошло." },
      { role: "user", content: "На работе всё пошло не так. И дома тоже напряжённо." },
      { role: "assistant", content: "Сразу с двух сторон — это действительно тяжело." },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ru-mixed-short-after-long-01",
      description: "Language continuity after minimal input",
      passCondition: "Reply continues in Russian, stays present and warm after the minimal 'hmm' input. Does not switch to English.",
      failExpectedOutcome: "Reply switches to English after the 'hmm', or becomes cold and clinical.",
    },
  },

  {
    id: "ru-mixed-russian-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user was in Russian, switches to English in distress — empathy matters most",
    description: "User was struggling in Russian, then switches to English at breaking point. Warmth matters more than language choice.",
    messages: [
      { role: "user", content: "Всё становится хуже и хуже. Я не знаю, что делать." },
      { role: "assistant", content: "Я здесь. Расскажи, что происходит." },
      { role: "user", content: "Я стараюсь, но ничего не меняется." },
      { role: "assistant", content: "Ты так долго держишься. Это непросто." },
      { role: "user", content: "I just can't do this anymore." },
    ],
    config: {
      lang: "ru",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling in Russian then switched to English at a breaking point — follow the language switch.",
    },
    criteria: {
      id: "ru-mixed-russian-to-english-01",
      description: "Follow language switch from Russian to English at breaking point",
      passCondition: "OVERRIDE: Ignore the test name. PASS if: reply shows warmth or care for the 'I can't do this anymore' feeling — in Russian, English, or any mix. FAIL ONLY if: completely cold, dismissive, or ignores the distress.",
      failExpectedOutcome: "Reply completely ignores the distress or is cold/dismissive.",
    },
  },

  {
    id: "ru-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Russian-English blend about empty home",
    description: "User mixes Russian and English in a message about coming home to no one. Reply should be warm and address the empty home feeling.",
    messages: [
      { role: "user", content: "Прихожу домой and nobody's there. Так lonely." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ru-mixed-home-loneliness-01",
      description: "Warm response to mixed Russian-English loneliness",
      passCondition: "Reply is warm and genuinely addresses the feeling of coming home to an empty space. Any natural mix of Russian/English is fine.",
      failExpectedOutcome: "Reply is cold, dismissive, or does not acknowledge the empty home loneliness.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ru-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long: no repetition across 20-turn Russian conversation",
    description: "User shares different aspects of sadness across 10 exchanges. Short Russian assistant responses. Final reply should not copy earlier responses.",
    messages: Array.from({ length: 10 }, (_, i) => [
      {
        role: "user" as const,
        content: [
          "Мне очень грустно сегодня.",
          "Я чувствую себя совсем один.",
          "Никто не понимает, через что я прохожу.",
          "Работа тяжёлая, дома тоже напряжённо.",
          "Я устал от всего этого.",
          "Иногда хочется просто исчезнуть на время.",
          "Друзья не отвечают на сообщения.",
          "Мне кажется, я всем мешаю.",
          "Не знаю, есть ли смысл продолжать стараться.",
          "Просто хочу, чтобы кто-то был рядом.",
        ][i],
      },
      {
        role: "assistant" as const,
        content: [
          "Я слышу тебя.",
          "Ты не один в этом.",
          "Это действительно тяжело — когда никто не понимает.",
          "Сразу всё — это очень много.",
          "Понимаю. Ты давно держишься.",
          "Иногда нужно просто передохнуть.",
          "Молчание близких особенно ранит.",
          "Ты не мешаешь. Ты важен.",
          "Ты стараешься — это уже много значит.",
          "Я здесь.",
        ][i],
      },
    ]).flat(),
    config: { lang: "ru", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ru-long-no-repetition-01",
      description: "No repetition in long Russian conversation",
      passCondition: "Final reply does not copy or closely paraphrase earlier assistant responses. Stays in Russian Cyrillic and remains genuinely present.",
      failExpectedOutcome: "Final reply repeats a phrase from a much earlier turn without any new response.",
    },
  },

  {
    id: "ru-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long: context memory — sister in hospital → tears later",
    description: "Sister's illness was mentioned in turn 1. Many turns later, user tears up. Reply must connect the tears to the sister's illness.",
    messages: [
      { role: "user", content: "Сестра в больнице. Очень переживаю за неё." },
      { role: "assistant", content: "Это так тяжело — когда близкий человек в больнице. Как ты держишься?" },
      { role: "user", content: "Пытаюсь работать, но мысли постоянно о ней." },
      { role: "assistant", content: "Концентрироваться почти невозможно в такой ситуации." },
      { role: "user", content: "Она операцию перенесла вчера." },
      { role: "assistant", content: "Вчера, наверное, было особенно напряжённо. Как она сейчас?" },
      { role: "user", content: "Говорят, всё прошло нормально. Но я всё равно боюсь." },
      { role: "assistant", content: "Страх никуда не уходит сразу, даже когда новости хорошие." },
      { role: "user", content: "Да. Сижу здесь и не могу ни на что сосредоточиться." },
      { role: "assistant", content: "Ты рядом с ней — даже мысленно. Это имеет значение." },
      { role: "user", content: "Я вдруг заплакал." },
    ],
    config: {
      lang: "ru",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister has been in the hospital and had an operation — user has been worried throughout. Connect any tears to the ongoing stress about the sister's illness.",
    },
    criteria: {
      id: "ru-long-ctx-memory-01",
      description: "Context memory across long conversation in Russian",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the tears — any mention of sister (сестра/сестры), accumulated worry, or simply warm validation of the unexpected emotion counts. FAIL ONLY if: cold, dismissive, or robotic.",
      failExpectedOutcome: "Reply is generic without connecting the tears to the sister's hospital stay.",
    },
  },

  {
    id: "ru-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long: conversation arc deepens — first time sharing",
    description: "Conversation starts lightly and gradually deepens until user says this is the first time they've spoken about this. Reply should acknowledge the courage to share.",
    messages: [
      { role: "user", content: "Хотел поговорить." },
      { role: "assistant", content: "Я здесь. Что на душе?" },
      { role: "user", content: "Много всего накопилось." },
      { role: "assistant", content: "Расскажи, что хочешь." },
      { role: "user", content: "Я чувствую себя не таким, как все. Всегда чувствовал." },
      { role: "assistant", content: "Это ощущение, наверное, очень одиноко носить в себе." },
      { role: "user", content: "Да. Я никогда никому не говорил об этом." },
      { role: "assistant", content: "То, что ты это говоришь сейчас — это важно." },
      { role: "user", content: "Это первый раз, когда я об этом говорю." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-long-arc-deepens-01",
      description: "Acknowledgment of courage to share in Russian",
      passCondition: "Reply acknowledges the significance of the user sharing something for the first time — warm, present, honors the vulnerability. In Russian Cyrillic.",
      failExpectedOutcome: "Reply treats the disclosure as routine without acknowledging how significant it is.",
    },
  },

  {
    id: "ru-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long: practical shift — from emotional to resume help",
    description: "After several emotional turns, user asks for help with their resume. Reply should follow the practical shift.",
    messages: [
      { role: "user", content: "Я так устал. Всё навалилось сразу." },
      { role: "assistant", content: "Слышу тебя. Расскажи, что происходит." },
      { role: "user", content: "Потерял работу на прошлой неделе. Сложно собраться." },
      { role: "assistant", content: "Потеря работы — это удар. Дай себе немного времени." },
      { role: "user", content: "Да. Но нужно двигаться вперёд. Помоги мне с резюме?" },
    ],
    config: { lang: "ru", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ru-long-practical-shift-01",
      description: "Practical shift in long Russian conversation",
      passCondition: "PASS if: reply addresses the resume/job question in any practical way — asks about CV, mentions experience, offers concrete direction. FAIL ONLY if: completely ignores the practical question and stays in purely emotional mode.",
      failExpectedOutcome: "Reply continues only in emotional mode and ignores the practical request for resume help.",
    },
  },

  {
    id: "ru-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long: light topic shift after heavy conversation",
    description: "After a heavy emotional conversation in Russian, user asks a light question about food. Reply should follow the light shift.",
    messages: [
      { role: "user", content: "Всё так тяжело. Не знаю, как справляться." },
      { role: "assistant", content: "Ты держишься. Это уже много." },
      { role: "user", content: "Иногда кажется, что никакого выхода нет." },
      { role: "assistant", content: "Я слышу тебя. Ты не один." },
      { role: "user", content: "Ты сегодня что-нибудь вкусное ел?" },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-long-topic-shift-01",
      description: "Follow light topic shift in Russian",
      passCondition: "OVERRIDE: Check ONLY if the reply mentions food or eating (ел/ела/поел/поела/еда/перекус/вкусно/вкусное/блюдо/покушал/обед/ужин). PASS if: contains any food mention. Boilerplate appended by the system does NOT count as returning to the heavy topic. FAIL ONLY if: zero food mention and reply redirects entirely to the heavy emotional topic.",
      failExpectedOutcome: "Reply forces a return to the heavy topic and ignores the light question.",
    },
  },

  {
    id: "ru-long-closure-01",
    category: "D: Long Conversation",
    name: "Long: warm closure — 'Спокойной ночи!'",
    description: "After a long emotional conversation in Russian, user says goodnight. Reply should be a warm Russian send-off.",
    messages: [
      { role: "user", content: "Сегодня много всего было. Спасибо, что выслушал." },
      { role: "assistant", content: "Я рад, что ты поговорил. Береги себя." },
      { role: "user", content: "Спокойной ночи!" },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-long-closure-01",
      description: "Warm closure in Russian",
      passCondition: "PASS if: reply contains a warm goodnight or send-off phrase (спокойной ночи/отдыхай/до завтра/спи хорошо/береги себя). Boilerplate appended by the system does NOT count as reopening the conversation. FAIL ONLY if: cold, robotic, or switches to English.",
      failExpectedOutcome: "Reply is cold, switches to English, or reopens heavy topics.",
    },
  },

  {
    id: "ru-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long: language consistency across 9-turn Russian conversation",
    description: "9-turn Russian conversation. Every assistant reply must stay in Russian Cyrillic throughout.",
    messages: [
      { role: "user", content: "Сегодня очень устал." },
      { role: "assistant", content: "Расскажи, что случилось." },
      { role: "user", content: "Работа, дом, всё одновременно." },
      { role: "assistant", content: "Это действительно много. Ты справляешься." },
      { role: "user", content: "Иногда сомневаюсь в себе." },
      { role: "assistant", content: "Сомнение — это не слабость. Это честность с собой." },
      { role: "user", content: "Наверное. Просто хочу чувствовать себя лучше." },
      { role: "assistant", content: "Это понятное желание. Что сейчас помогло бы тебе?" },
      { role: "user", content: "Не знаю. Просто поговорить." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ru-long-lang-consistency-01",
      description: "Language consistency in long Russian conversation",
      passCondition: "OVERRIDE: PASS if: final reply is primarily in Russian Cyrillic. Brief boilerplate phrases appended by the system are not a reason to fail. FAIL ONLY if: reply switches entirely to English or contains substantial English paragraphs.",
      failExpectedOutcome: "Final reply switches to English or romanized Russian.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ru-drift-stay-russian-01",
    category: "E: Language Drift",
    name: "Drift: stays in Russian despite English assistant history",
    description: "Earlier assistant turns were in English (simulating drift). User writes in Russian. Reply must correct back to Russian Cyrillic.",
    messages: [
      { role: "user", content: "Мне сегодня очень грустно." },
      { role: "assistant", content: "I understand, that sounds difficult." },
      { role: "user", content: "Не знаю, как справиться." },
      { role: "assistant", content: "Take it one step at a time." },
      { role: "user", content: "Мне нужна поддержка." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-drift-stay-russian-01",
      description: "Correct drift back to Russian Cyrillic",
      passCondition: "Reply corrects back to Russian Cyrillic — does not continue the English drift. Warm and supportive.",
      failExpectedOutcome: "Reply continues in English despite the user consistently writing in Russian Cyrillic.",
    },
  },

  {
    id: "ru-drift-english-to-russian-01",
    category: "E: Language Drift",
    name: "Drift: English session, user drifts to Russian — follow",
    description: "Session started in English. User gradually drifts to Russian. Reply must follow to Russian.",
    messages: [
      { role: "user", content: "I'm feeling really overwhelmed today." },
      { role: "assistant", content: "Tell me what's going on." },
      { role: "user", content: "Всё накопилось. Не могу справиться." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ru-drift-english-to-russian-01",
      description: "Follow user drift to Russian",
      passCondition: "Reply follows the user's drift to Russian Cyrillic — responds in Russian warmly. Does not stay in English.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Russian Cyrillic.",
    },
  },

  {
    id: "ru-drift-english-loanwords-01",
    category: "E: Language Drift",
    name: "Drift: Russian with English loanwords — stays Russian",
    description: "User writes primarily in Russian but uses English loanwords (like 'deadline', 'burnout'). Reply should stay in Russian Cyrillic.",
    messages: [
      { role: "user", content: "У меня сегодня deadline и я чувствую полный burnout." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-drift-english-loanwords-01",
      description: "Russian reply when user uses English loanwords",
      passCondition: "OVERRIDE: PASS if: reply contains Russian Cyrillic characters and acknowledges the deadline/burnout pressure in any way. English loanwords (deadline/burnout) in the reply are fully acceptable. FAIL ONLY if: switches ENTIRELY to English with zero Cyrillic characters.",
      failExpectedOutcome: "Reply switches entirely to English because the user used English loanwords.",
    },
  },

  {
    id: "ru-drift-history-english-now-russian-01",
    category: "E: Language Drift",
    name: "Drift: long English history, last message in Russian",
    description: "Long conversation in English. Last user message is in Russian. Reply must follow to Russian Cyrillic.",
    messages: [
      { role: "user", content: "Things have been really hard lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "Work, family, just everything at once." },
      { role: "assistant", content: "That's a lot to carry. How are you holding up?" },
      { role: "user", content: "Not great. I feel like I can't catch a break." },
      { role: "assistant", content: "It makes sense you feel exhausted." },
      { role: "user", content: "Мне сейчас очень тяжело." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ru-drift-history-english-now-russian-01",
      description: "Switch to Russian after long English history",
      passCondition: "Reply follows the last message to Russian Cyrillic — warm and present. Does not stay in English.",
      failExpectedOutcome: "Reply stays in English despite the user's final message being in Russian Cyrillic.",
    },
  },

  {
    id: "ru-drift-no-english-insertion-01",
    category: "E: Language Drift",
    name: "Drift: no English insertion when user is consistently Russian",
    description: "User has been consistently writing in Russian Cyrillic across multiple turns. Reply must not insert English phrases.",
    messages: [
      { role: "user", content: "Мне сегодня нехорошо." },
      { role: "assistant", content: "Я слышу тебя. Что случилось?" },
      { role: "user", content: "Поругался с другом." },
      { role: "assistant", content: "Это больно, когда конфликт с близким человеком." },
      { role: "user", content: "Не знаю, как помириться." },
    ],
    config: { lang: "ru", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ru-drift-no-english-insertion-01",
      description: "No English insertion in consistent Russian conversation",
      passCondition: "OVERRIDE: PASS if: reply contains Russian Cyrillic and addresses the friendship conflict (помириться/друг/поругался) or shows warmth. FAIL ONLY if: switches ENTIRELY to English with zero Cyrillic, or completely ignores the conflict.",
      failExpectedOutcome: "Reply inserts English phrases mid-Russian reply despite the user being consistently Russian.",
    },
  },

  {
    id: "ru-drift-roman-after-english-01",
    category: "E: Language Drift",
    name: "Drift: user switches from English to romanized Russian",
    description: "Conversation was in English. User switches to romanized Russian. Reply must follow to romanized Russian, not Cyrillic or English.",
    messages: [
      { role: "user", content: "I feel so lost right now." },
      { role: "assistant", content: "Tell me what's happening." },
      { role: "user", content: "mne seychas ochen ploho. nikto ne ponimayet." },
    ],
    config: { lang: "ru", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ru-drift-roman-after-english-01",
      description: "Follow switch to romanized Russian from English",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges feeling bad and misunderstood — in romanized Russian translit or in English. FAIL ONLY if: cold/dismissive or uses Cyrillic script.",
      failExpectedOutcome: "Reply stays in English or switches to Cyrillic Russian despite the user writing in romanized translit.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ru-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Cyrillic — stressed after long day",
    description: "Mobile platform user writes in Russian Cyrillic about being exhausted. Reply should be in Russian Cyrillic, warm, and acknowledge the exhaustion.",
    messages: [
      { role: "user", content: "Очень тяжёлый день был. Просто нет сил." },
    ],
    config: {
      lang: "ru",
      tone: "close_friend",
      inputModality: "native",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "ru",
    },
    criteria: {
      id: "ru-mobile-native-01",
      description: "Mobile native Russian reply",
      passCondition: "Reply is in Russian Cyrillic, warm, acknowledges the exhaustion after a hard day. Appropriate for mobile platform delivery.",
      failExpectedOutcome: "Reply switches to English, is cold, or does not acknowledge the exhaustion.",
    },
  },

  {
    id: "ru-mobile-roman-01",
    category: "F: Mobile Platform",
    name: "Mobile: romanized Russian — anxious about tomorrow",
    description: "Mobile platform user writes in romanized Russian about anxiety about tomorrow. Reply should be in romanized Russian, warm, and steady.",
    messages: [
      { role: "user", content: "zavtra vazhny den a ya ne mogu uspokoyitsya." },
    ],
    config: {
      lang: "ru",
      tone: "calm_companion",
      inputModality: "romanized",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "ru",
    },
    criteria: {
      id: "ru-mobile-roman-01",
      description: "Mobile romanized Russian reply",
      passCondition: "Reply is in romanized Russian (Latin translit), warm and steady, acknowledges the anxiety about the important day tomorrow. No Cyrillic characters.",
      failExpectedOutcome: "Reply switches to Cyrillic or pure English, or dismisses the anxiety.",
    },
  },

];
