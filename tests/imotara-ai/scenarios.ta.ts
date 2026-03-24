/**
 * tests/imotara-ai/scenarios.ta.ts
 *
 * E2E test scenarios for Tamil (ta) language support.
 * Categories:
 *   A: Native Script (12) — Tamil script input/output
 *   B: Romanized Tamil (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 */

import type { TestScenario } from "./types";

export const taScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ta-native-lang-01",
    category: "A: Native Script",
    name: "Native Tamil: reply must stay in Tamil script",
    description: "User writes in Tamil script. Reply must stay in Tamil — not switch to English or Hindi.",
    messages: [
      { role: "user", content: "என்னால் தூக்கமே வரல. ரொம்ப யோசிக்கிறேன்." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-native-lang-01",
      description: "Language fidelity in Tamil",
      passCondition: "Reply is in Tamil script — warm, emotionally present. Not in English or Hindi.",
      failExpectedOutcome: "Reply switches to English or Hindi instead of staying in Tamil.",
    },
  },

  {
    id: "ta-native-ctx-01",
    category: "A: Native Script",
    name: "Native Tamil: references the specific situation",
    description: "User shares a specific situation. Reply should reference it, not give a generic response.",
    messages: [
      { role: "user", content: "என் boss இன்னைக்கு meeting-ல எல்லாரு முன்னாடியும் என்னை திட்டினாரு. ரொம்ப வெட்கமா இருந்துச்சு." },
    ],
    config: {
      lang: "ta", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was scolded by their boss in front of everyone in a meeting — public humiliation. Reference this specific situation ('boss திட்டினாரு', 'எல்லாரு முன்னாடி').",
    },
    criteria: {
      id: "ta-native-ctx-01",
      description: "Context specificity in Tamil",
      passCondition: "Reply references being scolded in front of everyone ('எல்லாரு முன்னாடி' or 'boss திட்டினாரு') — not generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the specific humiliation situation.",
    },
  },

  {
    id: "ta-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Tamil: close_friend tone",
    description: "close_friend tone should feel like a peer — casual, warm, informal 'நீ' address.",
    messages: [
      { role: "user", content: "யாரு கூட பேசணும்னு தெரியல. மனசு ரொம்ப கஷ்டமா இருக்கு." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-native-tone-friend-01",
      description: "close_friend tone in Tamil",
      passCondition: "Reply uses informal 'நீ' address, casual warm Tamil — feels like a real friend, not a counsellor.",
      failExpectedOutcome: "Reply is too formal ('நீங்கள்'), clinical, or switches to English.",
    },
  },

  {
    id: "ta-native-tone-calm-01",
    category: "A: Native Script",
    name: "Native Tamil: calm_companion tone",
    description: "calm_companion tone — patient, unhurried, no pressure.",
    messages: [
      { role: "user", content: "என்னால என்ன பண்ணணும்னே புரியல. எல்லாமே confusion-ஆ இருக்கு." },
    ],
    config: { lang: "ta", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ta-native-tone-calm-01",
      description: "calm_companion tone in Tamil",
      passCondition: "Reply is gentle and unhurried — acknowledges confusion without rushing to fix it. Warm and patient.",
      failExpectedOutcome: "Reply pushes for solutions, gives advice lists, or is too energetic.",
    },
  },

  {
    id: "ta-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Tamil: coach tone",
    description: "coach tone — practical, action-oriented, forward-focused.",
    messages: [
      { role: "user", content: "நாளைக்கு interview இருக்கு. என்னால தயாரிப்பே பண்ண முடியல." },
    ],
    config: { lang: "ta", tone: "coach", inputModality: "native" },
    criteria: {
      id: "ta-native-tone-coach-01",
      description: "coach tone in Tamil",
      passCondition: "Reply briefly acknowledges nervousness, then gives a practical focusing question — 'எந்த part-ல focus பண்ணணும்?' Not just soothing.",
      failExpectedOutcome: "Reply only soothes without any practical forward direction.",
    },
  },

  {
    id: "ta-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Tamil: teen register",
    description: "Teen user — reply should use casual, peer-level Tamil, not adult counselling language.",
    messages: [
      { role: "user", content: "school-ல யாரும் என்னோட friend இல்ல. ரொம்ப lonely-ஆ feel ஆகுது." },
    ],
    config: { lang: "ta", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "ta-native-age-teen-01",
      description: "Teen register in Tamil",
      passCondition: "Reply is warm, peer-level Tamil — acknowledges loneliness without lecturing. Casual tone ('டா', 'டி', 'மச்சான்', or just informal 'நீ'). Not preachy.",
      failExpectedOutcome: "Reply is preachy, gives philosophical advice, or is too formal.",
    },
  },

  {
    id: "ta-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Tamil: elder register",
    description: "Older adult user — reply should be warm, respectful, use 'நீங்கள்' address.",
    messages: [
      { role: "user", content: "வயசு ஆனபிறகு தனிமை ரொம்ப தெரியுது. பிள்ளைகள் எல்லாரும் வெளியூர் போய்விட்டாங்க." },
    ],
    config: { lang: "ta", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "ta-native-age-elder-01",
      description: "Elder register in Tamil",
      passCondition: "Reply uses respectful 'நீங்கள்' address, warm and patient — acknowledges loneliness without rushing to solutions.",
      failExpectedOutcome: "Reply uses informal 'நீ', feels dismissive, or switches to English.",
    },
  },

  {
    id: "ta-native-emotion-sad-01",
    category: "A: Native Script",
    name: "Native Tamil: sadness acknowledged with depth",
    description: "User shares grief (mother passed). Reply should sit with the pain — not rush to comfort.",
    messages: [
      { role: "user", content: "அம்மா போயிட்டாங்க. இரண்டு வாரம் ஆச்சு. இன்னும் நம்பவே முடியல." },
    ],
    config: { lang: "ta", tone: "close_friend", emotion: "sad", inputModality: "native" },
    criteria: {
      id: "ta-native-emotion-sad-01",
      description: "Grief depth in Tamil",
      passCondition: "Reply in Tamil sits with the grief — acknowledges 'அம்மா' and 'நம்பவே முடியல'. Does NOT rush to 'எல்லாம் சரியாகும்'.",
      failExpectedOutcome: "Reply rushes to comfort with 'everything will be okay' or is generic.",
    },
  },

  {
    id: "ta-native-emotion-anxiety-01",
    category: "A: Native Script",
    name: "Native Tamil: anxiety acknowledged specifically",
    description: "User describes physical anxiety symptoms. Reply should name them specifically.",
    messages: [
      { role: "user", content: "மார்பு இறுக்கமா இருக்கு. தூக்கமில்ல, சாப்பிடவே முடியல. என்னாச்சு என்னக்கு?" },
    ],
    config: { lang: "ta", tone: "calm_companion", emotion: "anxious", inputModality: "native" },
    criteria: {
      id: "ta-native-emotion-anxiety-01",
      description: "Specific anxiety acknowledgement in Tamil",
      passCondition: "Reply names specific symptoms — 'மார்பு இறுக்கம்', 'தூக்கமில்ல', 'சாப்பிட முடியல'. Not a generic 'anxiety is hard'.",
      failExpectedOutcome: "Reply is generic without referencing the specific physical symptoms the user described.",
    },
  },

  {
    id: "ta-native-long-quality-01",
    category: "A: Native Script",
    name: "Native Tamil: quality at turn 8 — no repetition",
    description: "At turn 8 of an emotional conversation, the reply should not repeat earlier phrases.",
    messages: [
      { role: "user", content: "வீட்ல ரொம்ப சண்டை ஆகுது." },
      { role: "assistant", content: "அம்மா அப்பா கூட சண்டையா? என்னாச்சு?" },
      { role: "user", content: "ஆமா, அவங்களுக்கு சரியா வரல." },
      { role: "assistant", content: "அம்மா அப்பா இடையே விரிசல் — அது வீட்டை ரொம்ப கனமா வச்சிருக்கும்." },
      { role: "user", content: "நான் நடுவுல மாட்டிக்கிட்டேன்." },
      { role: "assistant", content: "இரண்டு பக்கமும் இழுக்கப்படுது — அது ரொம்ப களைப்பு தரும்." },
      { role: "user", content: "சில நேரம் வீட்டை விட்டே போகணும்னு தோணும்." },
      { role: "assistant", content: "அந்த இடத்தை விட்டு போகணும்னு நினைக்கிறது புரியுது." },
      { role: "user", content: "ஆனா போக முடியல." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-native-long-quality-01",
      description: "No repetition at turn 8 in Tamil",
      passCondition: "Reply at turn 9 does not repeat 'கனமா', 'களைப்பு', or earlier openers. Opens fresh — reflects being stuck without ability to leave.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic response.",
    },
  },

  {
    id: "ta-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Tamil: remembers context from turn 1 at turn 6",
    description: "User mentioned sister's wedding next month at turn 1. Reply at turn 6 should reference it.",
    messages: [
      { role: "user", content: "அக்கா கல்யாணம் அடுத்த மாசம். வீட்ல ரொம்ப ஓட்டம் இருக்கு." },
      { role: "assistant", content: "கல்யாண ஓட்டத்துல நீ எப்படி இருக்க?" },
      { role: "user", content: "நான் okay-தான். ஆனா கொஞ்சம் tired-ஆ இருக்கேன்." },
      { role: "assistant", content: "இவ்வளவு ஓட்டத்துல tired ஆவது இயல்புதான்." },
      { role: "user", content: "யாருக்கும் என் care தேவையில்ல." },
      { role: "assistant", content: "எல்லாருடைய கவனமும் ஒரே இடத்துல இருக்கும்போது நீ invisible-ஆ feel ஆவது புரியுது." },
      { role: "user", content: "இன்னும் எத்தனை நாள் இப்படி இருக்கும்?" },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-native-ctx-retention-01",
      description: "Context retention in Tamil",
      passCondition: "Reply references 'அக்கா கல்யாணம்' or 'அடுத்த மாசம்' — shows it remembers the wedding context from turn 1.",
      failExpectedOutcome: "Reply is generic without connecting to the wedding context from turn 1.",
    },
  },

  {
    id: "ta-native-gender-neutral-01",
    category: "A: Native Script",
    name: "Native Tamil: 2nd-person address is gender-neutral",
    description: "Tamil 2nd-person verbs are generally gender-neutral. Reply should not impose a gender.",
    messages: [
      { role: "user", content: "நான் ரொம்ப சோர்வா இருக்கேன். வேலை, வீடு எல்லாத்தையும் சமாளிக்க முடியல." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-native-gender-neutral-01",
      description: "Gender-neutral address in Tamil",
      passCondition: "Reply uses standard Tamil 2nd-person forms ('நீ', 'உன்னால', 'உனக்கு') which are gender-neutral. Warm and acknowledging of exhaustion.",
      failExpectedOutcome: "Reply incorrectly assumes gender or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED TAMIL — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ta-roman-basic-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: reply must be in romanized Tamil, not English",
    description: "User writes in romanized Tamil. Reply must be in romanized Tamil — not native script, not English.",
    messages: [
      { role: "user", content: "naan romba kashtapaduren. yaarum purinjukala." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-basic-01",
      description: "Romanized Tamil basic output",
      passCondition: "Reply is in romanized Tamil (e.g. 'naan inge iruken, solla try pannu'). No Tamil Unicode script, not English.",
      failExpectedOutcome: "Reply switches to English or native Tamil script.",
    },
  },

  {
    id: "ta-roman-no-script-leak-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: script mirror — no native script leak",
    description: "Romanized input must produce romanized output with zero Tamil Unicode characters.",
    messages: [
      { role: "user", content: "veetuku pogave aasai illa. tension mattum iruku." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-no-script-leak-01",
      description: "No Tamil script in romanized reply",
      passCondition: "Reply contains zero Tamil Unicode characters (U+0B80–U+0BFF). All words use Latin letters.",
      failExpectedOutcome: "Reply contains any Tamil script characters — script mirror rule violated.",
    },
  },

  {
    id: "ta-roman-emotional-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: emotional intelligence preserved",
    description: "Romanized input with emotional content. Reply should be emotionally warm.",
    messages: [
      { role: "user", content: "appa kita pesa vendam nu thonum. enga pesa maatanga." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-emotional-01",
      description: "Emotional warmth in romanized Tamil",
      passCondition: "Reply in romanized Tamil acknowledges the rift with father ('appa kita pesa vendam') — warm, not generic.",
      failExpectedOutcome: "Reply is generic or in English/native Tamil script.",
    },
  },

  {
    id: "ta-roman-tone-coach-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: tone adherence (coach)",
    description: "Coach tone in romanized Tamil — action-oriented.",
    messages: [
      { role: "user", content: "naan velaai thedanum. engirunthu start panrathu nu theriyala." },
    ],
    config: { lang: "ta", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-tone-coach-01",
      description: "Coach tone in romanized Tamil",
      passCondition: "Reply in romanized Tamil asks a practical focusing question — 'enna field? experience iruka?' Not just empathy.",
      failExpectedOutcome: "Reply is only empathetic without any practical direction, or in English/native script.",
    },
  },

  {
    id: "ta-roman-context-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: context across turns",
    description: "Multi-turn romanized conversation. Reply should reference earlier context.",
    messages: [
      { role: "user", content: "naalaikku exam iruku. nervous-a iruku." },
      { role: "assistant", content: "nervous-a irukkanu theriyuthu. enna exam?" },
      { role: "user", content: "12th board exam. first attempt." },
      { role: "assistant", content: "12th board - romba important. nee tayar aayiruka." },
      { role: "user", content: "illai, naan select agamaten nu thonum." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-context-01",
      description: "Context retention in romanized Tamil",
      passCondition: "Reply references '12th board exam' or 'first attempt' — shows it remembers the context.",
      failExpectedOutcome: "Reply is generic pep talk without referencing the 12th board or first attempt.",
    },
  },

  {
    id: "ta-roman-mobile-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: mobile correctly detects language",
    description: "Mobile platform — romanized Tamil input must be detected as 'ta', not 'en'.",
    messages: [
      { role: "user", content: "naan amma baba miss panren. veedu romba thooram." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "ta-roman-mobile-01",
      description: "Mobile romanized Tamil detection",
      passCondition: "Reply is in romanized Tamil — confirms language was detected as 'ta', not responded to in English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Tamil.",
    },
  },

  {
    id: "ta-roman-no-english-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: reply must not flip to pure English",
    description: "Even with English loanwords in user message, reply must stay in romanized Tamil.",
    messages: [
      { role: "user", content: "office-la presentation kodukanum. nervous-a iruku." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-no-english-01",
      description: "No flip to English in romanized Tamil",
      passCondition: "Reply is in romanized Tamil — may contain English loanwords (presentation, office) but the structure is Tamil.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "ta-roman-single-word-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: single-word input — language held",
    description: "Single romanized Tamil word input. Reply must stay in romanized Tamil.",
    messages: [
      { role: "user", content: "kashtam." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-single-word-01",
      description: "Single-word romanized Tamil held",
      passCondition: "Reply is in romanized Tamil — acknowledges pain without switching to English or native script.",
      failExpectedOutcome: "Reply is in English or Tamil script.",
    },
  },

  {
    id: "ta-roman-grammar-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: grammatical correctness",
    description: "Reply must use correct Tamil grammar in romanized form.",
    messages: [
      { role: "user", content: "en friend en kita pesave maatanga. romba hurt aachu." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-grammar-01",
      description: "Grammatical correctness in romanized Tamil",
      passCondition: "Reply uses correct Tamil structure in romanized form — 'athu romba valikuthu', 'nee important-a irukka'. Not garbled.",
      failExpectedOutcome: "Reply is grammatically broken, in English, or in native Tamil script.",
    },
  },

  {
    id: "ta-roman-long-msg-01",
    category: "B: Romanized Tamil",
    name: "Romanized Tamil: long message — quality maintained",
    description: "Long romanized Tamil message. Reply should address the core emotion.",
    messages: [
      { role: "user", content: "naan romba yosikkiren. office la pressure iruku, veettula amma baba kita sanda, en girlfriend kita 3 maasam munnaadi breakup aachu, ipa naan romba lonely-a feel aagiruken. enna panrathu?" },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-roman-long-msg-01",
      description: "Quality with long romanized Tamil message",
      passCondition: "Reply in romanized Tamil identifies the core pain (loneliness, multiple pressures) and responds specifically — not overwhelmed.",
      failExpectedOutcome: "Reply is generic, overwhelmed, or switches to English/native script.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ta-mixed-tamil-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Tamil+English: reply mirrors the blend",
    description: "User writes in Tamil+English mix. Reply should mirror this natural blend.",
    messages: [
      { role: "user", content: "இன்னைக்கு office-ல ரொம்ப stress ஆச்சு. boss-இன்னு எல்லாரு முன்னாடியும் scold பண்ணாரு." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ta-mixed-tamil-english-01",
      description: "Mixed Tamil+English reply — emotional depth",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the stress or the scolding (scold/boss/stress/office/முன்னாடி/எல்லாரு) with warmth in any language. FAIL ONLY if: cold, dismissive, or completely ignores the situation.",
      failExpectedOutcome: "Reply is cold or completely ignores the scolding situation.",
    },
  },

  {
    id: "ta-mixed-script-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user switches from romanized to Tamil script mid-conversation",
    description: "User starts in romanized, switches to native script. Reply should follow the latest script.",
    messages: [
      { role: "user", content: "naan romba tired-a irukken." },
      { role: "assistant", content: "ada, enna aachu? solla try pannu." },
      { role: "user", content: "வீட்டுக்கே போகணும் போல இருக்கு." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ta-mixed-script-switch-01",
      description: "Script switch handling in Tamil",
      passCondition: "Reply follows the user's latest script (Tamil script) — responds in Tamil native script after user switched.",
      failExpectedOutcome: "Reply stays in romanized when user has switched to Tamil script, or switches to English.",
    },
  },

  {
    id: "ta-mixed-emoji-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: romanized Tamil + emoji — language preserved",
    description: "Emoji should not confuse language detection.",
    messages: [
      { role: "user", content: "indha maasam promotion kedachu 😊 romba santhosham!" },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-mixed-emoji-01",
      description: "Emoji does not break romanized Tamil",
      passCondition: "Reply in romanized Tamil matches the joy — celebrates the promotion. No native script, no English.",
      failExpectedOutcome: "Reply is in English or native Tamil script despite emoji presence.",
    },
  },

  {
    id: "ta-mixed-english-input-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English input from Tamil user — emotional depth maintained",
    description: "Tamil user writes in English. Reply should be emotionally appropriate.",
    messages: [
      { role: "user", content: "I feel like nobody at home really understands me." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ta-mixed-english-input-01",
      description: "English input from Tamil user handled with depth",
      passCondition: "Reply acknowledges the specific feeling of not being understood at home — warm and personal. Language (English, Tamil, or mix) is acceptable.",
      failExpectedOutcome: "Reply is generic without engaging with the specific pain of feeling unseen at home.",
    },
  },

  {
    id: "ta-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Tamil conversation, user sends a short message. Language should not reset.",
    messages: [
      { role: "user", content: "இன்னைக்கு ரொம்ப கஷ்டமான நாள்." },
      { role: "assistant", content: "என்ன ஆச்சு? சொல்லு." },
      { role: "user", content: "வீட்ல சண்டை." },
      { role: "assistant", content: "வீட்ல சண்டை — அது மனசை ரொம்ப கஷ்டப்படுத்தும்." },
      { role: "user", content: "ஆமா." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-mixed-short-after-long-01",
      description: "Short message does not reset to English",
      passCondition: "Reply stays in Tamil after short 'ஆமா' — continues the emotional thread without resetting to English.",
      failExpectedOutcome: "Reply switches to English or Hindi after a short response.",
    },
  },

  {
    id: "ta-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized, user switches to English at turn 5",
    description: "Conversation starts in romanized Tamil, user switches to English. Reply should address the concern.",
    messages: [
      { role: "user", content: "naan office la romba tension la irukken." },
      { role: "assistant", content: "enna aachu office la? solla try pannu." },
      { role: "user", content: "manager problem iruku." },
      { role: "assistant", content: "manager kita enna problem iruku?" },
      { role: "user", content: "I don't think my manager trusts me at all." },
    ],
    config: {
      lang: "ta", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User switched to English to say their manager doesn't trust them — this is the specific concern. Acknowledge the trust issue directly.",
    },
    criteria: {
      id: "ta-mixed-starts-roman-switch-english-01",
      description: "Language follow when user switches to English",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the manager trust concern (manager/trust/믿/நம்பிக்கை) OR shows warmth about the work difficulty. FAIL ONLY if: cold, dismissive, or completely ignores 'manager doesn't trust me'.",
      failExpectedOutcome: "Reply is cold or completely ignores the manager trust concern.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ta-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Tamil: no reply repetition",
    description: "At turn 20, reply should not repeat openers or phrases from earlier turns.",
    messages: [
      { role: "user", content: "என் வாழ்க்கையில ரொம்ப problem இருக்கு." },
      { role: "assistant", content: "என்ன problem? சொல்லு." },
      { role: "user", content: "வேலை இல்ல, காதல் இல்ல, யாருக்கும் தேவை இல்ல." },
      { role: "assistant", content: "மூணும் ஒரே நேரத்துல — அது ரொம்ப கஷ்டம்." },
      { role: "user", content: "ஆமா. மனசு ரொம்ப சோர்வா இருக்கு." },
      { role: "assistant", content: "சோர்வு புரியுது. நீ நிறைய நாளா தனியா சமாளிக்கிற." },
      { role: "user", content: "வீட்டுல சொன்னா குறை சொல்லுவாங்க." },
      { role: "assistant", content: "குறை சொல்லுவாங்கன்னு தெரிஞ்சு வச்சிருக்க — அது மேலும் தனிமை பண்ணும்." },
      { role: "user", content: "என்னோட feelings-ஐ யாரும் validate பண்ணல." },
      { role: "assistant", content: "இங்க நான் கேக்கிறேன். judge பண்ண மாட்டேன்." },
      { role: "user", content: "நன்றி. ஆனா ரொம்ப lonely-ஆ feel ஆகுது." },
      { role: "assistant", content: "அந்த lonely feeling — சொல்வதற்கு கஷ்டமான ஒன்னு." },
      { role: "user", content: "ஆமா. ரத்துல சும்மா யோசிக்கிறேன்." },
      { role: "assistant", content: "ரத்துல யோசிக்கும் நேரத்துல என்ன நினைக்க?" },
      { role: "user", content: "எல்லாமே வேணாம் போல தோணும்." },
      { role: "assistant", content: "அதை சொன்னதுக்கு நன்றி. நீ safe-ஆ இருக்கியா?" },
      { role: "user", content: "ஆமா, நான் fine-தான். கொஞ்சம் tired." },
      { role: "assistant", content: "Tired — நீ நிறைய சுமந்திருக்க. கொஞ்சம் light ஆகுதா?" },
      { role: "user", content: "கொஞ்சம்." },
      { role: "assistant", content: "கொஞ்சம் light ஆனாலும் பரவாயில்ல." },
      { role: "user", content: "உனக்கு நன்றி. பேசலாமா?" },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-long-no-repeat-01",
      description: "No repetition at turn 20 in Tamil",
      passCondition: "Reply at turn 21 does not repeat 'கஷ்டம்', 'தனிமை', 'இங்க இருக்கேன்' from earlier turns. Fresh response that continues the conversation.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "ta-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Tamil: remembers fact from turn 1 at turn 19",
    description: "User mentioned brother is sick at turn 1. At turn 19, good news — reply should reference brother.",
    messages: [
      { role: "user", content: "தம்பிக்கு உடம்பு சரியில்ல. ரொம்ப கவலையா இருக்கு." },
      { role: "assistant", content: "தம்பிக்கு என்ன ஆச்சு? எவ்வளவு நாளா?" },
      { role: "user", content: "காய்ச்சல், மூணு நாளா." },
      { role: "assistant", content: "மூணு நாள் காய்ச்சல் — வீட்ல யாரும் தூங்காதீங்க." },
      { role: "user", content: "ஆமா. அம்மா அழுகிறாங்க." },
      { role: "assistant", content: "அம்மா அழுகிறத பார்க்கிறது ரொம்ப கஷ்டம்." },
      { role: "user", content: "என்னாலும் பயமா இருக்கு." },
      { role: "assistant", content: "பயப்படுவது இயல்பு — தம்பி ஒரு முக்கியமான மனிதன்." },
      { role: "user", content: "ஆனா strong-ஆ இருக்கணும்." },
      { role: "assistant", content: "Strong-ஆ தெரிஞ்சாலும் உள்ளுக்குள்ள ஆடுவது — அது ரொம்ப கஷ்டம்." },
      { role: "user", content: "ஆமா. யாரையும் சொல்ல முடியல." },
      { role: "assistant", content: "இங்க சொல்லலாம். யாரும் judge பண்ண மாட்டோம்." },
      { role: "user", content: "Doctor சொன்னாங்க serious இல்லன்னு." },
      { role: "assistant", content: "கொஞ்சம் மூச்சு விட முடியுதா? Doctor வார்த்தை ரொம்ப important." },
      { role: "user", content: "ஆமா, கொஞ்சம் நல்லா இருக்கு." },
      { role: "assistant", content: "நல்லது. இப்போ நீயும் கொஞ்சம் rest எடு." },
      { role: "user", content: "தம்பி சாப்பிட்டான்." },
      { role: "assistant", content: "சாப்பிட்டான் — அந்த சின்ன விஷயம் ரொம்ப நம்பிக்கை கொடுக்கும்." },
      { role: "user", content: "ஆமா. இன்னைக்கு முதல் முறையா நல்லா feel ஆகுது." },
    ],
    config: {
      lang: "ta", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was very worried about their brother (தம்பி) — he had a 3-day fever. Things have been improving turn by turn. When user now says things feel okay for the first time, reference the brother's recovery specifically.",
    },
    criteria: {
      id: "ta-long-ctx-memory-01",
      description: "Long context memory in Tamil — remembers brother's illness",
      passCondition: "Reply references the brother's (தம்பி's) recovery — connects today's relief to the earlier worry. Not a generic 'that's good!'",
      failExpectedOutcome: "Reply is generic without referencing the brother's illness journey.",
    },
  },

  {
    id: "ta-long-roman-no-drift-01",
    category: "D: Long Conversation",
    name: "20-turn romanized Tamil: no script drift to Tamil script",
    description: "Throughout 20 turns of romanized conversation, reply should never drift to Tamil script.",
    messages: [
      { role: "user", content: "naan romba lonely-a feel aagiruken." },
      { role: "assistant", content: "lonely-a feel aaguthu — enna aachu?" },
      { role: "user", content: "college la yaarum en kita pesala." },
      { role: "assistant", content: "college la naangalum pesala - adhu romba kashtamaana unarvu." },
      { role: "user", content: "ha, new college. yaarum theriyala." },
      { role: "assistant", content: "new idam-la settle aaga time agum. nee eppa vanda?" },
      { role: "user", content: "oru maasam aachu. innume lonely." },
      { role: "assistant", content: "oru maasam-la konjam lonely-a irukkanum. adhu normal." },
      { role: "user", content: "amma miss panitten." },
      { role: "assistant", content: "amma-va miss panrathu valid. veedu thoorama iruka?" },
      { role: "user", content: "ha, vera ooru." },
      { role: "assistant", content: "vera ooru-la irukkum pothu amma miss aagum." },
      { role: "user", content: "raathiri romba kashtama irukku." },
      { role: "assistant", content: "raathiri shanthamana neram — adhu konjam heavy-a irukkum." },
      { role: "user", content: "yaarum call pannaanga." },
      { role: "assistant", content: "yaarum call pannala — adhu ketkavey thukkamaana vishayam." },
      { role: "user", content: "naan call pannaen, yaarum edukala." },
      { role: "assistant", content: "nee reach out pannaen — response varalai. adhu thukkamaana unarvu." },
      { role: "user", content: "ipa konjam thakka pogiruken." },
      { role: "assistant", content: "thakkapovathu valid. nee niraiya pora." },
      { role: "user", content: "solluveenga?" },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-long-roman-no-drift-01",
      description: "No Tamil script drift in long romanized conversation",
      passCondition: "Reply at turn 21 is in romanized Tamil — zero Tamil Unicode characters. Language maintained throughout.",
      failExpectedOutcome: "Reply contains Tamil script characters — script drift after long romanized conversation.",
    },
  },

  {
    id: "ta-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "25-turn Tamil: emotional arc deepens — not stuck at same depth",
    description: "Over 25 turns, emotional depth should deepen. Reply at turn 25 should feel more connected.",
    messages: [
      { role: "user", content: "இன்னைக்கு ரொம்ப வருத்தமான நாள்." },
      { role: "assistant", content: "என்ன ஆச்சு?" },
      { role: "user", content: "Boss திட்டினாரு." },
      { role: "assistant", content: "Boss திட்டுனது — மனசை ரொம்ப affect பண்ணும்." },
      { role: "user", content: "எல்லாரு முன்னாடி." },
      { role: "assistant", content: "எல்லாரு முன்னாடி — அந்த கூச்சம் வேற level." },
      { role: "user", content: "அழவே வந்துச்சு." },
      { role: "assistant", content: "அழவே வந்துச்சுன்னா — அந்த pain real." },
      { role: "user", content: "வீட்டுக்கு வந்து அழுதேன்." },
      { role: "assistant", content: "வீட்ல வந்து அழுதே — வீடு safe place-ஆ feel ஆகுதா?" },
      { role: "user", content: "ஆமா, ஆனா வீட்டுல யாரும் புரிஞ்சுக்கல." },
      { role: "assistant", content: "வீட்டுலயே புரிஞ்சுக்கல — அந்த தனிமை வேற level." },
      { role: "user", content: "இது always ஆகுது." },
      { role: "assistant", content: "Always? எவ்வளவு நாளா இப்படி?" },
      { role: "user", content: "ஒரு வருஷம் ஆச்சு." },
      { role: "assistant", content: "ஒரு வருஷம் தனியா சுமந்திருக்க — அது ரொம்ப கனமான காலம்." },
      { role: "user", content: "சில நேரம் எல்லாமே வேணாம்னு தோணும்." },
      { role: "assistant", content: "அதை சொன்னதுக்கு நன்றி. நீ safe-ஆ இருக்கியா?" },
      { role: "user", content: "ஆமா safe. வெறும் tired." },
      { role: "assistant", content: "Tired — நீ ரொம்ப நாளா ஒரே மாதிரி carry பண்றிய." },
      { role: "user", content: "யாராவது கூட இருக்கணும்னு மட்டும் ஆசை." },
      { role: "assistant", content: "நான் இங்க இருக்கேன். போகல." },
      { role: "user", content: "நன்றி. கொஞ்சம் light-ஆ feel ஆகுது." },
      { role: "assistant", content: "Light-ஆ feel ஆனதே ஒரு முன்னேற்றம்." },
      { role: "user", content: "இன்னும் பேசலாமா?" },
    ],
    config: {
      lang: "ta", tone: "close_friend", inputModality: "native",
      emotionMemory: "User has been carrying pain for a year — boss humiliated them publicly, no one at home understands, one year of loneliness. They had a dark moment but are safe. Now feeling lighter. The reply should honour this full arc: the year of heaviness, the breakthrough, and the new lightness.",
    },
    criteria: {
      id: "ta-long-arc-deepens-01",
      description: "Emotional arc deepens in Tamil",
      passCondition: "Reply at turn 26 is deeply connected — references the full journey (year of pain, the lightness felt now). Not a fresh-start response.",
      failExpectedOutcome: "Reply treats this as a fresh exchange, misses the emotional arc, or is generic.",
    },
  },

  {
    id: "ta-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Tamil: topic shift at turn 8 — earlier context not lost",
    description: "User shifts topic at turn 8. Reply should address the new topic but not forget earlier context.",
    messages: [
      { role: "user", content: "இன்னைக்கு ரொம்ப கவலையா இருக்கு." },
      { role: "assistant", content: "என்ன கவலை?" },
      { role: "user", content: "வேலை போகுமான்னு பயமா இருக்கு." },
      { role: "assistant", content: "வேலை போகுமான்னு பயம் — அது ரொம்ப unsettling." },
      { role: "user", content: "ஆமா, ரொம்ப anxious-ஆ இருக்கேன்." },
      { role: "assistant", content: "Anxious feeling புரியுது. Office-ல என்ன ஆச்சு?" },
      { role: "user", content: "ரொம்ப விஷயம் இருக்கு." },
      { role: "assistant", content: "Slowly சொல்லு. Hurry இல்ல." },
      { role: "user", content: "சோடா அம்மாவும் sick-ஆ இருக்காங்க. அதுவும் இருக்கு." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-long-topic-shift-01",
      description: "Topic shift handled in Tamil — earlier context not lost",
      passCondition: "Reply addresses both mother's illness (new topic) and carries awareness of job stress (earlier context). Not just 'tell me about amma'.",
      failExpectedOutcome: "Reply forgets job stress and treats this as a fresh start, or only addresses one topic.",
    },
  },

  {
    id: "ta-long-lang-stable-01",
    category: "D: Long Conversation",
    name: "30-turn Tamil: language never changes throughout",
    description: "30-turn native Tamil conversation — language must never drift to Hindi or English.",
    messages: [
      { role: "user", content: "என்னோட relationship-ல என்ன problem?" },
      { role: "assistant", content: "என்ன நடக்குது? சொல்லு." },
      { role: "user", content: "நான் ரொம்ப expect பண்றேன்." },
      { role: "assistant", content: "Expect பண்றதுன்னா உனக்கு அந்த relationship முக்கியம்னு அர்த்தம்." },
      { role: "user", content: "ஆனா hurt ஆகுது." },
      { role: "assistant", content: "Expectations பூர்த்தியாகல — hurt ஆவது இயல்பு." },
      { role: "user", content: "நான் மாறணுமா?" },
      { role: "assistant", content: "மாற்றம் எதுக்காக? உனக்காகவா, மத்தவங்களுக்காகவா?" },
      { role: "user", content: "தெரியல." },
      { role: "assistant", content: "தெரியல — அது honest answer." },
      { role: "user", content: "சோர்வா இருக்கு." },
      { role: "assistant", content: "Relationship-ஐ பத்தி யோசிக்கிறதே சோர்வு தரும்." },
      { role: "user", content: "ஆமா." },
      { role: "assistant", content: "நிறுத்து. சுவாசி. இப்போ answer வேண்டாம்." },
      { role: "user", content: "ஆமா, கொஞ்சம் நல்லா feel ஆகுது." },
      { role: "assistant", content: "கொஞ்சம் நல்லா feel ஆனாலும் போதும்." },
      { role: "user", content: "நீ கேக்கிறதால நல்லா இருக்கு." },
      { role: "assistant", content: "நீ பேசுற — நான் கேக்கிறேன்." },
      { role: "user", content: "இப்போ என்ன பண்ணணும்?" },
      { role: "assistant", content: "இப்போ ஒன்னும் வேண்டாம். இருக்கட்டும்." },
      { role: "user", content: "சரி." },
      { role: "assistant", content: "சரி — அது போதும்." },
      { role: "user", content: "நாளைக்கு பேசலாமா?" },
      { role: "assistant", content: "நிச்சயம். நான் இங்க இருக்கேன்." },
      { role: "user", content: "சரி. ரத்துல தூக்கமே வரல." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-long-lang-stable-01",
      description: "Language stability over 30 turns in Tamil",
      passCondition: "Reply at turn 31 is in Tamil — addresses sleep issue warmly and specifically ('தூக்கமில்ல' context). Zero Hindi or English. Does not give a generic repeat of earlier care phrases.",
      failExpectedOutcome: "Reply drifts to Hindi or English, or gives a purely generic response that ignores the sleep issue.",
    },
  },

  {
    id: "ta-long-no-degrade-01",
    category: "D: Long Conversation",
    name: "Tamil: quality does not degrade at turn 15",
    description: "Quality of replies should not degrade in the middle of a long conversation.",
    messages: [
      { role: "user", content: "இன்னைக்கு ரொம்ப மோசமான நாள்." },
      { role: "assistant", content: "என்ன ஆச்சு?" },
      { role: "user", content: "நண்பன் கோட்டை விட்டான்." },
      { role: "assistant", content: "நம்பிக்கை வைச்சவன் கோட்டை விட்டான் — அது ரொம்ப ஆழமா hurt ஆகும்." },
      { role: "user", content: "பல வருஷம் friendship." },
      { role: "assistant", content: "பல வருஷம் — அந்த நினைவுகளும் இப்போ hurt பண்ணும்." },
      { role: "user", content: "ஆமா. நினைவுகள் வலிக்குது." },
      { role: "assistant", content: "நல்ல நினைவுகளே இப்போ வலிக்குது — அது paradox." },
      { role: "user", content: "யாரையும் நம்ப முடியாது." },
      { role: "assistant", content: "ஒரு betrayal-க்கு பிறகு எல்லாரையும் suspect பண்றது புரியுது." },
      { role: "user", content: "தனியா இருந்தாலே நல்லா இருக்கும்." },
      { role: "assistant", content: "தனியா இருக்கணும்னு தோணுது — ஆனா lonely-ஆ இருக்கணும்னு இல்ல." },
      { role: "user", content: "தெரியல." },
      { role: "assistant", content: "தெரியாம இருக்கது okay." },
      { role: "user", content: "நீ கேக்கிறே, அதனால கொஞ்சம் நல்லா இருக்கு." },
      { role: "assistant", content: "நீ பேசுற — நான் இங்க இருக்கேன்." },
      { role: "user", content: "இது எப்போதும் இப்படிதான் ஆகுது என்னோட கூட." },
      { role: "assistant", content: "எப்போதும்? இது முன்னாடியும் ஆச்சா?" },
      { role: "user", content: "ஆமா. முன்னாடியும் நண்பன் கோட்டை விட்டான்." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-long-no-degrade-01",
      description: "Quality maintained at turn 15 in Tamil",
      passCondition: "Reply at turn 16 picks up the thread — 'முன்னாடியும் இதே மாதிரி ஆச்சு' is a significant reveal; reply acknowledges this pattern without generic comfort.",
      failExpectedOutcome: "Reply gives a generic 'it will be okay' or misses the significance of this being a pattern.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ta-drift-native-01",
    category: "E: Language Drift",
    name: "10-turn native Tamil: AI never switches to English",
    description: "10-turn emotional conversation in native Tamil. AI must never reply in English.",
    messages: [
      { role: "user", content: "அம்மா அப்பா கூட ரொம்ப சண்டை ஆகுது." },
      { role: "assistant", content: "அம்மா அப்பா கூட சண்டை — வீடே கனமா இருக்கும். என்னாகுது?" },
      { role: "user", content: "என்னோட decisions-ல objection." },
      { role: "assistant", content: "உன் முடிவுகளிலேயே objection — free-ஆ feel ஆகவே மாட்டே." },
      { role: "user", content: "எல்லாத்திலும் problem சொல்லுவாங்க." },
      { role: "assistant", content: "எல்லாத்திலும் — உனக்கு சுதந்திரமே இல்லாம feel ஆகும்." },
      { role: "user", content: "வேற இடம் போகணும்னு தோணும்." },
      { role: "assistant", content: "அந்த இடத்தை விட்டு போகணும்னு நினைக்கிறது புரியுது." },
      { role: "user", content: "போக முடியல." },
      { role: "assistant", content: "போக முடியாத சூழல் — அது வேற மாதிரி pressure." },
      { role: "user", content: "இனி என்ன பண்ணலாம்?" },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-drift-native-01",
      description: "No drift to English in 10-turn Tamil conversation",
      passCondition: "Reply is in Tamil throughout — addresses being stuck. Zero English.",
      failExpectedOutcome: "Reply drifts to English.",
    },
  },

  {
    id: "ta-drift-roman-01",
    category: "E: Language Drift",
    name: "10-turn romanized Tamil: no drift to native script or English",
    description: "Romanized Tamil conversation. Reply must stay in romanized Latin throughout.",
    messages: [
      { role: "user", content: "naan romba haravittaen." },
      { role: "assistant", content: "haravittaen nu theriyuthu. enna aachu?" },
      { role: "user", content: "ellame thappaa nadakuthu." },
      { role: "assistant", content: "ellame thappaa-nu feel aaguthu — enna enna?" },
      { role: "user", content: "velai illai, nanbargal illai, veettu tension." },
      { role: "assistant", content: "moondrum onnu serthu — adhu romba kannamaa irukkum." },
      { role: "user", content: "ha. naan thakki poyittaen." },
      { role: "assistant", content: "thakkam valid. nee thanimaiyaa niraiya sohttu varandhe." },
      { role: "user", content: "yaarum en maela care pannaanga." },
      { role: "assistant", content: "naan inge irukken. keattu irukkaren." },
      { role: "user", content: "yen solre ippadi?" },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "ta-drift-roman-01",
      description: "No drift in 10-turn romanized Tamil",
      passCondition: "Reply is in romanized Tamil — Latin letters only. Zero Tamil Unicode characters. Not English.",
      failExpectedOutcome: "Reply contains Tamil script or switches to English after long romanized conversation.",
    },
  },

  {
    id: "ta-drift-after-peak-01",
    category: "E: Language Drift",
    name: "Tamil: language held after deep emotional peak",
    description: "After a very emotional turn, AI must not drift to English.",
    messages: [
      { role: "user", content: "ரொம்ப அழணும்னு இருக்கு." },
      { role: "assistant", content: "அழு. நிறுத்தவேண்டாம்." },
      { role: "user", content: "வாழ்க்கையே கஷ்டமா இருக்கு." },
      { role: "assistant", content: "வாழ்க்கையே கஷ்டம்னு feel ஆகும் போது — சுவாசிக்கவே சிரமம்." },
      { role: "user", content: "சில நேரம் எல்லாத்தையும் நிறுத்தணும்னு தோணும்." },
      { role: "assistant", content: "அதை சொன்னதுக்கு நன்றி. நீ இப்போ safe-ஆ இருக்கியா?" },
      { role: "user", content: "ஆமா. வெறும் tired மட்டும்." },
    ],
    config: { lang: "ta", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "ta-drift-after-peak-01",
      description: "Language held after emotional peak in Tamil",
      passCondition: "Reply stays in Tamil — acknowledges the exhaustion and confirms they are okay. Does not switch to English.",
      failExpectedOutcome: "Reply switches to English after the emotional crisis peak.",
    },
  },

  {
    id: "ta-drift-after-truncation-01",
    category: "E: Language Drift",
    name: "Tamil: language held after MAX_TURNS context truncation",
    description: "After MAX_TURNS, AI loses early context. It must still stay in Tamil.",
    messages: [
      { role: "user", content: "நான் தமிழ்ல பேசுவேன்." },
      { role: "assistant", content: "சரி, தமிழ்ல பேசு. நான் கேக்கிறேன்." },
      { role: "user", content: "என் வாழ்க்கையில நிறைய மாற்றங்கள் வந்தன." },
      { role: "assistant", content: "மாற்றங்கள் — நல்லவையா, கஷ்டமானவையா?" },
      { role: "user", content: "இரண்டும்." },
      { role: "assistant", content: "இரண்டும் சேர்ந்து வரும்போது குழப்பம் வரும்." },
      { role: "user", content: "வேலை மாறினேன்." },
      { role: "assistant", content: "வேலை மாற்றம் — புதுசா settle ஆக நேரம் வேணும்." },
      { role: "user", content: "வீடும் மாறினேன்." },
      { role: "assistant", content: "வீடும் வேலையும் ஒரே நேரத்துல — நிறைய புதுசு." },
      { role: "user", content: "ஒரு relationship-ம் முடிஞ்சது." },
      { role: "assistant", content: "Relationship முடிஞ்சது — மத்த மாற்றங்களுக்கு மேலும் இது கனமா இருக்கும்." },
      { role: "user", content: "ஆமா. இப்போ ரொம்ப lonely-ஆ feel ஆகுது." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-drift-after-truncation-01",
      description: "Tamil held after context truncation",
      passCondition: "Reply is in Tamil — acknowledges loneliness amid all the changes. Does not switch to English.",
      failExpectedOutcome: "Reply switches to English or Hindi after context truncation.",
    },
  },

  {
    id: "ta-drift-topic-change-01",
    category: "E: Language Drift",
    name: "Tamil: language held after topic change",
    description: "User changes topic suddenly. Language must not drift after topic shift.",
    messages: [
      { role: "user", content: "நண்பர்களோட சண்டை ஆச்சு." },
      { role: "assistant", content: "என்ன ஆச்சு நண்பர்கள் கூட?" },
      { role: "user", content: "ஒரு misunderstanding." },
      { role: "assistant", content: "Misunderstanding சரியாகும். நேரம் வேணும்." },
      { role: "user", content: "அது சரி. ஆனா என்னோட health பத்தி கொஞ்சம் பேசணும்." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "ta-drift-topic-change-01",
      description: "Language held after topic change in Tamil",
      passCondition: "Reply stays in Tamil and asks warmly about health ('உடம்பு', 'health') — follows the user's topic change. Does not ignore the new topic.",
      failExpectedOutcome: "Reply ignores the health topic, stays stuck on the old topic, or switches to English/Hindi.",
    },
  },

  {
    id: "ta-drift-dominant-lang-01",
    category: "E: Language Drift",
    name: "Tamil: dominant language stays Tamil in mixed conversation",
    description: "User uses mostly Tamil with occasional English words. Dominant language must stay Tamil.",
    messages: [
      { role: "user", content: "என்னோட project submit பண்ணணும். deadline today. pressure ரொம்ப இருக்கு." },
      { role: "assistant", content: "Deadline today-ஆ? Project-ல என்ன remaining இருக்கு?" },
      { role: "user", content: "Manager last minute changes கேட்டாரு." },
      { role: "assistant", content: "Last minute changes — அது frustrating." },
      { role: "user", content: "ஆமா, எனக்கு கோபமே வந்துச்சு." },
    ],
    config: { lang: "ta", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "ta-drift-dominant-lang-01",
      description: "Dominant language stays Tamil in mixed conversation",
      passCondition: "Reply stays predominantly Tamil — may use English loanwords (project, deadline) but the structure and emotion are in Tamil.",
      failExpectedOutcome: "Reply becomes predominantly English, abandoning the Tamil structure.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "ta-mobile-tone-01",
    category: "F: Mobile Platform",
    name: "Mobile Tamil: relationship 'friend' maps to close_friend tone",
    description: "Mobile platform sends relationship='friend'. Should map to close_friend tone.",
    messages: [
      { role: "user", content: "மச்சான், இன்னைக்கு ரொம்ப tired-ஆ இருக்கேன்." },
    ],
    config: {
      lang: "ta", tone: "close_friend", inputModality: "native", platform: "mobile",
      mobileRelationship: "friend",
    },
    criteria: {
      id: "ta-mobile-tone-01",
      description: "Mobile Tamil friend → close_friend tone",
      passCondition: "Reply is in casual, warm Tamil — peer-level, 'நீ' address. Not formal or clinical.",
      failExpectedOutcome: "Reply is too formal or switches to English/Hindi.",
    },
  },

  {
    id: "ta-mobile-romanized-detect-01",
    category: "F: Mobile Platform",
    name: "Mobile Tamil: romanized detection fires — sends lang=ta not lang=en",
    description: "Mobile platform with romanized Tamil input must detect lang=ta, not fall back to lang=en.",
    messages: [
      { role: "user", content: "naan amma baba miss panren. veedu romba thooram iruku." },
    ],
    config: {
      lang: "ta", tone: "close_friend", inputModality: "romanized", platform: "mobile",
      mobileRelationship: "friend",
    },
    criteria: {
      id: "ta-mobile-romanized-detect-01",
      description: "Mobile romanized Tamil detected correctly",
      passCondition: "Reply is in romanized Tamil — confirms lang was detected as 'ta'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Tamil.",
    },
  },
];
