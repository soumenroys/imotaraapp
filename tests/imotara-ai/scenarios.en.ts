/**
 * tests/imotara-ai/scenarios.en.ts
 *
 * All 14 English test scenarios covering:
 *  1.  Language integrity — reply must be in English
 *  2.  Context relevance — reply must address the specific situation
 *  3.  Tone matching — reply must match the configured tone
 *  4.  Age adaptation — vocabulary must suit user age group
 *  5.  Gender handling — no incorrect gender assumptions in English
 *  6.  Verb correctness — grammatically correct verb usage
 *  7.  Language mirroring — user wrote English → reply stays English
 *  8.  Relationship vibe — reply must reflect the chosen vibe
 *  9.  Emotion acknowledgment — reply must match the emotional content
 *  10. Response style — reply follows the chosen response style
 *  11. Emotion calibration — correct empathy level for emotion intensity
 *  12. Long conversation quality — no repetition after 8+ turns
 *  13. Long conversation context — references earlier details
 *  14. Companion memory — remembers user-shared facts from earlier turns
 */

import type { TestScenario, ChatMessage } from "./types";

// ─── Helper ────────────────────────────────────────────────────────────────
function user(content: string): ChatMessage {
  return { role: "user", content };
}
function assistant(content: string): ChatMessage {
  return { role: "assistant", content };
}

// ─── Scenarios ─────────────────────────────────────────────────────────────

