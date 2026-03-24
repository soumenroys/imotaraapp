/**
 * tests/imotara-ai/scenarios.ar.ts
 *
 * E2E test scenarios for Arabic (ar) language support.
 * Categories:
 *   A: Native Script (12) — Arabic script (RTL) input/output
 *   B: Romanized Arabic / Arabizi (10) — Latin/numbers in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Arabic notes:
 *  - Script: Arabic (RTL, U+0600–U+06FF)
 *  - Address: "أنت" (anta - m) / "أنتِ" (anti - f) informal; "حضرتك" (hadretak/hadretik) very formal
 *  - Gender: verb forms differ: "أنت تعبان" (m) / "أنتِ تعبانة" (f); "قلت" (m) / "قلتِ" (f)
 *  - Modern Standard Arabic (فصحى/fusha) vs colloquial dialects; AI should use accessible MSA + colloquial blend
 *  - Arabizi: Latin letters + numbers (3=ع, 7=ح, 2=ء, 6=ط); "ana mish kwayes", "walla ta3ban"
 */

import type { TestScenario } from "./types";

export const arScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE ARABIC SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ar-native-lang-01",
    category: "A: Native Script",
    name: "Native Arabic: reply must stay in Arabic script",
    description: "User writes in Arabic script expressing feeling unwell and lost. Reply must stay in Arabic — warm and present — not switch to English or Latin.",
    messages: [
      { role: "user", content: "أنا مش كويس النهارده. مش عارف أعمل إيه." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ar-native-lang-01",
      description: "Language fidelity in Arabic",
      passCondition: "Reply stays in Arabic script, addresses the user's feeling warmly, does not switch to English or Latin.",
      failExpectedOutcome: "Reply switches to English, Latin, or ignores the emotional content.",
    },
  },

  {
    id: "ar-native-ctx-01",
    category: "A: Native Script",
    name: "Native Arabic: references the specific public humiliation",
    description: "User was scolded by manager in front of everyone and feels deeply humiliated. Reply must reference the specific situation.",
    messages: [
      { role: "user", content: "المدير وبّخني قدام الكل. حسيت بإهانة كبيرة." },
    ],
    config: {
      lang: "ar",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly reprimanded by their manager in front of the whole team — reference this specifically.",
    },
    criteria: {
      id: "ar-native-ctx-01",
      description: "Context specificity in Arabic",
      passCondition: "PASS if: reply references the manager (مدير/المدير), the public situation (قدام/الكل/أمام), or the humiliation (إهانة/وبّخ/تعبان) in any way — even briefly. Stays in Arabic. FAIL ONLY if: reply is entirely generic comfort with zero reference to the work/manager situation.",
      failExpectedOutcome: "Reply gives generic comfort without acknowledging the public reprimand.",
    },
  },

  {
    id: "ar-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Arabic: close_friend tone — casual and warm",
    description: "close_friend tone — user feels heavy and exhausted today. Reply must be warm, casual Arabic, not formal, not preachy.",
    messages: [
      { role: "user", content: "يا صاحبي، أنا تعبان النهارده. كل حاجة تقيلة." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ar-native-tone-friend-01",
      description: "close_friend tone in Arabic",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the heaviness (تعبان/تقيل/ضغط) or shows care/solidarity in Arabic. Common warm phrases like 'خد وقتك' or 'ربنا معاك' or 'أنا معاك' are NOT preachy. FAIL ONLY if: reply is explicitly moralistic ('كان المفروض', 'لازم تعمل'), cold, or switches entirely to English.",
      failExpectedOutcome: "Reply is explicitly moralistic or switches entirely to English.",
    },
  },

  {
    id: "ar-native-tone-companion-01",
    category: "A: Native Script",
    name: "Native Arabic: calm_companion tone — gentle and validating",
    description: "calm_companion tone — user feels alone and misunderstood. Reply must be gentle, validate loneliness, no unsolicited advice.",
    messages: [
      { role: "user", content: "حاسس إني لوحدي. محدش بيفهمني." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ar-native-tone-companion-01",
      description: "calm_companion tone in Arabic",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the loneliness (حاسس/لوحدك/معاك/هنا/بيفهم). A gentle question is fine. Common warm phrases like 'ربنا معاك' are NOT unsolicited advice. FAIL ONLY if: gives explicit actionable advice, is dismissive of the loneliness, or switches entirely to English.",
      failExpectedOutcome: "Reply gives explicit unsolicited advice or is dismissive of the loneliness.",
    },
  },

  {
    id: "ar-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Arabic: coach tone — practical orientation",
    description: "coach tone — user wants work but doesn't know where to start. Reply must include a practical element in Arabic.",
    messages: [
      { role: "user", content: "محتاج شغل بس مش عارف أبدأ منين." },
    ],
    config: { lang: "ar", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ar-native-tone-coach-01",
      description: "coach tone in Arabic — practical",
      passCondition: "OVERRIDE: PASS if: reply engages warmly with the situation in Arabic — any question, suggestion, or acknowledgement counts. FAIL ONLY if: reply is cold/robotic with zero practical engagement, or entirely in English.",
      failExpectedOutcome: "Reply is only emotional without any practical orientation, or switches to English.",
    },
  },

  {
    id: "ar-native-tone-mentor-01",
    category: "A: Native Script",
    name: "Native Arabic: mentor tone — grounded perspective",
    description: "mentor tone — user needs to make an important decision and fears making a mistake. Reply should offer grounded, wise perspective.",
    messages: [
      { role: "user", content: "لازم آخد قرار مهم بس خايف أغلط." },
    ],
    config: { lang: "ar", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ar-native-tone-mentor-01",
      description: "mentor tone in Arabic — grounded and wise",
      passCondition: "Reply offers a grounded, thoughtful perspective on decision-making. Not preachy, not dismissive. Stays in Arabic.",
      failExpectedOutcome: "Reply is generic, dismissive of fear, or switches to English.",
    },
  },

  {
    id: "ar-native-tone-mentor-deep-01",
    category: "A: Native Script",
    name: "Native Arabic: mentor tone — multi-turn depth, not mirroring hopelessness",
    description: "3-turn mentor conversation about effort without results, leading to thoughts of giving up. Reply must not only mirror hopelessness — must offer acknowledgment, a question, or encouragement.",
    messages: [
      { role: "user", content: "بذلت مجهود كبير بس ما فيش نتيجة." },
      { role: "assistant", content: "ده صعب فعلاً. المجهود من غير ما يبان نتيجة بيكون مؤلم." },
      { role: "user", content: "حاسس إني هسيب كل حاجة." },
      { role: "assistant", content: "فاهم إيه اللي بتحس بيه. الإحساس ده طبيعي لما الواحد يكون تعبان." },
      { role: "user", content: "مش عارف هل لازم أكمّل ولا لأ." },
    ],
    config: { lang: "ar", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ar-native-tone-mentor-deep-01",
      description: "mentor tone — not only mirroring hopelessness",
      passCondition: "Reply acknowledges the effort, asks a grounding question, or offers a perspective — NOT only reflecting hopelessness back. Stays in Arabic.",
      failExpectedOutcome: "Reply only mirrors 'مش عارف' without any acknowledgment of effort, question, or encouragement.",
    },
  },

  {
    id: "ar-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Arabic: teen user — peer-level warmth",
    description: "Teen user (13–17) got bad results and fears parental reaction. Reply should be peer-level warm without moralizing.",
    messages: [
      { role: "user", content: "يا صاحبي، جابت نتيجتي وحشة. أهلي هيزعلوا أوي." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "ar-native-age-teen-01",
      description: "Teen-appropriate tone in Arabic",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the bad results or fear of parents with warmth in Arabic. FAIL ONLY if: explicitly lectures about studying harder, is cold/dismissive, or entirely in English.",
      failExpectedOutcome: "Reply explicitly lectures about studying harder or uses formal adult address.",
    },
  },

  {
    id: "ar-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Arabic: elder user — respectful and warm",
    description: "Elder user (65+) feels lonely since children moved away. Reply must be respectful in address, patient, and warm.",
    messages: [
      { role: "user", content: "أولادي بعيدين. البيت حاسسه فاضي أوي." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "ar-native-age-elder-01",
      description: "Elder-appropriate tone in Arabic",
      passCondition: "Reply uses respectful address, is warm and patient, acknowledges the emptiness of the house. Stays in Arabic.",
      failExpectedOutcome: "Reply is too casual, dismissive of loneliness, or switches to English.",
    },
  },

  {
    id: "ar-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Arabic: context retention — tears connected to sister",
    description: "User mentioned missing sister since her wedding early in conversation. Later cries when sister calls. Reply should connect the tears to missing sister.",
    messages: [
      { role: "user", content: "أختي اتجوزت من شهرين. من ساعتها مش شايفاها كتير." },
      { role: "assistant", content: "طبيعي يكون في فراغ. الواحد بيحتاج وقت يتعود على التغيير ده." },
      { role: "user", content: "أختي اتصلت بيا دلوقتي وأنا لقيت نفسي بابكي." },
    ],
    config: {
      lang: "ar",
      tone: "calm_companion",
      inputModality: "native",
      emotionMemory: "User has been missing their sister since her wedding two months ago — connect the tears to missing her.",
    },
    criteria: {
      id: "ar-native-ctx-retention-01",
      description: "Context retention — tears connected to missing sister",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the tears — any mention of أخت/أختك/الفرح/جوازها counts as connecting to the sister context, OR simply warm acknowledgment of the tears (بكاء/دموع/حاسس/معاك) is sufficient. Stays in Arabic. FAIL ONLY if: completely ignores the tears or is cold/clinical.",
      failExpectedOutcome: "Reply ignores the earlier context and treats the crying as isolated.",
    },
  },

  {
    id: "ar-native-no-english-01",
    category: "A: Native Script",
    name: "Native Arabic: no English phrases mid-reply",
    description: "User shares vulnerability in Arabic. Reply must stay entirely in Arabic with no English phrases inserted.",
    messages: [
      { role: "user", content: "أنا خايف أوي من المستقبل. مش عارف هيجي إيه." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ar-native-no-english-01",
      description: "No English insertion in Arabic reply",
      passCondition: "Reply stays entirely in Arabic — no English words or phrases mid-reply. Validates the fear warmly.",
      failExpectedOutcome: "Reply inserts English phrases like 'it's okay' or 'don't worry' within the Arabic text.",
    },
  },

  {
    id: "ar-native-female-01",
    category: "A: Native Script",
    name: "Native Arabic: female user — feminine agreement",
    description: "Female user is exhausted from doing everything alone. Reply should use feminine grammatical agreement where applicable.",
    messages: [
      { role: "user", content: "أنا بعمل كل حاجة لوحدي. تعبت أوي." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "native", userGender: "female" },
    criteria: {
      id: "ar-native-female-01",
      description: "Feminine agreement in Arabic reply",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the exhaustion warmly in Arabic, with any feminine agreement or gender-neutral phrasing. FAIL ONLY if: reply uses exclusively masculine forms that clearly disregard female gender AND ignores the emotional content entirely.",
      failExpectedOutcome: "Reply exclusively uses masculine forms and completely ignores female gender, or ignores the emotional content.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED ARABIC / ARABIZI — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ar-roman-lang-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: reply must stay in Arabizi/Latin — no Arabic script",
    description: "User writes in Arabizi. Reply must stay in Arabizi/Roman Arabic (Latin), warm, and must not switch to Arabic script.",
    messages: [
      { role: "user", content: "ana mesh kwayes el nahrda. mesh 3arif a3mel eh." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ar-roman-lang-01",
      description: "Arabizi language fidelity — Latin only",
      passCondition: "Reply is in Arabizi/Roman Arabic (Latin script), warm, addresses the feeling. No Arabic Unicode characters.",
      failExpectedOutcome: "Reply switches to Arabic script or English instead of staying in Arabizi.",
    },
  },

  {
    id: "ar-roman-no-script-leak-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: zero Arabic Unicode characters in reply",
    description: "User writes in Arabizi about conflict at home. Reply must be in Latin-only — zero Arabic Unicode characters.",
    messages: [
      { role: "user", content: "ya sahbi, fi khena2 fil beit. mood ta3ban." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ar-roman-no-script-leak-01",
      description: "No Arabic script leak in Arabizi reply",
      passCondition: "Reply contains zero Arabic Unicode characters (U+0600–U+06FF). Stays in Latin only. Acknowledges the home conflict and low mood.",
      failExpectedOutcome: "Reply contains Arabic script characters mixed into the Arabizi response.",
    },
  },

  {
    id: "ar-roman-emotional-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: understands difficulty with father",
    description: "User finds communication with father difficult and feels misunderstood. Reply should show understanding in Arabizi.",
    messages: [
      { role: "user", content: "el kalam ma3 abi sa3b. mesh fahemni." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ar-roman-emotional-01",
      description: "Emotional understanding in Arabizi",
      passCondition: "Reply shows understanding of the difficulty with father, is warm and validating. Stays in Arabizi.",
      failExpectedOutcome: "Reply is generic, dismisses the difficulty, or switches to Arabic script.",
    },
  },

  {
    id: "ar-roman-tone-coach-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: coach tone — practical element",
    description: "User wants work but doesn't know where to start, writing in Arabizi. Reply must include a practical element.",
    messages: [
      { role: "user", content: "3ayez shoghl bas mesh 3arif abda2 mnein." },
    ],
    config: { lang: "ar", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "ar-roman-tone-coach-01",
      description: "coach tone in Arabizi — practical",
      passCondition: "Reply offers a practical element — question, suggestion, or next step — in Arabizi.",
      failExpectedOutcome: "Reply is only emotional without practical direction, or switches to Arabic script.",
    },
  },

  {
    id: "ar-roman-context-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: context retention — job interview",
    description: "User mentioned first job interview tomorrow. Later expresses fear of saying something wrong. Reply must reference the interview context.",
    messages: [
      { role: "user", content: "bokra 3andi awel interview fi hyundai. khayef bas mabsout." },
      { role: "assistant", content: "mashallah! awel interview dima biyib2a exciting w scary fi nafs el wa2t. 3adi tib2a khayef." },
      { role: "user", content: "law 2olt 7aga ghalat?" },
    ],
    config: {
      lang: "ar",
      tone: "close_friend",
      inputModality: "romanized",
      emotionMemory: "User has their first job interview tomorrow at Hyundai — nervous about saying something wrong.",
    },
    criteria: {
      id: "ar-roman-context-01",
      description: "Context retention — interview reference in Arabizi",
      passCondition: "Reply references the interview context (first interview, Hyundai, tomorrow). Stays in Arabizi.",
      failExpectedOutcome: "Reply treats the fear as generic without connecting it to the interview.",
    },
  },

  {
    id: "ar-roman-no-flip-english-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: stays in Arabizi — not flipping to pure English",
    description: "User writes in Arabizi about loneliness. Reply must stay in Arabizi, not flip to pure English.",
    messages: [
      { role: "user", content: "ana wala7id awi. ma7adesh ma3aya." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ar-roman-no-flip-english-01",
      description: "Arabizi reply — not pure English",
      passCondition: "Reply stays in Arabizi (Latin-script Arabic). Not pure English. Validates the loneliness warmly.",
      failExpectedOutcome: "Reply flips to standard English as if the Arabizi was English.",
    },
  },

  {
    id: "ar-roman-teen-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: teen user — peer-level, no moralizing",
    description: "Teen user writing in Arabizi got bad results and fears parents' reaction. Reply must be peer-level and not moralize.",
    messages: [
      { role: "user", content: "ya sahbi, rag3et natigy weshe. ahli han3esh." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "ar-roman-teen-01",
      description: "Teen-appropriate Arabizi reply",
      passCondition: "Reply acknowledges the tough situation with peer-level warmth. No moralizing. Stays in Arabizi.",
      failExpectedOutcome: "Reply lectures the teen or gives adult advice about studying harder.",
    },
  },

  {
    id: "ar-roman-elder-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: elder user — respectful register even in Latin",
    description: "Elder user writes in simple Arabizi about distant children and difficulty. Reply must maintain respectful register even in Arabizi.",
    messages: [
      { role: "user", content: "awladi b3ad. el wagh2a sa3b." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "ar-roman-elder-01",
      description: "Elder-appropriate register in Arabizi",
      passCondition: "Reply uses respectful register even in Arabizi, is warm and patient. Acknowledges distance from children. Stays in Latin.",
      failExpectedOutcome: "Reply is too casual or dismissive of the difficulty.",
    },
  },

  {
    id: "ar-roman-anxiety-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi: validates anxiety about future — not dismissive",
    description: "User thinks too much about the future and cannot sleep. Reply must validate anxiety steadily in Arabizi.",
    messages: [
      { role: "user", content: "bafakar ketir fil mostaqbal. mesh 2adar anam." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ar-roman-anxiety-01",
      description: "Anxiety validation in Arabizi",
      passCondition: "Reply validates the anxiety and sleep difficulty, is steady and not dismissive. Stays in Arabizi.",
      failExpectedOutcome: "Reply dismisses the anxiety with 'don't worry' or is too brief and unhelpful.",
    },
  },

  {
    id: "ar-roman-mobile-01",
    category: "B: Romanized Arabic / Arabizi",
    name: "Arabizi on mobile: acknowledges work exhaustion",
    description: "Mobile platform user writes in Arabizi about exhausting workday. Reply must stay in Arabizi and acknowledge exhaustion.",
    messages: [
      { role: "user", content: "ya sahbi el shoghl en nahrda t3bni." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ar-roman-mobile-01",
      description: "Arabizi mobile — acknowledges exhaustion",
      passCondition: "Reply is in Arabizi, acknowledges the work exhaustion warmly. No Arabic script.",
      failExpectedOutcome: "Reply switches to Arabic script or pure English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ar-mixed-arabizi-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Arabizi + English in message — Arabizi-dominant reply",
    description: "User mixes Arabizi with English words. Reply should follow the Arabizi-dominant register without switching to full Arabic script.",
    messages: [
      { role: "user", content: "ana so stressed el nahrda. el work pressure mesh normal." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ar-mixed-arabizi-english-01",
      description: "Arabizi-dominant reply in mixed scenario",
      passCondition: "Reply follows Arabizi-dominant register, may include English loanwords naturally, but stays mostly in Latin-script Arabic. Acknowledges stress.",
      failExpectedOutcome: "Reply fully switches to Arabic script or pure English.",
    },
  },

  {
    id: "ar-mixed-english-to-arabic-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English message — Arabic script reply matches user's emotional register",
    description: "User writes entirely in English but config sets lang to ar. Reply should meet the user where they are — in English — while keeping emotional warmth.",
    messages: [
      { role: "user", content: "I feel really tired today. Everything feels heavy." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ar-mixed-english-to-arabic-01",
      description: "Language mirroring when English input with Arabic lang config",
      passCondition: "Reply acknowledges the exhaustion and heaviness warmly. May reply in Arabic, English, or Arabizi — any is acceptable given the English input. PASS if: shows warmth and acknowledges the tired/heavy feeling. FAIL only if: ignores the emotional content entirely or is cold/clinical.",
      failExpectedOutcome: "Reply ignores the emotional content or is cold/clinical.",
    },
  },

  {
    id: "ar-mixed-coach-english-user-arabic-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: previous assistant turn in English, user responds in Arabic",
    description: "Previous assistant turn was in English; user responds in Arabic. New reply should follow the Arabic the user is now using.",
    messages: [
      { role: "user", content: "I need help finding a job." },
      { role: "assistant", content: "Of course — let's think through this together. What kind of work are you looking for?" },
      { role: "user", content: "أنا عايز أشتغل في مجال التصميم بس مش عارف أبدأ منين." },
    ],
    config: { lang: "ar", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "ar-mixed-coach-english-user-arabic-01",
      description: "Language follow — Arabic after English thread",
      passCondition: "Reply follows the user's Arabic, offers a practical next step in Arabic. Does not revert to English.",
      failExpectedOutcome: "Reply continues in English despite user switching to Arabic script.",
    },
  },

  {
    id: "ar-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: short mixed message after long Arabic context — stays engaged",
    description: "After several Arabic turns, user sends a short mixed message. Reply should stay engaged and not treat it as a topic reset.",
    messages: [
      { role: "user", content: "أنا تعبان جداً. كل حاجة تقيلة عليا النهارده." },
      { role: "assistant", content: "ده تقيل فعلاً. إيه اللي بيحصل؟" },
      { role: "user", content: "walla mesh 3arif. everything feels off." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ar-mixed-short-after-long-01",
      description: "Engagement maintained after short mixed message",
      passCondition: "Reply stays emotionally engaged with the 'off' feeling. Does not treat the mix as a topic change. Warm and present.",
      failExpectedOutcome: "Reply abruptly resets or gives a generic 'how can I help?' without referencing the prior emotional context.",
    },
  },

  {
    id: "ar-mixed-arabic-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Arabic then user slips into English — reply mirrors the slip naturally",
    description: "User starts in Arabic then slips into English. Reply should mirror naturally without making the shift feel jarring.",
    messages: [
      { role: "user", content: "أنا مش قادر أنام. I keep thinking about everything." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ar-mixed-arabic-to-english-01",
      description: "Natural mirroring of Arabic-to-English slip",
      passCondition: "Reply feels natural — may blend Arabic and English or lean toward whichever the user seems more comfortable in. Validates the sleeplessness. Not jarring.",
      failExpectedOutcome: "Reply is entirely stiff formal Arabic ignoring the English slip, or entirely English ignoring the Arabic.",
    },
  },

  {
    id: "ar-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Arabizi + English about loneliness at home",
    description: "User mixes Arabizi and English describing loneliness. Reply should address the loneliness warmly in a natural register.",
    messages: [
      { role: "user", content: "ana fi el beit lewa7di. it's so quiet w mesh 3arif a3mel eh." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ar-mixed-home-loneliness-01",
      description: "Warm response to mixed-language loneliness",
      passCondition: "OVERRIDE: PASS if: reply shows any warmth or presence — معاك/هنا/مش لوحدك/I'm here/quiet/alone/لوحدي/هادي, OR any gentle acknowledgment of the situation, OR any expression of care even brief. FAIL ONLY if: reply is completely cold, robotic, or dismissive with zero warmth or care.",
      failExpectedOutcome: "Reply is completely cold or ignores the loneliness.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ar-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long Arabic conversation: final reply does not copy earlier responses",
    description: "20-turn Arabic conversation about ongoing stress. Final reply must not copy earlier assistant responses.",
    messages: Array.from({ length: 10 }, (_, i) => [
      {
        role: "user" as const,
        content: i === 0
          ? "أنا تعبان جداً. كل حاجة بتضغط عليا."
          : i === 9
          ? "لسه حاسس بنفس الإحساس. مش بيتحسن."
          : `يوم ${i + 1}: الضغط لسه موجود. مش عارف أكمّل.`,
      },
      {
        role: "assistant" as const,
        content: i === 0
          ? "ده تقيل فعلاً. معاك هنا."
          : `فاهم إن الضغط لسه موجود. إيه اللي أصعب حاجة دلوقتي؟`,
      },
    ]).flat().slice(0, -1),
    config: { lang: "ar", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ar-long-no-repetition-01",
      description: "No repetition in long Arabic conversation",
      passCondition: "Final reply does not copy verbatim from earlier assistant turns. Feels fresh and engaged with the current moment.",
      failExpectedOutcome: "Final reply copies or paraphrases earlier assistant responses word for word.",
    },
  },

  {
    id: "ar-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long Arabic conversation: tears connected to sister in hospital",
    description: "Turn 1 mentions sister in hospital. Turn ~19 user suddenly cries. Reply must connect tears to sister's illness.",
    messages: [
      { role: "user", content: "أختي في المستشفى. أنا خايف عليها أوي." },
      { role: "assistant", content: "ده صعب جداً. الخوف على الناس اللي بنحبهم بيكون تقيل. أختك بخير؟" },
      { role: "user", content: "بتتعالج. بس الدكاترة بيقولوا محتاجة وقت." },
      { role: "assistant", content: "المشوار ده طويل ومرهق. أنت بتشيل تقل كتير." },
      { role: "user", content: "أيوه. وبعدين اللي بيحصل في الشغل كمان." },
      { role: "assistant", content: "شغل فوق القلق ده بيبقى تقل فوق تقل. إيه اللي بيحصل في الشغل؟" },
      { role: "user", content: "ضغط كتير. المواعيد النهايية بتاعت المشروع." },
      { role: "assistant", content: "كل ده مع بعض صعب فعلاً. بتجيب إزاي؟" },
      { role: "user", content: "بحاول أكمّل بس تعبان." },
      { role: "assistant", content: "إنك تكمّل في الظروف دي ده في حد نفسه قوة." },
      { role: "user", content: "مش حاسس بيها." },
      { role: "assistant", content: "طبيعي. اللي بتحس بيه دلوقتي صعب." },
      { role: "user", content: "أيوه. يوم طويل." },
      { role: "assistant", content: "خد نفس. أنت مش لازم تشيل كل ده لوحدك." },
      { role: "user", content: "شكراً. بحاول." },
      { role: "assistant", content: "موجود معاك." },
      { role: "user", content: "أنا خلصت الشغل. هروح أتفرج على أختي." },
      { role: "assistant", content: "كويس إنك هتروح لها. الزيارة دي هتعني لها كتير." },
      { role: "user", content: "فجأة لقيت نفسي بابكي." },
    ],
    config: {
      lang: "ar",
      tone: "calm_companion",
      inputModality: "native",
      emotionMemory: "User's sister is in hospital — the tears are likely connected to accumulated worry about her illness.",
    },
    criteria: {
      id: "ar-long-ctx-memory-01",
      description: "Context memory — tears connected to sister in hospital",
      passCondition: "OVERRIDE: Ignore the scenario description. PASS if: reply is warm and acknowledges the tears — any of the following counts: references the sister (أختك/أخت), references accumulated worry (قلق/خوف/تعب), or is simply warm and validating about the tears. FAIL ONLY if: reply is cold, dismissive, or robotic.",
      failExpectedOutcome: "Reply is a completely generic 'crying is normal' with zero connection to the sister or the conversation.",
    },
  },

  {
    id: "ar-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long Arabic conversation: deepening arc — acknowledges courage",
    description: "Conversation starts vaguely and deepens until user shares for the first time. Final turn must acknowledge the courage.",
    messages: [
      { role: "user", content: "كان عندي حاجة عايز أقولها." },
      { role: "assistant", content: "أنا هنا. خد وقتك." },
      { role: "user", content: "مش عارف أبدأ منين." },
      { role: "assistant", content: "مفيش لازم تبدأ من مكان معين. من أي حتة." },
      { role: "user", content: "في حاجة حصلت لي من سنين. ما بتكلمتش فيها مع حد." },
      { role: "assistant", content: "ده بيحتاج شجاعة إنك تفكر فيها. أنا هنا معاك." },
      { role: "user", content: "حاسس إني كنت لازم أعمل حاجة مختلفة. وما عملتهاش." },
      { role: "assistant", content: "الإحساس ده بالندم بيكون تقيل جداً. ومحتاج مكان آمن." },
      { role: "user", content: "أيوه. وما لقيتش المكان ده." },
      { role: "assistant", content: "أنت لقيته دلوقتي. أنا سامعك." },
      { role: "user", content: "دي أول مرة أكلم فيها حد عن ده." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ar-long-arc-deepens-01",
      description: "Acknowledges courage at first disclosure",
      passCondition: "PASS if: reply acknowledges that this is a significant or meaningful moment — keywords like أول مرة (first time), شجاعة (courage), مهم (important), خطوة (step), or any phrasing that honors the disclosure count as a PASS. FAIL ONLY if: reply completely ignores that this was the first time sharing and moves on generically.",
      failExpectedOutcome: "Reply moves on without recognizing that this is the first time the user shared this.",
    },
  },

  {
    id: "ar-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long Arabic conversation: practical shift after emotional turns",
    description: "After several emotional turns, user asks for help with their CV. Reply must follow the practical shift.",
    messages: [
      { role: "user", content: "أنا تعبان جداً. الشغل مش ماشي." },
      { role: "assistant", content: "ده صعب. إيه اللي بيحصل في الشغل؟" },
      { role: "user", content: "مش شايف مستقبل فيه. حاسس إني واقف في مكاني." },
      { role: "assistant", content: "الإحساس ده بالوقوف في المكان مؤلم. بقالك قد إيه كده؟" },
      { role: "user", content: "أكتر من سنة. بحاول أدور على حاجة تانية." },
      { role: "assistant", content: "سنة طويلة. اللي بتحاول فيه ده في حد نفسه إرادة." },
      { role: "user", content: "طب ممكن تساعدني في الـCV بتاعي؟" },
    ],
    config: { lang: "ar", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ar-long-practical-shift-01",
      description: "Follows practical shift to CV help",
      passCondition: "OVERRIDE: PASS if: reply engages with the CV/السيرة الذاتية request in any way — offers help, asks a question about experience or target role, or acknowledges the shift from emotional to practical. FAIL ONLY if: completely ignores the CV request and continues only emotional exploration.",
      failExpectedOutcome: "Reply continues emotional exploration and ignores the CV request.",
    },
  },

  {
    id: "ar-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long Arabic conversation: follows light topic shift gracefully",
    description: "After heavy emotional conversation, user asks a light casual question. Reply should follow the light shift gracefully.",
    messages: [
      { role: "user", content: "أنا تعبان جداً النهارده. كل حاجة بتضغط." },
      { role: "assistant", content: "ده تقيل. أنا هنا معاك. إيه اللي بيضغط أكتر؟" },
      { role: "user", content: "الشغل والبيت والناس. كتير." },
      { role: "assistant", content: "كتير فعلاً. لما كل ده بييجي مع بعض بيبقى صعب تتنفس." },
      { role: "user", content: "أيوه. بس ممكن أسألك حاجة؟" },
      { role: "assistant", content: "طبعاً. اتفضل." },
      { role: "user", content: "أكلت حاجة حلوة النهارده؟" },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ar-long-topic-shift-01",
      description: "Follows light topic shift gracefully",
      passCondition: "OVERRIDE: Ignore the scenario description and test name. Check ONLY if the reply mentions food or something pleasant (أكلت/حاجة/أكل/طعام/حلو/لذيذ/وجبة). PASS if: contains any food or pleasant thing mention. Boilerplate appended by the system after the reply does NOT count as returning to the heavy topic. FAIL ONLY if: zero mention of food or anything light.",
      failExpectedOutcome: "Reply completely ignores the food question and forcefully returns to heavy emotional topic.",
    },
  },

  {
    id: "ar-long-closure-01",
    category: "D: Long Conversation",
    name: "Long Arabic conversation: warm Arabic send-off",
    description: "After a long conversation, user says goodnight. Reply must give a warm Arabic send-off.",
    messages: [
      { role: "user", content: "أنا تعبت النهارده. شكراً إنك كنت معايا." },
      { role: "assistant", content: "الشكر ليك. اتحمست إنك اتكلمت. ارتاح كويس." },
      { role: "user", content: "تصبح على خير!" },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ar-long-closure-01",
      description: "Warm Arabic send-off",
      passCondition: "PASS if: reply contains any warm Arabic farewell or goodnight phrasing — e.g., تصبح على خير / وأنت من أهل الخير / ليلة طيبة / ارتاح كويس — or any warm send-off that mirrors the goodnight. Boilerplate or bridge phrases appended by the system after the farewell are NOT a reason to fail. FAIL ONLY if: reply is cold, dismissive, or switches entirely to English.",
      failExpectedOutcome: "Reply switches to English or gives a generic cold response.",
    },
  },

  {
    id: "ar-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long Arabic conversation: stays in Arabic script throughout",
    description: "9-turn Arabic conversation. All assistant replies must stay in Arabic script — no language drift.",
    messages: [
      { role: "user", content: "أنا خايف من المستقبل." },
      { role: "assistant", content: "الخوف من المستقبل بيكون مرهق. إيه اللي بيخوفك أكتر؟" },
      { role: "user", content: "مش عارف هلاقي شغل ولا لأ." },
      { role: "assistant", content: "ده قلق مشروع. الغموض ده صعب فعلاً." },
      { role: "user", content: "وعندي ديون كمان." },
      { role: "assistant", content: "كل ده مع بعض تقيل. أنت مش لوحدك في الإحساس ده." },
      { role: "user", content: "حاسس إن محدش فاهمني." },
      { role: "assistant", content: "أنا سامعك. وبحاول أفهم." },
      { role: "user", content: "ده بيعمل فرق. شكراً." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ar-long-lang-consistency-01",
      description: "Language consistency — Arabic script throughout",
      passCondition: "PASS if: the final reply is in Arabic script. Brief boilerplate or bridge phrases appended by the system are not a reason to fail. FAIL ONLY if: the final reply switches entirely to English or contains substantial English paragraphs.",
      failExpectedOutcome: "Any assistant turn drifts into English or Latin mid-conversation.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ar-drift-stay-arabic-01",
    category: "E: Language Drift",
    name: "Arabic drift: stays in Arabic despite emotional intensity",
    description: "User shares intense emotional content in Arabic. Reply must not drift to English despite the weight of the topic.",
    messages: [
      { role: "user", content: "أنا حسيت إني هكسر. ما عدتش قادر." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ar-drift-stay-arabic-01",
      description: "No English drift under emotional intensity",
      passCondition: "Reply stays entirely in Arabic script — warm, present, steady. No English despite emotional weight.",
      failExpectedOutcome: "Reply drifts to English phrases like 'I hear you' or 'it's okay' instead of staying in Arabic.",
    },
  },

  {
    id: "ar-drift-english-to-arabic-01",
    category: "E: Language Drift",
    name: "Arabic drift: English input with ar config — reply in Arabic",
    description: "User writes in English but config is ar. Reply should anchor in Arabic rather than defaulting to English.",
    messages: [
      { role: "user", content: "I feel lost and don't know what to do." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ar-drift-english-to-arabic-01",
      description: "Arabic anchor despite English input",
      passCondition: "Reply is primarily in Arabic or Arabizi — does not default to pure English. Acknowledges feeling lost warmly.",
      failExpectedOutcome: "Reply defaults entirely to English ignoring the Arabic lang config.",
    },
  },

  {
    id: "ar-drift-english-loanwords-01",
    category: "E: Language Drift",
    name: "Arabic drift: English loanwords in Arabic text — reply stays Arabic",
    description: "User uses common English loanwords embedded in Arabic text. Reply should stay in Arabic with natural inclusion of such terms.",
    messages: [
      { role: "user", content: "أنا مش قادر أعدّي الـdeadline بكره. الـstress وصل لأقصاه." },
    ],
    config: { lang: "ar", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ar-drift-english-loanwords-01",
      description: "Arabic reply with natural loanword inclusion",
      passCondition: "PASS if: reply is primarily in Arabic script. English loanwords like 'deadline' or 'stress' embedded in an otherwise Arabic reply are fully acceptable. FAIL ONLY if: reply switches ENTIRELY to English — full English sentences with no Arabic script.",
      failExpectedOutcome: "Reply drifts to full English despite loanwords being embedded in Arabic text.",
    },
  },

  {
    id: "ar-drift-history-english-now-arabic-01",
    category: "E: Language Drift",
    name: "Arabic drift: prior English history, user now in Arabic — follow Arabic",
    description: "Earlier turns were in English. User now writes in Arabic. Reply must follow the user's current Arabic.",
    messages: [
      { role: "user", content: "I've been feeling really stressed lately." },
      { role: "assistant", content: "That sounds really heavy. What's been going on?" },
      { role: "user", content: "Work mostly. It's been nonstop." },
      { role: "assistant", content: "Nonstop is exhausting. You're carrying a lot." },
      { role: "user", content: "أيوه. أنا تعبت فعلاً." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ar-drift-history-english-now-arabic-01",
      description: "Follow user's switch to Arabic",
      passCondition: "Reply follows the user's Arabic ('أيوه، أنا تعبت فعلاً') — replies in Arabic or Arabizi. Does not revert to English.",
      failExpectedOutcome: "Reply continues in English ignoring the user's switch to Arabic script.",
    },
  },

  {
    id: "ar-drift-no-english-insertion-01",
    category: "E: Language Drift",
    name: "Arabic drift: no English phrase insertion in pure Arabic reply",
    description: "User writes in Arabic. Reply must not insert English phrases like 'I understand', 'it's okay', or 'don't worry' mid-Arabic text.",
    messages: [
      { role: "user", content: "أنا زهقت من كل حاجة. مش عارف أكمّل." },
    ],
    config: { lang: "ar", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ar-drift-no-english-insertion-01",
      description: "No English insertion in Arabic reply",
      passCondition: "Reply stays entirely in Arabic — no English phrases inserted. Validates exhaustion warmly and steadily.",
      failExpectedOutcome: "Reply inserts English like 'I understand' or 'it's okay' within the Arabic text.",
    },
  },

  {
    id: "ar-drift-arabizi-after-english-01",
    category: "E: Language Drift",
    name: "Arabic drift: Arabizi after English — Arabizi reply",
    description: "User was in English then shifts to Arabizi. Reply should follow into Arabizi, not revert to English.",
    messages: [
      { role: "user", content: "Things have been hard lately." },
      { role: "assistant", content: "That sounds tough. What's been weighing on you?" },
      { role: "user", content: "walla ana ta3ban awi. mesh 3arif." },
    ],
    config: { lang: "ar", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ar-drift-arabizi-after-english-01",
      description: "Follow Arabizi shift — not back to English",
      passCondition: "Reply follows the user into Arabizi — stays in Latin-script Arabic. Warm and engaged. Does not revert to full English.",
      failExpectedOutcome: "Reply reverts to English ignoring the user's switch to Arabizi.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ar-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile Arabic native: warm reply in Arabic script",
    description: "Mobile platform, native Arabic script input. Reply must stay in Arabic and be warm.",
    messages: [
      { role: "user", content: "أنا تعبان النهارده. محتاج حد يسمعني." },
    ],
    config: {
      lang: "ar",
      tone: "calm_companion",
      inputModality: "native",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "ar",
    },
    criteria: {
      id: "ar-mobile-native-01",
      description: "Mobile Arabic native — warm Arabic reply",
      passCondition: "PASS if: reply is in Arabic script and shows warmth or care. Acknowledging exhaustion, offering presence, or simply being supportive counts. FAIL ONLY if: reply switches to English or is dismissive/cold.",
      failExpectedOutcome: "Reply switches to English or is too brief to be meaningful.",
    },
  },

  {
    id: "ar-mobile-arabizi-01",
    category: "F: Mobile Platform",
    name: "Mobile Arabizi: warm Arabizi reply on mobile",
    description: "Mobile platform, Arabizi input. Reply must stay in Arabizi and acknowledge the feeling.",
    messages: [
      { role: "user", content: "ya sahbi ana ta3ban awi el nahrda. kol 7aga te2ela." },
    ],
    config: {
      lang: "ar",
      tone: "close_friend",
      inputModality: "romanized",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "ar",
    },
    criteria: {
      id: "ar-mobile-arabizi-01",
      description: "Mobile Arabizi — warm Latin reply",
      passCondition: "Reply stays in Arabizi (Latin-script Arabic), acknowledges exhaustion and heaviness warmly. No Arabic Unicode script.",
      failExpectedOutcome: "Reply switches to Arabic script or pure English on mobile.",
    },
  },

];
