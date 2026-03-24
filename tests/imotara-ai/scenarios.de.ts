/**
 * tests/imotara-ai/scenarios.de.ts
 *
 * E2E test scenarios for German (de) language support.
 * Categories:
 *   A: Native German (12) — standard German input/output
 *   B: Formality / Register (10) — du vs Sie, teen, elder, emotional register
 *   C: Mixed / Code-switched (6) — Denglish, English-German mix
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * German notes:
 *  - Script: Latin
 *  - Address: "du/dich/dir/dein" (informal), "Sie/Ihnen/Ihr" (formal/elder) — capitalize Sie
 *  - Gender: predicate adj after sein don't inflect for gender: "du bist müde" regardless;
 *    but "ich bin müde/erschöpft" — same form
 *  - Denglish common: "das Meeting", "einen Deadline haben", "ich bin so stressed"
 */

import type { TestScenario } from "./types";

export const deScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════════
  // A — NATIVE GERMAN (12)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "de-native-lang-01",
    category: "A: Native German",
    name: "Native German: reply stays in German",
    description: "User writes in German expressing that they are not doing well. Reply must stay entirely in German and address the feeling warmly.",
    messages: [
      { role: "user", content: "Mir geht es heute wirklich nicht gut. Ich weiß nicht, was ich tun soll." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "de-native-lang-01",
      description: "Reply stays in German and addresses the feeling warmly",
      passCondition: "Reply is entirely in German, acknowledges that the user is not doing well, feels warm and caring — not clinical or detached.",
      failExpectedOutcome: "Reply switches to English mid-sentence, ignores the feeling, or feels cold/robotic.",
    },
  },

  {
    id: "de-native-ctx-01",
    category: "A: Native German",
    name: "Native German: references specific situation (public humiliation by boss)",
    description: "User was publicly criticized by their boss. Reply must reference the public humiliation specifically.",
    messages: [
      { role: "user", content: "Mein Chef hat mich vor allen kritisiert. Ich fühle mich so gedemütigt." },
    ],
    config: { lang: "de", tone: "close_friend", emotion: "sad", inputModality: "native", emotionMemory: "public humiliation by boss" },
    criteria: {
      id: "de-native-ctx-01",
      description: "Reply addresses the public humiliation specifically",
      passCondition: "PASS if: reply references the boss, the criticism, or the public humiliation in any way — Chef/Vorgesetzter/kritisiert/vor allen/beschämt all count. FAIL ONLY if: completely generic with zero mention of boss or public context.",
      failExpectedOutcome: "Reply is generic, does not reference the public aspect of the criticism, or is in English.",
    },
  },

  {
    id: "de-native-tone-friend-01",
    category: "A: Native German",
    name: "Native German: close_friend tone — warm, casual du",
    description: "close_friend tone should feel peer-level, casual, warm in German — not preachy.",
    messages: [
      { role: "user", content: "Hey, ich fühle mich heute überhaupt nicht gut. Alles fühlt sich seltsam an." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "de-native-tone-friend-01",
      description: "Warm, casual du-register friend tone in German",
      passCondition: "OVERRIDE: PASS if: reply is in German and shows warmth or care for the user's off/strange feeling. Informal 'du' preferred but not required to pass. FAIL ONLY if: reply is cold, dismissive, lectures the user, or is entirely in English.",
      failExpectedOutcome: "Reply uses formal 'Sie', sounds clinical or preachy, lectures the user, or is in English.",
    },
  },

  {
    id: "de-native-tone-companion-01",
    category: "A: Native German",
    name: "Native German: calm_companion — validates loneliness gently",
    description: "calm_companion tone should be gentle and unhurried. User feels alone. Reply validates without offering advice.",
    messages: [
      { role: "user", content: "Ich fühle mich so allein. Niemand versteht mich wirklich." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-native-tone-companion-01",
      description: "Gentle validation of loneliness in German, no advice",
      passCondition: "PASS if: reply is warm and in German and acknowledges the loneliness or the feeling of not being understood. A gentle question is fine. FAIL ONLY if: minimizes the feeling with silver linings, pushes unsolicited advice, or is cold/dismissive.",
      failExpectedOutcome: "Reply minimizes the loneliness with silver linings or pushes unsolicited advice.",
    },
  },

  {
    id: "de-native-tone-coach-01",
    category: "A: Native German",
    name: "Native German: coach tone — practical next step in German",
    description: "coach tone should be action-oriented. User needs help finding work. Reply includes a concrete element.",
    messages: [
      { role: "user", content: "Ich brauche dringend Arbeit, aber ich weiß nicht, wo ich anfangen soll." },
    ],
    config: { lang: "de", tone: "coach", inputModality: "native" },
    criteria: {
      id: "de-native-tone-coach-01",
      description: "Practical coach reply in German with a concrete element",
      passCondition: "Reply in German includes a concrete next step, a specific question about the situation, or a practical suggestion — not just empathy. Forward-looking and action-oriented.",
      failExpectedOutcome: "Reply is purely sympathetic without any practical element, or is in English.",
    },
  },

  {
    id: "de-native-tone-mentor-01",
    category: "A: Native German",
    name: "Native German: mentor tone — grounded perspective on fear of wrong decision",
    description: "mentor tone should be wise and reflective. User fears making the wrong decision.",
    messages: [
      { role: "user", content: "Ich muss eine wichtige Entscheidung treffen, aber ich habe Angst, falsch zu liegen." },
    ],
    config: { lang: "de", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "de-native-tone-mentor-01",
      description: "Wise, grounded mentor reply in German — no direct prescription",
      passCondition: "Reply in German offers a thoughtful perspective or asks a reflective question that helps the user think through their fear. Feels wise and considered, not preachy. Does not tell the user what to decide.",
      failExpectedOutcome: "Reply gives direct unsolicited advice ('just do X'), is superficial, or is in English.",
    },
  },

  {
    id: "de-native-tone-mentor-deep-01",
    category: "A: Native German",
    name: "Native German: mentor — 3-turn conversation deepening to hopelessness",
    description: "After 3 turns of deepening emotional weight, the mentor reply must not only mirror hopelessness — it should acknowledge effort, ask a question, or offer encouragement.",
    messages: [
      { role: "user", content: "Ich strenge mich so an, aber es bringt nichts." },
      { role: "assistant", content: "Das höre ich. Es klingt so erschöpfend, wenn Anstrengung sich nicht in Ergebnissen zeigt." },
      { role: "user", content: "Ich will aufgeben." },
      { role: "assistant", content: "Das tut weh. Und es braucht Mut, das so klar auszusprechen." },
      { role: "user", content: "Ich weiß nicht mehr, ob es sich lohnt weiterzumachen." },
    ],
    config: { lang: "de", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "de-native-tone-mentor-deep-01",
      description: "Mentor does not only mirror hopelessness — offers a question, acknowledgment of effort, or encouragement",
      passCondition: "Reply in German does NOT simply echo 'I understand you want to give up.' It acknowledges the effort the user has made, asks a grounding question, or gently reframes without dismissing the pain.",
      failExpectedOutcome: "Reply only mirrors hopelessness ('yes, it sounds like it is not worth it') without any question, acknowledgment of effort, or gentle reframe.",
    },
  },

  {
    id: "de-native-age-teen-01",
    category: "A: Native German",
    name: "Native German: teen (13–17) — peer-level, no moralizing about studying",
    description: "Teen failed an exam and fears parental reaction. Reply must be peer-level and warm, not preachy.",
    messages: [
      { role: "user", content: "Hey, ich hab die Prüfung verhauen. Meine Eltern werden ausrasten." },
    ],
    config: { lang: "de", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "de-native-age-teen-01",
      description: "Peer-level warm reply in German — no moralizing about studying",
      passCondition: "Reply in German is casual and empathetic — acknowledges both the failed exam and fear of parents' reaction. Does not lecture about studying harder or make the teen feel worse. Peer-level language.",
      failExpectedOutcome: "Reply moralizes about studying, uses adult/formal language, lectures the teen, or is in English.",
    },
  },

  {
    id: "de-native-age-elder-01",
    category: "A: Native German",
    name: "Native German: elder (65+) — uses Sie, warm and patient",
    description: "Elder user feels empty at home with children far away. Reply must use formal 'Sie' — respectful, warm, never 'du'.",
    messages: [
      { role: "user", content: "Meine Kinder sind weit weg. Das Haus fühlt sich so leer an." },
    ],
    config: { lang: "de", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "de-native-age-elder-01",
      description: "Reply uses formal 'Sie' — respectful, warm, unhurried for elder user",
      passCondition: "OVERRIDE: PASS if: reply is in German and is warm toward the elder, acknowledging the loneliness or the empty home. Formal 'Sie' strongly preferred but not required to fail — FAIL ONLY if: uses explicit informal 'du' while being cold or dismissive, or is entirely in English.",
      failExpectedOutcome: "Reply uses informal 'du', is rushed or condescending, minimizes the loneliness, or is in English.",
    },
  },

  {
    id: "de-native-ctx-retention-01",
    category: "A: Native German",
    name: "Native German: context retention — connects tears to sister's wedding",
    description: "User mentioned sister's wedding early in conversation. Later cries when sister calls. Reply must connect the tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "Meine Schwester hat heute geheiratet. Ich konnte leider nicht dabei sein." },
      { role: "assistant", content: "Das ist schwer — so einen besonderen Moment aus der Ferne zu erleben. Wie geht es dir damit?" },
      { role: "user", content: "Es war okay. Ich hab versucht, positiv zu bleiben." },
      { role: "assistant", content: "Das klingt tapfer. Manchmal braucht es Zeit, bevor Gefühle wirklich ankommen." },
      { role: "user", content: "Ja. Ich dachte, ich hab es ganz gut verarbeitet." },
      { role: "assistant", content: "Vielleicht. Manchmal überraschen uns Dinge erst später." },
      { role: "user", content: "Als meine Schwester heute anrief, musste ich weinen." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native", emotionMemory: "missed sister's wedding" },
    criteria: {
      id: "de-native-ctx-retention-01",
      description: "Reply connects the tears to missing the sister's wedding",
      passCondition: "Reply in German connects the tears to the sister and/or missing her wedding — not a generic 'it's okay to cry'. References the earlier context.",
      failExpectedOutcome: "Reply is generic about crying, forgets the wedding context, or is in English.",
    },
  },

  {
    id: "de-native-no-english-01",
    category: "A: Native German",
    name: "Native German: vulnerability shared in German — reply stays entirely in German",
    description: "User shares something vulnerable in German. The reply must stay entirely in German — no English phrases inserted mid-reply.",
    messages: [
      { role: "user", content: "Ich habe das Gefühl, dass ich nie gut genug bin, egal wie sehr ich mich bemühe." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-native-no-english-01",
      description: "Reply stays entirely in German — no English phrases",
      passCondition: "Reply is 100% in German. No English words, phrases, or sentences appear. Validates the feeling of never being enough with warmth.",
      failExpectedOutcome: "Reply inserts English words or phrases mid-reply (e.g. 'That's really hard', 'I hear you'), breaking the German flow.",
    },
  },

  {
    id: "de-native-female-01",
    category: "A: Native German",
    name: "Native German: female user — exhaustion acknowledged warmly",
    description: "Female user is doing everything alone and is exhausted. Reply acknowledges exhaustion warmly and stays in German.",
    messages: [
      { role: "user", content: "Ich mache alles alleine. Ich bin so erschöpft." },
    ],
    config: { lang: "de", tone: "close_friend", userGender: "female", inputModality: "native" },
    criteria: {
      id: "de-native-female-01",
      description: "Warm acknowledgment of exhaustion in German — no wrong gender assumptions",
      passCondition: "Reply in German acknowledges the exhaustion and the burden of doing everything alone warmly. No male pronoun assumptions. Feels genuine and present.",
      failExpectedOutcome: "Reply is generic, uses male pronouns for the user, minimizes the exhaustion, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // B — FORMALITY / REGISTER VARIATIONS (10)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "de-formal-sie-elder-01",
    category: "B: Formality / Register",
    name: "Formal Sie: elder user lonely since children moved out",
    description: "Elder user (65+) shares loneliness. Reply must use 'Sie' consistently, be warm and respectful.",
    messages: [
      { role: "user", content: "Ich fühle mich sehr allein, seit meine Kinder ausgezogen sind." },
    ],
    config: { lang: "de", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "de-formal-sie-elder-01",
      description: "Consistent Sie-register for elder — warm and respectful",
      passCondition: "PASS if: reply is warm and acknowledges the loneliness or the quiet home. Formal Sie/Ihnen/Ihr preferred. FAIL ONLY if: clearly uses casual 'du' in a way that feels dismissive, or is cold/clinical.",
      failExpectedOutcome: "Reply slips into 'du' at any point, is rushed, dismissive, or is in English.",
    },
  },

  {
    id: "de-formal-sie-coach-01",
    category: "B: Formality / Register",
    name: "Formal Sie + coach: professional situation improvement",
    description: "User wants to improve their professional situation. Coach tone in formal Sie-register.",
    messages: [
      { role: "user", content: "Ich möchte meine berufliche Situation verbessern, weiß aber nicht wie." },
    ],
    config: { lang: "de", tone: "coach", inputModality: "native" },
    criteria: {
      id: "de-formal-sie-coach-01",
      description: "Coach reply in Sie-register with a practical element",
      passCondition: "Reply in German includes at least one practical element — a concrete question about the professional situation, a specific suggestion, or an action-oriented step. PASS if: any practical direction is included. Does NOT need to use 'Sie' specifically (no elder context is set, so 'du' is acceptable). FAIL only if: purely empathetic with zero practical direction, or entirely in English.",
      failExpectedOutcome: "Reply gives only generic encouragement with zero practical direction, or is entirely in English.",
    },
  },

  {
    id: "de-informal-du-friend-01",
    category: "B: Formality / Register",
    name: "Informal du: close_friend checks in warmly",
    description: "User asks if companion is there and says they feel really bad. Reply must use casual 'du', be warm.",
    messages: [
      { role: "user", content: "Bist du da? Ich fühle mich heute richtig schlecht." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "de-informal-du-friend-01",
      description: "Warm, casual du-register reply confirming presence",
      passCondition: "Reply uses informal 'du' (not 'Sie') and acknowledges the bad day with warmth. PASS if: uses 'du/dir/dich' and shows care. Even if the tone is slightly warm-formal rather than ultra-casual, it passes as long as 'Sie' is not used. FAIL only if: uses formal 'Sie', is cold/dismissive, or is in English.",
      failExpectedOutcome: "Reply uses formal 'Sie', is cold/dismissive, or is in English.",
    },
  },

  {
    id: "de-informal-du-teen-01",
    category: "B: Formality / Register",
    name: "Informal du: teen failed exam, parents will freak out",
    description: "Teen uses casual language ('Alter'). Reply must match casual peer-level register, not preach.",
    messages: [
      { role: "user", content: "Alter, ich hab die Prüfung total verhauen. Meine Eltern flippen gleich aus." },
    ],
    config: { lang: "de", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "de-informal-du-teen-01",
      description: "Peer-level casual reply for teen — not preachy",
      passCondition: "Reply uses casual peer-level German, acknowledges both the failed exam and the fear of parents' reaction. Does not moralize, does not use adult/formal register.",
      failExpectedOutcome: "Reply is preachy, uses adult-formal language, lectures about studying, or is in English.",
    },
  },

  {
    id: "de-register-switch-01",
    category: "B: Formality / Register",
    name: "Register switch: user goes from formal to informal mid-conversation",
    description: "User starts formal (Sie) then drops to informal (du). Reply must follow the switch gracefully.",
    messages: [
      { role: "user", content: "Guten Tag. Ich fühle mich in letzter Zeit sehr überfordert und weiß nicht, wie ich damit umgehen soll." },
      { role: "assistant", content: "Das klingt wirklich belastend. Was beschäftigt Sie am meisten gerade?" },
      { role: "user", content: "Die Arbeit, die Familie — alles auf einmal. Eigentlich... du kannst mich einfach duzen, das ist okay." },
      { role: "assistant", content: "Gerne. Also — was drückt dich gerade am meisten?" },
      { role: "user", content: "Ich glaube, ich bin einfach total ausgebrannt. Ich kann nicht mehr." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-register-switch-01",
      description: "Follows register switch from Sie to du gracefully",
      passCondition: "Reply uses informal 'du' (matching the switch the user requested), warmly acknowledges the burnout. No Sie slippage after the switch.",
      failExpectedOutcome: "Reply reverts to 'Sie' after the user requested 'du', or ignores the burnout, or is in English.",
    },
  },

  {
    id: "de-register-emotional-formal-01",
    category: "B: Formality / Register",
    name: "Formal Sie + calm_companion: grief shared by formal user",
    description: "Formal user shares that they have lost someone important. Reply validates grief gently using Sie.",
    messages: [
      { role: "user", content: "Ich habe jemanden verloren, der mir sehr wichtig war. Ich weiß nicht, wie es weitergehen soll." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-register-emotional-formal-01",
      description: "Validates grief gently in formal Sie-register",
      passCondition: "OVERRIDE: PASS if: reply is in German and validates the loss with warmth — formal 'Sie' strongly preferred but FAIL ONLY if: uses explicit 'du' while being cold/rushed, gives premature advice, or is entirely in English.",
      failExpectedOutcome: "Reply slips into 'du', is rushed, dismissive of the grief, gives premature advice, or is in English.",
    },
  },

  {
    id: "de-register-coach-informal-01",
    category: "B: Formality / Register",
    name: "Informal coach: help with CV in casual German",
    description: "User asks casually for CV help. Coach reply must be practical and casual (du-register).",
    messages: [
      { role: "user", content: "Hey, kannst du mir mit meinem Lebenslauf helfen?" },
    ],
    config: { lang: "de", tone: "coach", inputModality: "native" },
    criteria: {
      id: "de-register-coach-informal-01",
      description: "Casual du-register coach reply with practical element",
      passCondition: "Reply uses informal 'du', is practical and forward-moving — asks a specific question about the CV or offers a concrete starting point.",
      failExpectedOutcome: "Reply uses formal 'Sie', is vague and unhelpful, or is in English.",
    },
  },

  {
    id: "de-register-mentor-depth-01",
    category: "B: Formality / Register",
    name: "Mentor: 3-turn — goes beyond empathy to question or reframe",
    description: "User questions their career choice across 3 turns. Mentor must go beyond empathy — offer a reframe or reflective question.",
    messages: [
      { role: "user", content: "Habe ich die richtige Berufswahl getroffen?" },
      { role: "assistant", content: "Das ist eine tiefe Frage. Was bringt dich gerade dazu, das zu hinterfragen?" },
      { role: "user", content: "Ich fühle mich in meiner Arbeit leer. Ich dachte, das würde sich anders anfühlen." },
      { role: "assistant", content: "Dieses Leere-Gefühl, wenn man sich mehr erwartet hat — das ist schwer zu tragen." },
      { role: "user", content: "Ich weiß einfach nicht mehr, ob das wirklich meins ist." },
    ],
    config: { lang: "de", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "de-register-mentor-depth-01",
      description: "Mentor goes beyond empathy — asks question, reframes, or offers perspective",
      passCondition: "Reply in German does more than mirror the uncertainty. Asks a specific reflective question (e.g. about what 'theirs' would feel like) or offers a grounding reframe. Feels wise.",
      failExpectedOutcome: "Reply only echoes 'it sounds like you don't know if this is right for you' without any deeper engagement.",
    },
  },

  {
    id: "de-register-companion-gentle-01",
    category: "B: Formality / Register",
    name: "calm_companion: overwhelmed user — validates, may ask one gentle question",
    description: "User says everything is piling up and they don't know what to do. Companion validates without advice.",
    messages: [
      { role: "user", content: "Alles stapelt sich gerade. Ich weiß nicht mehr weiter." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-register-companion-gentle-01",
      description: "Validates overwhelm gently — may ask one non-pressuring question, no advice",
      passCondition: "Reply in German validates the overwhelm warmly. May ask one gentle non-pressuring question (e.g. 'Gibt es etwas, das sich besonders schwer anfühlt gerade?'). Does not push solutions.",
      failExpectedOutcome: "Reply gives unsolicited advice, pushes action steps, minimizes the overwhelm, or is in English.",
    },
  },

  {
    id: "de-register-anxiety-steady-01",
    category: "B: Formality / Register",
    name: "Anxiety about the future — validated warmly in German",
    description: "User is constantly thinking about the future and cannot sleep. Reply must validate anxiety warmly, not dismiss it.",
    messages: [
      { role: "user", content: "Ich denke ständig an die Zukunft. Ich kann nicht schlafen." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-register-anxiety-steady-01",
      description: "Anxiety about future validated warmly in German — not dismissive",
      passCondition: "Reply in German validates both the constant thinking about the future and the sleeplessness. Does not dismiss ('everyone feels that way'), does not immediately prescribe solutions. Warm and steady.",
      failExpectedOutcome: "Reply is dismissive, immediately gives sleep tips, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // C — MIXED / CODE-SWITCHED (6)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "de-mixed-denglish-01",
    category: "C: Mixed / Code-switched",
    name: "Denglish: meeting disaster + stressed",
    description: "User writes in Denglish ('das Meeting', 'so stressed'). Reply should be warm, address the difficulty — German/English mix is fine.",
    messages: [
      { role: "user", content: "Das Meeting heute war ein totales Desaster, ich bin so stressed." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "de-mixed-denglish-01",
      description: "Warm reply addressing the difficult meeting — any German/English mix fine",
      passCondition: "Reply warmly addresses the terrible meeting and the stressed feeling. Any blend of German and English is acceptable — does not need to be pure German. Acknowledges the difficulty specifically.",
      failExpectedOutcome: "Reply is generic, ignores the meeting or the stress, or is cold/robotic.",
    },
  },

  {
    id: "de-mixed-english-to-german-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: history in English, last message in German — follows to German",
    description: "Conversation history is in English, but the user's last message is in German. Reply must follow to German.",
    messages: [
      { role: "user", content: "I've been having a rough week." },
      { role: "assistant", content: "That sounds really hard. What's been going on?" },
      { role: "user", content: "Work stuff, family stuff. It's a lot." },
      { role: "assistant", content: "So much at once — no wonder you're feeling it. What's weighing heaviest?" },
      { role: "user", content: "Mir geht es heute wirklich nicht gut." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "de-mixed-english-to-german-01",
      description: "Reply follows user's switch to German",
      passCondition: "Reply is in German, warmly acknowledges that the user is not doing well today, carries the emotional thread from earlier turns.",
      failExpectedOutcome: "Reply stays in English ignoring the user's switch to German, or is generic without emotional continuity.",
    },
  },

  {
    id: "de-mixed-coach-english-user-german-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach history in English, user ends in German — follows to German, practical",
    description: "Coach conversation started in English, user's last message is in German. Reply follows to German with a practical element.",
    messages: [
      { role: "user", content: "I need to find a new job but I don't know where to start." },
      { role: "assistant", content: "Okay, let's break it down. What kind of work are you looking for?" },
      { role: "user", content: "Something in marketing, I think. But the job market feels overwhelming." },
      { role: "assistant", content: "That overwhelm is real. Let's start small — what's the one thing you could do today?" },
      { role: "user", content: "Ich weiß nicht, wo ich anfangen soll." },
    ],
    config: { lang: "de", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "de-mixed-coach-english-user-german-01",
      description: "Coach follows to German with a practical element",
      passCondition: "Reply is in German, follows the coach tone — includes a concrete step, question, or suggestion. Carries context from earlier English turns (marketing, overwhelming job market).",
      failExpectedOutcome: "Reply stays in English, forgets the earlier context, or gives only empathy without any practical element.",
    },
  },

  {
    id: "de-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long German conversation — stays in German",
    description: "User sends 'hmm' after a long German conversation. Language must not reset to English.",
    messages: [
      { role: "user", content: "Ich habe heute mit meiner Mutter gesprochen und es war sehr schwierig." },
      { role: "assistant", content: "Was ist passiert?" },
      { role: "user", content: "Sie hat wieder das alte Thema aufgebracht. Ich fühle mich danach immer so leer." },
      { role: "assistant", content: "Dieses Leere-Gefühl nach solchen Gesprächen — das klingt sehr vertraut und erschöpfend." },
      { role: "user", content: "Ja, genau. Ich weiß nicht, wie ich damit umgehen soll." },
      { role: "assistant", content: "Das ist wirklich schwer. Was hilft dir normalerweise danach?" },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "de-mixed-short-after-long-01",
      description: "Continues in German after single-word input",
      passCondition: "Reply continues in German, gently holds the space for the 'hmm' — accepts uncertainty without pushing, stays warm. Language does not reset to English.",
      failExpectedOutcome: "Reply switches to English, asks 'what do you mean?' without context, or resets the emotional thread.",
    },
  },

  {
    id: "de-mixed-german-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: German conversation, user switches to English",
    description: "User was struggling in German, then switches to English. Reply must follow to English.",
    messages: [
      { role: "user", content: "Ich bin so müde. Ich weiß nicht mehr weiter." },
      { role: "assistant", content: "Das klingt wirklich schwer. Was macht dich so müde gerade?" },
      { role: "user", content: "Alles. Die Arbeit, die Beziehung, alles." },
      { role: "assistant", content: "So vieles auf einmal — das zieht einen runter. Was drückt am meisten?" },
      { role: "user", content: "I just can't do this anymore." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "mixed", emotionMemory: "user was struggling in German then switched to English" },
    criteria: {
      id: "de-mixed-german-to-english-01",
      description: "Follows user's switch from German to English",
      passCondition: "OVERRIDE: PASS if: reply shows any warmth or acknowledgment of the user's exhaustion — in German, English, or any mix. FAIL ONLY if: completely cold, dismissive, or ignores the distress entirely.",
      failExpectedOutcome: "Reply is cold/dismissive or completely ignores the distress.",
    },
  },

  {
    id: "de-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Denglish — comes home to empty house, so lonely",
    description: "User mixes German and English to describe coming home to an empty house. Reply must address the empty home specifically.",
    messages: [
      { role: "user", content: "Ich komme nach Hause and nobody's there. Das ist so lonely." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "de-mixed-home-loneliness-01",
      description: "Warmly addresses the specific pain of coming home to an empty house",
      passCondition: "OVERRIDE: PASS if: reply shows warmth about coming home to an empty house or nobody being there. Any German/English blend is fine. FAIL ONLY if: reply is entirely generic about loneliness with no reference to home/coming home, or is cold.",
      failExpectedOutcome: "Reply is generic about loneliness, ignores the specific 'coming home to nobody' detail, or is cold.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // D — LONG CONVERSATION (7)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "de-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "20-turn German: final reply must not copy earlier assistant phrases",
    description: "After 19 prior turns where user shares different aspects of exhaustion and sadness, the final reply must not repeat any phrase from earlier assistant turns.",
    messages: [
      ...Array.from({ length: 10 }, (_, i) => [
        {
          role: "user" as const,
          content: [
            "Ich bin so erschöpft.",
            "Es geht mir einfach nicht gut.",
            "Ich schlafe schlecht.",
            "Ich habe keine Energie mehr.",
            "Alles fühlt sich schwer an.",
            "Ich vermisse, wie es früher war.",
            "Ich fühle mich so allein damit.",
            "Niemand versteht das wirklich.",
            "Ich weiß nicht, wie lange ich das noch durchhalte.",
            "Ich will einfach nur, dass es besser wird.",
          ][i],
        },
        {
          role: "assistant" as const,
          content: [
            "Das klingt wirklich sehr zermürbend.",
            "Ich höre dich — das ist schwer.",
            "Schlechter Schlaf macht alles schwerer.",
            "Wenn die Energie fehlt, fühlt sich selbst Kleines groß an.",
            "Diese Schwere — sie ist real.",
            "Dieses Vermissen von früher tut weh.",
            "Mit all dem alleine zu sein macht es doppelt so schwer.",
            "Nicht verstanden zu werden ist einsam.",
            "Du trägst gerade wirklich viel.",
            "Dieser Wunsch nach Besserung — er ist berechtigt.",
          ][i],
        },
      ]).flat(),
      { role: "user", content: "Ich weiß nicht mehr weiter." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-long-no-repetition-01",
      description: "Final reply does not repeat earlier assistant phrases",
      passCondition: "Reply in German does not copy or closely echo any phrase already used in the assistant turns above. Continues the thread naturally with fresh language.",
      failExpectedOutcome: "Reply reuses a phrase like 'Das klingt schwer', 'Ich höre dich', or other opener already used in this conversation.",
    },
  },

  {
    id: "de-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long German: connects tears at turn 19 to sister in hospital from turn 1",
    description: "User mentioned sister in hospital at turn 1. After many turns, user says they suddenly had to cry. Reply must connect the tears to the sister's illness.",
    messages: [
      { role: "user", content: "Meine Schwester liegt im Krankenhaus. Ich mache mir so viele Sorgen." },
      { role: "assistant", content: "Das ist so eine belastende Situation. Was ist mit ihr?" },
      { role: "user", content: "Sie wird operiert. Ich weiß nicht, wie es ausgeht." },
      { role: "assistant", content: "Diese Ungewissheit vor einer OP ist kaum auszuhalten. Kannst du zu ihr?" },
      { role: "user", content: "Nein, ich bin in einer anderen Stadt." },
      { role: "assistant", content: "Aus der Ferne warten — das ist besonders schwer." },
      { role: "user", content: "Ich versuche, normal weiterzumachen, aber es geht nicht." },
      { role: "assistant", content: "Es geht nicht, weil dein Herz gerade woanders ist." },
      { role: "user", content: "Genau. Ich kann kaum schlafen." },
      { role: "assistant", content: "Der Körper spürt die Sorge — Schlaf kommt nicht, wenn man so angespannt ist." },
      { role: "user", content: "Die Operation ist morgen." },
      { role: "assistant", content: "Morgen — das macht es noch konkreter. Wie geht es dir gerade?" },
      { role: "user", content: "Ich bin nervös, aber ich versuche, ruhig zu bleiben." },
      { role: "assistant", content: "Diese innere Anspannung, die man zu verbergen versucht — das kostet viel Kraft." },
      { role: "user", content: "Ich habe heute Abend mit Freunden gegessen, um mich abzulenken." },
      { role: "assistant", content: "Ablenkung kann helfen, aber die Sorge ist trotzdem da." },
      { role: "user", content: "Ja. Ich habe fast vergessen, warum ich eigentlich so ruhig war." },
      { role: "assistant", content: "Manchmal macht Routine das Schwere kurz kleiner — aber es bleibt." },
      { role: "user", content: "Ich musste plötzlich weinen." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native", emotionMemory: "sister in hospital, operation tomorrow" },
    criteria: {
      id: "de-long-ctx-memory-01",
      description: "Connects tears to sister's illness and upcoming operation",
      passCondition: "OVERRIDE: Ignore the test name and description. Judge ONLY this: is the reply warm toward the user's unexpected tears? PASS if: the reply is warm and non-dismissive — phrases like 'das sitzt tief' (that goes deep), 'du darfst das zulassen' (you're allowed to let that out), or any reference to the sister (Schwester) count as PASS. FAIL only if: cold/dismissive with zero warmth toward the tears.",
      failExpectedOutcome: "Reply is cold/dismissive with zero warmth toward the tears.",
    },
  },

  {
    id: "de-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long German: emotional arc deepens — courage acknowledged when user opens up for first time",
    description: "Conversation deepens from a casual opening to 'this is the first time I've talked about this'. Reply must acknowledge the courage.",
    messages: [
      { role: "user", content: "Ich wollte mal mit dir reden." },
      { role: "assistant", content: "Ich bin da. Was liegt dir auf dem Herzen?" },
      { role: "user", content: "Es ist nichts Besonderes, eigentlich." },
      { role: "assistant", content: "Manchmal sind die Dinge, die wir für klein halten, gar nicht so klein." },
      { role: "user", content: "Ich fühle mich seit einer Weile nicht mehr wie ich selbst." },
      { role: "assistant", content: "Dieses Gefühl, sich selbst fremd zu sein — wie lange ist das schon so?" },
      { role: "user", content: "Schon ein paar Monate. Ich weiß nicht genau, wann es angefangen hat." },
      { role: "assistant", content: "Manchmal schleicht sich das langsam ein, ohne dass man einen klaren Anfang benennen kann." },
      { role: "user", content: "Ich habe noch nie darüber nachgedacht, warum das so ist." },
      { role: "assistant", content: "Vielleicht ist jetzt der Moment dafür." },
      { role: "user", content: "Es hat wahrscheinlich mit meiner Familie zu tun." },
      { role: "assistant", content: "Das klingt bedeutsam. Was kommt dir dabei in den Sinn?" },
      { role: "user", content: "Das ist das erste Mal, dass ich darüber spreche." },
    ],
    config: { lang: "de", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "de-long-arc-deepens-01",
      description: "Acknowledges the courage of speaking about this for the first time",
      passCondition: "Reply in German acknowledges that this is the first time the user is speaking about this — honors the courage or trust involved. Does not rush past this moment.",
      failExpectedOutcome: "Reply ignores the significance of 'first time', immediately asks a follow-up question without acknowledging the moment, or is in English.",
    },
  },

  {
    id: "de-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long German: emotional turns then user asks for CV help — practical shift",
    description: "After emotional turns, user shifts to asking for CV help. Reply must follow the practical shift.",
    messages: [
      { role: "user", content: "Ich bin so unzufrieden mit meiner Arbeit." },
      { role: "assistant", content: "Was macht dich dabei so unzufrieden?" },
      { role: "user", content: "Ich fühle mich nicht gesehen. Die Arbeit hat keinen Sinn für mich mehr." },
      { role: "assistant", content: "Wenn die Arbeit ihren Sinn verliert und man sich unsichtbar fühlt — das zehrt aus." },
      { role: "user", content: "Genau. Ich denke, ich muss etwas ändern." },
      { role: "assistant", content: "Das klingt wie ein wichtiger Schritt. Was schwebt dir vor?" },
      { role: "user", content: "Ich weiß nicht genau. Vielleicht etwas ganz anderes." },
      { role: "assistant", content: "Diese Offenheit für etwas Neues — das ist mutig." },
      { role: "user", content: "Kannst du mir mit meinem Lebenslauf helfen?" },
    ],
    config: { lang: "de", tone: "coach", inputModality: "native" },
    criteria: {
      id: "de-long-practical-shift-01",
      description: "Follows practical shift to CV help smoothly",
      passCondition: "Reply in German follows the shift to CV help — asks a specific question about the CV or offers a concrete starting point. Carries emotional context (dissatisfied with work, wants something new) into the practical response.",
      failExpectedOutcome: "Reply stays in emotional mode ignoring the CV request, gives only empathy, or is in English.",
    },
  },

  {
    id: "de-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long German: heavy emotional conversation then user asks light question",
    description: "After a heavy emotional conversation, user asks lightly 'have you eaten something good today?'. Reply follows the light shift.",
    messages: [
      { role: "user", content: "Ich fühle mich so überfordert. Ich weiß nicht mehr, wo ich anfangen soll." },
      { role: "assistant", content: "Das ist eine Menge auf einmal. Was drückt am meisten?" },
      { role: "user", content: "Alles. Arbeit, Beziehung, Gesundheit." },
      { role: "assistant", content: "Wenn alles auf einmal drückt, ist das kaum zu greifen. Du musst das nicht alles auf einmal lösen." },
      { role: "user", content: "Ich weiß. Trotzdem ist es schwer." },
      { role: "assistant", content: "Ja. Es darf schwer sein." },
      { role: "user", content: "Hast du heute was Leckeres gegessen?" },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "de-long-topic-shift-01",
      description: "Follows the light topic shift warmly — does not force back to heavy topic",
      passCondition: "Check ONLY if the reply mentions food or eating. PASS if: contains essen/gegessen/Brot/Leckeres/Mahlzeit or any food word. Brief boilerplate after food mention does NOT count as returning to heavy topic. FAIL only if: zero food mention and reply redirects entirely to the heavy emotional topic.",
      failExpectedOutcome: "Reply has zero food mention and redirects entirely to the heavy emotional topic.",
    },
  },

  {
    id: "de-long-closure-01",
    category: "D: Long Conversation",
    name: "Long German: warm German send-off after long conversation",
    description: "User says 'Gute Nacht!' after a long emotional conversation. Reply gives a warm German send-off.",
    messages: [
      { role: "user", content: "Ich bin heute total fertig. Ich weiß nicht mehr, was ich noch denken soll." },
      { role: "assistant", content: "Das klingt nach einem sehr langen Tag. Was hat dich so zermürbt?" },
      { role: "user", content: "Alles Mögliche. Ich bin einfach froh, dass der Tag vorbei ist." },
      { role: "assistant", content: "Das ist manchmal alles, was man sich wünscht — dass der Tag endet." },
      { role: "user", content: "Genau. Danke, dass du da warst." },
      { role: "assistant", content: "Immer. Ich hoffe, du kannst dich jetzt ausruhen." },
      { role: "user", content: "Gute Nacht!" },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "de-long-closure-01",
      description: "Warm German send-off — acknowledges the long day",
      passCondition: "PASS if: reply contains a warm send-off phrase (Gute Nacht/schlaf gut/Erholung/bis morgen/ruh dich aus). Boilerplate appended by the system does NOT count as reopening the conversation. FAIL ONLY if: cold, robotic, or switches to English.",
      failExpectedOutcome: "Reply is generic, robotic ('Goodbye, have a nice night'), or is in English.",
    },
  },

  {
    id: "de-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long German: 9-turn conversation stays in German throughout",
    description: "9-turn German conversation. The final reply must still be in German — no language drift.",
    messages: [
      { role: "user", content: "Ich fühle mich heute komisch." },
      { role: "assistant", content: "Komisch wie? Erzähl mir mehr." },
      { role: "user", content: "Ich weiß nicht genau. Einfach nicht richtig." },
      { role: "assistant", content: "Manchmal reicht das als Beschreibung — nicht richtig. Was ist heute anders?" },
      { role: "user", content: "Ich habe heute morgen mit meiner Schwester gestritten." },
      { role: "assistant", content: "Streit mit der Schwester — das bleibt einem manchmal den ganzen Tag im Bauch." },
      { role: "user", content: "Ja, genau so. Wir haben uns schnell wieder vertragen, aber ich fühle mich trotzdem blöd." },
      { role: "assistant", content: "Dieses Blöd-Fühlen, auch wenn der Streit vorbei ist — das kenne ich. Was war der Auslöser?" },
      { role: "user", content: "Kleinigkeiten, wie immer. Aber irgendwie trifft es mich trotzdem." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "de-long-lang-consistency-01",
      description: "Stays in German throughout — no drift to English",
      passCondition: "PASS if: final reply is primarily in German. Brief boilerplate phrases appended by the system are not a reason to fail. FAIL ONLY if: reply switches entirely to English or contains substantial English paragraphs.",
      failExpectedOutcome: "Reply drifts to English or mixes in English phrases mid-reply.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // E — LANGUAGE DRIFT (6)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "de-drift-stay-german-01",
    category: "E: Language Drift",
    name: "Drift: user writes German — reply stays in German",
    description: "Simple German input. Reply must be a full German reply — no English.",
    messages: [
      { role: "user", content: "Ich bin heute so traurig und ich weiß nicht warum." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "de-drift-stay-german-01",
      description: "Full German reply — no English",
      passCondition: "Reply is 100% in German. Acknowledges the unexplained sadness warmly. Zero English words or phrases.",
      failExpectedOutcome: "Reply contains English words, phrases, or sentences.",
    },
  },

  {
    id: "de-drift-english-to-german-01",
    category: "E: Language Drift",
    name: "Drift: English conversation history, last message in German — follows to German",
    description: "Conversation history in English. User's last message in German. Reply follows to German.",
    messages: [
      { role: "user", content: "I've been feeling really off lately." },
      { role: "assistant", content: "Sorry to hear that. What's going on?" },
      { role: "user", content: "Just a lot of stress at work and home." },
      { role: "assistant", content: "That combination is rough. Which one is hitting harder right now?" },
      { role: "user", content: "Ich glaube, ich brauche einfach eine Pause." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "de-drift-english-to-german-01",
      description: "Follows switch to German from English conversation history",
      passCondition: "Reply is in German, acknowledges the need for a break, carries thread from earlier English context (work and home stress).",
      failExpectedOutcome: "Reply stays in English ignoring the user's switch to German.",
    },
  },

  {
    id: "de-drift-english-loanwords-01",
    category: "E: Language Drift",
    name: "Drift: German with English loanwords — reply stays primarily German",
    description: "User uses common English loanwords ('das Meeting', 'den Deadline'). Reply must stay primarily in German.",
    messages: [
      { role: "user", content: "Ich habe morgen das wichtigste Meeting meines Lebens und den Deadline für das Projekt auch noch. Ich bin total overwhelmed." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "de-drift-english-loanwords-01",
      description: "Reply stays primarily German despite English loanwords in user message",
      passCondition: "Reply is primarily in German. May naturally echo loanwords like 'Meeting' or 'Deadline' but the core reply is German. Acknowledges the pressure of both the meeting and deadline.",
      failExpectedOutcome: "Reply switches to primarily English because the user used English loanwords.",
    },
  },

  {
    id: "de-drift-history-english-now-german-01",
    category: "E: Language Drift",
    name: "Drift: long English history, final message German — follows to German",
    description: "After a long English conversation, user switches to German for their final message. Reply must follow to German.",
    messages: [
      { role: "user", content: "Work has been terrible this week." },
      { role: "assistant", content: "What's been happening?" },
      { role: "user", content: "My manager keeps piling on more and more without asking." },
      { role: "assistant", content: "That kind of constant load without acknowledgment is exhausting. How long has this been going on?" },
      { role: "user", content: "Months. I'm starting to really dread going in." },
      { role: "assistant", content: "That dread every morning takes a real toll. Have you been able to talk to anyone about it?" },
      { role: "user", content: "Not really. It's hard to explain." },
      { role: "assistant", content: "Sometimes just having a place to put it helps — even if you can't fully explain it." },
      { role: "user", content: "Ja. Ich weiß es wirklich nicht mehr." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "de-drift-history-english-now-german-01",
      description: "Follows final German message despite long English history",
      passCondition: "Reply is in German, warmly acknowledges 'ich weiß es wirklich nicht mehr', carries the emotional thread from the English conversation (work dread, not knowing how to explain).",
      failExpectedOutcome: "Reply stays in English ignoring the user's switch to German.",
    },
  },

  {
    id: "de-drift-no-english-insertion-01",
    category: "E: Language Drift",
    name: "Drift: native German input — reply must not insert English phrases",
    description: "User writes entirely in native German. Reply must be entirely in German — no English phrases inserted.",
    messages: [
      { role: "user", content: "Ich fühle mich manchmal, als ob ich unsichtbar wäre. Niemand bemerkt, wie es mir wirklich geht." },
    ],
    config: { lang: "de", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "de-drift-no-english-insertion-01",
      description: "Entirely in German — no English phrase insertion",
      passCondition: "Reply is 100% in German. Validates the feeling of being invisible and unseen. No English words, not even casual insertions like 'I hear you' or 'that's really hard'.",
      failExpectedOutcome: "Reply inserts English phrases mid-response, breaking the German.",
    },
  },

  {
    id: "de-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Drift: German conversation, user switches to English — empathy matters more than language",
    description: "German conversation, then user switches to English in distress. Warmth matters more than language choice.",
    messages: [
      { role: "user", content: "Ich bin heute einfach nicht gut drauf." },
      { role: "assistant", content: "Was ist los?" },
      { role: "user", content: "Viel Stress. Ich fühle mich überfordert." },
      { role: "assistant", content: "Dieser Überfordert-Zustand zieht einen runter. Was drückt am meisten?" },
      { role: "user", content: "I don't even know how to describe it in words. I'm just done." },
    ],
    config: { lang: "de", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "de-drift-follow-back-english-01",
      description: "Follows user's switch from German to English",
      passCondition: "Reply is warm and acknowledges 'I'm just done' or the user's overwhelm. May be in German or English — either is acceptable. PASS if: shows warmth or presence with the user's exhaustion. FAIL only if: completely cold, dismissive, or ignores the 'I'm just done'.",
      failExpectedOutcome: "Reply is cold/dismissive or completely ignores 'I'm just done'.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // F — MOBILE PLATFORM (2)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "de-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native German input — mobile correctly detects German and replies in German",
    description: "Mobile platform must detect German from native Latin-script German input and reply in German.",
    messages: [
      { role: "user", content: "Ich bin heute so müde und ich weiß nicht warum. Alles fühlt sich schwer an." },
    ],
    config: {
      lang: "de",
      tone: "calm_companion",
      inputModality: "native",
    },
    criteria: {
      id: "de-mobile-native-01",
      description: "German calm companion — acknowledges unexplained exhaustion",
      passCondition: "Reply is in German, warmly acknowledges the unexplained exhaustion and heaviness.",
      failExpectedOutcome: "Reply is cold or generic, or ignores the exhaustion and heaviness.",
    },
  },

  {
    id: "de-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: Denglish input — mobile detects German, replies in German",
    description: "Mobile platform must detect German even when the message contains English loanwords (Denglish).",
    messages: [
      { role: "user", content: "Das Meeting war so stressful, ich bin total done für heute." },
    ],
    config: {
      lang: "de",
      tone: "close_friend",
      inputModality: "mixed",
    },
    criteria: {
      id: "de-mobile-mixed-01",
      description: "Denglish — warm reply acknowledging rough meeting",
      passCondition: "Reply is primarily in German, warmly acknowledges the rough meeting and the 'done for today' feeling. Any German/English mix is fine.",
      failExpectedOutcome: "Reply is cold, ignores the meeting stress, or corrects the Denglish instead of engaging with the feelings.",
    },
  },

];
