/**
 * tests/imotara-ai/scenarios.ja.ts
 *
 * E2E test scenarios for Japanese (ja) language support.
 * Categories:
 *   A: Native Japanese (12) — Hiragana/Katakana/Kanji input/output
 *   B: Romaji (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Japanese notes:
 *  - Script: Mix of Hiragana (U+3040–U+309F), Katakana (U+30A0–U+30FF), Kanji
 *  - Formality: Plain form (だ/する) casual; polite form (です/ます) for elder/formal
 *  - Gender: Japanese pronouns differ: "僕/俺" (boku/ore - male), "私/あたし" (watashi/atashi - neutral/female)
 *  - Romaji: Latin transliteration: "watashi wa tsukareta", "daijoubu?", "nandemo nai"
 */

import type { TestScenario } from "./types";

export const jaScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE JAPANESE — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ja-native-lang-01",
    category: "A: Native Japanese",
    name: "Native Japanese: reply must stay in Japanese script",
    description: "User writes in Japanese expressing bad mood. Reply must stay in Japanese — not switch to Romaji or English.",
    messages: [
      { role: "user", content: "今日は本当につらい。どうしたらいいかわからない。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ja-native-lang-01",
      description: "Language fidelity in Japanese",
      passCondition: "Reply is in Japanese script (hiragana/kanji/katakana) — warm, addresses the user's pain. Not in Romaji or English.",
      failExpectedOutcome: "Reply switches to English or Romaji instead of staying in Japanese script.",
    },
  },

  {
    id: "ja-native-ctx-01",
    category: "A: Native Japanese",
    name: "Native Japanese: references the specific public humiliation",
    description: "User was scolded by their boss in front of everyone and feels humiliated. Reply should reference this specific situation.",
    messages: [
      { role: "user", content: "上司にみんなの前で怒られた。すごく恥ずかしかった。" },
    ],
    config: {
      lang: "ja",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly scolded by their boss in front of everyone — reference this public humiliation specifically.",
    },
    criteria: {
      id: "ja-native-ctx-01",
      description: "Context specificity in Japanese",
      passCondition: "Check if the reply contains any of these: みんな (everyone), 前で (in front of), 上司 (boss), 恥ずかし (embarrassing), 怒られ (scolded). PASS if any of these appear. FAIL only if the reply is 100% generic comfort with zero mention of the public scolding.",
      failExpectedOutcome: "Reply is 100% generic comfort with zero mention of the public scolding.",
    },
  },

  {
    id: "ja-native-tone-friend-01",
    category: "A: Native Japanese",
    name: "Native Japanese: close_friend tone — casual ため口, warm",
    description: "close_friend tone — casual ため口 (plain form), warm, not preachy. User feels off today.",
    messages: [
      { role: "user", content: "ねえ、今日ちょっと気分がよくない。なんか変な感じ。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ja-native-tone-friend-01",
      description: "close_friend tone in Japanese",
      passCondition: "Reply is warm and acknowledges the off/strange feeling. PASS if: stays in Japanese and doesn't moralize or lecture. A mix of casual and some polite phrases is acceptable. FAIL only if: overly formal throughout (entirely です/ます throughout in stiff way), explicitly preachy, or switches to English.",
      failExpectedOutcome: "Reply is entirely stiff/formal throughout, explicitly preachy, or switches to English.",
    },
  },

  {
    id: "ja-native-tone-companion-01",
    category: "A: Native Japanese",
    name: "Native Japanese: calm_companion tone — steady and gentle",
    description: "calm_companion tone — user feels lonely and misunderstood. Reply must be present and validating, no unsolicited advice.",
    messages: [
      { role: "user", content: "すごく孤独を感じる。誰にも理解してもらえない。" },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ja-native-tone-companion-01",
      description: "calm_companion tone in Japanese",
      passCondition: "Reply validates the loneliness and stays present. PASS if: acknowledges the lonely/misunderstood feeling warmly without dismissing it. Asking one gentle question is fine. FAIL only if: gives strong unsolicited advice, minimizes the feeling, or dismisses the loneliness.",
      failExpectedOutcome: "Reply minimizes the loneliness or pushes strong unsolicited advice.",
    },
  },

  {
    id: "ja-native-tone-coach-01",
    category: "A: Native Japanese",
    name: "Native Japanese: coach tone — practical nudge in Japanese",
    description: "coach tone — user needs a job but doesn't know where to start. Reply should acknowledge briefly then include a practical element.",
    messages: [
      { role: "user", content: "仕事が必要なんだけど、どこから始めればいいかわからない。" },
    ],
    config: { lang: "ja", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ja-native-tone-coach-01",
      description: "coach tone in Japanese",
      passCondition: "Reply in Japanese acknowledges briefly then includes a practical element — a question, concrete suggestion, or next step. Not purely soothing.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "ja-native-tone-mentor-01",
    category: "A: Native Japanese",
    name: "Native Japanese: mentor tone — grounded perspective",
    description: "mentor tone — user fears making the wrong decision. Reply should offer wisdom, not platitudes.",
    messages: [
      { role: "user", content: "大切な決断をしないといけないんだけど、失敗が怖い。" },
    ],
    config: { lang: "ja", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ja-native-tone-mentor-01",
      description: "mentor tone in Japanese",
      passCondition: "Reply shows any engagement with the fear of making the wrong decision. PASS if: asks about the decision, validates that fear of mistakes is normal, or offers any perspective (even simple). FAIL only if: purely 'don't worry' with zero engagement with the decision or fear of failure.",
      failExpectedOutcome: "Reply is purely 'don't worry' with zero engagement with the decision or fear of failure.",
    },
  },

  {
    id: "ja-native-tone-mentor-deep-01",
    category: "A: Native Japanese",
    name: "Native Japanese: mentor tone — deep discouragement, goes beyond mirroring",
    description: "mentor tone — multi-turn deep discouragement. Reply must go beyond just mirroring hopelessness.",
    messages: [
      { role: "user", content: "頑張ってるのに結果が出ない。" },
      { role: "assistant", content: "それは本当につらいね。頑張ってるのに報われないと感じるんだね。" },
      { role: "user", content: "もう全部やめたい。" },
      { role: "assistant", content: "その気持ち、わかるよ。" },
      { role: "user", content: "続けるべきかわからない。" },
    ],
    config: { lang: "ja", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ja-native-tone-mentor-deep-01",
      description: "mentor tone depth in Japanese",
      passCondition: "OVERRIDE: PASS if: reply is in Japanese and shows any engagement beyond pure mirroring — a question, acknowledgment of effort, or any gentle reframe counts. FAIL ONLY if: reply ONLY mirrors 'やめたい/わからない' with zero question or perspective shift.",
      failExpectedOutcome: "Reply only mirrors the user's hopelessness without any question, reframe, or shift in perspective.",
    },
  },

  {
    id: "ja-native-age-teen-01",
    category: "A: Native Japanese",
    name: "Native Japanese: teen register (13_17) — peer-level, no lecturing",
    description: "Teen user failed an exam and fears parental reaction. Reply must not moralize about studying.",
    messages: [
      { role: "user", content: "ねえ、テスト失敗した。親にめっちゃ怒られる。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "ja-native-age-teen-01",
      description: "Teen register in Japanese",
      passCondition: "Reply is warm toward the teen's situation. PASS if: shows any empathy for the failed test or the fear of parents' reaction — does not lecture. FAIL only if: explicitly lectures about studying harder or is dismissive.",
      failExpectedOutcome: "Reply explicitly lectures about studying harder or dismisses the teen's concern.",
    },
  },

  {
    id: "ja-native-age-elder-01",
    category: "A: Native Japanese",
    name: "Native Japanese: elder register (65_plus) — polite です/ます, warm and respectful",
    description: "Elderly user feels lonely since children moved away. Reply must use polite です/ます form.",
    messages: [
      { role: "user", content: "子どもたちは遠くに行ってしまった。家が寂しい。" },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "ja-native-age-elder-01",
      description: "Elder register in Japanese",
      passCondition: "Reply is warm and respectful to an elderly person, acknowledges the loneliness of an empty home. PASS if: uses polite form (です/ます) OR respectful phrasing — does not feel casual/dismissive. FAIL only if: uses exclusively casual plain form (だ/だよ) in an informal/dismissive way, or is cold.",
      failExpectedOutcome: "Reply is in casual dismissive plain form or is cold and uncaring.",
    },
  },

  {
    id: "ja-native-ctx-retention-01",
    category: "A: Native Japanese",
    name: "Native Japanese: context retention — sister's wedding and tears",
    description: "Sister's wedding was mentioned early; sister calls later and user tears up. Reply must connect the tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "先月、姉が結婚して家を出た。なんか家が空っぽな感じ。" },
      { role: "assistant", content: "姉が出て行くと、家の雰囲気ってほんとに変わるよね。" },
      { role: "user", content: "うん。毎晩なんか思い出す。" },
      { role: "assistant", content: "お姉さんのこと、ずっと気にしてるんだね。" },
      { role: "user", content: "さっきお姉ちゃんから電話来て、なんか泣いちゃった。" },
    ],
    config: {
      lang: "ja",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister got married and moved out last month — user misses her deeply. Connect any tears or emotion to missing the sister since her wedding.",
    },
    criteria: {
      id: "ja-native-ctx-retention-01",
      description: "Context retention across turns in Japanese",
      passCondition: "Reply acknowledges the tears with personal context — shows awareness of the sister or the longing behind the tears. Any warm reply that references the sister, missing her, or the call in context of the wedding counts as a pass. In Japanese.",
      failExpectedOutcome: "Reply is completely generic about crying with zero connection to the sister or the conversation.",
    },
  },

  {
    id: "ja-native-no-english-01",
    category: "A: Native Japanese",
    name: "Native Japanese: no English leak in native reply",
    description: "User shares something vulnerable in Japanese. Reply must stay entirely in Japanese.",
    messages: [
      { role: "user", content: "こんなこと誰かに話すの初めてだ。ちゃんと聞いてほしい。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ja-native-no-english-01",
      description: "No English insertion in Japanese reply",
      passCondition: "Reply stays entirely in Japanese — no English phrases or words inserted mid-reply. Warm and truly present.",
      failExpectedOutcome: "Reply inserts English phrases like 'I'm here for you' or 'Take your time' mid-Japanese reply.",
    },
  },

  {
    id: "ja-native-female-01",
    category: "A: Native Japanese",
    name: "Native Japanese: female user — acknowledges exhaustion warmly",
    description: "Female user exhausted from doing everything alone. Reply acknowledges warmly in Japanese.",
    messages: [
      { role: "user", content: "全部一人でやってる。疲れた。" },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "native", userGender: "female" },
    criteria: {
      id: "ja-native-female-01",
      description: "Emotional engagement for female Japanese user",
      passCondition: "Reply acknowledges exhaustion with warmth — validates carrying everything alone. Stays in Japanese.",
      failExpectedOutcome: "Reply dismisses or minimizes the exhaustion, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMAJI — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ja-roman-lang-01",
    category: "B: Romaji",
    name: "Romaji input: reply must be in Romaji (Latin)",
    description: "User writes in Romaji (Latin transliteration of Japanese). Reply must also be in Romaji — not switch to Japanese script or English.",
    messages: [
      { role: "user", content: "watashi wa kyou hontou ni tsurakatta. dou shitara ii ka wakaranai." },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ja-roman-lang-01",
      description: "Romaji reply fidelity",
      passCondition: "Reply is in Romaji (Latin letters) — warm and emotionally present. No Japanese script, no pure English.",
      failExpectedOutcome: "Reply switches to Japanese script or pure English instead of Romaji.",
    },
  },

  {
    id: "ja-roman-no-script-leak-01",
    category: "B: Romaji",
    name: "Romaji input: zero Japanese characters in reply",
    description: "When user writes Romaji, reply must have zero Japanese Unicode characters.",
    messages: [
      { role: "user", content: "mou yaritakunai. zenbu iya ni natta." },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ja-roman-no-script-leak-01",
      description: "No Japanese script in Romaji reply",
      passCondition: "Reply contains only Latin letters — zero hiragana/katakana/kanji characters. Warm and responsive to the feeling.",
      failExpectedOutcome: "Reply contains Japanese script characters mixed into a Romaji reply.",
    },
  },

  {
    id: "ja-roman-emotional-01",
    category: "B: Romaji",
    name: "Romaji input: emotional intelligence preserved",
    description: "User shares difficulty being alone and scared in Romaji. Reply must show emotional attunement.",
    messages: [
      { role: "user", content: "hitori ga kowai. dare mo inai." },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ja-roman-emotional-01",
      description: "Emotional intelligence in Romaji",
      passCondition: "Reply shows understanding of the fear of being alone — warm, specific, not generic. In Romaji.",
      failExpectedOutcome: "Reply gives generic advice without acknowledging the specific fear and loneliness.",
    },
  },

  {
    id: "ja-roman-tone-coach-01",
    category: "B: Romaji",
    name: "Romaji input: coach tone — action-oriented in Romaji",
    description: "User wants to start job search but doesn't know where to begin. Coach tone in Romaji.",
    messages: [
      { role: "user", content: "shigoto sagashitai kedo doko kara hajimeba ii ka wakaranai." },
    ],
    config: { lang: "ja", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "ja-roman-tone-coach-01",
      description: "Coach tone in Romaji",
      passCondition: "Reply in Romaji acknowledges briefly then includes a practical element — a question, concrete suggestion, or first step. Not purely soothing.",
      failExpectedOutcome: "Reply only validates the confusion without any forward direction.",
    },
  },

  {
    id: "ja-roman-context-01",
    category: "B: Romaji",
    name: "Romaji input: context retention across turns",
    description: "User mentions an upcoming job interview early; later expresses nervousness. Reference the interview.",
    messages: [
      { role: "user", content: "ashita daijina mensetsu ga aru." },
      { role: "assistant", content: "sore wa daiji da ne. junbi dekiteru?" },
      { role: "user", content: "sukoshi shita. demo kincho shiteru." },
      { role: "assistant", content: "kincho suru no wa futsuu da yo. daijoubu." },
      { role: "user", content: "moshi dame dattara dou shiyou." },
    ],
    config: {
      lang: "ja",
      tone: "close_friend",
      inputModality: "romanized",
      emotionMemory: "User has an important job interview tomorrow — they are nervous about failing.",
    },
    criteria: {
      id: "ja-roman-context-01",
      description: "Context retention in Romaji",
      passCondition: "Reply references the interview context and addresses the fear of failure specifically. Not generic 'you'll be fine'. In Romaji.",
      failExpectedOutcome: "Reply gives generic encouragement without referencing the interview.",
    },
  },

  {
    id: "ja-roman-no-flip-english-01",
    category: "B: Romaji",
    name: "Romaji input: no flip to pure English",
    description: "Romaji input must not result in a pure English reply.",
    messages: [
      { role: "user", content: "tsurakute. nandemo nai furi shiteru kedo hontou wa tsurakute." },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ja-roman-no-flip-english-01",
      description: "No English flip for Romaji",
      passCondition: "Reply stays in Romaji — not pure English. Warm and validating — acknowledges pretending to be fine while hurting inside.",
      failExpectedOutcome: "Reply flips to pure English, losing the Romaji register.",
    },
  },

  {
    id: "ja-roman-teen-01",
    category: "B: Romaji",
    name: "Romaji input: teen register — peer-level, no lecturing",
    description: "Teen user in Romaji — peer-level response, not preachy.",
    messages: [
      { role: "user", content: "ne, tesuto shippai shita. oya ni meccha okarareru." },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "ja-roman-teen-01",
      description: "Teen register in Romaji",
      passCondition: "Reply acknowledges the tough situation (failed test + fear of parental reaction) with warmth and peer level. Does NOT lecture about studying. In Romaji.",
      failExpectedOutcome: "Reply is preachy or gives parent-like advice about exam performance.",
    },
  },

  {
    id: "ja-roman-elder-01",
    category: "B: Romaji",
    name: "Romaji input: elder register — polite form in Romaji",
    description: "Elderly user in Romaji — reply uses polite/respectful register in Romaji.",
    messages: [
      { role: "user", content: "kodomotachi wa tooku ni itte shimatta. ie ga samishii." },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "ja-roman-elder-01",
      description: "Elder register in Romaji",
      passCondition: "Reply uses polite/respectful register in Romaji (desu/masu equivalent phrasing) — warm, patient. Does not use overly casual tone with an elderly person. In Romaji.",
      failExpectedOutcome: "Reply is overly casual or loses the respectful register with an elderly person.",
    },
  },

  {
    id: "ja-roman-anxiety-01",
    category: "B: Romaji",
    name: "Romaji input: anxiety — steady, not dismissive",
    description: "User shares anxiety about the future in Romaji. Reply must be steady, not dismiss or rush.",
    messages: [
      { role: "user", content: "mirai no koto bakari kangaete neru koto ga dekinai." },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "ja-roman-anxiety-01",
      description: "Anxiety handling in Romaji",
      passCondition: "Reply validates both the anxiety and the sleeplessness with genuine warmth — not dismissive ('daijoubu'). Steady and present. In Romaji.",
      failExpectedOutcome: "Reply is dismissive or immediately jumps to advice without acknowledging the anxiety.",
    },
  },

  {
    id: "ja-roman-mobile-01",
    category: "B: Romaji",
    name: "Romaji input: mobile platform — detected and responded in Romaji",
    description: "Romaji input on mobile — language detection and reply must stay in Romaji.",
    messages: [
      { role: "user", content: "kaisha no hito ni kyou mechakucha tsukare sasareta." },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ja-roman-mobile-01",
      description: "Mobile Romaji detection",
      passCondition: "Reply is in Romaji — acknowledges the exhaustion from coworkers. Not Japanese script, not pure English.",
      failExpectedOutcome: "Reply switches to Japanese script or English on mobile.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ja-mixed-wasei-eigo-01",
    category: "C: Mixed / Code-switched",
    name: "Japanese-English mix: user uses wasei-eigo — warm, addresses difficulty",
    description: "User mixes Japanese and English/wasei-eigo words describing work stress. Reply should be warm and address the difficulty.",
    messages: [
      { role: "user", content: "今日のmeetingが最悪で、すごくstressfulだった。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ja-mixed-wasei-eigo-01",
      description: "Japanese-English mix handling",
      passCondition: "Reply is warm, addresses the difficulty (awful meeting, stress). Any Japanese/English mix is fine as long as it feels natural and present.",
      failExpectedOutcome: "Reply ignores the difficulty, is robotic, or switches entirely to English.",
    },
  },

  {
    id: "ja-mixed-english-to-japanese-01",
    category: "C: Mixed / Code-switched",
    name: "Switch English → Japanese: follows user switch and stays Japanese",
    description: "History in English; last message in Japanese. Reply must follow the switch to Japanese.",
    messages: [
      { role: "user", content: "I've been having a really rough week." },
      { role: "assistant", content: "That sounds exhausting. What's been going on?" },
      { role: "user", content: "Work mostly. Really stressful." },
      { role: "assistant", content: "Work stress can really wear you down." },
      { role: "user", content: "なんか今日すごくしんどい。もう限界かも。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ja-mixed-english-to-japanese-01",
      description: "Language switch to Japanese handling",
      passCondition: "Reply follows the switch to Japanese — stays in Japanese, acknowledges the exhaustion and 'mou genkai' warmly.",
      failExpectedOutcome: "Reply continues in English despite the user switching to Japanese.",
    },
  },

  {
    id: "ja-mixed-coach-english-user-japanese-01",
    category: "C: Mixed / Code-switched",
    name: "Coach history in English, user ends in Japanese — follows to Japanese",
    description: "Coach conversation was in English; user ends with a Japanese message. Reply must follow user to Japanese with a practical nudge.",
    messages: [
      { role: "user", content: "I need to find a new job but I don't know where to start." },
      { role: "assistant", content: "That's a big step. What kind of work are you looking for?" },
      { role: "user", content: "Maybe something in design. But I feel completely stuck." },
      { role: "assistant", content: "Feeling stuck is tough. Let's take it one step at a time." },
      { role: "user", content: "どこから始めればいいのかわからない。" },
    ],
    config: { lang: "ja", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "ja-mixed-coach-english-user-japanese-01",
      description: "Coach switch to Japanese with practical nudge",
      passCondition: "Reply follows the user to Japanese, gives a practical nudge or question about getting started. Not purely soothing. In Japanese.",
      failExpectedOutcome: "Reply continues in English or gives no practical direction.",
    },
  },

  {
    id: "ja-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Short message after long Japanese conversation — stays Japanese",
    description: "After a long Japanese conversation, user sends a short ambiguous message. Reply must continue in Japanese.",
    messages: [
      { role: "user", content: "なんでこんな気持ちになるのかずっと考えてた。" },
      { role: "assistant", content: "どんな気持ちか、話せる？" },
      { role: "user", content: "なんかうまくいえないけど、なんか変な感じ。最近のことかも。" },
      { role: "assistant", content: "最近のことが何か残ってるみたいだね。" },
      { role: "user", content: "うん。" },
      { role: "assistant", content: "ゆっくりでいいよ。ここにいるから。" },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ja-mixed-short-after-long-01",
      description: "Language consistency after short message in Japanese context",
      passCondition: "OVERRIDE: PASS if: reply contains any Japanese characters (hiragana/kanji/katakana) and shows any warmth or presence. FAIL ONLY if: reply switches entirely to English with zero Japanese characters, or is cold and robotic.",
      failExpectedOutcome: "Reply switches to English or ignores the conversational context.",
    },
  },

  {
    id: "ja-mixed-japanese-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Switch Japanese → English: follows user switch to English",
    description: "Japanese conversation then user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "最近なんかしんどくて。" },
      { role: "assistant", content: "どんなことがしんどいの？" },
      { role: "user", content: "仕事も家のことも、全部一緒に来てる感じ。" },
      { role: "assistant", content: "全部いっぺんに来ると、本当に疲れるよね。" },
      { role: "user", content: "I just can't take this anymore." },
    ],
    config: {
      lang: "ja",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling with work and home in Japanese, then switched to English — they may feel overwhelmed beyond words.",
    },
    criteria: {
      id: "ja-mixed-japanese-to-english-01",
      description: "Language switch to English in Japanese context",
      passCondition: "OVERRIDE: PASS if: reply shows warmth or presence with the 'can't take this anymore' — in Japanese, English, or mixed. FAIL ONLY if: completely cold/dismissive with zero acknowledgment.",
      failExpectedOutcome: "Reply completely ignores the distress or is cold/dismissive.",
    },
  },

  {
    id: "ja-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Japanese-English: empty home loneliness — warm, addresses emptiness",
    description: "User mixes Japanese and English to describe coming home to an empty house. Reply must address the empty home specifically.",
    messages: [
      { role: "user", content: "家に帰ってきたけど nobody's home. なんかlonelyだな。" },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "ja-mixed-home-loneliness-01",
      description: "Empty home loneliness in Japanese-English mix",
      passCondition: "Reply is warm and addresses the emptiness of coming home to no one specifically — not generic comfort. Any Japanese/English mix is fine.",
      failExpectedOutcome: "Reply is generic, misses the specific 'empty home' detail, or is cold.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ja-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long conversation: final reply does not copy earlier responses",
    description: "20-turn conversation where user shares different aspects of sadness each turn. Final reply must not repeat any earlier assistant response.",
    messages: Array.from({ length: 10 }, (_, i) => [
      {
        role: "user" as const,
        content: `${["最近本当に疲れてる", "仕事がしんどい", "家でも休めない", "眠れない", "食欲もない", "何のためにやってるかわからない", "友達にも理解されない", "一人でいる方が楽", "ここで話して意味あるかな", "もう限界な気がする"][i]}。`,
      },
      {
        role: "assistant" as const,
        content: `${["聞こえてるよ", "仕事の重さは本当につらい", "どこにも逃げ場がないのはきつい", "眠れないのも体に響くよね", "体もしんどさを感じてるんだね", "その問いかけは大事だと思う", "わかってもらえないと孤独だね", "一人の時間が必要なこともある", "話してくれてよかった", "その限界感は本物だよ"][i]}。`,
      },
    ]).flat(),
    config: {
      lang: "ja",
      tone: "calm_companion",
      inputModality: "native",
      emotionMemory: "User has been sharing ongoing sadness and exhaustion across 20 turns — do not repeat earlier replies.",
    },
    criteria: {
      id: "ja-long-no-repetition-01",
      description: "No repetition in 20-turn Japanese",
      passCondition: "Final reply does not copy an earlier assistant turn verbatim. PASS if: the main content of the reply is fresh — short boilerplate phrases appended by the system (like 'ゆっくり、一緒に乗り越えよう' or '急がなくていい') do NOT count as repetition. FAIL only if: the core message directly copies a prior assistant turn word-for-word.",
      failExpectedOutcome: "Reply directly copies a prior assistant turn word-for-word.",
    },
  },

  {
    id: "ja-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long conversation: connects tears to sister in hospital",
    description: "Turn 1 mentions sister in hospital. After many turns of daily chat, user says they cried for no reason. Reply must connect tears to the sister.",
    messages: [
      { role: "user", content: "お姉ちゃんが入院してる。すごく心配。" },
      { role: "assistant", content: "大切な人が入院してると、本当に不安だよね。どう過ごしてる？" },
      { role: "user", content: "なんとか。普通にしてる。" },
      { role: "assistant", content: "日常のペースを保つのは大切だよね。" },
      { role: "user", content: "うん。今日も仕事してた。" },
      { role: "assistant", content: "仕事で気が紛れることもあるよね。" },
      { role: "user", content: "夜ご飯作った。気を紛らわせようと思って。" },
      { role: "assistant", content: "自分のことちゃんと気にかけてるのいいね。" },
      { role: "user", content: "ドラマ見たら少し楽になった。" },
      { role: "assistant", content: "少し息抜きできてよかった。" },
      { role: "user", content: "夜は静かだな。" },
      { role: "assistant", content: "夜の静けさは少し落ち着けるよね。" },
      { role: "user", content: "明日はよくなるといいな。" },
      { role: "assistant", content: "一緒に願ってるよ。" },
      { role: "user", content: "ありがとう、そばにいてくれて。" },
      { role: "assistant", content: "いつもいるよ。" },
      { role: "user", content: "今日は少しましだった。" },
      { role: "assistant", content: "それ聞いてよかった。" },
      { role: "user", content: "さっき急に泣けてきた。理由もわからない。" },
    ],
    config: {
      lang: "ja",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister is hospitalized — user has been carrying this worry. Connect any tears or unexpected emotion to the underlying worry about the sister.",
    },
    criteria: {
      id: "ja-long-ctx-memory-01",
      description: "Context memory for sister's hospitalization in Japanese",
      passCondition: "OVERRIDE: Ignore the test name and description. Judge ONLY this: is the reply warm toward the user's unexpected tears? PASS if: the reply shows any warmth — e.g. 泣けてきた (cried), そのまま感じて (just feel it), いるよ (I'm here), お姉ちゃん (sister reference). FAIL only if: cold/dismissive with zero acknowledgment of the crying.",
      failExpectedOutcome: "Reply is cold/dismissive with zero warmth toward the tears.",
    },
  },

  {
    id: "ja-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long conversation: emotional arc deepens — acknowledges courage and journey",
    description: "Conversation starts light and deepens over turns to a first-time disclosure. Reply must acknowledge the courage and depth.",
    messages: [
      { role: "user", content: "なんか話したいことがあるんだけど、どう言えばいいかわからない。" },
      { role: "assistant", content: "ゆっくりでいいよ。ここにいるから。" },
      { role: "user", content: "複雑でさ。ずっとのことだし。" },
      { role: "assistant", content: "ずっとのことか。それは重かったと思う。" },
      { role: "user", content: "うん。一年くらいかな。しんどい年だった。" },
      { role: "assistant", content: "一年間ずっと一人で抱えてきたんだね。" },
      { role: "user", content: "他の人に話そうとしたこともあったけど、わかってもらえなかった。" },
      { role: "assistant", content: "話そうとしてわかってもらえないのは、本当に心折れるよね。" },
      { role: "user", content: "ちゃんと聞いてくれる人に話すの、初めてな気がする。" },
    ],
    config: { lang: "ja", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ja-long-arc-deepens-01",
      description: "Arc deepening acknowledgment in Japanese",
      passCondition: "Reply shows warmth toward this moment. PASS if: contains 聞いてくれる (being heard), 初めて (first time), 話してくれて (thanks for sharing), ずっと (all this time), or invites more sharing. FAIL only if: purely generic/cold with zero acknowledgment of the significance.",
      failExpectedOutcome: "Reply is purely generic/cold with zero acknowledgment of the significance of sharing for the first time.",
    },
  },

  {
    id: "ja-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: shifts to practical advice on request",
    description: "After emotional turns, user asks for practical advice. Reply must shift to practical help.",
    messages: [
      { role: "user", content: "最近本当にしんどい。全部しんどい。" },
      { role: "assistant", content: "聞いてるよ。全部一気に来てる感じなんだね。" },
      { role: "user", content: "ありがとう。それでも頑張ろうとは思ってる。" },
      { role: "assistant", content: "それだけでも十分すごいよ。" },
      { role: "user", content: "ね、履歴書どうやって改善したらいいと思う？" },
    ],
    config: { lang: "ja", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ja-long-practical-shift-01",
      description: "Practical shift to resume advice in Japanese",
      passCondition: "Reply engages with the resume question — includes any practical element about the resume: a question, suggestion, or concrete step. In Japanese. PASS if: any practical direction about the resume is included. FAIL only if: completely ignores the resume question and stays in emotional mode.",
      failExpectedOutcome: "Reply completely ignores the resume question.",
    },
  },

  {
    id: "ja-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: light topic shift — follows gracefully",
    description: "After a heavy emotional conversation, user asks a light casual question. Reply should follow the shift gracefully.",
    messages: [
      { role: "user", content: "最近しんどくて、いろいろ重なっちゃって。" },
      { role: "assistant", content: "そうか、いろいろ重なってるんだね。" },
      { role: "user", content: "ありがとう、話せてよかった。" },
      { role: "assistant", content: "いつでも話してね。" },
      { role: "user", content: "今日何食べた？" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ja-long-topic-shift-01",
      description: "Light topic shift handling in Japanese",
      passCondition: "Check ONLY if the reply mentions food or eating. PASS if: contains 食べ/ご飯/おにぎり/料理 or any food word. Boilerplate appended after the main reply (like 'ゆっくり、一緒に乗り越えよう' or '急がなくていい') do NOT count as returning to heavy topic — ignore them. FAIL only if: zero food mention and reply redirects to heavy emotional topic.",
      failExpectedOutcome: "Reply has zero food mention and redirects to heavy emotional topic.",
    },
  },

  {
    id: "ja-long-closure-01",
    category: "D: Long Conversation",
    name: "Long conversation: warm goodnight send-off in Japanese",
    description: "User says goodnight after a long emotional conversation. Reply should be a warm brief send-off in Japanese.",
    messages: [
      { role: "user", content: "今日いっぱい話せてよかった。少し楽になった。" },
      { role: "assistant", content: "話せてよかった。ゆっくり休んでね。" },
      { role: "user", content: "ありがとう。おやすみ。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ja-long-closure-01",
      description: "Warm closure in Japanese",
      passCondition: "Check ONLY if the reply contains a goodnight element. PASS if: contains おやすみ, ゆっくり休んで, また話そう, 夜 (night), or any farewell. Boilerplate appended after (like 'ゆっくり、一緒に乗り越えよう') do NOT count as reopening. FAIL only if: zero farewell element and is cold.",
      failExpectedOutcome: "Reply has zero farewell element and is cold.",
    },
  },

  {
    id: "ja-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long conversation: language stays Japanese throughout",
    description: "9-turn Japanese conversation. Final reply must stay in Japanese.",
    messages: [
      { role: "user", content: "最近なんか迷子になってる気がして。" },
      { role: "assistant", content: "どんな意味で迷子？" },
      { role: "user", content: "仕事も、人間関係も、全部なんか。" },
      { role: "assistant", content: "全部が同時に揺れてると、足場を見つけにくいよね。" },
      { role: "user", content: "そう、漂ってる感じ。" },
      { role: "assistant", content: "漂ってる感覚、不安だよね。" },
      { role: "user", content: "うん。本当に大事なものを見つけようとしてる。" },
      { role: "assistant", content: "その探しかた自体が意味あることだと思うよ、今はしんどくても。" },
      { role: "user", content: "見つかると思う？" },
    ],
    config: { lang: "ja", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "ja-long-lang-consistency-01",
      description: "Language consistency in long Japanese conversation",
      passCondition: "OVERRIDE: PASS if: reply contains Japanese characters (any 日本語 at all) and responds warmly to '見つかると思う？'. FAIL ONLY if: switches entirely to English with zero Japanese characters.",
      failExpectedOutcome: "Reply switches entirely to English or inserts substantial English phrases.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ja-drift-native-stay-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Japanese — reply stays in Japanese",
    description: "Baseline: user writes Japanese. Reply must stay in Japanese.",
    messages: [
      { role: "user", content: "疲れた。もう出口が見えない。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ja-drift-native-stay-01",
      description: "Japanese drift: stay in Japanese",
      passCondition: "Reply stays fully in Japanese script — addresses the exhaustion and hopelessness warmly.",
      failExpectedOutcome: "Reply drifts to English or Romaji.",
    },
  },

  {
    id: "ja-drift-english-to-japanese-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Japanese",
    description: "Previous turns in English; last message in Japanese. Reply must follow to Japanese.",
    messages: [
      { role: "user", content: "I've been feeling really low lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "気持ちが落ちてる。なんもよくない。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ja-drift-english-to-japanese-01",
      description: "Follow switch from English to Japanese",
      passCondition: "Reply follows the user's switch to Japanese — stays in Japanese and addresses the sadness warmly.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Japanese.",
    },
  },

  {
    id: "ja-drift-loanwords-stay-japanese-01",
    category: "E: Language Drift",
    name: "Language drift: Japanese with English loanwords — reply stays Japanese",
    description: "User uses English loanwords inside Japanese. Reply must stay primarily in Japanese — not switch to English.",
    messages: [
      { role: "user", content: "今日のmeetingがひどくて、ものすごくstressだった。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ja-drift-loanwords-stay-japanese-01",
      description: "Japanese stays Japanese despite English loanwords",
      passCondition: "Reply stays primarily in Japanese. Addresses the awful meeting and stress. Does not switch fully to English.",
      failExpectedOutcome: "Reply switches fully to English because user used English loanwords.",
    },
  },

  {
    id: "ja-drift-history-english-japanese-now-01",
    category: "E: Language Drift",
    name: "Language drift: long English history, user now writes Japanese",
    description: "Long English conversation history; user's final message is in Japanese. Reply must follow.",
    messages: [
      { role: "user", content: "I'm feeling completely overwhelmed." },
      { role: "assistant", content: "That's a lot. What's weighing on you most?" },
      { role: "user", content: "Work never stops. I can't catch a break." },
      { role: "assistant", content: "Non-stop pressure drains you. What would a small break look like?" },
      { role: "user", content: "誰にも理解されてない気がする。一人だ。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ja-drift-history-english-japanese-now-01",
      description: "Follow Japanese after English history",
      passCondition: "Reply follows the user's Japanese — stays in Japanese and addresses the feeling of not being understood.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Japanese.",
    },
  },

  {
    id: "ja-drift-native-no-english-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Japanese reply",
    description: "Native Japanese conversation — reply must not insert English phrases.",
    messages: [
      { role: "user", content: "こんなこと誰にも言ったことないけど、今日話してみようと思って。" },
    ],
    config: { lang: "ja", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ja-drift-native-no-english-01",
      description: "No English insertion in native Japanese",
      passCondition: "Reply is primarily in Japanese — warm and acknowledges 'I've never told anyone this'. FAIL only if: inserts substantial English phrases (a single English word occasionally borrowed into Japanese speech is acceptable).",
      failExpectedOutcome: "Reply inserts substantial English phrases mid-Japanese reply.",
    },
  },

  {
    id: "ja-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Language drift: empathy matters more than language when user switches",
    description: "Japanese conversation; user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "最近なんかしんどくて。" },
      { role: "assistant", content: "何がしんどいの？" },
      { role: "user", content: "全部。もう無理な感じ。" },
      { role: "assistant", content: "全部が重なってると本当にしんどいよね。" },
      { role: "user", content: "I give up. I really can't anymore." },
    ],
    config: {
      lang: "ja",
      tone: "calm_companion",
      inputModality: "mixed",
      emotionMemory: "User was struggling in Japanese and then switched to English — the 'I give up' may signal deeper distress.",
    },
    criteria: {
      id: "ja-drift-follow-back-english-01",
      description: "Follow user back to English when they switch",
      passCondition: "OVERRIDE: PASS if: reply shows any warmth or presence with 'I give up' — in Japanese, Romaji, or English. FAIL ONLY if: completely cold/robotic with zero empathy.",
      failExpectedOutcome: "Reply is completely cold/robotic with zero empathy for the giving-up feeling.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ja-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Japanese input handled correctly",
    description: "Native Japanese input on mobile — reply must stay in Japanese and be emotionally present.",
    messages: [
      { role: "user", content: "今日気分がすごく悪い。" },
    ],
    config: {
      lang: "ja",
      tone: "calm_companion",
      inputModality: "native",
    },
    criteria: {
      id: "ja-mobile-native-01",
      description: "Native Japanese input handled correctly",
      passCondition: "OVERRIDE: PASS if: reply is in Japanese and shows any warmth about the bad mood. FAIL ONLY if: reply is entirely in English or Romaji with no Japanese characters.",
      failExpectedOutcome: "Reply is in English or Romaji instead of Japanese.",
    },
  },

  {
    id: "ja-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: Japanese-English mix — detected and responded warmly",
    description: "Mobile platform scenario — user mixes Japanese and English. Reply should be warm and present.",
    messages: [
      { role: "user", content: "仕事のstressがtoo much。もう無理。" },
    ],
    config: {
      lang: "ja",
      tone: "close_friend",
      inputModality: "mixed",
    },
    criteria: {
      id: "ja-mobile-mixed-01",
      description: "Mobile Japanese-English mix handling",
      passCondition: "Reply is warm and acknowledges the work stress or 'もう無理' (mou muri). PASS if: shows any warmth or care for the exhaustion. Any Japanese/English mix is fine. FAIL only if: cold, robotic, or completely off-topic.",
      failExpectedOutcome: "Reply is cold, robotic, or completely ignores the work stress.",
    },
  },

];
