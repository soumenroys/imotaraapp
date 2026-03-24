/**
 * tests/imotara-ai/scenarios.fr.ts
 *
 * E2E test scenarios for French (fr) language support.
 * Categories:
 *   A: Native French (12) — standard French input/output
 *   B: Formality / Register (10) — tu vs vous, teen, elder, emotional register
 *   C: Mixed / Code-switched (6) — Franglais, English-French mix
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * French notes:
 *  - Script: Latin (same as English)
 *  - Address: "tu/te/toi/ton/ta" (informal), "vous/votre/vous" (formal/elder/plural)
 *  - Gender: 2nd-person verb agreement: "tu es" works for all genders; adjectives: "fatigué(e)"
 *  - French speakers freely mix English tech/work terms: "le meeting", "un email", "stressée"
 */

import type { TestScenario } from "./types";

export const frScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE FRENCH — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "fr-native-lang-01",
    category: "A: Native French",
    name: "Native French: reply must stay in French",
    description: "User writes in French expressing feeling bad. Reply must stay in French and address the feeling without switching to English.",
    messages: [
      { role: "user", content: "Je me sens vraiment mal aujourd'hui. Je ne sais pas quoi faire." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-native-lang-01",
      description: "Language fidelity in French",
      passCondition: "Reply stays in French, acknowledges the user's feeling ('mal aujourd'hui'), does not switch to English.",
      failExpectedOutcome: "Reply switches to English or ignores the emotional content.",
    },
  },

  {
    id: "fr-native-ctx-01",
    category: "A: Native French",
    name: "Native French: references the specific humiliation at work",
    description: "User was publicly criticized by their boss and feels humiliated. Reply should reference the specific situation, not give generic comfort.",
    messages: [
      { role: "user", content: "Mon chef m'a critiqué devant tout le monde. Je me sens humilié." },
    ],
    config: {
      lang: "fr",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly criticized by their boss in front of the whole team — reference this specifically.",
    },
    criteria: {
      id: "fr-native-ctx-01",
      description: "Context specificity in French",
      passCondition: "Reply references being criticized in front of others — acknowledges the public nature of the humiliation, not a generic 'ça va aller'.",
      failExpectedOutcome: "Reply gives generic comfort without mentioning the public criticism.",
    },
  },

  {
    id: "fr-native-tone-friend-01",
    category: "A: Native French",
    name: "Native French: close_friend tone — casual and warm",
    description: "close_friend tone — casual, warm, uses 'tu', not preachy. User feels off today.",
    messages: [
      { role: "user", content: "Hé, aujourd'hui je me sens pas bien. Tout me semble bizarre." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-native-tone-friend-01",
      description: "close_friend tone in French",
      passCondition: "Reply is warm and casual, uses 'tu', stays in French. Not preachy, not overly formal. Acknowledges the off feeling.",
      failExpectedOutcome: "Reply uses 'vous', sounds formal, gives advice or is preachy.",
    },
  },

  {
    id: "fr-native-tone-companion-01",
    category: "A: Native French",
    name: "Native French: calm_companion tone — steady and gentle",
    description: "calm_companion tone — user feels lonely and misunderstood. Reply must be present and validating, no unsolicited advice.",
    messages: [
      { role: "user", content: "Je me sens vraiment seul(e). Personne ne me comprend." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-native-tone-companion-01",
      description: "calm_companion tone in French",
      passCondition: "OVERRIDE: PASS if: reply is in French and shows warmth about loneliness or feeling misunderstood. A gentle question is fine. FAIL ONLY if: gives unsolicited advice, is cold/dismissive, or entirely in English.",
      failExpectedOutcome: "Reply gives unsolicited advice, is preachy, or dismisses the loneliness.",
    },
  },

  {
    id: "fr-native-tone-coach-01",
    category: "A: Native French",
    name: "Native French: coach tone — practical nudge",
    description: "coach tone — user needs a job but doesn't know where to start. Reply should acknowledge briefly then include a practical element.",
    messages: [
      { role: "user", content: "J'ai besoin d'un travail mais je sais pas par où commencer." },
    ],
    config: { lang: "fr", tone: "coach", inputModality: "native" },
    criteria: {
      id: "fr-native-tone-coach-01",
      description: "coach tone in French",
      passCondition: "Reply in French acknowledges briefly then includes a practical element — a question, concrete suggestion, or next step. Not purely soothing.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "fr-native-tone-mentor-01",
    category: "A: Native French",
    name: "Native French: mentor tone — grounded perspective",
    description: "mentor tone — user fears making the wrong decision. Reply should offer wisdom, not platitudes.",
    messages: [
      { role: "user", content: "J'ai une décision importante à prendre et j'ai peur de me tromper." },
    ],
    config: { lang: "fr", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "fr-native-tone-mentor-01",
      description: "mentor tone in French",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In French.",
      failExpectedOutcome: "Reply is generic comfort without any insight, guidance, or perspective.",
    },
  },

  {
    id: "fr-native-tone-mentor-deep-01",
    category: "A: Native French",
    name: "Native French: mentor tone — deep discouragement after effort",
    description: "mentor tone — multi-turn conversation where user tried hard but sees no results, finally questions whether to continue.",
    messages: [
      { role: "user", content: "Je fais tout ce qu'il faut mais rien ne change. Je me sens perdu." },
      { role: "assistant", content: "C'est vraiment épuisant de s'investir autant sans voir de résultats." },
      { role: "user", content: "Exactement. J'en ai marre. Ça fait des mois que j'essaie." },
      { role: "assistant", content: "Des mois de persévérance, c'est pas rien. Je t'entends." },
      { role: "user", content: "Je ne sais plus si ça vaut la peine de continuer." },
    ],
    config: { lang: "fr", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "fr-native-tone-mentor-deep-01",
      description: "mentor tone depth in French",
      passCondition: "Reply is in French and NOT purely mirroring hopelessness — any gentle question, acknowledgment of sustained effort, small reframe, or encouragement counts.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "fr-native-age-teen-01",
    category: "A: Native French",
    name: "Native French: teen register (13_17)",
    description: "Teen user got a bad grade and fears parental reaction. Reply must not moralize about studying.",
    messages: [
      { role: "user", content: "Hé, j'ai eu une mauvaise note. Mes parents vont me disputer." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "fr-native-age-teen-01",
      description: "Teen register in French",
      passCondition: "Reply acknowledges the tough situation (bad grade + fear of parents) with warmth and peer-level tone. Does NOT moralize or lecture about studying harder. Stays in French.",
      failExpectedOutcome: "Reply is preachy, parental, or gives lecturing advice about studying.",
    },
  },

  {
    id: "fr-native-age-elder-01",
    category: "A: Native French",
    name: "Native French: elder register (65_plus) — uses 'vous'",
    description: "Elderly user feels lonely since children moved away. Reply must use respectful 'vous'.",
    messages: [
      { role: "user", content: "Mes enfants sont loin. Je me sens seul dans cette maison." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "fr-native-age-elder-01",
      description: "Elder register in French",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the loneliness or empty home (seul/solitude/loin/enfants/maison). Any respectful French reply counts. FAIL ONLY if: cold, dismissive, or uses informal 'tu' in a way that feels brusque.",
      failExpectedOutcome: "Reply uses informal 'tu' with an elderly person, or is cold and dismissive.",
    },
  },

  {
    id: "fr-native-ctx-retention-01",
    category: "A: Native French",
    name: "Native French: context retention — sister and tears",
    description: "Sister's wedding was mentioned early; sister calls later and user tears up. Reply must connect the tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "Ma sœur s'est mariée le mois dernier. La maison est tellement vide sans elle." },
      { role: "assistant", content: "On ressent vraiment le vide quand quelqu'un de proche part vivre ailleurs..." },
      { role: "user", content: "Oui, chaque soir c'est pareil. Je pense à elle." },
      { role: "assistant", content: "Elle te manque vraiment." },
      { role: "user", content: "Elle vient d'appeler et j'ai fondu en larmes sans raison." },
    ],
    config: {
      lang: "fr",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister got married and moved away last month — user misses her deeply. Connect any tears or emotion to missing the sister since her wedding.",
    },
    criteria: {
      id: "fr-native-ctx-retention-01",
      description: "Context retention across turns in French",
      passCondition: "Reply acknowledges the tears or emotion with personal context — shows awareness of the sister or the longing behind the tears. Not a purely generic 'c'est normal de pleurer' with zero personal acknowledgment. Any warm reply that references the sister, the missing her, or the weight behind the call counts as a pass.",
      failExpectedOutcome: "Reply is a completely generic 'crying is normal' with zero connection to the sister or the ongoing conversation.",
    },
  },

  {
    id: "fr-native-no-english-01",
    category: "A: Native French",
    name: "Native French: no English leak in native reply",
    description: "User shares a vulnerable moment in French. Reply must stay entirely in French — no English phrases mid-reply.",
    messages: [
      { role: "user", content: "C'est la première fois que je dis ça à quelqu'un. J'ai besoin qu'on m'écoute vraiment." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-native-no-english-01",
      description: "No English insertion in French reply",
      passCondition: "Reply stays entirely in French — no English phrases or words inserted mid-reply. Warm and truly present.",
      failExpectedOutcome: "Reply inserts English phrases like 'I'm here for you' or 'Take your time' mid-French reply.",
    },
  },

  {
    id: "fr-native-female-01",
    category: "A: Native French",
    name: "Native French: female user — exhausted doing everything alone",
    description: "Female user expresses exhaustion from handling everything by herself. Reply must acknowledge this warmly.",
    messages: [
      { role: "user", content: "Je fais tout toute seule. Je suis épuisée." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native", userGender: "female" },
    criteria: {
      id: "fr-native-female-01",
      description: "Emotional engagement for female French user",
      passCondition: "Reply acknowledges exhaustion with warmth — validates carrying everything alone. Stays in French.",
      failExpectedOutcome: "Reply dismisses or minimizes the exhaustion, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: FORMALITY / REGISTER VARIATIONS — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "fr-formal-vous-elder-01",
    category: "B: Formality / Register",
    name: "Formal register: elder uses 'vous' — warm and respectful",
    description: "Elderly user writes formally about loneliness since children left. Reply must use 'vous' and be patient and warm.",
    messages: [
      { role: "user", content: "Je me sens bien seul depuis que mes enfants sont partis. La maison est grande et vide." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "fr-formal-vous-elder-01",
      description: "Formal 'vous' register for elder in French",
      passCondition: "Reply is warm, patient, and respectful to an elderly user. Uses 'vous' OR avoids direct 2nd-person address entirely (e.g. 'cette solitude...'). Acknowledges the loneliness and empty home. Does NOT use informal 'tu'.",
      failExpectedOutcome: "Reply uses informal 'tu' or is cold/clinical without acknowledging the loneliness.",
    },
  },

  {
    id: "fr-formal-vous-coach-01",
    category: "B: Formality / Register",
    name: "Coach tone: elder user — practical guidance with respectful register",
    description: "Elderly user (65_plus) seeking professional improvement. Coach tone, respectful 'vous' address, practical question or step.",
    messages: [
      { role: "user", content: "Je cherche à améliorer ma situation professionnelle mais je ne sais comment procéder." },
    ],
    config: { lang: "fr", tone: "coach", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "fr-formal-vous-coach-01",
      description: "Coach tone with elder register in French",
      passCondition: "Reply is in French, includes a practical question or concrete step. Not purely soothing. Uses 'vous' or avoids 2nd-person.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "fr-informal-tu-friend-01",
    category: "B: Formality / Register",
    name: "Informal register: close_friend uses 'tu' — casual and warm",
    description: "User writes informally to a close friend. Reply must be casual with 'tu' register.",
    messages: [
      { role: "user", content: "T'es là ? Je me sens pas bien du tout aujourd'hui." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-informal-tu-friend-01",
      description: "Casual 'tu' register in French",
      passCondition: "OVERRIDE: PASS if: reply is warm and present in French with any casual or 'tu' phrasing. FAIL ONLY if: reply is cold, uses stiff formal 'vous' throughout, or is entirely in English.",
      failExpectedOutcome: "Reply switches to formal 'vous' or sounds stiff and distant.",
    },
  },

  {
    id: "fr-informal-tu-teen-01",
    category: "B: Formality / Register",
    name: "Informal register: teen uses casual slang — peer-level reply",
    description: "Teen writes in casual French slang about failing an exam. Reply must match peer-level tone, no moralizing.",
    messages: [
      { role: "user", content: "Eh, j'ai raté mon exam. Mes parents vont péter un câble." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "fr-informal-tu-teen-01",
      description: "Teen casual register in French",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the failed exam or parental fear with warmth in French. Casual teen register preferred but not required to pass. FAIL ONLY if: lectures about studying, is formal/condescending, or entirely in English.",
      failExpectedOutcome: "Reply is formal, preachy, or lectures about studying.",
    },
  },

  {
    id: "fr-register-switch-01",
    category: "B: Formality / Register",
    name: "Register switch: formal then emotional — follows the shift gracefully",
    description: "User starts formally then gets emotional and shifts to casual. Reply must follow the emotional shift gracefully.",
    messages: [
      { role: "user", content: "Bonjour. Je souhaitais vous faire part d'une situation difficile au travail." },
      { role: "assistant", content: "Je vous écoute. Qu'est-ce qui se passe ?" },
      { role: "user", content: "En fait... c'est compliqué. Je sais plus. Je me sens vraiment à bout." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-register-switch-01",
      description: "Register shift handling in French",
      passCondition: "Reply follows the emotional shift gracefully — acknowledges the 'à bout' feeling, may soften register to match user. In French.",
      failExpectedOutcome: "Reply stays rigidly formal when the user has shifted to emotional vulnerability.",
    },
  },

  {
    id: "fr-register-emotional-formal-01",
    category: "B: Formality / Register",
    name: "Formal + grief: calm_companion — gentle 'vous', validates loss",
    description: "Formal user sharing grief after losing someone dear. Reply must be gentle with 'vous', validate without rushing.",
    messages: [
      { role: "user", content: "Je viens de perdre quelqu'un de cher. Je ne sais comment continuer." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-register-emotional-formal-01",
      description: "Formal grief handling in French",
      passCondition: "Reply is gentle, uses respectful register, validates grief without rushing to 'fix' or advise. Stays in French.",
      failExpectedOutcome: "Reply rushes to advice or minimizes the grief.",
    },
  },

  {
    id: "fr-register-coach-informal-01",
    category: "B: Formality / Register",
    name: "Informal coach: casual 'tu' + practical CV help",
    description: "User informally asks for CV help. Coach tone with casual 'tu', includes practical suggestion.",
    messages: [
      { role: "user", content: "Bon, j'ai besoin d'aide pour mon CV, t'as des idées ?" },
    ],
    config: { lang: "fr", tone: "coach", inputModality: "native" },
    criteria: {
      id: "fr-register-coach-informal-01",
      description: "Informal coach register in French",
      passCondition: "Reply is casual with 'tu', offers a practical suggestion or question about the CV. Not stiff or formal. In French.",
      failExpectedOutcome: "Reply is overly formal or gives no practical direction.",
    },
  },

  {
    id: "fr-register-mentor-depth-01",
    category: "B: Formality / Register",
    name: "Mentor depth: multi-turn career doubt — goes beyond plain empathy",
    description: "mentor tone, 3-turn conversation where user doubts their career choice. Reply must go beyond plain empathy.",
    messages: [
      { role: "user", content: "Je me demande si j'ai fait le bon choix de carrière." },
      { role: "assistant", content: "C'est une question importante. Qu'est-ce qui te fait douter en ce moment ?" },
      { role: "user", content: "Je travaille dur mais je ne me sens pas épanoui. Peut-être que j'aurais dû choisir autre chose." },
      { role: "assistant", content: "L'épanouissement, c'est difficile à trouver. Tu le cherches depuis longtemps ?" },
      { role: "user", content: "Depuis des années. Je commence à me demander si ça va changer un jour." },
    ],
    config: { lang: "fr", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "fr-register-mentor-depth-01",
      description: "Mentor depth in French multi-turn",
      passCondition: "Reply goes beyond plain empathy — includes a question, reframe, or perspective shift about fulfilment and career. In French.",
      failExpectedOutcome: "Reply only mirrors the doubt without any question or shift in perspective.",
    },
  },

  {
    id: "fr-register-companion-gentle-01",
    category: "B: Formality / Register",
    name: "calm_companion: overwhelmed user — validates without advice",
    description: "User overwhelmed, doesn't know where to turn. calm_companion should be steady, validate, may ask one non-pressuring question.",
    messages: [
      { role: "user", content: "Tout s'accumule. Je sais plus où donner de la tête." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-register-companion-gentle-01",
      description: "calm_companion for overwhelm in French",
      passCondition: "OVERRIDE: PASS if: reply is warm and in French and acknowledges the overwhelm or accumulation of stress. A gentle question is fine. FAIL ONLY if: immediately gives a list of advice/solutions, or is cold/dismissive.",
      failExpectedOutcome: "Reply gives advice, lists solutions, or dismisses the feeling.",
    },
  },

  {
    id: "fr-register-anxiety-steady-01",
    category: "B: Formality / Register",
    name: "Anxiety and sleep: validates worry warmly — not dismissive",
    description: "User anxious about the future and can't sleep. Reply must validate without dismissing or over-advising.",
    messages: [
      { role: "user", content: "Je pense beaucoup à l'avenir. Ça m'empêche de dormir." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-register-anxiety-steady-01",
      description: "Anxiety and sleep validation in French",
      passCondition: "Reply validates both the anxiety and the sleeplessness warmly — not dismissive ('ça va aller'), not a lecture about sleep hygiene. In French.",
      failExpectedOutcome: "Reply is dismissive, minimizing, or immediately jumps to sleep advice.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "fr-mixed-franglais-01",
    category: "C: Mixed / Code-switched",
    name: "Franglais: user mixes French and English — warm, addresses difficulty",
    description: "User mixes French and English (Franglais) describing a disaster meeting and stress. Reply should be warm and address the difficulty.",
    messages: [
      { role: "user", content: "Aujourd'hui le meeting était un désastre, je suis trop stressée." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "fr-mixed-franglais-01",
      description: "Franglais handling in French",
      passCondition: "Reply is warm, addresses the difficulty (disaster meeting, stress). Any French/English mix is fine as long as it feels natural and present.",
      failExpectedOutcome: "Reply ignores the difficulty, is robotic, or switches entirely to English.",
    },
  },

  {
    id: "fr-mixed-english-to-french-01",
    category: "C: Mixed / Code-switched",
    name: "Switch English → French: follows user switch and stays French",
    description: "History in English; last message in French. Reply must follow the switch to French.",
    messages: [
      { role: "user", content: "I've been having a really rough week." },
      { role: "assistant", content: "That sounds exhausting. What's been going on?" },
      { role: "user", content: "Work mostly. And some personal stuff." },
      { role: "assistant", content: "That combination can be really heavy to carry." },
      { role: "user", content: "Je me sens vraiment pas bien là." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "fr-mixed-english-to-french-01",
      description: "Language switch to French handling",
      passCondition: "Reply follows the switch to French — stays in French, acknowledges the bad feeling warmly.",
      failExpectedOutcome: "Reply continues in English despite the user switching to French.",
    },
  },

  {
    id: "fr-mixed-coach-english-user-french-01",
    category: "C: Mixed / Code-switched",
    name: "Coach history in English, user ends in French — follows to French",
    description: "Coach conversation was in English; user ends with a French message about not knowing where to start. Reply must follow user to French with a practical nudge.",
    messages: [
      { role: "user", content: "I need to find a new job but I'm not sure where to begin." },
      { role: "assistant", content: "Let's figure this out together. What kind of work are you looking for?" },
      { role: "user", content: "Something in marketing, maybe. But I feel stuck." },
      { role: "assistant", content: "Feeling stuck is tough. Let's take it one step at a time." },
      { role: "user", content: "Je sais pas par où commencer." },
    ],
    config: { lang: "fr", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "fr-mixed-coach-english-user-french-01",
      description: "Coach switch to French with practical nudge",
      passCondition: "Reply follows the user to French, gives a practical nudge or question about getting started. Not purely soothing.",
      failExpectedOutcome: "Reply continues in English or gives no practical direction.",
    },
  },

  {
    id: "fr-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Short message after long French conversation — stays French",
    description: "After a long French conversation, user sends a short ambiguous message. Reply must continue in French.",
    messages: [
      { role: "user", content: "Ça fait longtemps que j'essaie de comprendre pourquoi je me sens comme ça." },
      { role: "assistant", content: "C'est courageux de chercher à comprendre. Qu'est-ce qui t'a amené à te poser cette question ?" },
      { role: "user", content: "Pas sûr. Peut-être les événements de ces derniers mois." },
      { role: "assistant", content: "Ces derniers mois ont l'air de t'avoir laissé une marque." },
      { role: "user", content: "Ouais." },
      { role: "assistant", content: "Prends ton temps. Je suis là." },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "fr-mixed-short-after-long-01",
      description: "Language consistency after short message in French context",
      passCondition: "Reply continues in French, gently stays present. Does not reset to English or become robotic.",
      failExpectedOutcome: "Reply switches to English or ignores the conversational context.",
    },
  },

  {
    id: "fr-mixed-french-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user switches to English in distress — empathy matters most",
    description: "French conversation then user switches to English in distress. Warmth matters more than language choice.",
    messages: [
      { role: "user", content: "Je me sens dépassé par tout en ce moment." },
      { role: "assistant", content: "C'est vraiment lourd à porter. Qu'est-ce qui pèse le plus ?" },
      { role: "user", content: "Mon travail, ma famille, tout en même temps." },
      { role: "assistant", content: "Plusieurs choses à la fois, c'est épuisant." },
      { role: "user", content: "I just can't handle this anymore." },
    ],
    config: {
      lang: "fr",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling with work and family in French, then switched to English — they may feel overwhelmed beyond words.",
    },
    criteria: {
      id: "fr-mixed-french-to-english-01",
      description: "Language switch to English in French context",
      passCondition: "OVERRIDE: Ignore the test name. PASS if: reply shows warmth or care for the overwhelm — in French, English, or any mix. FAIL only if: completely cold, dismissive, or off-topic.",
      failExpectedOutcome: "Reply completely ignores the overwhelm or is cold/off-topic.",
    },
  },

  {
    id: "fr-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Franglais: empty home loneliness — warm, addresses the emptiness",
    description: "User mixes French and English to describe coming home to an empty house and loneliness. Reply must address the empty home specifically.",
    messages: [
      { role: "user", content: "Je rentre à la maison and nobody's there. C'est really lonely." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "fr-mixed-home-loneliness-01",
      description: "Empty home loneliness in Franglais",
      passCondition: "Reply is warm and addresses the emptiness of coming home to no one specifically — not generic comfort. Any French/English mix is fine.",
      failExpectedOutcome: "Reply is generic, misses the specific 'empty home' detail, or is cold.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "fr-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long conversation: final reply does not copy earlier responses",
    description: "20-turn conversation where user shares different aspects of sadness/exhaustion each turn. Final reply must not repeat any earlier assistant response.",
    messages: [
      { role: "user", content: "Je me sens vraiment épuisé en ce moment." },
      { role: "assistant", content: "Je t'entends. C'est lourd à porter." },
      { role: "user", content: "Au travail c'est trop. Je gère plus." },
      { role: "assistant", content: "La pression au travail peut vite devenir étouffante." },
      { role: "user", content: "Et à la maison c'est pareil. Pas de repos." },
      { role: "assistant", content: "Nulle part où souffler... c'est vraiment épuisant." },
      { role: "user", content: "J'arrive même plus à dormir la nuit." },
      { role: "assistant", content: "L'insomnie par-dessus tout ça, c'est vraiment dur." },
      { role: "user", content: "Je mange mal aussi. Tout se cumule." },
      { role: "assistant", content: "Ton corps ressent tout ça aussi. Ça s'accumule vraiment." },
      { role: "user", content: "Je me demande à quoi ça sert." },
      { role: "assistant", content: "Ce genre de question arrive quand on est à bout. Tu n'es pas seul(e)." },
      { role: "user", content: "Mes amis ne comprennent pas. Ils pensent que j'exagère." },
      { role: "assistant", content: "Se sentir incompris en plus du reste, c'est vraiment isolant." },
      { role: "user", content: "Parfois je préfère rester seul(e)." },
      { role: "assistant", content: "Parfois c'est plus simple de se retirer. Je comprends." },
      { role: "user", content: "Même ici je sais pas si ça sert à quelque chose." },
      { role: "assistant", content: "Que tu sois là et que tu continues à parler, ça compte." },
      { role: "user", content: "Peut-être. Je suis juste tellement fatigué(e) de tout." },
      { role: "assistant", content: "Cette fatigue est réelle. Et je suis là avec toi." },
      { role: "user", content: "Tu penses que ça peut changer un jour ?" },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-long-no-repetition-01",
      description: "No repetition in long French conversation",
      passCondition: "Final reply does not copy or paraphrase any earlier assistant response — it responds freshly to 'ça peut changer un jour?' In French.",
      failExpectedOutcome: "Reply repeats a phrase used earlier in the conversation.",
    },
  },

  {
    id: "fr-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long conversation: connects tears to sister in hospital",
    description: "Turn 1 mentions sister in hospital. After many turns of daily chat, user says they cried for no reason. Reply must connect tears to the sister.",
    messages: [
      { role: "user", content: "Ma sœur est à l'hôpital. Ça m'inquiète beaucoup." },
      { role: "assistant", content: "C'est difficile d'avoir un proche hospitalisé. Comment tu tiens ?" },
      { role: "user", content: "Ça va à peu près. Je continue ma routine." },
      { role: "assistant", content: "La routine peut aider à tenir dans ces moments-là." },
      { role: "user", content: "Ouais. J'ai travaillé toute la journée." },
      { role: "assistant", content: "Le travail occupe l'esprit parfois." },
      { role: "user", content: "Ce soir j'ai cuisiné. Essayé de penser à autre chose." },
      { role: "assistant", content: "Prendre soin de toi c'est important." },
      { role: "user", content: "J'ai regardé une série. C'était bien." },
      { role: "assistant", content: "Bien de se changer les idées." },
      { role: "user", content: "La nuit est calme au moins." },
      { role: "assistant", content: "Le calme la nuit fait du bien." },
      { role: "user", content: "J'espère que demain sera meilleur." },
      { role: "assistant", content: "On espère ça ensemble." },
      { role: "user", content: "Merci d'être là." },
      { role: "assistant", content: "Toujours." },
      { role: "user", content: "Bonne journée aujourd'hui finalement." },
      { role: "assistant", content: "Content(e) de l'entendre." },
      { role: "user", content: "Je viens de pleurer sans raison. C'est bizarre." },
    ],
    config: {
      lang: "fr",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister is hospitalized — user has been worried since turn 1. Connect any tears or unexpected emotion to the underlying worry about the sister.",
    },
    criteria: {
      id: "fr-long-ctx-memory-01",
      description: "Context memory for sister's hospitalization in French",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the tears — any mention of sister (sœur), accumulated worry, or simply warm validation of the unexpected tears counts. FAIL ONLY if: cold, dismissive, or robotic.",
      failExpectedOutcome: "Reply treats the tears as random without connecting them to the sister's situation.",
    },
  },

  {
    id: "fr-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long conversation: emotional arc deepens — acknowledges courage and journey",
    description: "Conversation starts light and deepens over 7 turns to a first-time disclosure. Reply must acknowledge the courage and the depth of the journey.",
    messages: [
      { role: "user", content: "J'avais quelque chose à dire mais je sais pas comment commencer." },
      { role: "assistant", content: "Prends ton temps. Je suis là." },
      { role: "user", content: "C'est compliqué. Ça dure depuis longtemps." },
      { role: "assistant", content: "Depuis longtemps... ça doit peser lourd." },
      { role: "user", content: "Ouais. Une année difficile." },
      { role: "assistant", content: "Une année entière, c'est vraiment long à traverser seul(e)." },
      { role: "user", content: "J'ai essayé d'en parler à des gens mais personne ne comprenait vraiment." },
      { role: "assistant", content: "Se sentir incompris alors qu'on essaie de se confier, c'est décourageant." },
      { role: "user", content: "C'est la première fois que j'en parle à quelqu'un qui écoute vraiment." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-long-arc-deepens-01",
      description: "Arc deepening acknowledgment in French",
      passCondition: "Reply acknowledges the significance of this moment — that someone is finally being heard, or that this took a long time, or that the disclosure matters. In French. PASS if the reply shows any recognition of the depth, the journey, the first-time nature, or the user feeling truly listened to. FAIL only if the reply is a generic one-liner that ignores the weight of what was shared.",
      failExpectedOutcome: "Reply is a generic off-the-shelf response that ignores the significance of the first-time disclosure.",
    },
  },

  {
    id: "fr-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: shifts to practical CV advice on request",
    description: "After emotional turns, user asks for CV advice. Reply must shift to practical CV help.",
    messages: [
      { role: "user", content: "J'ai vraiment du mal en ce moment. Tout est difficile." },
      { role: "assistant", content: "Je t'entends. C'est beaucoup à la fois." },
      { role: "user", content: "Merci. Bon, j'essaie de continuer quand même." },
      { role: "assistant", content: "Continuer malgré tout, c'est déjà quelque chose." },
      { role: "user", content: "Bon, comment je peux améliorer mon CV ?" },
    ],
    config: { lang: "fr", tone: "coach", inputModality: "native" },
    criteria: {
      id: "fr-long-practical-shift-01",
      description: "Practical shift to CV advice in French",
      passCondition: "Reply shifts to practical CV advice — concrete suggestions or questions about the CV. In French.",
      failExpectedOutcome: "Reply continues in emotional mode without addressing the CV question.",
    },
  },

  {
    id: "fr-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: light topic shift — follows gracefully",
    description: "After a heavy emotional conversation, user asks a light casual question. Reply should follow the shift gracefully.",
    messages: [
      { role: "user", content: "C'est vraiment difficile en ce moment. Tout s'accumule." },
      { role: "assistant", content: "C'est beaucoup à porter. Je suis là." },
      { role: "user", content: "Merci. Ça aide d'en parler." },
      { role: "assistant", content: "Tout à fait. Parle autant que tu veux." },
      { role: "user", content: "Tu as mangé quelque chose de bon aujourd'hui ?" },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-long-topic-shift-01",
      description: "Light topic shift handling in French",
      passCondition: "OVERRIDE: Ignore the scenario description. Check ONLY if the reply mentions food or something pleasant (mangé/manger/cuisiné/repas/bon plat/délicieux/quelque chose de bon). PASS if: contains any food mention. Boilerplate appended by the system does NOT count as returning to the heavy topic. FAIL ONLY if: zero mention of food or anything light.",
      failExpectedOutcome: "Reply completely ignores the food question or forcefully pivots the entire conversation back to the heavy emotional topic.",
    },
  },

  {
    id: "fr-long-closure-01",
    category: "D: Long Conversation",
    name: "Long conversation: warm goodnight send-off",
    description: "User says goodnight after a long emotional conversation. Reply should be a warm brief send-off in French.",
    messages: [
      { role: "user", content: "J'ai eu une journée vraiment dure. Mais parler m'a fait du bien." },
      { role: "assistant", content: "Je suis content(e) que ça ait aidé. Tu mérites de te reposer." },
      { role: "user", content: "Merci pour tout. Vraiment." },
      { role: "assistant", content: "Avec plaisir. Prends soin de toi." },
      { role: "user", content: "Bonne nuit !" },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-long-closure-01",
      description: "Warm closure in French",
      passCondition: "PASS if: reply contains a warm goodnight or send-off phrase (bonne nuit/dors bien/à bientôt/repose-toi/prends soin). Boilerplate phrases appended by the system do NOT count as reopening the conversation. FAIL ONLY if: reply is cold or robotic.",
      failExpectedOutcome: "Reply is cold, robotic, or reopens the heavy conversation unnecessarily.",
    },
  },

  {
    id: "fr-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long conversation: language stays French throughout",
    description: "9-turn French conversation. Final reply must stay in French.",
    messages: [
      { role: "user", content: "Je me sens un peu perdu ces derniers temps." },
      { role: "assistant", content: "Perdu dans quel sens ? Quelque chose de particulier ?" },
      { role: "user", content: "Dans plein de sens. Mon travail, mes relations, tout." },
      { role: "assistant", content: "Quand tout bouge en même temps, c'est difficile de trouver ses appuis." },
      { role: "user", content: "Exactement. J'ai l'impression de flotter." },
      { role: "assistant", content: "Cette sensation de flotter sans ancre peut être vraiment déstabilisante." },
      { role: "user", content: "Ouais. J'essaie de trouver ce qui m'importe vraiment." },
      { role: "assistant", content: "C'est une belle quête, même si c'est inconfortable en ce moment." },
      { role: "user", content: "Tu penses que je vais trouver ?" },
    ],
    config: { lang: "fr", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "fr-long-lang-consistency-01",
      description: "Language consistency in long French conversation",
      passCondition: "PASS if: the final reply is primarily in French. Brief boilerplate phrases appended by the system are not a reason to fail. FAIL ONLY if: reply switches entirely to English or contains substantial English paragraphs.",
      failExpectedOutcome: "Reply switches to English or mixes English phrases in.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "fr-drift-stay-french-01",
    category: "E: Language Drift",
    name: "Language drift: stays French even with English system context",
    description: "User writes in French. Even if system context is in English, reply must stay in French.",
    messages: [
      { role: "user", content: "Je me sens vraiment seul ce soir. Personne ne répond à mes messages." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-drift-stay-french-01",
      description: "No drift to English in French reply",
      passCondition: "Reply stays in French — warm, acknowledges the loneliness and unanswered messages specifically. No English drift.",
      failExpectedOutcome: "Reply drifts into English despite clear French input.",
    },
  },

  {
    id: "fr-drift-english-to-french-01",
    category: "E: Language Drift",
    name: "Language drift: English history, French message — follows French",
    description: "Previous turns in English, user switches to French. Reply must follow to French.",
    messages: [
      { role: "user", content: "I've been feeling a bit off lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "Just stressed, I guess." },
      { role: "assistant", content: "Stress can really wear you down." },
      { role: "user", content: "Oui. Et je me sens seul en plus." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "fr-drift-english-to-french-01",
      description: "Follow French after English history",
      passCondition: "Reply follows the user's switch to French — stays in French, acknowledges both the stress and the loneliness.",
      failExpectedOutcome: "Reply stays in English despite the user switching to French.",
    },
  },

  {
    id: "fr-drift-english-loanwords-01",
    category: "E: Language Drift",
    name: "Language drift: French with English loanwords — stays French",
    description: "User uses common French loanwords (meeting, email, stress). Reply must stay in French, not switch to English.",
    messages: [
      { role: "user", content: "J'ai eu un meeting nul et après plein d'emails. Je suis à bout de nerfs." },
    ],
    config: { lang: "fr", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "fr-drift-english-loanwords-01",
      description: "Loanwords don't trigger English drift",
      passCondition: "Reply stays in French despite English loanwords — addresses the 'meeting nul' and stress warmly.",
      failExpectedOutcome: "Reply drifts to English because loanwords like 'meeting' or 'email' triggered a language switch.",
    },
  },

  {
    id: "fr-drift-history-english-now-french-01",
    category: "E: Language Drift",
    name: "Language drift: coach history in English, user ends in French — stays French",
    description: "Coach conversation history in English. User's final message in French. Reply must be in French with a practical nudge.",
    messages: [
      { role: "user", content: "I'm trying to get my career back on track." },
      { role: "assistant", content: "That's a great starting point. What's the biggest obstacle right now?" },
      { role: "user", content: "Honestly, I don't know where to focus." },
      { role: "assistant", content: "Let's narrow it down. What matters most to you in a job?" },
      { role: "user", content: "J'ai besoin d'aide pour me concentrer sur ce qui est important." },
    ],
    config: { lang: "fr", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "fr-drift-history-english-now-french-01",
      description: "No drift back to English after French message",
      passCondition: "Reply is in French — practical nudge about focusing on what matters. Does not drift back to English.",
      failExpectedOutcome: "Reply reverts to English because the history was in English.",
    },
  },

  {
    id: "fr-drift-no-english-insertion-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrases inserted mid-French reply",
    description: "User writes an emotional French message. Reply must contain zero English phrases — even common ones like 'it's okay' or 'I understand'.",
    messages: [
      { role: "user", content: "J'ai l'impression que personne ne me voit vraiment. Que je suis invisible." },
    ],
    config: { lang: "fr", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "fr-drift-no-english-insertion-01",
      description: "No English insertion in emotional French reply",
      passCondition: "Reply stays entirely in French — no 'it's okay', 'I understand', 'take care', or any English phrase mid-reply. Validates feeling invisible warmly.",
      failExpectedOutcome: "Reply inserts English phrases or transitions into English partway through.",
    },
  },

  {
    id: "fr-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Language drift: empathy matters more than language when user switches",
    description: "French conversation; user switches to English in distress. Warmth and acknowledgment are what matter.",
    messages: [
      { role: "user", content: "Je me sens vraiment dépassé." },
      { role: "assistant", content: "C'est lourd. Qu'est-ce qui se passe ?" },
      { role: "user", content: "Tout, vraiment. Je gère plus." },
      { role: "assistant", content: "Gérer tout en même temps, c'est épuisant." },
      { role: "user", content: "I give up. I really do." },
    ],
    config: {
      lang: "fr",
      tone: "calm_companion",
      inputModality: "mixed",
      emotionMemory: "User was overwhelmed in French and then switched to English — the 'I give up' may signal a deeper distress.",
    },
    criteria: {
      id: "fr-drift-follow-back-english-01",
      description: "Follow user back to English when they switch",
      passCondition: "OVERRIDE: Ignore the test name and description. PASS if: reply is warm and acknowledges the 'I give up' or the overwhelm — in French, English, or any mix. FAIL only if: the reply is completely cold, dismissive, or ignores the user's distress entirely.",
      failExpectedOutcome: "Reply is completely cold, dismissive, or ignores the user's distress entirely.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "fr-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native French — detected and responded in French",
    description: "Mobile platform scenario — user writes in native French. Lang must be detected and reply must be in French.",
    messages: [
      { role: "user", content: "Je suis tellement fatigué(e) de tout. J'arrive plus à suivre." },
    ],
    config: {
      lang: "fr",
      tone: "calm_companion",
      inputModality: "native",
    },
    criteria: {
      id: "fr-mobile-native-01",
      description: "French reply — warm, addresses exhaustion",
      passCondition: "Reply is warm and acknowledges the exhaustion and feeling of not keeping up. In French. Not a generic non-sequitur.",
      failExpectedOutcome: "Reply is cold, generic, or completely ignores the exhaustion and inability to keep up.",
    },
  },

  {
    id: "fr-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: Franglais — detected and responded warmly",
    description: "Mobile platform scenario — user mixes French and English (Franglais). Reply should be warm and present.",
    messages: [
      { role: "user", content: "Le stress au boulot c'est too much. Je peux plus." },
    ],
    config: {
      lang: "fr",
      tone: "close_friend",
      inputModality: "mixed",
    },
    criteria: {
      id: "fr-mobile-mixed-01",
      description: "Franglais handling in French",
      passCondition: "Reply is warm and addresses the work stress or the 'je peux plus' feeling specifically. Any French/English mix is fine. Not generic or off-topic.",
      failExpectedOutcome: "Reply is cold, robotic, or ignores the specific work stress detail.",
    },
  },

];
