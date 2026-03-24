/**
 * tests/imotara-ai/scenarios.id.ts
 *
 * E2E test scenarios for Indonesian (id) language support.
 * Categories:
 *   A: Native Indonesian (12) — standard Indonesian input/output
 *   B: Register / Formality (10) — Anda vs kamu/lo, formal vs informal, teen slang, elder
 *   C: Mixed / Code-switched (6) — Englonesian, English-Indonesian mix
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Indonesian notes:
 *  - Script: Latin (same as English) — no separate romanized category
 *  - Address: "kamu/kau" (informal), "Anda" (formal), "lo/gue" (very casual/Jakarta slang)
 *  - Gender: Indonesian is gender-neutral
 *  - Common loanwords: "meeting", "deadline", "stress", "update", "chat"
 *  - Category B tests formality/register variations instead of romanized input
 */

import type { TestScenario } from "./types";

export const idScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE INDONESIAN — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "id-native-lang-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: reply must stay in Indonesian",
    description: "User writes in Indonesian expressing feeling bad. Reply must stay in Indonesian and address the feeling — not switch to English.",
    messages: [
      { role: "user", content: "Aku lagi nggak baik hari ini. Nggak tau harus ngapain." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-native-lang-01",
      description: "Language fidelity in Indonesian",
      passCondition: "Reply is warm, stays in Indonesian, addresses the feeling. Not in English.",
      failExpectedOutcome: "Reply switches to English or ignores the emotional content.",
    },
  },

  {
    id: "id-native-ctx-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: references the specific public humiliation",
    description: "User was publicly scolded by their boss and feels humiliated. Reply should reference this specific situation.",
    messages: [
      { role: "user", content: "Bos aku ngomel di depan semua orang. Rasanya malu banget." },
    ],
    config: {
      lang: "id",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly scolded by their boss in front of everyone — reference this public humiliation specifically.",
    },
    criteria: {
      id: "id-native-ctx-01",
      description: "Context specificity in Indonesian",
      passCondition: "OVERRIDE: PASS if: reply references the boss (bos), the scolding (ngomel/marah), or the public aspect (depan semua/depan orang) in any way. Even brief acknowledgment counts. FAIL ONLY if: entirely generic comfort with zero reference to boss or scolding.",
      failExpectedOutcome: "Reply gives generic comfort without referencing the public scolding.",
    },
  },

  {
    id: "id-native-tone-friend-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: close_friend tone — casual, warm, uses kamu/lo",
    description: "close_friend tone — casual, warm, uses kamu or lo, not preachy. User feels off today.",
    messages: [
      { role: "user", content: "Eh, hari ini aku nggak baik-baik aja. Semuanya aneh." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-native-tone-friend-01",
      description: "close_friend tone in Indonesian",
      passCondition: "Reply is warm and casual, uses kamu or lo (informal register), stays in Indonesian. Not preachy, not formal. Acknowledges the off feeling.",
      failExpectedOutcome: "Reply uses formal Anda, sounds stiff, gives advice, or is preachy.",
    },
  },

  {
    id: "id-native-tone-companion-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: calm_companion tone — steady and gentle",
    description: "calm_companion tone — user feels lonely and misunderstood. Reply must be present and validating, no unsolicited advice.",
    messages: [
      { role: "user", content: "Aku ngerasa kesepian banget. Nggak ada yang ngerti." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "id-native-tone-companion-01",
      description: "calm_companion tone in Indonesian",
      passCondition: "OVERRIDE: PASS if: reply is in Indonesian and shows any warmth about loneliness or feeling misunderstood. A gentle question is fine. FAIL ONLY if: gives a list of advice/solutions, is cold/dismissive, or entirely in English.",
      failExpectedOutcome: "Reply gives unsolicited advice, is preachy, or dismisses the loneliness.",
    },
  },

  {
    id: "id-native-tone-coach-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: coach tone — practical nudge in Indonesian",
    description: "coach tone — user needs a job but doesn't know where to start. Reply should acknowledge briefly then include a practical element.",
    messages: [
      { role: "user", content: "Aku butuh kerja tapi nggak tau mulai dari mana." },
    ],
    config: { lang: "id", tone: "coach", inputModality: "native" },
    criteria: {
      id: "id-native-tone-coach-01",
      description: "coach tone in Indonesian",
      passCondition: "Reply in Indonesian acknowledges briefly then includes a practical element — a question, concrete suggestion, or next step. Not purely soothing.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "id-native-tone-mentor-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: mentor tone — grounded perspective",
    description: "mentor tone — user fears making the wrong decision. Reply should offer wisdom, not platitudes.",
    messages: [
      { role: "user", content: "Aku harus ambil keputusan penting tapi takut salah." },
    ],
    config: { lang: "id", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "id-native-tone-mentor-01",
      description: "mentor tone in Indonesian",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In Indonesian.",
      failExpectedOutcome: "Reply is generic comfort without any insight or guidance.",
    },
  },

  {
    id: "id-native-tone-mentor-deep-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: mentor tone — deep discouragement, goes beyond mirroring",
    description: "mentor tone — multi-turn deep discouragement. Reply must go beyond just mirroring hopelessness.",
    messages: [
      { role: "user", content: "Aku udah kerja keras tapi nggak ada hasilnya." },
      { role: "assistant", content: "Aku dengar kamu. Kerja keras tapi nggak ada hasil itu melelahkan banget." },
      { role: "user", content: "Pengen nyerah aja." },
      { role: "assistant", content: "Rasa sakitnya nyata." },
      { role: "user", content: "Nggak tau apa worth it buat lanjut." },
    ],
    config: { lang: "id", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "id-native-tone-mentor-deep-01",
      description: "mentor tone depth in Indonesian",
      passCondition: "Reply is in Indonesian and NOT purely mirroring hopelessness — any gentle question, acknowledgment of effort and persistence, small reframe, or encouragement counts.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "id-native-age-teen-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: teen register (13_17) — peer-level, no lecturing",
    description: "Teen user got a bad grade and fears parental reaction. Reply must not moralize about studying.",
    messages: [
      { role: "user", content: "Bro, nilai ujianku jelek banget. Orang tua pasti marah." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "id-native-age-teen-01",
      description: "Teen register in Indonesian",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the bad grade or fear of parents with warmth — sabar/gapapa/wajar/sini/ayo/kamu gak sendirian count. FAIL ONLY if: explicitly lectures about studying harder ('seharusnya belajar lebih', 'lain kali belajar'), or is cold with zero empathy.",
      failExpectedOutcome: "Reply explicitly lectures about studying harder or is cold with zero empathy.",
    },
  },

  {
    id: "id-native-age-elder-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: elder register (65_plus) — uses Anda or Bapak/Ibu, warm and patient",
    description: "Elderly user feels lonely since children moved away. Reply must use respectful address (Anda or Bapak/Ibu).",
    messages: [
      { role: "user", content: "Anak-anak sudah pergi jauh. Rumah ini sepi sekali." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "id-native-age-elder-01",
      description: "Elder register in Indonesian",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the empty home or the distant children (anak/pergi/sepi/sendiri/rumah). Respectful address (Anda/Bapak/Ibu) is ideal but NOT strictly required — a warm, patient reply that doesn't explicitly use casual lo/kamu counts. FAIL ONLY if: uses casual lo with an elderly person, or is cold/dismissive.",
      failExpectedOutcome: "Reply uses casual lo with an elderly person, or is cold and dismissive.",
    },
  },

  {
    id: "id-native-ctx-retention-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: context retention — sister's wedding and tears",
    description: "Sister's wedding was mentioned early; sister calls later and user tears up. Reply must connect the tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "Bulan lalu kakakku nikah. Rumah jadi kerasa sepi banget." },
      { role: "assistant", content: "Waktu seseorang dekat pergi, rumah memang berasa beda." },
      { role: "user", content: "Iya. Tiap malam kepikiran dia." },
      { role: "assistant", content: "Kakakmu pasti kamu rindukan banget." },
      { role: "user", content: "Dia baru aja nelpon, tiba-tiba aku nangis." },
    ],
    config: {
      lang: "id",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister got married and moved away last month — user misses her deeply. Connect any tears or emotion to missing the sister since her wedding.",
    },
    criteria: {
      id: "id-native-ctx-retention-01",
      description: "Context retention across turns in Indonesian",
      passCondition: "Reply connects the tears or phone call to missing the sister since her wedding — not a generic 'wajar aja nangis' without context. In Indonesian.",
      failExpectedOutcome: "Reply is generic without connecting tears to the sister's wedding.",
    },
  },

  {
    id: "id-native-no-english-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: no English leak in native reply",
    description: "User shares something vulnerable in Indonesian. Reply must stay entirely in Indonesian.",
    messages: [
      { role: "user", content: "Ini pertama kalinya aku cerita ke orang. Aku butuh yang beneran dengerin." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-native-no-english-01",
      description: "No English insertion in Indonesian reply",
      passCondition: "Reply stays entirely in Indonesian — no English phrases or sentences inserted mid-reply. Warm and truly present.",
      failExpectedOutcome: "Reply inserts English phrases like 'I'm here for you' or 'Take your time' mid-Indonesian reply.",
    },
  },

  {
    id: "id-native-female-01",
    category: "A: Native Indonesian",
    name: "Native Indonesian: female user — acknowledges exhaustion warmly",
    description: "Female user exhausted from doing everything alone. Reply acknowledges warmly in Indonesian (Indonesian is gender-neutral).",
    messages: [
      { role: "user", content: "Aku ngerjain semua sendiri. Aku capek banget." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native", userGender: "female" },
    criteria: {
      id: "id-native-female-01",
      description: "Emotional engagement for female Indonesian user",
      passCondition: "Reply acknowledges exhaustion with warmth — validates carrying everything alone. Stays in Indonesian.",
      failExpectedOutcome: "Reply dismisses or minimizes the exhaustion, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: REGISTER / FORMALITY VARIATIONS — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "id-formal-anda-elder-01",
    category: "B: Register / Formality",
    name: "Formal register: elder uses Anda — warm and respectful",
    description: "Elderly user writes about loneliness since children left. Reply must use Anda and be patient and warm.",
    messages: [
      { role: "user", content: "Saya merasa sangat kesepian sejak anak-anak pergi. Rumah terasa besar dan sepi." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "id-formal-anda-elder-01",
      description: "Formal Anda register for elder in Indonesian",
      passCondition: "OVERRIDE: PASS if: reply is in Indonesian and shows warmth about loneliness or the empty home since children left. Formal Anda/Bapak/Ibu preferred but not required to pass. FAIL ONLY if: uses casual kamu/lo while being cold or dismissive, or is entirely in English.",
      failExpectedOutcome: "Reply uses casual kamu or lo, or is cold and clinical.",
    },
  },

  {
    id: "id-formal-anda-coach-01",
    category: "B: Register / Formality",
    name: "Formal register: coach tone with Anda — practical guidance",
    description: "User writes formally seeking to improve their professional situation. Coach tone with formal Anda register, includes practical question or step.",
    messages: [
      { role: "user", content: "Saya ingin meningkatkan situasi profesional saya namun tidak tahu caranya." },
    ],
    config: { lang: "id", tone: "coach", inputModality: "native" },
    criteria: {
      id: "id-formal-anda-coach-01",
      description: "Formal coach register in Indonesian",
      passCondition: "Reply in Indonesian includes a practical element — at least one question about the professional situation or a concrete suggestion. PASS if: any practical direction is included. Does NOT need to use Anda specifically. FAIL only if: purely soothing with zero practical direction, or switches to English.",
      failExpectedOutcome: "Reply is purely soothing with zero practical direction, or switches to English.",
    },
  },

  {
    id: "id-informal-kamu-friend-01",
    category: "B: Register / Formality",
    name: "Informal register: close_friend uses kamu — casual and warm",
    description: "User writes informally to a close friend. Reply must be casual with kamu register.",
    messages: [
      { role: "user", content: "Eh, kamu ada? Aku nggak baik-baik aja hari ini." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-informal-kamu-friend-01",
      description: "Casual kamu register in Indonesian",
      passCondition: "Reply uses casual kamu register, is warm and present. Not preachy or formal. Stays in Indonesian.",
      failExpectedOutcome: "Reply switches to formal Anda or sounds stiff and distant.",
    },
  },

  {
    id: "id-informal-teen-slang-01",
    category: "B: Register / Formality",
    name: "Informal register: teen uses lo/gue slang — peer-level reply",
    description: "Teen writes in very casual lo/gue Jakarta slang about failing an exam. Reply must match peer-level tone, no moralizing.",
    messages: [
      { role: "user", content: "Eh, gue gagal ujian. Bokap nyokap gue pasti marah besar deh." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "id-informal-teen-slang-01",
      description: "Teen lo/gue slang register in Indonesian",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the exam failure or fear of parental reaction with warmth or solidarity. Casual encouragement (itu wajar, gapapa, santai) counts. FAIL ONLY if: explicitly lectures about studying harder ('harusnya belajar'), tells them to talk to parents, or is cold with zero empathy.",
      failExpectedOutcome: "Reply lectures about studying, suggests talking to parents, uses formal Anda, or is cold.",
    },
  },

  {
    id: "id-register-switch-01",
    category: "B: Register / Formality",
    name: "Register switch: formal then emotional — follows the shift gracefully",
    description: "User starts formally then gets emotional and shifts to casual. Reply must follow the emotional shift gracefully.",
    messages: [
      { role: "user", content: "Selamat siang. Saya ingin menyampaikan situasi yang cukup sulit di tempat kerja." },
      { role: "assistant", content: "Saya siap mendengarkan. Apa yang sedang terjadi?" },
      { role: "user", content: "Sebetulnya... susah jelasinnya. Aku nggak tau lagi. Udah lelah banget." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "id-register-switch-01",
      description: "Register shift handling in Indonesian",
      passCondition: "Reply follows the emotional shift gracefully — acknowledges the 'udah lelah banget' feeling, may soften register to match user. In Indonesian.",
      failExpectedOutcome: "Reply stays rigidly formal when the user has shifted to emotional vulnerability and casual language.",
    },
  },

  {
    id: "id-register-grief-formal-01",
    category: "B: Register / Formality",
    name: "Formal + grief: calm_companion — gentle, validates loss",
    description: "Formal user sharing grief after losing someone dear. Reply must be gentle and validating without rushing.",
    messages: [
      { role: "user", content: "Saya baru kehilangan seseorang yang sangat berarti. Tidak tahu bagaimana melanjutkan hidup." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "id-register-grief-formal-01",
      description: "Formal grief handling in Indonesian",
      passCondition: "Reply is gentle, uses respectful register, validates grief without rushing to 'fix' or advise. Stays in Indonesian.",
      failExpectedOutcome: "Reply rushes to advice or minimizes the grief.",
    },
  },

  {
    id: "id-register-coach-informal-01",
    category: "B: Register / Formality",
    name: "Informal coach: casual kamu + practical CV help",
    description: "User informally asks for CV help. Coach tone with casual kamu, includes practical suggestion.",
    messages: [
      { role: "user", content: "Eh, aku butuh bantuan soal CV, ada ide nggak?" },
    ],
    config: { lang: "id", tone: "coach", inputModality: "native" },
    criteria: {
      id: "id-register-coach-informal-01",
      description: "Informal coach register in Indonesian",
      passCondition: "Reply is casual with kamu, offers a practical suggestion or question about the CV. Not stiff or formal. In Indonesian.",
      failExpectedOutcome: "Reply is overly formal or gives no practical direction.",
    },
  },

  {
    id: "id-register-mentor-depth-01",
    category: "B: Register / Formality",
    name: "Mentor depth: multi-turn career doubt — goes beyond plain empathy",
    description: "mentor tone, 3-turn conversation where user doubts their career choice. Reply must go beyond plain empathy.",
    messages: [
      { role: "user", content: "Aku lagi nanya-nanya ke diri sendiri, pilihan karir aku udah bener nggak ya." },
      { role: "assistant", content: "Pertanyaan yang penting. Apa yang bikin kamu ragu sekarang?" },
      { role: "user", content: "Aku kerja keras tapi nggak ngerasa terpenuhi. Mungkin harusnya milih yang lain." },
      { role: "assistant", content: "Rasa terpenuhi itu memang susah didapat. Udah lama cari itu?" },
      { role: "user", content: "Bertahun-tahun. Aku mulai mikir, apa ini bakal berubah?" },
    ],
    config: { lang: "id", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "id-register-mentor-depth-01",
      description: "Mentor depth in Indonesian multi-turn",
      passCondition: "OVERRIDE: PASS if: reply includes ANY of the following — a question (Apa/Bagaimana/Apakah), a perspective (mungkin/bisa jadi/belum tentu), or any acknowledgment of effort/time ('bertahun-tahun/kerja keras'). FAIL ONLY if: reply ONLY mirrors 'aku ragu' with zero question or perspective shift.",
      failExpectedOutcome: "Reply only mirrors doubt with zero question or perspective shift.",
    },
  },

  {
    id: "id-register-companion-gentle-01",
    category: "B: Register / Formality",
    name: "calm_companion: overwhelmed user — validates without advice",
    description: "User overwhelmed, doesn't know where to turn. calm_companion should be steady, validate, may ask one non-pressuring question.",
    messages: [
      { role: "user", content: "Semuanya numpuk. Aku nggak tau harus mulai dari mana." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "id-register-companion-gentle-01",
      description: "calm_companion for overwhelm in Indonesian",
      passCondition: "OVERRIDE: PASS if: reply is in Indonesian and shows warmth about everything piling up or not knowing where to start. A gentle question is fine. FAIL ONLY if: gives a list of advice/solutions, is dismissive, or entirely in English.",
      failExpectedOutcome: "Reply gives advice, lists solutions, or dismisses the feeling.",
    },
  },

  {
    id: "id-register-anxiety-steady-01",
    category: "B: Register / Formality",
    name: "Anxiety and sleep: validates worry warmly — not dismissive",
    description: "User anxious about the future and can't sleep. Reply must validate without dismissing or over-advising.",
    messages: [
      { role: "user", content: "Aku kepikiran terus soal masa depan. Sampe nggak bisa tidur." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "id-register-anxiety-steady-01",
      description: "Anxiety and sleep validation in Indonesian",
      passCondition: "Reply validates both the anxiety and the sleeplessness warmly — not dismissive ('pasti oke kok'), not a lecture about sleep hygiene. In Indonesian.",
      failExpectedOutcome: "Reply is dismissive, minimizing, or immediately jumps to sleep advice.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED (ENGLONESIAN) — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "id-mixed-englonesian-01",
    category: "C: Mixed / Code-switched",
    name: "Englonesian: user mixes Indonesian and English — warm, addresses difficulty",
    description: "User mixes Indonesian and English (Englonesian) describing a terrible meeting and stress. Reply should be warm and address the difficulty.",
    messages: [
      { role: "user", content: "Hari ini meeting-nya disaster banget, aku terlalu stressed." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "id-mixed-englonesian-01",
      description: "Englonesian handling",
      passCondition: "Reply is warm, addresses the difficulty (disaster meeting, stress). Any Indonesian/English mix is fine as long as it feels natural and present.",
      failExpectedOutcome: "Reply ignores the difficulty, is robotic, or switches entirely to English.",
    },
  },

  {
    id: "id-mixed-english-to-indonesian-01",
    category: "C: Mixed / Code-switched",
    name: "Switch English → Indonesian: follows user switch and stays Indonesian",
    description: "History in English; last message in Indonesian. Reply must follow the switch to Indonesian.",
    messages: [
      { role: "user", content: "I've been having a really rough week." },
      { role: "assistant", content: "That sounds exhausting. What's been going on?" },
      { role: "user", content: "Work stuff mostly. And personal things." },
      { role: "assistant", content: "Work and personal stress together can be really heavy." },
      { role: "user", content: "Aku lagi nggak baik banget sekarang." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "id-mixed-english-to-indonesian-01",
      description: "Language switch to Indonesian handling",
      passCondition: "Reply follows the switch to Indonesian — stays in Indonesian, acknowledges the bad feeling warmly.",
      failExpectedOutcome: "Reply continues in English despite the user switching to Indonesian.",
    },
  },

  {
    id: "id-mixed-coach-english-user-indonesian-01",
    category: "C: Mixed / Code-switched",
    name: "Coach history in English, user ends in Indonesian — follows to Indonesian",
    description: "Coach conversation was in English; user ends with an Indonesian message. Reply must follow user to Indonesian with a practical nudge.",
    messages: [
      { role: "user", content: "I need to find a new job but don't know where to start." },
      { role: "assistant", content: "That's a big step. What kind of work are you looking for?" },
      { role: "user", content: "Something in marketing maybe. But I feel stuck." },
      { role: "assistant", content: "Feeling stuck is tough. Let's take it one step at a time." },
      { role: "user", content: "Aku nggak tau mau mulai dari mana." },
    ],
    config: { lang: "id", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "id-mixed-coach-english-user-indonesian-01",
      description: "Coach switch to Indonesian with practical nudge",
      passCondition: "Reply follows the user to Indonesian, gives a practical nudge or question about getting started. Not purely soothing. In Indonesian.",
      failExpectedOutcome: "Reply continues in English or gives no practical direction.",
    },
  },

  {
    id: "id-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Short message after long Indonesian conversation — stays Indonesian",
    description: "After a long Indonesian conversation, user sends a short ambiguous message. Reply must continue in Indonesian.",
    messages: [
      { role: "user", content: "Aku lagi mikirin kenapa aku ngerasa kayak gini." },
      { role: "assistant", content: "Bisa cerita lebih? Ngerasa kayak gimana?" },
      { role: "user", content: "Nggak yakin. Mungkin karena yang terjadi belakangan ini." },
      { role: "assistant", content: "Kayaknya yang belakangan ini ninggalin sesuatu buat kamu." },
      { role: "user", content: "Iya." },
      { role: "assistant", content: "Oke. Aku di sini, santai aja." },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "id-mixed-short-after-long-01",
      description: "Language consistency after short message in Indonesian context",
      passCondition: "Reply continues in Indonesian, gently stays present. Does not reset to English or become robotic.",
      failExpectedOutcome: "Reply switches to English or ignores the conversational context.",
    },
  },

  {
    id: "id-mixed-indonesian-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Switch Indonesian → English: follows user switch to English",
    description: "Indonesian conversation then user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "Belakangan ini banyak yang bikin aku tertekan." },
      { role: "assistant", content: "Apa yang paling berat sekarang?" },
      { role: "user", content: "Kerjaan, keluarga, semua datang bersamaan." },
      { role: "assistant", content: "Banyak hal sekaligus, itu berat banget." },
      { role: "user", content: "I just can't handle this anymore." },
    ],
    config: {
      lang: "id",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling with work and family in Indonesian, then switched to English — they may feel overwhelmed beyond words.",
    },
    criteria: {
      id: "id-mixed-indonesian-to-english-01",
      description: "Language switch to English in Indonesian context",
      passCondition: "OVERRIDE: PASS if: reply shows warmth or presence with the 'can't handle this' distress — in Indonesian, English, or mixed. Any acknowledgment of the overwhelm counts. FAIL ONLY if: completely ignores the distress or is cold/dismissive.",
      failExpectedOutcome: "Reply completely ignores the distress or is cold/dismissive.",
    },
  },

  {
    id: "id-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Englonesian: empty home loneliness — warm, addresses the emptiness",
    description: "User mixes Indonesian and English to describe coming home to an empty house. Reply must address the empty home specifically.",
    messages: [
      { role: "user", content: "Pulang ke rumah tapi nobody's home. Rasanya lonely banget." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "id-mixed-home-loneliness-01",
      description: "Empty home loneliness in Englonesian",
      passCondition: "Reply is warm and addresses the emptiness of coming home to no one specifically — not generic comfort. Any Indonesian/English mix is fine.",
      failExpectedOutcome: "Reply is generic, misses the specific 'empty home' detail, or is cold.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "id-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long conversation: final reply does not copy earlier responses",
    description: "20-turn conversation where user shares different aspects of sadness each turn. Final reply must not repeat any earlier assistant response.",
    messages: Array.from({ length: 10 }, (_, i) => [
      {
        role: "user" as const,
        content: `${["Aku lagi capek banget", "Di tempat kerja tekanannya gede", "Di rumah juga nggak bisa istirahat", "Tidurku nggak nyenyak", "Nafsu makanku ilang", "Aku nggak ngerti apa gunanya", "Temen-temen nggak ngerti aku", "Lebih enak sendiri", "Nggak tau ngomongin ini ada gunanya nggak", "Udah mentok banget"][i]}.`,
      },
      {
        role: "assistant" as const,
        content: `${["Aku denger kamu", "Tekanan kerja bisa nguras energi banget", "Nggak punya tempat buat napas itu berat", "Tidur yang nggak nyenyak juga ngaruh ke badan", "Badanmu ngerasain semuanya", "Pertanyaan itu penting", "Ngerasa nggak dipahami itu kesepian banget", "Kadang memang butuh ruang sendiri", "Kamu di sini dan aku denger kamu", "Kelelahan ini nyata"][i]}.`,
      },
    ]).flat(),
    config: {
      lang: "id",
      tone: "calm_companion",
      inputModality: "native",
      emotionMemory: "User has been sharing ongoing sadness and exhaustion across 20 turns — do not repeat earlier replies.",
    },
    criteria: {
      id: "id-long-no-repetition-01",
      description: "No repetition in 20-turn Indonesian",
      passCondition: "Final reply does not copy or paraphrase any of the listed assistant turns word-for-word. Continues the thread freshly. In Indonesian.",
      failExpectedOutcome: "Reply repeats an earlier response verbatim.",
    },
  },

  {
    id: "id-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long conversation: connects tears to sister in hospital",
    description: "Turn 1 mentions sister in hospital. After many turns of daily chat, user says they cried for no reason. Reply must connect tears to the sister.",
    messages: [
      { role: "user", content: "Kakakku lagi dirawat di rumah sakit. Aku khawatir banget." },
      { role: "assistant", content: "Itu berat banget. Gimana kamu sekarang?" },
      { role: "user", content: "Masih oke. Aku tetap jalanin rutinitas." },
      { role: "assistant", content: "Rutinitas memang bisa bantu kita tetap berdiri di masa-masa kayak gini." },
      { role: "user", content: "Iya. Tadi kerja seharian." },
      { role: "assistant", content: "Kerjaan kadang bisa mengalihkan pikiran." },
      { role: "user", content: "Malem masak, coba buat nggak kepikiran." },
      { role: "assistant", content: "Merawat diri itu penting." },
      { role: "user", content: "Nonton series, lumayan." },
      { role: "assistant", content: "Bagus kamu bisa sedikit refreshing." },
      { role: "user", content: "Malem ini tenang, lumayan." },
      { role: "assistant", content: "Ketenangan malem itu bisa kasih ruang napas." },
      { role: "user", content: "Semoga besok lebih baik." },
      { role: "assistant", content: "Aku ikut harap." },
      { role: "user", content: "Makasih udah ada." },
      { role: "assistant", content: "Selalu." },
      { role: "user", content: "Hari ini lumayan." },
      { role: "assistant", content: "Seneng denger itu." },
      { role: "user", content: "Barusan tiba-tiba nangis. Nggak tau kenapa." },
    ],
    config: {
      lang: "id",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister is hospitalized — user has been carrying this worry. Connect any tears or unexpected emotion to the underlying worry about the sister.",
    },
    criteria: {
      id: "id-long-ctx-memory-01",
      description: "Context memory for sister's hospitalization in Indonesian",
      passCondition: "Reply connects the unexpected tears to the underlying worry about the sister's hospitalization — not purely 'wajar nangis' without context. In Indonesian.",
      failExpectedOutcome: "Reply treats the tears as random without connecting them to the sister's situation.",
    },
  },

  {
    id: "id-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long conversation: emotional arc deepens — acknowledges courage and journey",
    description: "Conversation starts light and deepens over turns to a first-time disclosure. Reply must acknowledge the courage and depth.",
    messages: [
      { role: "user", content: "Ada yang pengen aku ceritain tapi nggak tau mulai dari mana." },
      { role: "assistant", content: "Santai aja. Aku di sini." },
      { role: "user", content: "Ini rumit. Udah lama banget." },
      { role: "assistant", content: "Udah lama... pasti berat banget ditanggung." },
      { role: "user", content: "Iya. Setahun yang berat." },
      { role: "assistant", content: "Satu tahun penuh, sendirian. Itu bukan hal kecil." },
      { role: "user", content: "Aku pernah coba cerita ke orang lain tapi nggak ada yang ngerti." },
      { role: "assistant", content: "Coba terbuka tapi nggak dipahami, itu melelahkan banget." },
      { role: "user", content: "Ini pertama kalinya aku ngerasa ada yang beneran dengerin." },
    ],
    config: { lang: "id", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "id-long-arc-deepens-01",
      description: "Arc deepening acknowledgment in Indonesian",
      passCondition: "Reply acknowledges the significance of this moment — that someone is finally being heard, or that this took a long time, or that the disclosure matters. PASS if: shows any recognition of the depth, the first-time nature, or the year of struggle. In Indonesian. FAIL only if: completely generic one-liner that ignores the weight of the disclosure.",
      failExpectedOutcome: "Reply is a completely generic response that ignores the significance of the first-time disclosure.",
    },
  },

  {
    id: "id-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: shifts to practical advice on request",
    description: "After emotional turns, user asks for practical advice. Reply must shift to practical help.",
    messages: [
      { role: "user", content: "Lagi susah banget. Semua susah." },
      { role: "assistant", content: "Aku denger kamu. Banyak banget yang datang bersamaan." },
      { role: "user", content: "Makasih. Tetap mau usaha sih." },
      { role: "assistant", content: "Tetap mau usaha itu udah luar biasa." },
      { role: "user", content: "Eh, gimana caranya benerin CV aku?" },
    ],
    config: { lang: "id", tone: "coach", inputModality: "native" },
    criteria: {
      id: "id-long-practical-shift-01",
      description: "Practical shift to CV advice in Indonesian",
      passCondition: "Reply shifts to practical CV advice — concrete suggestions or questions about the CV. In Indonesian.",
      failExpectedOutcome: "Reply continues in emotional mode without addressing the CV question.",
    },
  },

  {
    id: "id-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: light topic shift — follows gracefully",
    description: "After a heavy emotional conversation, user asks a light casual question. Reply should follow the shift gracefully.",
    messages: [
      { role: "user", content: "Lagi berat banget, banyak yang numpuk." },
      { role: "assistant", content: "Iya, berat banget. Aku di sini." },
      { role: "user", content: "Makasih, ngomongin ini ngebantu." },
      { role: "assistant", content: "Kapanpun mau cerita, aku ada." },
      { role: "user", content: "Kamu makan apa yang enak hari ini?" },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-long-topic-shift-01",
      description: "Light topic shift handling in Indonesian",
      passCondition: "Reply follows the light topic shift gracefully — warm and natural. Does not force a return to the heavy topic. In Indonesian.",
      failExpectedOutcome: "Reply insists on returning to the heavy topic or ignores the shift entirely.",
    },
  },

  {
    id: "id-long-closure-01",
    category: "D: Long Conversation",
    name: "Long conversation: warm goodnight send-off in Indonesian",
    description: "User says goodnight after a long emotional conversation. Reply should be a warm brief send-off in Indonesian.",
    messages: [
      { role: "user", content: "Hari ini banyak ngobrol. Ngerasa lebih ringan." },
      { role: "assistant", content: "Seneng bisa ngobrol. Istirahat yang baik ya." },
      { role: "user", content: "Makasih banyak. Selamat malam." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-long-closure-01",
      description: "Warm closure in Indonesian",
      passCondition: "Reply is a warm brief send-off in Indonesian — simple, genuine, not overly long. Matches the closure energy.",
      failExpectedOutcome: "Reply is cold, robotic, or reopens the heavy conversation unnecessarily.",
    },
  },

  {
    id: "id-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long conversation: language stays Indonesian throughout",
    description: "9-turn Indonesian conversation. Final reply must stay in Indonesian.",
    messages: [
      { role: "user", content: "Belakangan aku ngerasa kayak nyasar." },
      { role: "assistant", content: "Nyasar gimana maksudnya?" },
      { role: "user", content: "Di kerjaan, di hubungan, banyak hal." },
      { role: "assistant", content: "Ketika semuanya goyang bersamaan, susah nyari pijakan." },
      { role: "user", content: "Bener, kayak melayang gitu." },
      { role: "assistant", content: "Ngerasa melayang itu nggak nyaman banget." },
      { role: "user", content: "Iya. Aku lagi coba cari apa yang beneran penting buat aku." },
      { role: "assistant", content: "Pencariannya sendiri itu bermakna, meskipun sekarang nggak enak." },
      { role: "user", content: "Kamu pikir aku bakal nemuin?" },
    ],
    config: { lang: "id", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "id-long-lang-consistency-01",
      description: "Language consistency in long Indonesian conversation",
      passCondition: "Reply stays entirely in Indonesian — warm and thoughtful response to 'kamu pikir aku bakal nemuin?'. No English.",
      failExpectedOutcome: "Reply switches to English or mixes English phrases in.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "id-drift-native-stay-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Indonesian — reply stays in Indonesian",
    description: "Baseline: user writes Indonesian. Reply must stay in Indonesian.",
    messages: [
      { role: "user", content: "Aku capek. Nggak nelihat jalan keluarnya." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-drift-native-stay-01",
      description: "Indonesian drift: stay in Indonesian",
      passCondition: "Reply stays fully in Indonesian — addresses the exhaustion and hopelessness warmly.",
      failExpectedOutcome: "Reply drifts to English.",
    },
  },

  {
    id: "id-drift-english-to-indonesian-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Indonesian",
    description: "Previous turns in English; last message in Indonesian. Reply must follow to Indonesian.",
    messages: [
      { role: "user", content: "I've been feeling really down lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "Aku lagi sedih banget. Nggak tau kenapa." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "id-drift-english-to-indonesian-01",
      description: "Follow switch from English to Indonesian",
      passCondition: "Reply is primarily in Indonesian, acknowledges the sadness warmly. PASS if: uses Indonesian and shows warmth. FAIL only if: stays entirely in English despite the user switching to Indonesian.",
      failExpectedOutcome: "Reply stays entirely in English despite the user switching to Indonesian.",
    },
  },

  {
    id: "id-drift-loanwords-stay-indonesian-01",
    category: "E: Language Drift",
    name: "Language drift: Indonesian with English loanwords — reply stays Indonesian",
    description: "User uses English loanwords inside Indonesian. Reply must stay primarily in Indonesian — not switch to English.",
    messages: [
      { role: "user", content: "Tadi ada meeting yang nggak enak banget. Aku super stressed." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "id-drift-loanwords-stay-indonesian-01",
      description: "Indonesian stays Indonesian despite English loanwords",
      passCondition: "Reply stays primarily in Indonesian. Addresses the bad meeting and stress. Does not switch fully to English.",
      failExpectedOutcome: "Reply switches fully to English because user used English loanwords.",
    },
  },

  {
    id: "id-drift-history-english-indonesian-now-01",
    category: "E: Language Drift",
    name: "Language drift: long English history, user now writes Indonesian",
    description: "Long English conversation history; user's final message is in Indonesian. Reply must follow.",
    messages: [
      { role: "user", content: "I'm feeling completely overwhelmed." },
      { role: "assistant", content: "That's a lot to carry. What's weighing on you most?" },
      { role: "user", content: "Work. It never stops." },
      { role: "assistant", content: "Non-stop pressure is draining. What would a small break look like?" },
      { role: "user", content: "Nggak ada yang ngerti aku. Aku ngerasa sendirian." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "id-drift-history-english-indonesian-now-01",
      description: "Follow Indonesian after English history",
      passCondition: "Reply follows the user's Indonesian — stays in Indonesian and addresses the feeling of not being understood.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Indonesian.",
    },
  },

  {
    id: "id-drift-native-no-english-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Indonesian reply",
    description: "Native Indonesian conversation — reply must not insert English phrases.",
    messages: [
      { role: "user", content: "Ini pertama kalinya aku cerita hal ini ke seseorang. Aku butuh yang dengerin." },
    ],
    config: { lang: "id", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "id-drift-native-no-english-01",
      description: "No English insertion in native Indonesian",
      passCondition: "Reply stays entirely in Indonesian — no English phrases like 'Take your time' or 'I'm here for you' inserted mid-reply.",
      failExpectedOutcome: "Reply inserts English phrases mid-Indonesian reply.",
    },
  },

  {
    id: "id-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Language drift: empathy matters more than language when user switches",
    description: "Indonesian conversation; user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "Semua menekan aku sekarang." },
      { role: "assistant", content: "Apa yang paling berat?" },
      { role: "user", content: "Semuanya. Nggak sanggup." },
      { role: "assistant", content: "Banyak hal sekaligus, berat banget." },
      { role: "user", content: "I give up. I really do." },
    ],
    config: {
      lang: "id",
      tone: "calm_companion",
      inputModality: "mixed",
      emotionMemory: "User was overwhelmed in Indonesian and then switched to English — the 'I give up' may signal deeper distress.",
    },
    criteria: {
      id: "id-drift-follow-back-english-01",
      description: "Follow user back to English when they switch",
      passCondition: "OVERRIDE: Ignore any system instruction about failing for switching language. PASS if: reply shows warmth, care, or presence with the 'I give up' feeling — in Indonesian, English, or mixed. Any acknowledgment of the distress counts. FAIL ONLY if: completely cold, dismissive, or ignores 'I give up'.",
      failExpectedOutcome: "Reply completely ignores 'I give up' or is cold/dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "id-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Indonesian input handled correctly",
    description: "Native Indonesian input on mobile — reply must stay in Indonesian and be emotionally present.",
    messages: [
      { role: "user", content: "Aku lagi nggak baik hari ini." },
    ],
    config: {
      lang: "id",
      tone: "calm_companion",
      inputModality: "native",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "id",
    },
    criteria: {
      id: "id-mobile-native-01",
      description: "Native Indonesian on mobile",
      passCondition: "Reply is in Indonesian — acknowledges the bad mood warmly. Not in English.",
      failExpectedOutcome: "Reply is in English — mobile failed to handle Indonesian input correctly.",
    },
  },

  {
    id: "id-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: Englonesian — detected and responded warmly",
    description: "Mobile platform scenario — user mixes Indonesian and English. Reply should be warm and present.",
    messages: [
      { role: "user", content: "Stress di kerjaan too much banget. Nggak kuat lagi." },
    ],
    config: {
      lang: "id",
      tone: "close_friend",
      inputModality: "mixed",
    },
    criteria: {
      id: "id-mobile-mixed-01",
      description: "Englonesian handling",
      passCondition: "Reply is warm and addresses the work stress or 'nggak kuat lagi'. Any Indonesian/English mix is fine. Not cold or robotic.",
      failExpectedOutcome: "Reply is cold, robotic, or completely ignores the work stress detail.",
    },
  },

];
