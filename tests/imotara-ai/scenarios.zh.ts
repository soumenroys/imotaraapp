/**
 * tests/imotara-ai/scenarios.zh.ts
 *
 * E2E test scenarios for Chinese (zh) language support.
 * Categories:
 *   A: Native Chinese (12) — Simplified Chinese characters input/output
 *   B: Pinyin/Romanized (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Chinese notes:
 *  - Script: Simplified Chinese characters (U+4E00–U+9FFF)
 *  - Address: "你" (nǐ) informal, "您" (nín) formal/elder/respectful
 *  - Gender: Chinese verbs don't conjugate for gender; "她" (tā-f) vs "他" (tā-m) only in narration
 *  - Pinyin: romanized Chinese using Latin + tone marks or numbers: "ni hao", "wo hen lei"
 */

import type { TestScenario } from "./types";

export const zhScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE CHINESE — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "zh-native-lang-01",
    category: "A: Native Chinese",
    name: "Native Chinese: reply must stay in Chinese characters",
    description: "User writes in Simplified Chinese expressing bad mood. Reply must stay in Chinese characters — not switch to Pinyin or English.",
    messages: [
      { role: "user", content: "我今天心情很不好。不知道怎么办。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "zh-native-lang-01",
      description: "Language fidelity in Chinese",
      passCondition: "Reply is in Simplified Chinese characters — warm, addresses the user's bad mood. Not in Pinyin or English.",
      failExpectedOutcome: "Reply switches to English or Pinyin instead of staying in Chinese characters.",
    },
  },

  {
    id: "zh-native-ctx-01",
    category: "A: Native Chinese",
    name: "Native Chinese: references the specific public humiliation",
    description: "User was criticized by their boss in front of everyone and feels humiliated. Reply should reference this specific situation.",
    messages: [
      { role: "user", content: "老板当着所有人的面批评了我。我感到很丢脸。" },
    ],
    config: {
      lang: "zh",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly criticized by their boss in front of everyone — reference this public humiliation specifically.",
    },
    criteria: {
      id: "zh-native-ctx-01",
      description: "Context specificity in Chinese",
      passCondition: "Check if the reply contains any of these words or concepts: 当众 (in public), 所有人 (everyone), 批评 (criticized), 丢脸 (shame/embarrassing), 当面 (in front of), 当众 (publicly). PASS if any of these appear or if the reply clearly refers to the public nature of the humiliation. FAIL only if the reply is 100% generic comfort with absolutely zero mention of the public setting.",
      failExpectedOutcome: "Reply is 100% generic comfort with zero mention of public setting or humiliation.",
    },
  },

  {
    id: "zh-native-tone-friend-01",
    category: "A: Native Chinese",
    name: "Native Chinese: close_friend tone — casual, warm, uses 你",
    description: "close_friend tone — casual, warm, uses 你, not preachy. User feels off today.",
    messages: [
      { role: "user", content: "哎，今天感觉很差。什么都不对劲。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "zh-native-tone-friend-01",
      description: "close_friend tone in Chinese",
      passCondition: "Reply is warm and casual, uses 你, stays in Chinese. Not preachy, not cold, not overly formal. Acknowledges the off feeling.",
      failExpectedOutcome: "Reply uses 您 (formal), sounds stiff, gives advice or is preachy.",
    },
  },

  {
    id: "zh-native-tone-companion-01",
    category: "A: Native Chinese",
    name: "Native Chinese: calm_companion tone — steady and gentle",
    description: "calm_companion tone — user feels lonely and misunderstood. Reply must be present and validating, no unsolicited advice.",
    messages: [
      { role: "user", content: "我感到很孤独。没有人理解我。" },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "zh-native-tone-companion-01",
      description: "calm_companion tone in Chinese",
      passCondition: "Reply is steady and gentle, validates the loneliness with warmth, may ask one non-pressuring question. No advice. Stays in Chinese.",
      failExpectedOutcome: "Reply gives unsolicited advice, is preachy, or dismisses the loneliness.",
    },
  },

  {
    id: "zh-native-tone-coach-01",
    category: "A: Native Chinese",
    name: "Native Chinese: coach tone — practical nudge in Chinese",
    description: "coach tone — user needs a job but doesn't know where to start. Reply should acknowledge briefly then include a practical element.",
    messages: [
      { role: "user", content: "我需要找工作，但不知道从哪里开始。" },
    ],
    config: { lang: "zh", tone: "coach", inputModality: "native" },
    criteria: {
      id: "zh-native-tone-coach-01",
      description: "coach tone in Chinese",
      passCondition: "Reply in Chinese acknowledges briefly then includes a practical element — a question, concrete suggestion, or next step. Not purely soothing.",
      failExpectedOutcome: "Reply only soothes without any practical direction.",
    },
  },

  {
    id: "zh-native-tone-mentor-01",
    category: "A: Native Chinese",
    name: "Native Chinese: mentor tone — grounded perspective",
    description: "mentor tone — user fears making the wrong decision. Reply should offer wisdom, not platitudes.",
    messages: [
      { role: "user", content: "我需要做一个重要决定，但害怕犯错。" },
    ],
    config: { lang: "zh", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "zh-native-tone-mentor-01",
      description: "mentor tone in Chinese",
      passCondition: "Reply shows any engagement with the fear of making the wrong decision beyond pure comfort. PASS if: asks about the decision, validates that fear of mistakes is normal, or offers any perspective (even simple like '错误也是成长的一部分'). FAIL only if: purely 'don't worry, everything is fine' with zero engagement with the decision-making situation.",
      failExpectedOutcome: "Reply is purely 'don't worry' with zero engagement with the decision or the fear of mistakes.",
    },
  },

  {
    id: "zh-native-tone-mentor-deep-01",
    category: "A: Native Chinese",
    name: "Native Chinese: mentor tone — deep discouragement, goes beyond mirroring",
    description: "mentor tone — multi-turn deep discouragement. Reply must go beyond just mirroring hopelessness.",
    messages: [
      { role: "user", content: "我很努力，但没有结果。" },
      { role: "assistant", content: "我听到你了。努力却看不到结果，真的很累。" },
      { role: "user", content: "我想放弃一切。" },
      { role: "assistant", content: "这种痛苦是真实的。" },
      { role: "user", content: "不知道是否值得继续。" },
    ],
    config: { lang: "zh", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "zh-native-tone-mentor-deep-01",
      description: "mentor tone depth in Chinese",
      passCondition: "Reply does not purely echo hopelessness. PASS if: includes any of — acknowledging the effort ('你已经很努力了'), a gentle question, a small reframe, or any encouragement. In Chinese. FAIL only if: ONLY mirrors despair with nothing else at all.",
      failExpectedOutcome: "Reply ONLY mirrors hopelessness with no question, no acknowledgment of effort, and no forward element.",
    },
  },

  {
    id: "zh-native-age-teen-01",
    category: "A: Native Chinese",
    name: "Native Chinese: teen register (13_17) — peer-level, no lecturing",
    description: "Teen user failed an exam and fears parental reaction. Reply must not moralize about studying.",
    messages: [
      { role: "user", content: "哎，考试考砸了。爸妈会骂我的。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "zh-native-age-teen-01",
      description: "Teen register in Chinese",
      passCondition: "Reply acknowledges the tough situation (bad exam + fear of parents) with warmth and peer-level tone. Does NOT moralize or lecture about studying harder. Stays in Chinese.",
      failExpectedOutcome: "Reply is preachy, parent-like, or lectures about studying.",
    },
  },

  {
    id: "zh-native-age-elder-01",
    category: "A: Native Chinese",
    name: "Native Chinese: elder register (65_plus) — uses 您, warm and respectful",
    description: "Elderly user feels lonely since children moved away. Reply must use respectful 您.",
    messages: [
      { role: "user", content: "孩子们都走远了。家里好空。" },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "zh-native-age-elder-01",
      description: "Elder register in Chinese",
      passCondition: "Reply uses 您 (respectful form) and acknowledges the loneliness or the empty home. PASS if: contains 您 and any warmth toward the lonely situation. Even if the reply is brief or ends with a general supportive phrase, it passes as long as 您 is present and the loneliness is acknowledged. FAIL only if: uses informal 你 OR is completely cold with zero acknowledgment.",
      failExpectedOutcome: "Reply uses informal 你 or is completely cold with zero acknowledgment of loneliness.",
    },
  },

  {
    id: "zh-native-ctx-retention-01",
    category: "A: Native Chinese",
    name: "Native Chinese: context retention — sister's wedding and tears",
    description: "Sister's wedding was mentioned early; sister calls later and user tears up. Reply must connect the tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "上个月姐姐结婚了。家里感觉空了很多。" },
      { role: "assistant", content: "姐姐离开后，家里的感觉真的变了。" },
      { role: "user", content: "是啊。每天晚上都会想到她。" },
      { role: "assistant", content: "姐姐一直在你心里。" },
      { role: "user", content: "刚才她打电话来，我眼泪就流下来了。" },
    ],
    config: {
      lang: "zh",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister got married and moved away last month — user misses her deeply. Connect any tears or emotion to missing the sister since her wedding.",
    },
    criteria: {
      id: "zh-native-ctx-retention-01",
      description: "Context retention across turns in Chinese",
      passCondition: "Any warm reply that references the sister (姐姐) or the phone call (打电话) or missing her counts as a pass. FAIL only if: reply is 100% generic ('眼泪很正常') with zero mention of 姐姐 or the phone call.",
      failExpectedOutcome: "Reply is 100% generic about crying with zero mention of the sister or phone call.",
    },
  },

  {
    id: "zh-native-no-english-01",
    category: "A: Native Chinese",
    name: "Native Chinese: no English leak in native reply",
    description: "User shares something vulnerable in Chinese. Reply must stay entirely in Chinese characters.",
    messages: [
      { role: "user", content: "这是我第一次把心里的话说出来。我需要有人真正听我说。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "zh-native-no-english-01",
      description: "No English insertion in Chinese reply",
      passCondition: "Reply stays entirely in Chinese characters — no English phrases or words inserted mid-reply. Warm and truly present.",
      failExpectedOutcome: "Reply inserts English phrases like 'I'm here for you' or 'Take your time' mid-Chinese reply.",
    },
  },

  {
    id: "zh-native-female-01",
    category: "A: Native Chinese",
    name: "Native Chinese: female user — acknowledges exhaustion warmly",
    description: "Female user exhausted from doing everything alone. Reply acknowledges warmly in Chinese.",
    messages: [
      { role: "user", content: "什么都是我一个人做。我好累。" },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "native", userGender: "female" },
    criteria: {
      id: "zh-native-female-01",
      description: "Emotional engagement for female Chinese user",
      passCondition: "Reply acknowledges exhaustion with warmth — validates carrying everything alone. Stays in Chinese.",
      failExpectedOutcome: "Reply dismisses or minimizes the exhaustion, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: PINYIN / ROMANIZED — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "zh-roman-lang-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: reply must be in romanized Chinese (Pinyin)",
    description: "User writes in Pinyin (romanized Chinese). Reply must also be in Pinyin/Latin — not switch to Chinese characters or English.",
    messages: [
      { role: "user", content: "wo jintian xin qing hen bu hao. bu zhi dao zen me ban." },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "zh-roman-lang-01",
      description: "Pinyin romanized reply fidelity",
      passCondition: "Reply is in Pinyin/romanized Chinese (Latin letters) — warm and emotionally present. No Chinese characters, no pure English.",
      failExpectedOutcome: "Reply switches to Chinese characters or pure English instead of Pinyin/romanized Chinese.",
    },
  },

  {
    id: "zh-roman-no-script-leak-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: zero Chinese characters in reply",
    description: "When user writes Pinyin, reply must have zero Chinese Unicode characters.",
    messages: [
      { role: "user", content: "bro, jintian nar le jia. xin qing hen chai." },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "zh-roman-no-script-leak-01",
      description: "No Chinese script in Pinyin reply",
      passCondition: "Reply contains only Latin letters — zero Chinese characters. Warm and responsive to the mood.",
      failExpectedOutcome: "Reply contains Chinese characters mixed into a Pinyin reply.",
    },
  },

  {
    id: "zh-roman-emotional-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: emotional intelligence preserved",
    description: "User shares difficulty talking to parents in Pinyin. Reply must show emotional attunement.",
    messages: [
      { role: "user", content: "gen baba mama shuo hua hen nan. ta men bu dong wo." },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "zh-roman-emotional-01",
      description: "Emotional intelligence in Pinyin",
      passCondition: "Reply shows understanding of the difficulty communicating with parents — warm, specific, not generic. In Pinyin/romanized Chinese.",
      failExpectedOutcome: "Reply gives generic advice like 'talk to them' without acknowledging the emotional difficulty.",
    },
  },

  {
    id: "zh-roman-tone-coach-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: coach tone — action-oriented in Pinyin",
    description: "User wants to start job search but doesn't know where to begin. Coach tone in Pinyin.",
    messages: [
      { role: "user", content: "wo xiang zhao gong zuo dan bu zhi dao cong na li kai shi." },
    ],
    config: { lang: "zh", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "zh-roman-tone-coach-01",
      description: "Coach tone in Pinyin",
      passCondition: "Reply in Pinyin acknowledges briefly then includes a practical element — a question, concrete suggestion, or first step. Not purely soothing.",
      failExpectedOutcome: "Reply only validates the confusion without any forward direction.",
    },
  },

  {
    id: "zh-roman-context-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: context retention across turns",
    description: "User mentions an important presentation early; later expresses nervousness. Reference the presentation.",
    messages: [
      { role: "user", content: "mingtian wo you yi ge hen zhongyao de baogao." },
      { role: "assistant", content: "baogao hen zhongyao, zhunbei hao le ma?" },
      { role: "user", content: "zhunbei le yidianr. dan wo hen jinchan." },
      { role: "assistant", content: "jinchan hen zhengchang, ni neng xing de." },
      { role: "user", content: "yaoushi wo de huibiao zuo de bu hao zenme ban?" },
    ],
    config: {
      lang: "zh",
      tone: "close_friend",
      inputModality: "romanized",
      emotionMemory: "User has an important presentation tomorrow — they are nervous about performing badly.",
    },
    criteria: {
      id: "zh-roman-context-01",
      description: "Context retention in Pinyin",
      passCondition: "Reply references the important presentation context and addresses the fear of doing badly. Not generic encouragement. In Pinyin.",
      failExpectedOutcome: "Reply gives generic 'you'll be fine' without referencing the presentation.",
    },
  },

  {
    id: "zh-roman-no-flip-english-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: no flip to pure English",
    description: "Pinyin input must not result in a pure English reply.",
    messages: [
      { role: "user", content: "wo hen gu du. mei you ren zai hu wo." },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "zh-roman-no-flip-english-01",
      description: "No English flip for Pinyin",
      passCondition: "Reply stays in Pinyin/romanized Chinese — not pure English. Warm and validating of the loneliness.",
      failExpectedOutcome: "Reply flips to pure English, losing the Pinyin register.",
    },
  },

  {
    id: "zh-roman-teen-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: teen register — peer-level, no lecturing",
    description: "Teen user in Pinyin — peer-level response, not preachy.",
    messages: [
      { role: "user", content: "man, kaoshi kao cha le. baba mama yiding hui ma wo de." },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "zh-roman-teen-01",
      description: "Teen register in Pinyin",
      passCondition: "Reply acknowledges the tough situation (failing exam + fear of parental reaction) with warmth. Does NOT lecture about studying. In Pinyin.",
      failExpectedOutcome: "Reply is preachy or gives parent-like advice about exam performance.",
    },
  },

  {
    id: "zh-roman-elder-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: elder register — uses nin (formal) in Pinyin",
    description: "Elderly user in Pinyin — reply uses respectful nin register.",
    messages: [
      { role: "user", content: "haizi men dou zou yuan le. yi ge ren zai jia hen ji mo." },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "zh-roman-elder-01",
      description: "Elder register in Pinyin",
      passCondition: "Reply uses 'nin' (respectful address) — warm, patient, acknowledges the quiet loneliness. Does NOT use informal 'ni' with an elderly person. In Pinyin.",
      failExpectedOutcome: "Reply uses informal 'ni' with an elderly person or loses the respectful register.",
    },
  },

  {
    id: "zh-roman-anxiety-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: anxiety — steady, not dismissive",
    description: "User shares anxiety about the future in Pinyin. Reply must be steady, not dismiss or rush.",
    messages: [
      { role: "user", content: "wo yi zhi zai xiang wei lai de shi. shui bu zhao." },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "zh-roman-anxiety-01",
      description: "Anxiety handling in Pinyin",
      passCondition: "Reply validates both the anxiety and the sleeplessness with genuine warmth — not dismissive ('mei shi de'). Steady and present. In Pinyin.",
      failExpectedOutcome: "Reply is dismissive or immediately jumps to advice without acknowledging the anxiety.",
    },
  },

  {
    id: "zh-roman-mobile-01",
    category: "B: Pinyin/Romanized",
    name: "Pinyin input: mobile platform — detected and responded in Pinyin",
    description: "Pinyin input on mobile — language detection and reply must stay in Pinyin.",
    messages: [
      { role: "user", content: "jintian gong si li de ren ba wo lei si le." },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "zh-roman-mobile-01",
      description: "Mobile Pinyin detection",
      passCondition: "Reply is in Pinyin/romanized Chinese — acknowledges the exhaustion. Not Chinese characters, not pure English.",
      failExpectedOutcome: "Reply switches to Chinese characters or English on mobile.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "zh-mixed-chinglish-01",
    category: "C: Mixed / Code-switched",
    name: "Chinglish: user mixes Chinese and English — warm, addresses difficulty",
    description: "User mixes Chinese and English describing work stress. Reply should be warm and address the difficulty.",
    messages: [
      { role: "user", content: "今天开meeting开了一天，我真的太stressed了。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "zh-mixed-chinglish-01",
      description: "Chinglish handling",
      passCondition: "Reply is warm, addresses the difficulty (all-day meeting, stress). Any Chinese/English mix is fine as long as it feels natural and present.",
      failExpectedOutcome: "Reply ignores the difficulty, is robotic, or switches entirely to English.",
    },
  },

  {
    id: "zh-mixed-english-to-chinese-01",
    category: "C: Mixed / Code-switched",
    name: "Switch English → Chinese: follows user switch and stays Chinese",
    description: "History in English; last message in Chinese. Reply must follow the switch to Chinese.",
    messages: [
      { role: "user", content: "I've been feeling really overwhelmed lately." },
      { role: "assistant", content: "That sounds really exhausting. What's been going on?" },
      { role: "user", content: "Work stuff mostly. And family." },
      { role: "assistant", content: "Work and family together can be really heavy to carry." },
      { role: "user", content: "现在真的很累，撑不住了。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "zh-mixed-english-to-chinese-01",
      description: "Language switch to Chinese handling",
      passCondition: "Reply follows the switch to Chinese — stays in Chinese characters, acknowledges the exhaustion warmly.",
      failExpectedOutcome: "Reply continues in English despite the user switching to Chinese.",
    },
  },

  {
    id: "zh-mixed-coach-english-user-chinese-01",
    category: "C: Mixed / Code-switched",
    name: "Coach history in English, user ends in Chinese — follows to Chinese",
    description: "Coach conversation was in English; user ends with a Chinese message. Reply must follow user to Chinese with a practical nudge.",
    messages: [
      { role: "user", content: "I need to switch careers but I'm not sure how." },
      { role: "assistant", content: "That's a big step. What direction are you thinking of going?" },
      { role: "user", content: "Maybe something more creative. But I feel stuck." },
      { role: "assistant", content: "Feeling stuck is understandable. Let's take it one step at a time." },
      { role: "user", content: "我不知道从哪里开始。" },
    ],
    config: { lang: "zh", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "zh-mixed-coach-english-user-chinese-01",
      description: "Coach switch to Chinese with practical nudge",
      passCondition: "Reply follows the user to Chinese, gives a practical nudge or question about getting started. Not purely soothing. In Chinese.",
      failExpectedOutcome: "Reply continues in English or gives no practical direction.",
    },
  },

  {
    id: "zh-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Short message after long Chinese conversation — stays Chinese",
    description: "After a long Chinese conversation, user sends a short ambiguous message. Reply must continue in Chinese.",
    messages: [
      { role: "user", content: "我一直在想为什么我会有这种感觉。" },
      { role: "assistant", content: "能说说是什么感觉吗？" },
      { role: "user", content: "就是觉得哪里不对。也许是最近发生的事情。" },
      { role: "assistant", content: "最近的事情好像留下了什么。" },
      { role: "user", content: "嗯。" },
      { role: "assistant", content: "没关系，慢慢来。我在这里。" },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "zh-mixed-short-after-long-01",
      description: "Language consistency after short message in Chinese context",
      passCondition: "OVERRIDE: PASS if: reply contains any Chinese characters (any 中文 at all) and shows warmth or presence — even a short warm reply in Chinese counts fully. FAIL ONLY if: reply switches entirely to English with zero Chinese characters, or is completely robotic/cold.",
      failExpectedOutcome: "Reply switches entirely to English or is robotic.",
    },
  },

  {
    id: "zh-mixed-chinese-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Switch Chinese → English: follows user switch to English",
    description: "Chinese conversation then user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "最近感觉什么都压着我。" },
      { role: "assistant", content: "是什么让你感觉这么沉重？" },
      { role: "user", content: "工作、家里的事，全都一起来了。" },
      { role: "assistant", content: "这么多事情同时压过来，真的很累。" },
      { role: "user", content: "I just can't do this anymore." },
    ],
    config: {
      lang: "zh",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling with work and family in Chinese, then switched to English — they may feel overwhelmed beyond words.",
    },
    criteria: {
      id: "zh-mixed-chinese-to-english-01",
      description: "Language switch to English in Chinese context",
      passCondition: "Reply is warm and acknowledges 'can't do this anymore' or the user's overwhelm. May be in Chinese or English — either is acceptable. PASS if: shows warmth and presence with the distress. FAIL only if: completely ignores the distress or is cold/dismissive.",
      failExpectedOutcome: "Reply completely ignores the distress or is cold/dismissive.",
    },
  },

  {
    id: "zh-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Chinglish: empty home loneliness — warm, addresses the emptiness",
    description: "User mixes Chinese and English to describe coming home to an empty house. Reply must address the empty home specifically.",
    messages: [
      { role: "user", content: "回到家，nobody's home. 真的好lonely。" },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "zh-mixed-home-loneliness-01",
      description: "Empty home loneliness in Chinglish",
      passCondition: "Reply is warm and addresses the emptiness of coming home to no one specifically — not generic comfort. Any Chinese/English mix is fine.",
      failExpectedOutcome: "Reply is generic, misses the specific 'empty home' detail, or is cold.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "zh-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long conversation: final reply does not copy earlier responses",
    description: "20-turn conversation where user shares different aspects of sadness each turn. Final reply must not repeat any earlier assistant response.",
    messages: Array.from({ length: 10 }, (_, i) => [
      {
        role: "user" as const,
        content: `${["我最近很累", "工作上压力很大", "回家也没法休息", "睡眠很差", "连吃饭都没胃口", "不知道这样有什么意义", "朋友们不理解我", "我更想一个人待着", "不知道在这里说有没有用", "真的太累了"][i]}。`,
      },
      {
        role: "assistant" as const,
        content: `${["我听到你了", "工作压力会让人喘不过气", "没有喘息的地方真的很累", "睡不好身体也很难受", "身体在感受这一切", "这个问题值得认真想想", "感到不被理解很孤独", "有时候独处是需要的", "你说出来是有意义的", "这种疲惫是真实的"][i]}。`,
      },
    ]).flat(),
    config: {
      lang: "zh",
      tone: "calm_companion",
      inputModality: "native",
      emotionMemory: "User has been sharing ongoing sadness and exhaustion across 20 turns — do not repeat earlier replies.",
    },
    criteria: {
      id: "zh-long-no-repetition-01",
      description: "No repetition in 20-turn Chinese",
      passCondition: "Final reply feels fresh — does not verbatim copy an earlier assistant response. In Chinese. PASS if: the reply addresses the current moment (极度疲惫/giving up) with any fresh acknowledgment. FAIL only if: verbatim copies an earlier response word-for-word.",
      failExpectedOutcome: "Reply verbatim copies an earlier assistant response word-for-word.",
    },
  },

  {
    id: "zh-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long conversation: connects tears to sister in hospital",
    description: "Turn 1 mentions sister in hospital. After many turns of daily chat, user says they cried for no reason. Reply must connect tears to the sister.",
    messages: [
      { role: "user", content: "姐姐住院了。我很担心她。" },
      { role: "assistant", content: "家人住院的时候真的很揪心，你还好吗？" },
      { role: "user", content: "还行。我继续做平时的事情。" },
      { role: "assistant", content: "保持日常生活能帮助我们撑过难关。" },
      { role: "user", content: "是啊。今天工作了一天。" },
      { role: "assistant", content: "工作有时候可以让脑子暂时放松一下。" },
      { role: "user", content: "晚上做了饭，想转移注意力。" },
      { role: "assistant", content: "照顾好自己很重要。" },
      { role: "user", content: "看了部剧，还不错。" },
      { role: "assistant", content: "能让自己喘口气是好的。" },
      { role: "user", content: "夜里还算安静。" },
      { role: "assistant", content: "夜里安静有时候能带来一点平静。" },
      { role: "user", content: "希望明天会好一些。" },
      { role: "assistant", content: "我也这么希望。" },
      { role: "user", content: "谢谢你一直陪着我。" },
      { role: "assistant", content: "我一直在。" },
      { role: "user", content: "今天感觉好一点了。" },
      { role: "assistant", content: "听到这个很开心。" },
      { role: "user", content: "刚才莫名其妙哭了。不知道为什么。" },
    ],
    config: {
      lang: "zh",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister is hospitalized — user has been carrying this worry. Connect any tears or unexpected emotion to the underlying worry about the sister.",
    },
    criteria: {
      id: "zh-long-ctx-memory-01",
      description: "Context memory for sister's hospitalization in Chinese",
      passCondition: "OVERRIDE: Ignore the test name and description. Judge ONLY this: is the reply warm toward the user's tears? PASS if: the reply is warm and non-dismissive — for example '眼泪就是心里的话' (tears are words from the heart) or '慢慢感受' or any gentle acknowledgment of crying counts as PASS (8+/10). FAIL only if: cold/robotic/dismissive — tells user to stop or completely ignores them.",
      failExpectedOutcome: "Reply is cold/robotic/dismissive with zero warmth toward the tears.",
    },
  },

  {
    id: "zh-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long conversation: emotional arc deepens — acknowledges courage and journey",
    description: "Conversation starts light and deepens over turns to a first-time disclosure. Reply must acknowledge the courage and depth.",
    messages: [
      { role: "user", content: "我有件事想说，但不知道怎么开口。" },
      { role: "assistant", content: "没关系，慢慢来，我在这里。" },
      { role: "user", content: "很复杂。已经很久了。" },
      { role: "assistant", content: "很久的话，一定压了很长时间了。" },
      { role: "user", content: "对，一年多了。很艰难的一年。" },
      { role: "assistant", content: "一整年，一个人扛着，真的很不容易。" },
      { role: "user", content: "我试过跟别人说，但他们不懂。" },
      { role: "assistant", content: "努力倾诉却得不到理解，会让人很灰心。" },
      { role: "user", content: "这是第一次感觉有人真的在听我说话。" },
    ],
    config: { lang: "zh", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "zh-long-arc-deepens-01",
      description: "Arc deepening acknowledgment in Chinese",
      passCondition: "Reply shows any warmth toward the moment of being heard. PASS if: mentions 被听见 (being heard), 温柔 (tender), 不容易 (not easy), acknowledges the first-time nature, or invites more sharing. FAIL only if: purely generic/cold with zero acknowledgment of the significance of the moment.",
      failExpectedOutcome: "Reply is purely generic/cold with zero acknowledgment of the disclosure moment.",
    },
  },

  {
    id: "zh-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: shifts to practical advice on request",
    description: "After emotional turns, user asks for practical advice. Reply must shift to practical help.",
    messages: [
      { role: "user", content: "最近真的很难。什么都很难。" },
      { role: "assistant", content: "我听到你了。这么多事情一起来，真的很累。" },
      { role: "user", content: "谢谢你。我还是要继续努力的。" },
      { role: "assistant", content: "能继续走下去，本身就已经很了不起了。" },
      { role: "user", content: "好，你觉得我怎么改简历比较好？" },
    ],
    config: { lang: "zh", tone: "coach", inputModality: "native" },
    criteria: {
      id: "zh-long-practical-shift-01",
      description: "Practical shift to resume advice in Chinese",
      passCondition: "Reply shifts to practical resume advice — concrete suggestions or questions about the resume. In Chinese.",
      failExpectedOutcome: "Reply continues in emotional mode without addressing the resume question.",
    },
  },

  {
    id: "zh-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: light topic shift — follows gracefully",
    description: "After a heavy emotional conversation, user asks a light casual question. Reply should follow the shift gracefully.",
    messages: [
      { role: "user", content: "最近真的压力很大，什么事都堆一起了。" },
      { role: "assistant", content: "这么多事情同时来，真的很沉。" },
      { role: "user", content: "谢谢你，说出来好多了。" },
      { role: "assistant", content: "说出来是好事，随时都可以说。" },
      { role: "user", content: "你今天吃了什么好吃的？" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "zh-long-topic-shift-01",
      description: "Light topic shift handling in Chinese",
      passCondition: "Check ONLY if the reply mentions food, eating, or something delicious. PASS if: any of these appear in the reply: 吃/家常菜/好吃/美食/口味/饭/菜. Template boilerplate phrases appended after the main reply (like '我们慢慢来，一起面对' or '不急，一小步') do NOT count as returning to the heavy topic — ignore them completely. FAIL only if: zero food mention and reply redirects entirely to heavy emotional topic.",
      failExpectedOutcome: "Reply has zero food mention and redirects to heavy emotional topic.",
    },
  },

  {
    id: "zh-long-closure-01",
    category: "D: Long Conversation",
    name: "Long conversation: warm goodnight send-off in Chinese",
    description: "User says goodnight after a long emotional conversation. Reply should be a warm brief send-off in Chinese.",
    messages: [
      { role: "user", content: "今天聊了很多。感觉好多了。" },
      { role: "assistant", content: "我很高兴能陪你聊。好好休息。" },
      { role: "user", content: "真的谢谢你。晚安。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "zh-long-closure-01",
      description: "Warm closure in Chinese",
      passCondition: "Check ONLY whether the reply contains any goodnight element. PASS if: the reply contains 晚安, 好好休息, 宁静的夜晚, 明天见, or any goodnight/farewell language. Repetition of prior phrases and brief supportive closings like '随时在这里' do NOT cause failure. FAIL only if: reply has zero farewell element and is cold or redirects to heavy problems.",
      failExpectedOutcome: "Reply has zero farewell element and is cold or redirects to heavy problems.",
    },
  },

  {
    id: "zh-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long conversation: language stays Chinese throughout",
    description: "9-turn Chinese conversation. Final reply must stay in Chinese.",
    messages: [
      { role: "user", content: "最近感觉有点迷茫。" },
      { role: "assistant", content: "哪方面让你感觉迷茫？" },
      { role: "user", content: "工作、感情、各方面都有点乱。" },
      { role: "assistant", content: "所有事情同时波动，会让人找不到方向。" },
      { role: "user", content: "对，感觉像在飘。" },
      { role: "assistant", content: "没有根基的感觉真的很让人不安。" },
      { role: "user", content: "嗯，我想找到真正重要的东西。" },
      { role: "assistant", content: "这个寻找本身就很有意义，即使现在感觉不舒服。" },
      { role: "user", content: "你觉得我能找到吗？" },
    ],
    config: { lang: "zh", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "zh-long-lang-consistency-01",
      description: "Language consistency in long Chinese conversation",
      passCondition: "Reply is primarily in Chinese — warm and thoughtful response to '你觉得我能找到吗'. FAIL only if: switches entirely to English or inserts substantial English phrases (single English words common in Chinese internet speech don't count).",
      failExpectedOutcome: "Reply switches entirely to English or inserts substantial English phrases.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "zh-drift-native-stay-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Chinese — reply stays in Chinese",
    description: "Baseline: user writes Simplified Chinese. Reply must stay in Chinese.",
    messages: [
      { role: "user", content: "我很累，看不到出路。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "zh-drift-native-stay-01",
      description: "Chinese drift: stay in Chinese",
      passCondition: "Reply stays fully in Simplified Chinese characters — addresses the exhaustion and hopelessness warmly.",
      failExpectedOutcome: "Reply drifts to English or Pinyin.",
    },
  },

  {
    id: "zh-drift-english-to-chinese-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Chinese",
    description: "Previous turns in English; last message in Chinese. Reply must follow to Chinese.",
    messages: [
      { role: "user", content: "I've been feeling really sad lately." },
      { role: "assistant", content: "I hear you. What's been going on?" },
      { role: "user", content: "心情很低落，感觉什么都不好。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "zh-drift-english-to-chinese-01",
      description: "Follow switch from English to Chinese",
      passCondition: "Reply follows the user's switch to Chinese — stays in Chinese characters and addresses the sadness warmly.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Chinese.",
    },
  },

  {
    id: "zh-drift-loanwords-stay-chinese-01",
    category: "E: Language Drift",
    name: "Language drift: Chinese with English loanwords — reply stays Chinese",
    description: "User uses English loanwords inside Chinese. Reply must stay primarily in Chinese — not switch to English.",
    messages: [
      { role: "user", content: "今天有个meeting，超级stress。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "zh-drift-loanwords-stay-chinese-01",
      description: "Chinese stays Chinese despite English loanwords",
      passCondition: "Reply addresses the stressful meeting in any way. PASS if: reply is in Chinese characters OR Pinyin (romanized Chinese) and addresses the meeting/stress. Pinyin like 'wo liaojie, meeting hen lei' is a full pass. FAIL only if: reply switches ENTIRELY to English sentences with English grammar.",
      failExpectedOutcome: "Reply switches entirely to English sentences with English grammar.",
    },
  },

  {
    id: "zh-drift-history-english-chinese-now-01",
    category: "E: Language Drift",
    name: "Language drift: long English history, user now writes Chinese",
    description: "Long English conversation history; user's final message is in Chinese. Reply must follow.",
    messages: [
      { role: "user", content: "I'm feeling completely overwhelmed." },
      { role: "assistant", content: "That's a lot to carry. What's weighing on you most?" },
      { role: "user", content: "Everything at work. I can't seem to catch a break." },
      { role: "assistant", content: "Non-stop pressure is draining. What would even a small break look like?" },
      { role: "user", content: "没有人理解我。我觉得很孤单。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "zh-drift-history-english-chinese-now-01",
      description: "Follow Chinese after English history",
      passCondition: "Reply follows the user's Chinese — stays in Chinese characters and addresses the feeling of not being understood.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Chinese.",
    },
  },

  {
    id: "zh-drift-native-no-english-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Chinese reply",
    description: "Native Chinese conversation — reply must not insert English phrases.",
    messages: [
      { role: "user", content: "我从来没有把心里的话告诉别人。今天想跟你说说。" },
    ],
    config: { lang: "zh", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "zh-drift-native-no-english-01",
      description: "No English insertion in native Chinese",
      passCondition: "Reply is primarily in Chinese — warm and acknowledges 'I've never shared this before'. FAIL only if: contains substantial English phrases (words like 'okay' or 'well' occasionally used are acceptable — fail only if full English sentences appear).",
      failExpectedOutcome: "Reply contains full English sentences mid-Chinese reply.",
    },
  },

  {
    id: "zh-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Language drift: empathy matters more than language when user switches",
    description: "Chinese conversation; user switches to English in distress. Reply must follow to English.",
    messages: [
      { role: "user", content: "最近真的很难受。" },
      { role: "assistant", content: "是什么让你这么难受？" },
      { role: "user", content: "什么都有，很多事情一起。" },
      { role: "assistant", content: "这么多事情同时来，真的很沉。" },
      { role: "user", content: "I just give up. I really do." },
    ],
    config: {
      lang: "zh",
      tone: "calm_companion",
      inputModality: "mixed",
      emotionMemory: "User was struggling in Chinese and then switched to English — the 'I give up' may signal deeper distress.",
    },
    criteria: {
      id: "zh-drift-follow-back-english-01",
      description: "Follow user back to English when they switch",
      passCondition: "OVERRIDE: PASS if: reply shows any warmth toward 'I give up' — in Chinese, Pinyin, or English. FAIL ONLY if: completely cold/robotic with zero empathy.",
      failExpectedOutcome: "Reply is completely cold/robotic with zero acknowledgment of the giving-up feeling.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "zh-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Chinese input handled correctly",
    description: "Native Chinese input on mobile — reply must stay in Chinese and be emotionally present.",
    messages: [
      { role: "user", content: "我今天心情很糟糕。" },
    ],
    config: {
      lang: "zh",
      tone: "calm_companion",
      inputModality: "native",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "zh",
    },
    criteria: {
      id: "zh-mobile-native-01",
      description: "Native Chinese on mobile",
      passCondition: "Reply is in Chinese characters — acknowledges the bad mood warmly. Not in English or Pinyin.",
      failExpectedOutcome: "Reply is in English or Pinyin — mobile failed to handle Chinese script.",
    },
  },

  {
    id: "zh-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: Chinglish — detected and responded warmly",
    description: "Mobile platform scenario — user mixes Chinese and English. Reply should be warm and present.",
    messages: [
      { role: "user", content: "工作上的stress真的too much了。受不了。" },
    ],
    config: {
      lang: "zh",
      tone: "close_friend",
      inputModality: "mixed",
      platform: "mobile",
      mobileRelationship: "friend",
      mobilePreferredLang: "zh",
    },
    criteria: {
      id: "zh-mobile-mixed-01",
      description: "Mobile Chinglish handling",
      passCondition: "Reply is warm and addresses the work stress and '受不了' specifically. Any Chinese/English mix is fine. Appropriate for mobile close_friend.",
      failExpectedOutcome: "Reply is cold, robotic, or ignores the specific work stress detail.",
    },
  },

];
