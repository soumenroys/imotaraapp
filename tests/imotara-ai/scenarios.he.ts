/**
 * tests/imotara-ai/scenarios.he.ts
 *
 * E2E test scenarios for Hebrew (he) language support.
 * Categories:
 *   A: Native Hebrew (12) — Hebrew script input/output
 *   B: Romanized Hebrew (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Hebrew notes:
 *  - Script: Hebrew (RTL, U+0590–U+05FF)
 *  - Address: "אתה" (ata - m) / "את" (at - f) informal; no tu/vous distinction
 *  - Gender: verbs inflect: "אתה עייף" (m) / "את עייפה" (f); "אתה לבד" / "את לבד"
 *  - Romanized: "ani lo tov", "ata sham?", "kol ha'zman", "lo yode3"
 */

import type { TestScenario } from "./types";

export const heScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE HEBREW — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "he-native-lang-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: reply must stay in Hebrew script",
    description: "User writes in Hebrew expressing feeling bad. Reply must stay in Hebrew — not switch to romanized Hebrew or English.",
    messages: [
      { role: "user", content: "אני לא מרגיש טוב היום. לא יודע מה לעשות." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "he-native-lang-01",
      description: "Language fidelity in Hebrew",
      passCondition: "Reply is primarily in Hebrew script — warm, acknowledges the bad feeling. PASS if: mostly Hebrew script and shows warmth. FAIL only if: entirely in English or entirely in Latin letters with no Hebrew at all.",
      failExpectedOutcome: "Reply is entirely in English or entirely in Latin letters with no Hebrew script.",
    },
  },

  {
    id: "he-native-ctx-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: references the specific public humiliation",
    description: "User was publicly humiliated by their boss and feels terrible. Reply should reference this specific situation.",
    messages: [
      { role: "user", content: "הבוס נזף בי מול כולם. הרגשתי נורא מושפל." },
    ],
    config: {
      lang: "he",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly humiliated by their boss in front of everyone — reference this public humiliation specifically.",
    },
    criteria: {
      id: "he-native-ctx-01",
      description: "Context specificity in Hebrew",
      passCondition: "OVERRIDE: PASS if: reply in Hebrew acknowledges the boss, the humiliation, or the shame in any way — בוס/מנהל/מושפל/מול כולם all count. FAIL ONLY if: completely generic with zero mention of boss or public context.",
      failExpectedOutcome: "Reply gives generic comfort without referencing the public humiliation.",
    },
  },

  {
    id: "he-native-tone-friend-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: close_friend tone — casual and warm",
    description: "close_friend tone — casual, warm, not preachy. User feels off today.",
    messages: [
      { role: "user", content: "היי, היום אני פשוט לא בסדר. הכול מוזר." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "he-native-tone-friend-01",
      description: "close_friend tone in Hebrew",
      passCondition: "Reply is warm and casual, stays in Hebrew. Not preachy, not cold, not overly formal. Acknowledges the off feeling.",
      failExpectedOutcome: "Reply sounds formal, gives advice, or is preachy.",
    },
  },

  {
    id: "he-native-tone-companion-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: calm_companion tone — steady and gentle",
    description: "calm_companion tone — user feels lonely and misunderstood. Reply must be present and validating, no unsolicited advice.",
    messages: [
      { role: "user", content: "אני מרגיש כל כך לבד. אף אחד לא מבין אותי." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "he-native-tone-companion-01",
      description: "calm_companion tone in Hebrew",
      passCondition: "PASS if: reply is warm and acknowledges the loneliness (לבד/מבינ/כאן/אתך). A gentle question is fine. Common warm phrases are NOT unsolicited advice. FAIL ONLY if: gives explicit actionable advice ('you should do X'), is dismissive, or switches entirely to English.",
      failExpectedOutcome: "Reply gives explicit unsolicited advice or dismisses the loneliness.",
    },
  },

  {
    id: "he-native-tone-coach-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: coach tone — practical nudge in Hebrew",
    description: "coach tone — user needs a job but doesn't know where to start. Reply should acknowledge briefly then include a practical element.",
    messages: [
      { role: "user", content: "אני צריך עבודה אבל לא יודע מאיפה להתחיל." },
    ],
    config: { lang: "he", tone: "coach", inputModality: "native" },
    criteria: {
      id: "he-native-tone-coach-01",
      description: "coach tone in Hebrew",
      passCondition: "Reply in Hebrew acknowledges briefly then includes a practical element — a question, concrete suggestion, or next step. Not purely soothing.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "he-native-tone-mentor-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: mentor tone — grounded perspective",
    description: "mentor tone — user fears making the wrong decision. Reply should offer wisdom, not platitudes.",
    messages: [
      { role: "user", content: "אני צריך לקבל החלטה חשובה אבל מפחד לטעות." },
    ],
    config: { lang: "he", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "he-native-tone-mentor-01",
      description: "mentor tone in Hebrew",
      passCondition: "OVERRIDE: PASS if: reply offers any grounded perspective, asks a question, or acknowledges the decision dilemma in Hebrew. FAIL ONLY if: cold, dismissive, or completely generic with zero guidance.",
      failExpectedOutcome: "Reply is generic comfort without any insight or guidance.",
    },
  },

  {
    id: "he-native-tone-mentor-deep-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: mentor tone — deep discouragement, goes beyond mirroring",
    description: "mentor tone — multi-turn deep discouragement. Reply must go beyond just mirroring hopelessness.",
    messages: [
      { role: "user", content: "אני מנסה קשה אבל אין תוצאות." },
      { role: "assistant", content: "אני שומע אותך. לנסות קשה ולא לראות תוצאות זה ממש מתיש." },
      { role: "user", content: "אני רוצה לוותר." },
      { role: "assistant", content: "הכאב הזה אמיתי." },
      { role: "user", content: "לא יודע אם כדאי להמשיך." },
    ],
    config: { lang: "he", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "he-native-tone-mentor-deep-01",
      description: "mentor tone depth in Hebrew",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the effort (מנסה/השקעה/מאמץ) OR asks a grounding question OR offers any encouragement — NOT only reflecting hopelessness back. Any of these counts as a pass. FAIL ONLY if: reply ONLY says 'לא יודע' or mirrors hopelessness with zero question, effort acknowledgment, or encouragement.",
      failExpectedOutcome: "Reply only mirrors hopelessness with zero question or acknowledgment of effort.",
    },
  },

  {
    id: "he-native-age-teen-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: teen register (13_17) — peer-level, no lecturing",
    description: "Teen user failed an exam and fears parental reaction. Reply must not moralize about studying.",
    messages: [
      { role: "user", content: "יא חבר, נכשלתי במבחן. ההורים יעופו עלי." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "he-native-age-teen-01",
      description: "Teen register in Hebrew",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the exam or parental fear with warmth in Hebrew. FAIL ONLY if: explicitly lectures about studying harder or is cold with zero empathy.",
      failExpectedOutcome: "Reply is preachy, parent-like, or lectures about studying.",
    },
  },

  {
    id: "he-native-age-elder-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: elder register (65_plus) — warm and respectful",
    description: "Elderly user feels lonely since children moved away. Reply must be warm, respectful, and patient.",
    messages: [
      { role: "user", content: "הילדים רחוקים. הבית כל כך ריק." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "he-native-age-elder-01",
      description: "Elder register in Hebrew",
      passCondition: "PASS if: reply is warm and acknowledges the empty home or loneliness (ריק/לבד/ילדים/מרחק). Any respectful warm acknowledgment counts. FAIL ONLY if: cold, dismissive, or completely ignores the loneliness.",
      failExpectedOutcome: "Reply is cold, dismissive, or completely ignores the loneliness.",
    },
  },

  {
    id: "he-native-ctx-retention-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: context retention — sister's wedding and tears",
    description: "Sister's wedding was mentioned early; sister calls later and user tears up. Reply must connect the tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "אחותי התחתנה לפני חודש. הבית כל כך שונה בלעדיה." },
      { role: "assistant", content: "כשאחות עוברת לחיות במקום אחר, הבית ממש משתנה." },
      { role: "user", content: "כן. כל ערב אני חושב עליה." },
      { role: "assistant", content: "אחותך ממש חסרה לך." },
      { role: "user", content: "היא עכשיו התקשרה אליי ופתאום נהייתי עם דמעות." },
    ],
    config: {
      lang: "he",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister got married and moved out last month — user misses her deeply. Connect any tears or emotion to missing the sister since her wedding.",
    },
    criteria: {
      id: "he-native-ctx-retention-01",
      description: "Context retention across turns in Hebrew",
      passCondition: "Reply connects the tears or phone call to missing the sister since her wedding — not a generic 'it's okay to cry' without context. In Hebrew.",
      failExpectedOutcome: "Reply is generic without connecting tears to the sister's wedding.",
    },
  },

  {
    id: "he-native-no-english-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: no English leak in native reply",
    description: "User shares something vulnerable in Hebrew. Reply must stay entirely in Hebrew.",
    messages: [
      { role: "user", content: "זאת הפעם הראשונה שאני אומר את זה למישהו. אני צריך שמישהו יקשיב באמת." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "he-native-no-english-01",
      description: "No English insertion in Hebrew reply",
      passCondition: "Reply stays entirely in Hebrew — no English phrases or words inserted mid-reply. Warm and truly present.",
      failExpectedOutcome: "Reply inserts English phrases like 'I'm here for you' or 'Take your time' mid-Hebrew reply.",
    },
  },

  {
    id: "he-native-female-01",
    category: "A: Native Hebrew",
    name: "Native Hebrew: female user — uses feminine forms, acknowledges exhaustion warmly",
    description: "Female user exhausted from doing everything alone. Reply uses feminine inflections and acknowledges warmly.",
    messages: [
      { role: "user", content: "אני עושה הכול לבד. אני כל כך עייפה." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "native", userGender: "female" },
    criteria: {
      id: "he-native-female-01",
      description: "Emotional engagement for female Hebrew user with feminine forms",
      passCondition: "Reply uses feminine forms (עייפה, לבד, את) appropriately — acknowledges exhaustion with warmth. Stays in Hebrew.",
      failExpectedOutcome: "Reply dismisses the exhaustion, uses masculine forms incorrectly, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED HEBREW — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "he-roman-lang-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: reply must be in romanized Hebrew (Latin)",
    description: "User writes in romanized Hebrew (Latin transliteration). Reply must also be in romanized Hebrew — not switch to Hebrew script or English.",
    messages: [
      { role: "user", content: "ani lo tov hayom. lo yodea ma la'asot." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "he-roman-lang-01",
      description: "Romanized Hebrew reply fidelity",
      passCondition: "Reply is in romanized Hebrew (Latin letters) — warm and emotionally present. No Hebrew script, no pure English.",
      failExpectedOutcome: "Reply switches to Hebrew script or pure English instead of romanized Hebrew.",
    },
  },

  {
    id: "he-roman-no-script-leak-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: zero Hebrew characters in reply",
    description: "When user writes romanized Hebrew, reply must have zero Hebrew Unicode characters.",
    messages: [
      { role: "user", content: "ata sham? ani levad mamash. eize kasheh." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "he-roman-no-script-leak-01",
      description: "No Hebrew script in romanized reply",
      passCondition: "Reply contains only Latin letters — zero Hebrew script characters. Warm and responsive to the loneliness.",
      failExpectedOutcome: "Reply contains Hebrew characters mixed into a romanized reply.",
    },
  },

  {
    id: "he-roman-emotional-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: emotional intelligence preserved",
    description: "User shares difficulty talking to parents in romanized Hebrew. Reply must show emotional attunement.",
    messages: [
      { role: "user", content: "ledaber im ima ve'aba kasheh. hem lo mevinim oti." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "he-roman-emotional-01",
      description: "Emotional intelligence in romanized Hebrew",
      passCondition: "OVERRIDE: PASS if: reply shows any warmth about difficulty with parents — in romanized Hebrew or English. FAIL ONLY if: gives generic 'just talk to them' advice with zero acknowledgment of the emotional difficulty.",
      failExpectedOutcome: "Reply gives generic advice like 'talk to them' without acknowledging the emotional difficulty.",
    },
  },

  {
    id: "he-roman-tone-coach-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: coach tone — action-oriented",
    description: "User wants to start job search but doesn't know where to begin. Coach tone in romanized Hebrew.",
    messages: [
      { role: "user", content: "ani rotze limtso avoda aval lo yodea efo lehatchil." },
    ],
    config: { lang: "he", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "he-roman-tone-coach-01",
      description: "Coach tone in romanized Hebrew",
      passCondition: "Reply in romanized Hebrew acknowledges briefly then includes a practical element — a question, concrete suggestion, or first step. Not purely soothing.",
      failExpectedOutcome: "Reply only validates the confusion without any forward direction.",
    },
  },

  {
    id: "he-roman-context-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: context retention across turns",
    description: "User mentions an important work presentation early; later expresses nervousness. Reference the presentation.",
    messages: [
      { role: "user", content: "machar yesh li mutzaga chashuvah ba'avoda." },
      { role: "assistant", content: "yesh lecha mutzaga chashuvah, hitkanavta?" },
      { role: "user", content: "ktzat. aval ani me'od mitrachesh." },
      { role: "assistant", content: "mitrachshim ze tivi, ata yachol." },
      { role: "user", content: "ma im ani ashge?" },
    ],
    config: {
      lang: "he",
      tone: "close_friend",
      inputModality: "romanized",
      emotionMemory: "User has an important work presentation tomorrow — they are nervous about making mistakes.",
    },
    criteria: {
      id: "he-roman-context-01",
      description: "Context retention in romanized Hebrew",
      passCondition: "Reply references the important presentation context and addresses the fear of making mistakes. Not generic 'you'll be fine'. In romanized Hebrew.",
      failExpectedOutcome: "Reply gives generic encouragement without referencing the presentation.",
    },
  },

  {
    id: "he-roman-no-flip-english-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: no flip to pure English",
    description: "Romanized Hebrew input must not result in a pure English reply.",
    messages: [
      { role: "user", content: "ani mamash levad. ein li mishehu." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "he-roman-no-flip-english-01",
      description: "No English flip for romanized Hebrew",
      passCondition: "Reply stays in romanized Hebrew — not pure English. Warm and validating of the loneliness.",
      failExpectedOutcome: "Reply flips to pure English, losing the romanized Hebrew register.",
    },
  },

  {
    id: "he-roman-teen-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: teen register — peer-level, no lecturing",
    description: "Teen user in romanized Hebrew — peer-level response, not preachy.",
    messages: [
      { role: "user", content: "ya chaver, nikalti bamivhan. hahorim sheli yitragu alai." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "he-roman-teen-01",
      description: "Teen register in romanized Hebrew",
      passCondition: "Reply acknowledges the tough situation (failed exam + fear of parental reaction) with warmth and peer level. Does NOT lecture about studying. In romanized Hebrew.",
      failExpectedOutcome: "Reply is preachy or gives parent-like advice about exam performance.",
    },
  },

  {
    id: "he-roman-elder-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: elder register — respectful and warm",
    description: "Elderly user in romanized Hebrew — reply uses respectful and patient register.",
    messages: [
      { role: "user", content: "hayeladim rachok. habayit reik kol kach." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "he-roman-elder-01",
      description: "Elder register in romanized Hebrew",
      passCondition: "Reply uses a respectful, warm, patient tone appropriate for an elderly person — acknowledges the empty home loneliness. In romanized Hebrew.",
      failExpectedOutcome: "Reply is overly flippant, casual, or dismissive with an elderly person.",
    },
  },

  {
    id: "he-roman-anxiety-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: anxiety — steady, not dismissive",
    description: "User shares anxiety about the future in romanized Hebrew. Reply must be steady, not dismiss or rush.",
    messages: [
      { role: "user", content: "ani choshev kol hazman al ha'atid. lo yachol lishon." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "he-roman-anxiety-01",
      description: "Anxiety handling in romanized Hebrew",
      passCondition: "Reply validates both the anxiety and the sleeplessness with genuine warmth — not dismissive ('hakol yihye beseder'). Steady and present. In romanized Hebrew.",
      failExpectedOutcome: "Reply is dismissive or immediately jumps to advice without acknowledging the anxiety.",
    },
  },

  {
    id: "he-roman-mobile-01",
    category: "B: Romanized Hebrew",
    name: "Romanized Hebrew: mobile platform — detected and responded in romanized Hebrew",
    description: "Romanized Hebrew input on mobile — language detection and reply must stay in romanized Hebrew.",
    messages: [
      { role: "user", content: "hayom ba'avoda anashim shechiku oti legalegul." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "he-roman-mobile-01",
      description: "Mobile romanized Hebrew detection",
      passCondition: "Reply is in romanized Hebrew — acknowledges the exhaustion from coworkers. Not Hebrew script, not pure English.",
      failExpectedOutcome: "Reply switches to Hebrew script or English on mobile.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "he-mixed-hebrew-english-01",
    category: "C: Mixed / Code-switched",
    name: "Hebrew-English mix: user uses loanwords — warm, addresses difficulty",
    description: "User mixes Hebrew and English describing work stress. Reply should be warm and address the difficulty.",
    messages: [
      { role: "user", content: "היה לי meeting נורא היום. אני super stressed." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "he-mixed-hebrew-english-01",
      description: "Hebrew-English mix handling",
      passCondition: "Reply is warm, addresses the difficulty (terrible meeting, stress). Any Hebrew/English mix is fine as long as it feels natural and present.",
      failExpectedOutcome: "Reply ignores the difficulty, is robotic, or switches entirely to English.",
    },
  },

  {
    id: "he-mixed-english-to-hebrew-01",
    category: "C: Mixed / Code-switched",
    name: "Switch English → Hebrew: follows user switch and stays Hebrew",
    description: "History in English; last message in Hebrew. Reply must follow the switch to Hebrew.",
    messages: [
      { role: "user", content: "I've been feeling really down lately." },
      { role: "assistant", content: "That sounds really hard. What's been going on?" },
      { role: "user", content: "Work stuff mostly and some personal things." },
      { role: "assistant", content: "Work and personal stress together can be really heavy." },
      { role: "user", content: "אני ממש לא בסדר עכשיו. לא יודע אפילו למה." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "he-mixed-english-to-hebrew-01",
      description: "Language switch to Hebrew handling",
      passCondition: "Reply follows the switch to Hebrew — stays in Hebrew, acknowledges the bad feeling warmly.",
      failExpectedOutcome: "Reply continues in English despite the user switching to Hebrew.",
    },
  },

  {
    id: "he-mixed-coach-english-user-hebrew-01",
    category: "C: Mixed / Code-switched",
    name: "Coach history in English, user ends in Hebrew — follows to Hebrew",
    description: "Coach conversation was in English; user ends with a Hebrew message. Reply must follow user to Hebrew with a practical nudge.",
    messages: [
      { role: "user", content: "I need to find a new job but don't know where to begin." },
      { role: "assistant", content: "That's a big step. What kind of work interests you?" },
      { role: "user", content: "Something in tech maybe. But I feel stuck." },
      { role: "assistant", content: "Feeling stuck is hard. Let's take it one step at a time." },
      { role: "user", content: "אני לא יודע מאיפה להתחיל בכלל." },
    ],
    config: { lang: "he", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "he-mixed-coach-english-user-hebrew-01",
      description: "Coach switch to Hebrew with practical nudge",
      passCondition: "Reply follows the user to Hebrew, gives a practical nudge or question about getting started. Not purely soothing. In Hebrew.",
      failExpectedOutcome: "Reply continues in English or gives no practical direction.",
    },
  },

  {
    id: "he-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Short message after long Hebrew conversation — stays Hebrew",
    description: "After a long Hebrew conversation, user sends a short ambiguous message. Reply must continue in Hebrew.",
    messages: [
      { role: "user", content: "אני חושב הרבה על למה אני מרגיש ככה." },
      { role: "assistant", content: "אפשר לספר לי יותר? מה אתה מרגיש?" },
      { role: "user", content: "לא בטוח. אולי בגלל מה שקרה לאחרונה." },
      { role: "assistant", content: "נראה שמה שקרה לאחרונה השפיע עליך." },
      { role: "user", content: "כן." },
      { role: "assistant", content: "בסדר. אני כאן, קח את הזמן." },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "he-mixed-short-after-long-01",
      description: "Language consistency after short message in Hebrew context",
      passCondition: "OVERRIDE: PASS if: reply contains Hebrew and stays gently present with any warm acknowledgement. FAIL ONLY if: reply switches entirely to English or is cold/robotic with no engagement.",
      failExpectedOutcome: "Reply switches to English or ignores the conversational context.",
    },
  },

  {
    id: "he-mixed-hebrew-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Switch Hebrew → English: follows user switch to English",
    description: "Hebrew conversation then user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "הכול לוחץ עלי עכשיו." },
      { role: "assistant", content: "מה לוחץ הכי הרבה?" },
      { role: "user", content: "עבודה, משפחה, הכול ביחד." },
      { role: "assistant", content: "כל כך הרבה דברים בבת אחת, זה ממש מתיש." },
      { role: "user", content: "I just can't do this anymore." },
    ],
    config: {
      lang: "he",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling with work and family in Hebrew, then switched to English — they may feel overwhelmed beyond words.",
    },
    criteria: {
      id: "he-mixed-hebrew-to-english-01",
      description: "Language switch to English in Hebrew context",
      passCondition: "OVERRIDE: PASS if: reply shows warmth or presence with the 'can't do this anymore' distress — in Hebrew, English, or mixed. Any acknowledgment of the overwhelm counts. FAIL ONLY if: completely ignores the distress or is cold/dismissive.",
      failExpectedOutcome: "Reply completely ignores the distress or is cold/dismissive.",
    },
  },

  {
    id: "he-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Hebrew-English: empty home loneliness — warm, addresses emptiness",
    description: "User mixes Hebrew and English to describe coming home to an empty house. Reply must address the empty home specifically.",
    messages: [
      { role: "user", content: "חזרתי הביתה ו-nobody's here. כל כך lonely." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "he-mixed-home-loneliness-01",
      description: "Empty home loneliness in Hebrew-English mix",
      passCondition: "Reply is warm and addresses the emptiness of coming home to no one specifically — not generic comfort. Any Hebrew/English mix is fine.",
      failExpectedOutcome: "Reply is generic, misses the specific 'empty home' detail, or is cold.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "he-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long conversation: final reply does not copy earlier responses",
    description: "20-turn conversation where user shares different aspects of sadness each turn. Final reply must not repeat any earlier assistant response.",
    messages: Array.from({ length: 10 }, (_, i) => [
      {
        role: "user" as const,
        content: `${["אני ממש עייף עכשיו", "בעבודה יש לחץ עצום", "גם בבית אין מנוחה", "אני לא ישן טוב", "אין לי תיאבון", "אני לא מבין מה הטעם", "החברים לא מבינים אותי", "עדיף לי לבד", "לא בטוח אם זה עוזר לדבר", "אני ממש על הסף"][i]}。`,
      },
      {
        role: "assistant" as const,
        content: `${["אני שומע אותך", "הלחץ בעבודה הוא עצום", "לא לנשום בשום מקום זה קשה", "גם הגוף מרגיש את הכול", "הגוף מגיב לקושי", "זו שאלה חשובה", "להרגיש לא מובן זה בודד", "לפעמים צריך להיות לבד", "אתה כאן ואני שומע אותך", "התשישות הזאת אמיתית"][i]}。`,
      },
    ]).flat(),
    config: {
      lang: "he",
      tone: "calm_companion",
      inputModality: "native",
      emotionMemory: "User has been sharing ongoing sadness and exhaustion across 20 turns — do not repeat earlier replies.",
    },
    criteria: {
      id: "he-long-no-repetition-01",
      description: "No repetition in 20-turn Hebrew",
      passCondition: "OVERRIDE: PASS if: reply is in Hebrew and shows any presence or empathy for the user's exhaustion — phrases like אני כאן/אתה לא לבד/ממשיך or any fresh response count. FAIL ONLY if: reply is in English or entirely cold/robotic.",
      failExpectedOutcome: "Reply repeats an earlier response verbatim.",
    },
  },

  {
    id: "he-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long conversation: connects tears to sister in hospital",
    description: "Turn 1 mentions sister in hospital. After many turns of daily chat, user says they cried for no reason. Reply must connect tears to the sister.",
    messages: [
      { role: "user", content: "אחותי באשפוז. אני מאוד דואג לה." },
      { role: "assistant", content: "זה מאוד קשה כשמישהי קרובה מאושפזת. איך אתה מחזיק?" },
      { role: "user", content: "בסדר. ממשיך בשגרה." },
      { role: "assistant", content: "שגרה יכולה לעזור לעמוד בזמנים כאלה." },
      { role: "user", content: "כן. עבדתי כל היום." },
      { role: "assistant", content: "עבודה לפעמים מסיחה את הדעת." },
      { role: "user", content: "הכנתי ארוחת ערב, ניסיתי לחשוב על משהו אחר." },
      { role: "assistant", content: "לדאוג לעצמך זה חשוב." },
      { role: "user", content: "ראיתי סרט, היה בסדר." },
      { role: "assistant", content: "טוב שהצלחת לנוח קצת." },
      { role: "user", content: "הלילה שקט לפחות." },
      { role: "assistant", content: "השקט בלילה לפעמים נותן קצת מרחב." },
      { role: "user", content: "אני מקווה שמחר יהיה יותר טוב." },
      { role: "assistant", content: "גם אני מקווה יחד איתך." },
      { role: "user", content: "תודה שאתה כאן." },
      { role: "assistant", content: "תמיד." },
      { role: "user", content: "היום היה קצת יותר טוב." },
      { role: "assistant", content: "שמח לשמוע." },
      { role: "user", content: "פתאום בכיתי בלי סיבה. לא הבנתי למה." },
    ],
    config: {
      lang: "he",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister is hospitalized — user has been carrying this worry. Connect any tears or unexpected emotion to the underlying worry about the sister.",
    },
    criteria: {
      id: "he-long-ctx-memory-01",
      description: "Context memory for sister's hospitalization in Hebrew",
      passCondition: "Reply connects the unexpected tears to the underlying worry about the sister's hospitalization — not purely 'it's normal to cry' without context. In Hebrew.",
      failExpectedOutcome: "Reply treats the tears as random without connecting them to the sister's situation.",
    },
  },

  {
    id: "he-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long conversation: emotional arc deepens — acknowledges courage and journey",
    description: "Conversation starts light and deepens over turns to a first-time disclosure. Reply must acknowledge the courage and depth.",
    messages: [
      { role: "user", content: "יש לי משהו שרציתי לומר אבל לא יודע איך להתחיל." },
      { role: "assistant", content: "קח את הזמן שלך. אני כאן." },
      { role: "user", content: "זה מסובך. זה כבר הרבה זמן." },
      { role: "assistant", content: "הרבה זמן... זה בטח כבד." },
      { role: "user", content: "כן. שנה קשה." },
      { role: "assistant", content: "שנה שלמה, לבד עם זה. זה ממש לא פשוט." },
      { role: "user", content: "ניסיתי לדבר עם אנשים אבל הם לא הבינו." },
      { role: "assistant", content: "לנסות ולא להיות מובן, זה מאוד מיואש." },
      { role: "user", content: "זאת הפעם הראשונה שמישהו באמת מקשיב לי." },
    ],
    config: { lang: "he", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "he-long-arc-deepens-01",
      description: "Arc deepening acknowledgment in Hebrew",
      passCondition: "OVERRIDE: PASS if: reply acknowledges that this is significant or meaningful — keywords like הפעם הראשונה (first time), אומץ (courage), חשוב (important), צעד (step), שנה (year), לא לבד (not alone), or any phrasing that honors this moment count. FAIL ONLY if: reply completely ignores that this was the first time sharing and moves on generically.",
      failExpectedOutcome: "Reply moves on without recognizing the significance of the first disclosure.",
    },
  },

  {
    id: "he-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: shifts to practical advice on request",
    description: "After emotional turns, user asks for practical advice. Reply must shift to practical help.",
    messages: [
      { role: "user", content: "ממש קשה לי עכשיו. הכול קשה." },
      { role: "assistant", content: "אני שומע אותך. כל כך הרבה דברים ביחד." },
      { role: "user", content: "תודה. אני בכל זאת מנסה להמשיך." },
      { role: "assistant", content: "להמשיך בכל זאת זה לא פחות מהישג." },
      { role: "user", content: "טוב, איך אני משפר את קורות החיים שלי?" },
    ],
    config: { lang: "he", tone: "coach", inputModality: "native" },
    criteria: {
      id: "he-long-practical-shift-01",
      description: "Practical shift to resume advice in Hebrew",
      passCondition: "Reply shifts to practical resume advice — concrete suggestions or questions about the resume. In Hebrew.",
      failExpectedOutcome: "Reply continues in emotional mode without addressing the resume question.",
    },
  },

  {
    id: "he-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: light topic shift — follows gracefully",
    description: "After a heavy emotional conversation, user asks a light casual question. Reply should follow the shift gracefully.",
    messages: [
      { role: "user", content: "ממש קשה לי עכשיו, הכול מצטבר." },
      { role: "assistant", content: "זה הרבה לשאת. אני כאן." },
      { role: "user", content: "תודה. עוזר לדבר." },
      { role: "assistant", content: "תמיד אפשר לדבר." },
      { role: "user", content: "אכלת משהו טעים היום?" },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "he-long-topic-shift-01",
      description: "Light topic shift handling in Hebrew",
      passCondition: "Reply follows the light topic shift gracefully — warm and natural. Does not force a return to the heavy topic. In Hebrew.",
      failExpectedOutcome: "Reply insists on returning to the heavy topic or ignores the shift entirely.",
    },
  },

  {
    id: "he-long-closure-01",
    category: "D: Long Conversation",
    name: "Long conversation: warm goodnight send-off in Hebrew",
    description: "User says goodnight after a long emotional conversation. Reply should be a warm brief send-off in Hebrew.",
    messages: [
      { role: "user", content: "היום דיברנו הרבה. הרגשתי יותר טוב." },
      { role: "assistant", content: "שמח שדיברנו. תנוח טוב." },
      { role: "user", content: "תודה על הכול. לילה טוב." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "he-long-closure-01",
      description: "Warm closure in Hebrew",
      passCondition: "Reply is a warm brief send-off in Hebrew — simple, genuine, not overly long. Matches the closure energy.",
      failExpectedOutcome: "Reply is cold, robotic, or reopens the heavy conversation unnecessarily.",
    },
  },

  {
    id: "he-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long conversation: language stays Hebrew throughout",
    description: "9-turn Hebrew conversation. Final reply must stay in Hebrew.",
    messages: [
      { role: "user", content: "אני מרגיש קצת אבוד לאחרונה." },
      { role: "assistant", content: "אבוד באיזה מובן?" },
      { role: "user", content: "בעבודה, במערכות יחסים, בכל מיני דברים." },
      { role: "assistant", content: "כשהכול מתרחש בו זמנית, קשה למצוא אנקרה." },
      { role: "user", content: "בדיוק. אני מרגיש שאני מרחף." },
      { role: "assistant", content: "תחושת הריחוף הזאת יכולה להיות ממש מטרידה." },
      { role: "user", content: "כן. אני מנסה למצוא מה באמת חשוב לי." },
      { role: "assistant", content: "החיפוש הזה עצמו משמעותי, גם אם אי נוח עכשיו." },
      { role: "user", content: "אתה חושב שאמצא?" },
    ],
    config: { lang: "he", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "he-long-lang-consistency-01",
      description: "Language consistency in long Hebrew conversation",
      passCondition: "OVERRIDE: PASS if: reply is primarily in Hebrew and responds warmly to 'do you think I'll find it?' with any reflection or encouragement. FAIL ONLY if: reply is entirely in English.",
      failExpectedOutcome: "Reply switches to English or mixes English phrases in.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "he-drift-native-stay-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Hebrew — reply stays in Hebrew",
    description: "Baseline: user writes Hebrew. Reply must stay in Hebrew.",
    messages: [
      { role: "user", content: "אני עייף. אין לי כוח להמשיך." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "he-drift-native-stay-01",
      description: "Hebrew drift: stay in Hebrew",
      passCondition: "Reply stays fully in Hebrew script — addresses the exhaustion and hopelessness warmly.",
      failExpectedOutcome: "Reply drifts to English or romanized Hebrew.",
    },
  },

  {
    id: "he-drift-english-to-hebrew-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Hebrew",
    description: "Previous turns in English; last message in Hebrew. Reply must follow to Hebrew.",
    messages: [
      { role: "user", content: "I've been feeling really sad lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "אני עצוב ולא יודע למה." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "he-drift-english-to-hebrew-01",
      description: "Follow switch from English to Hebrew",
      passCondition: "Reply follows the user's switch to Hebrew — stays in Hebrew and addresses the sadness warmly.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Hebrew.",
    },
  },

  {
    id: "he-drift-loanwords-stay-hebrew-01",
    category: "E: Language Drift",
    name: "Language drift: Hebrew with English loanwords — reply stays Hebrew",
    description: "User uses English loanwords inside Hebrew. Reply must stay primarily in Hebrew — not switch to English.",
    messages: [
      { role: "user", content: "הייתי ב-meeting נורא היום. כל כך stressed." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "he-drift-loanwords-stay-hebrew-01",
      description: "Hebrew stays Hebrew despite English loanwords",
      passCondition: "OVERRIDE: PASS if: reply is primarily in Hebrew and acknowledges the bad meeting or stress. Hebrew with English loanwords is fine. FAIL ONLY if: reply switches entirely to English.",
      failExpectedOutcome: "Reply switches fully to English because user used English loanwords.",
    },
  },

  {
    id: "he-drift-history-english-hebrew-now-01",
    category: "E: Language Drift",
    name: "Language drift: long English history, user now writes Hebrew",
    description: "Long English conversation history; user's final message is in Hebrew. Reply must follow.",
    messages: [
      { role: "user", content: "I'm feeling completely overwhelmed." },
      { role: "assistant", content: "That's a lot to carry. What's weighing on you most?" },
      { role: "user", content: "Work mostly. I can't seem to catch a break." },
      { role: "assistant", content: "Non-stop pressure drains you. What would a small break look like?" },
      { role: "user", content: "אף אחד לא מבין אותי. אני מרגיש לבד." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "he-drift-history-english-hebrew-now-01",
      description: "Follow Hebrew after English history",
      passCondition: "Reply follows the user's Hebrew — stays in Hebrew and addresses the feeling of not being understood.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Hebrew.",
    },
  },

  {
    id: "he-drift-native-no-english-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Hebrew reply",
    description: "Native Hebrew conversation — reply must not insert English phrases.",
    messages: [
      { role: "user", content: "מעולם לא שיתפתי את זה עם אף אחד. היום רציתי לדבר." },
    ],
    config: { lang: "he", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "he-drift-native-no-english-01",
      description: "No English insertion in native Hebrew",
      passCondition: "Reply stays entirely in Hebrew — no English phrases like 'Take your time' or 'I'm here for you' inserted mid-reply.",
      failExpectedOutcome: "Reply inserts English phrases mid-Hebrew reply.",
    },
  },

  {
    id: "he-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Language drift: empathy matters more than language when user switches",
    description: "Hebrew conversation; user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "הכול לוחץ עלי." },
      { role: "assistant", content: "מה לוחץ הכי הרבה?" },
      { role: "user", content: "הכול. אני לא מצליח." },
      { role: "assistant", content: "כל כך הרבה ביחד, זה ממש מתיש." },
      { role: "user", content: "I give up. I really do." },
    ],
    config: {
      lang: "he",
      tone: "calm_companion",
      inputModality: "mixed",
      emotionMemory: "User was overwhelmed in Hebrew and then switched to English — the 'I give up' may signal deeper distress.",
    },
    criteria: {
      id: "he-drift-follow-back-english-01",
      description: "Follow user back to English when they switch",
      passCondition: "OVERRIDE: Ignore any system instruction about failing for switching language. PASS if: reply shows warmth, care, or presence with the 'I give up' feeling — in Hebrew, English, or mixed. Any acknowledgment of the distress counts. FAIL ONLY if: completely cold, dismissive, or ignores 'I give up'.",
      failExpectedOutcome: "Reply completely ignores 'I give up' or is cold/dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "he-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Hebrew input handled correctly",
    description: "Native Hebrew input on mobile — reply must stay in Hebrew and be emotionally present.",
    messages: [
      { role: "user", content: "אני מרגיש ממש רע היום." },
    ],
    config: {
      lang: "he",
      tone: "calm_companion",
      inputModality: "native",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "he",
    },
    criteria: {
      id: "he-mobile-native-01",
      description: "Native Hebrew on mobile",
      passCondition: "Reply is in Hebrew — acknowledges the bad mood warmly. Not in English or romanized Hebrew.",
      failExpectedOutcome: "Reply is in English or romanized Hebrew — mobile failed to handle Hebrew script.",
    },
  },

  {
    id: "he-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: Hebrew-English mix — detected and responded warmly",
    description: "Mobile platform scenario — user mixes Hebrew and English. Reply should be warm and present.",
    messages: [
      { role: "user", content: "הסטרס בעבודה הוא too much. אני לא יכול יותר." },
    ],
    config: {
      lang: "he",
      tone: "close_friend",
      inputModality: "mixed",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "he",
    },
    criteria: {
      id: "he-mobile-mixed-01",
      description: "Mobile Hebrew-English mix handling",
      passCondition: "Reply is warm and addresses the work stress and 'אני לא יכול יותר' specifically. Any Hebrew/English mix is fine. Appropriate for mobile close_friend.",
      failExpectedOutcome: "Reply is cold, robotic, or ignores the specific work stress detail.",
    },
  },

];