export const scenarios: TestScenario[] = [

  // ── 1. Language integrity ─────────────────────────────────────────────────
  {
    id: "en-lang-01",
    category: "Language",
    name: "Reply must be in English",
    description: "User writes in English. Imotara must reply entirely in English.",
    messages: [user("I've been feeling really lonely lately and I don't know why.")],
    config: { tone: "close_friend", lang: "en" },
    criteria: {
      id: "lang-integrity",
      description: "Response is entirely in English — no foreign script or foreign words.",
      passCondition: "Every sentence is in English. No Devanagari, Bengali, Arabic, CJK, Cyrillic, or other non-Latin script appears.",
      failExpectedOutcome: "Expected: Reply entirely in English. If other scripts appear, Imotara is mixing languages incorrectly. Fix: check lang normalization and system prompt language instruction.",
    },
  },

  // ── 2. Context relevance ──────────────────────────────────────────────────
  {
    id: "en-ctx-01",
    category: "Context",
    name: "Reply must address the specific situation",
    description: "User shares a specific situation (dog died). Reply must acknowledge it specifically.",
    messages: [user("My dog Max passed away yesterday after 12 years. I feel devastated.")],
    config: { tone: "close_friend", lang: "en", emotion: "sad" },
    criteria: {
      id: "context-specific",
      description: "Reply references the dog, the loss, or the 12-year bond — not a generic grief response.",
      passCondition: "Reply mentions 'Max', 'dog', 'loss', '12 years', or uses wording that clearly reflects the pet-loss context. Does not give generic 'I'm sorry for your loss' without any specificity.",
      failExpectedOutcome: "Expected: Specific acknowledgment of Max and the 12-year bond. If generic, Imotara is not picking up context. Fix: improve conversation context injection in system prompt.",
    },
  },

  // ── 3. Tone — close_friend ────────────────────────────────────────────────
  {
    id: "en-tone-friend-01",
    category: "Tone",
    name: "close_friend tone: casual and warm",
    description: "Tone set to close_friend. Reply should feel like a warm, peer-level conversation.",
    messages: [user("I'm so stressed about my work presentation tomorrow. I feel unprepared.")],
    config: { tone: "close_friend", lang: "en" },
    criteria: {
      id: "tone-close-friend",
      description: "Reply is casual, warm, uses peer-level language (not clinical or formal).",
      passCondition: "Reply uses casual language, shows genuine warmth, feels like a friend talking — not a professional or therapist. No stiff phrases like 'I understand your concerns'.",
      failExpectedOutcome: "Expected: Casual, warm peer-level support like 'That sounds nerve-wracking — what feels most shaky right now?' If too formal/clinical, fix tone prompt injection.",
    },
  },

  // ── 3b. Tone — coach ──────────────────────────────────────────────────────
  {
    id: "en-tone-coach-01",
    category: "Tone",
    name: "coach tone: practical and action-oriented",
    description: "Tone set to coach. Reply should be practical, forward-looking, action-oriented.",
    messages: [user("I'm stressed about my work presentation tomorrow. I feel unprepared.")],
    config: { tone: "coach", lang: "en" },
    criteria: {
      id: "tone-coach",
      description: "Reply is practical, offers a concrete action or next step, not just comfort.",
      passCondition: "Reply includes a concrete suggestion, question about next action, or small practical step. Sounds energetic and focused, not overly soothing.",
      failExpectedOutcome: "Expected: Something like 'Okay, let's make a quick plan — what's the one part of the presentation that feels most uncertain?' If too soothing/passive, fix coach tone mapping.",
    },
  },

  // ── 3c. Tone — calm_companion ─────────────────────────────────────────────
  {
    id: "en-tone-calm-01",
    category: "Tone",
    name: "calm_companion tone: patient and unhurried",
    description: "Tone set to calm_companion. Reply should be soft, patient, never rushing.",
    messages: [user("Everything feels like too much lately. I'm exhausted.")],
    config: { tone: "calm_companion", lang: "en" },
    criteria: {
      id: "tone-calm",
      description: "Reply is soft, patient, unhurried. No pushing action. Gentle presence.",
      passCondition: "Reply is calming and slow-paced. No urgency. Uses phrases like 'no rush', 'take your time', or equivalent. No action items pushed.",
      failExpectedOutcome: "Expected: Soft, patient response like 'That kind of exhaustion runs deep. No rush — just take one breath.' If feels pushy or energetic, fix calm_companion tone mapping.",
    },
  },

  // ── 3d. Tone — mentor ─────────────────────────────────────────────────────
  {
    id: "en-tone-mentor-01",
    category: "Tone",
    name: "mentor tone: wise and reflective",
    description: "Tone set to mentor. Reply should be wise, help user find their own answers.",
    messages: [user("I don't know what to do with my career. I feel stuck and unclear.")],
    config: { tone: "mentor", lang: "en" },
    criteria: {
      id: "tone-mentor",
      description: "Reply is wise and thoughtful, asks a reflective question, doesn't give direct advice.",
      passCondition: "Reply guides the user toward self-discovery. Asks a deeper question rather than prescribing a solution. Feels wise and considered, not casual.",
      failExpectedOutcome: "Expected: Something like 'When you imagine feeling unstuck, what does that look like for you?' If giving direct advice, fix mentor tone mapping.",
    },
  },

  // ── 4. Age — teen ────────────────────────────────────────────────────────
  {
    id: "en-age-teen-01",
    category: "Age",
    name: "Teen user (13–17): peer-level, no adult idioms",
    description: "User is 13–17. Reply should be relatable, not patronizing.",
    messages: [user("School is so overwhelming. There's too much homework and I just can't cope.")],
    config: { tone: "close_friend", lang: "en", userAge: "13_17" },
    criteria: {
      id: "age-teen",
      description: "Reply uses teen-friendly language. No adult idioms like 'leveraging your strengths' or clinical terms.",
      passCondition: "Reply is simple, relatable, peer-supportive. No jargon. No parental tone ('you should', 'make sure you'). Empathetic and age-appropriate.",
      failExpectedOutcome: "Expected: Reply like 'That sounds so overwhelming — homework piling up with no break is genuinely hard.' If condescending or adult-speak, fix userAge=13_17 prompt hint.",
    },
  },

  // ── 4b. Age — 65+ ────────────────────────────────────────────────────────
  {
    id: "en-age-elder-01",
    category: "Age",
    name: "Older adult (65+): warm and unhurried",
    description: "User is 65+. Reply should use respectful, warm, unhurried language.",
    messages: [user("I feel lonely since my children moved to another city. The house feels very quiet.")],
    config: { tone: "calm_companion", lang: "en", userAge: "65_plus" },
    criteria: {
      id: "age-elder",
      description: "Reply is respectful, warm, patient. No rushed phrasing or slang.",
      passCondition: "Reply uses warm, unhurried language. Acknowledges loneliness without minimizing. No slang, no urgency. Feels respectful and genuinely present.",
      failExpectedOutcome: "Expected: Something warm and slow like 'That quiet after so many years of noise — it carries its own weight. What do the days feel like now?' If too casual or rushed, fix userAge=65_plus hint.",
    },
  },

  // ── 5. Gender — female user ───────────────────────────────────────────────
  {
    id: "en-gender-female-01",
    category: "Gender",
    name: "Female user: no wrong gender assumptions",
    description: "User gender is female. Imotara must not use wrong pronouns or make male assumptions.",
    messages: [user("I got the promotion I've been working towards for a year. I feel proud but also nervous.")],
    config: { tone: "close_friend", lang: "en", userGender: "female" },
    criteria: {
      id: "gender-female",
      description: "Reply treats user as female (or gender-neutral). No 'he', 'him', 'his' for the user.",
      passCondition: "Reply uses 'you' consistently. If any pronoun is used for the user, it must be 'she/her' or neutral 'you'. No male pronoun slippage.",
      failExpectedOutcome: "Expected: Reply addresses user as 'you' without male pronoun assumption. If 'he/him' appears for user, fix gender injection in system prompt.",
    },
  },

  // ── 6. Verb correctness ───────────────────────────────────────────────────
  {
    id: "en-verb-01",
    category: "Verb Forms",
    name: "Grammatically correct verb usage in English",
    description: "Imotara reply must be grammatically correct — no subject-verb disagreement.",
    messages: [user("I've been feeling so anxious about everything. My heart races for no reason.")],
    config: { tone: "close_friend", lang: "en" },
    criteria: {
      id: "verb-correctness",
      description: "No obvious grammatical errors in verb usage (I/you/they agreement).",
      passCondition: "All verbs agree with their subjects. No 'you is', 'they was', 'I are' type errors. Natural English grammar throughout.",
      failExpectedOutcome: "Expected: Grammatically clean English. If verb errors appear, check that the AI model is producing clean output and the formatter isn't corrupting sentences.",
    },
  },

  // ── 7. Language mirroring ────────────────────────────────────────────────
  {
    id: "en-lang-mirror-01",
    category: "Language Mirroring",
    name: "English in → English out (no code-switching)",
    description: "User writes in English. Imotara must not code-switch to another language.",
    messages: [user("I feel so sad today and I don't know what to do about it.")],
    config: { lang: "en", tone: "close_friend" },
    criteria: {
      id: "language-mirror",
      description: "Reply stays entirely in English. No mid-sentence switch to another language.",
      passCondition: "100% English output. No words from Hindi, Bengali, Spanish, or any other language unless it is a common English loanword.",
      failExpectedOutcome: "Expected: Pure English reply. If code-switching occurs, the lang normalization or system prompt language instruction is broken.",
    },
  },

  // ── 8. Relationship vibe — mentor ─────────────────────────────────────────
  {
    id: "en-vibe-mentor-01",
    category: "Relationship Vibe",
    name: "Mentor vibe: guides, doesn't prescribe",
    description: "Companion relationship is 'mentor'. Reply should guide, not dictate.",
    messages: [user("I feel like I always make the wrong decisions. I second-guess everything.")],
    config: {
      tone: "mentor",
      lang: "en",
    },
    criteria: {
      id: "vibe-mentor",
      description: "Reply invites reflection, not prescription. Asks a wise question rather than telling the user what to do.",
      passCondition: "Reply helps user reflect on their own decision-making. Asks something like 'What would trusting yourself look like in the smallest way today?' rather than 'You should do X'.",
      failExpectedOutcome: "Expected: Reflective, wisdom-offering reply. If Imotara prescribes actions directly, fix mentor relationship vibe.",
    },
  },

  // ── 9. Emotion acknowledgment — anxiety ───────────────────────────────────
  {
    id: "en-emotion-anxiety-01",
    category: "Emotion",
    name: "Anxiety: must acknowledge and validate anxiety specifically",
    description: "User is anxious. Reply must acknowledge anxiety specifically, not generically.",
    messages: [user("I have this constant anxious feeling, like something bad is about to happen. It won't stop.")],
    config: { tone: "close_friend", lang: "en", emotion: "anxious" },
    criteria: {
      id: "emotion-anxiety",
      description: "Reply specifically acknowledges the anxious feeling and the anticipatory nature of it.",
      passCondition: "Reply validates anxiety or the 'something bad' dread specifically. Uses words like 'anxious', 'dread', 'anticipation', 'nervous system', or equivalent. Does not treat it as general sadness.",
      failExpectedOutcome: "Expected: Something like 'That anticipatory dread — like your mind is on alert even when nothing's happened yet — is one of the hardest things.' If generic, fix emotion hint injection.",
    },
  },

  // ── 10. Response style — reflect ─────────────────────────────────────────
  {
    id: "en-style-reflect-01",
    category: "Response Style",
    name: "Reflect style: ask gentle questions, don't push solutions",
    description: "Response style set to 'reflect'. Reply should ask reflective questions.",
    messages: [user("Everything feels heavy lately. I don't know where to start.")],
    config: { tone: "calm_companion", lang: "en" },
    criteria: {
      id: "style-reflect",
      description: "Reply invites reflection, doesn't push solutions or action steps.",
      passCondition: "Reply asks a gentle, open-ended question that invites the user to explore their feelings. Does NOT immediately offer solutions or action steps.",
      failExpectedOutcome: "Expected: Something like 'What does heavy feel like for you right now — is it more like weight, fog, or something else?' If giving solutions, fix reflect response style.",
    },
  },

  // ── 11. Emotion calibration — joy ────────────────────────────────────────
  {
    id: "en-emotion-joy-01",
    category: "Emotion Calibration",
    name: "Joy: match the user's positive energy",
    description: "User shares good news. Reply must match the positive emotional register.",
    messages: [user("I just got accepted into the university I've always dreamed of! I'm so happy!")],
    config: { tone: "close_friend", lang: "en", emotion: "joy" },
    criteria: {
      id: "emotion-joy",
      description: "Reply celebrates with the user. Matches their positive energy. Not muted or clinical.",
      passCondition: "Reply is genuinely celebratory and warm. Uses exclamatory or enthusiastic language. Acknowledges the achievement specifically (university, dream, acceptance). Does not dampen the mood.",
      failExpectedOutcome: "Expected: Celebratory reply like 'That's huge! Your dream school — all that work actually paid off!' If muted or neutral, fix emotion='joy' calibration.",
    },
  },

  // ── 12. Long conversation quality ────────────────────────────────────────
  {
    id: "en-long-quality-01",
    category: "Long Conversation",
    name: "Quality maintained over 10+ turns — no repetition",
    description: "After 10 conversation turns, Imotara's reply must not repeat earlier phrases.",
    messages: [
      user("I've been struggling with motivation lately."),
      assistant("Hmm… That kind of flatness can sneak up on you. What does a good day look like for you these days?"),
      user("A good day used to be when I finished my work and felt proud. Now I don't feel that anymore."),
      assistant("Oh… The absence of that proud feeling is its own kind of loss. What changed — was it gradual or sudden?"),
      user("It was gradual. I think it started when I got a new manager who doesn't appreciate my work."),
      assistant("That's hard — when your effort goes unseen by the person who's supposed to notice. How long has this been going on?"),
      user("About 6 months. I dread going to work every morning."),
      assistant("Six months of dread every morning takes a real toll. What does that dread feel like — more anxiety, numbness, or just heaviness?"),
      user("More like numbness. Like I'm going through the motions."),
      assistant("Going through the motions while feeling numb inside — it sounds exhausting to maintain. Have you had moments where you feel more like yourself, even briefly?"),
      user("Maybe on weekends when I'm with friends. But even then I'm distracted thinking about work."),
    ],
    config: { tone: "close_friend", lang: "en", emotion: "sad" },
    criteria: {
      id: "long-quality",
      description: "Reply after 10 turns must be fresh — no repeated openers like 'Hmm…', no reused phrases from earlier turns.",
      passCondition: "Reply opener is different from all previous assistant openers. No exact phrase repetition from prior turns. Quality remains high — specific, engaged, not generic.",
      failExpectedOutcome: "Expected: Fresh, specific reply that continues the thread naturally. If opener repeats 'Hmm…' or prior exact phrases, fix reply deduplication and seed rotation.",
    },
  },

  // ── 13. Long conversation context ────────────────────────────────────────
  {
    id: "en-long-ctx-01",
    category: "Long Conversation Context",
    name: "References specific detail shared 4+ turns ago",
    description: "User shared their dog's name (Max) early in conversation. Later reply must remember it.",
    messages: [
      user("My dog Max passed away three days ago. I'm devastated."),
      assistant("Oh… Losing Max after years together — that's a grief that hits differently than people expect. How are you holding up today?"),
      user("I keep forgetting he's gone and then remembering again. It's like a wave."),
      assistant("That wave — the forgetting and then the remembering — is one of the hardest parts of grief. It catches you off guard every time."),
      user("Yeah. I keep reaching for his leash out of habit."),
      assistant("Those muscle-memory moments are so tender. Your hands still know what your heart is trying to process."),
      user("I feel so guilty too. Like maybe I could have done more for him."),
      assistant("That guilt is love with nowhere to go. It doesn't mean you did anything wrong."),
      user("I know rationally. But emotionally it hits hard."),
      assistant("Knowing and feeling are two different countries. What would you say to a friend who was feeling this same guilt?"),
      user("I'd tell them they did their best and Max knew he was loved."),
    ],
    config: { tone: "close_friend", lang: "en", emotion: "sad" },
    criteria: {
      id: "long-context",
      description: "Reply references Max by name or references the guilt/love theme from the conversation — not a fresh restart.",
      passCondition: "Reply references 'Max' or echoes back the specific detail ('Max knew he was loved', guilt theme, etc.). Does not restart with a generic grief response.",
      failExpectedOutcome: "Expected: Reply like 'So let that wisdom you'd give a friend apply to you too — Max knew.' If no reference to Max or prior context, conversation memory is not being injected properly.",
    },
  },

  // ── 14. Companion memory ────────────────────────────────────────────────
  {
    id: "en-memory-01",
    category: "Companion Memory",
    name: "Remembers user-shared facts from earlier turns",
    description: "User mentioned their mother's name is Priya and she has been ill. Later message 'I'm worried about her' must get a contextual reply.",
    messages: [
      user("My mother Priya has been ill for the past month. It's been really hard watching her struggle."),
      assistant("Watching someone you love go through illness — especially your mother — is one of the heaviest things to carry. How is Priya doing?"),
      user("She's slowly getting better but it's been a hard month. I feel so helpless."),
      assistant("That helplessness when someone you love is suffering and you can't fix it — that feeling is so real. You're carrying a lot right now."),
      user("Yeah. Today was actually a better day for her though."),
      assistant("That's such a relief to hear — even one better day matters. How are you feeling today?"),
      user("I'm still worried about her though."),
    ],
    config: { tone: "close_friend", lang: "en" },
    criteria: {
      id: "companion-memory",
      description: "Reply to 'I'm still worried about her' must reference Priya by name or the illness context — not ask 'who?' or give a generic response.",
      passCondition: "Reply references Priya, the illness, or the month-long journey. Demonstrates that Imotara has been listening and remembers.",
      failExpectedOutcome: "Expected: Reply like 'Priya being better today doesn't erase a month of worry — that lingers.' If generic like 'Tell me more about your worry', conversation memory injection is broken.",
    },
  },
];
