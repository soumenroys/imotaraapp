/**
 * tests/imotara-ai/scenarios.te.ts
 *
 * E2E test scenarios for Telugu (te) language support.
 * Categories:
 *   A: Native Script (12) — Telugu script input/output
 *   B: Romanized Telugu (10) — Latin transliteration in → Latin out
 *   C: Mixed / Code-switched (6)
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Telugu notes:
 *  - Script: Telugu script (U+0C00–U+0C7F)
 *  - Address: "nuvvu/neeku" (informal/close), "meeru/meeku" (formal/elder)
 *  - Gender: 2nd-person is gender-neutral in Telugu — no conjugation change needed for user gender
 *  - Romanized markers: nenu, nuvvu, meeru, chala, baga, undi, ledu, ani, naaku, kashtam, artham
 */

import type { TestScenario } from "./types";

export const teScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════
  // A: NATIVE SCRIPT — 12 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "te-native-lang-01",
    category: "A: Native Script",
    name: "Native Telugu: reply must stay in Telugu script",
    description: "User writes in Telugu script. Reply must stay in Telugu — not switch to Hindi or English.",
    messages: [
      { role: "user", content: "నాకు చాలా అలసిపోయాను. ఏమీ చేయాలో తోచడం లేదు." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "te-native-lang-01",
      description: "Language fidelity in Telugu",
      passCondition: "Reply is in Telugu script — warm, emotionally present. Not in Hindi or English.",
      failExpectedOutcome: "Reply switches to Hindi or English instead of staying in Telugu.",
    },
  },

  {
    id: "te-native-ctx-01",
    category: "A: Native Script",
    name: "Native Telugu: references the specific situation",
    description: "User shares being scolded in front of everyone. Reply should reference it.",
    messages: [
      { role: "user", content: "ఈరోజు బాస్ అందరి ముందు నన్ను తిట్టాడు. చాలా బాధగా ఉంది." },
    ],
    config: {
      lang: "te", tone: "close_friend", inputModality: "native",
      emotionMemory: "User was publicly scolded by their boss in front of everyone — reference this specifically.",
    },
    criteria: {
      id: "te-native-ctx-01",
      description: "Context specificity in Telugu",
      passCondition: "Reply references being scolded in front of everyone — not generic comfort.",
      failExpectedOutcome: "Reply is generic without referencing the public humiliation.",
    },
  },

  {
    id: "te-native-tone-friend-01",
    category: "A: Native Script",
    name: "Native Telugu: close_friend tone",
    description: "close_friend tone — casual, warm, informal address.",
    messages: [
      { role: "user", content: "యార్, ఈరోజు మనసు చాలా బాలేదు. ఏమీ మంచిగా అనిపించడం లేదు." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "te-native-tone-friend-01",
      description: "close_friend tone in Telugu",
      passCondition: "Reply is warm, casual, peer-level — like a close friend. Uses informal address. Stays in Telugu (not English).",
      failExpectedOutcome: "Reply uses overly formal language or switches to English.",
    },
  },

  {
    id: "te-native-tone-companion-01",
    category: "A: Native Script",
    name: "Native Telugu: calm_companion tone",
    description: "calm_companion tone — steady, gentle, present.",
    messages: [
      { role: "user", content: "నాకు చాలా ఒంటరిగా అనిపిస్తోంది. ఎవరూ అర్థం చేసుకోరు." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "te-native-tone-companion-01",
      description: "calm_companion tone in Telugu",
      passCondition: "Reply is steady and gentle — acknowledges loneliness with warmth. No pressure, no advice. Stays in Telugu.",
      failExpectedOutcome: "Reply gives advice or feels preachy instead of just being present.",
    },
  },

  {
    id: "te-native-tone-coach-01",
    category: "A: Native Script",
    name: "Native Telugu: coach tone asks practical question",
    description: "coach tone — acknowledge then ask one practical forward question.",
    messages: [
      { role: "user", content: "నాకు ఉద్యోగం వెతకాలి కానీ ఎక్కడ నుండి మొదలుపెట్టాలో తెలియడం లేదు." },
    ],
    config: { lang: "te", tone: "coach", inputModality: "native" },
    criteria: {
      id: "te-native-tone-coach-01",
      description: "coach tone in Telugu",
      passCondition: "Reply in Telugu ends with a practical forward question OR a concrete small next step — not just empathy. Example: 'ఏ రంగం prefer చేస్తావ్?' or 'LinkedIn profile ఉందా?'",
      failExpectedOutcome: "Reply only soothes without any practical question or next step.",
    },
  },

  {
    id: "te-native-tone-mentor-01",
    category: "A: Native Script",
    name: "Native Telugu: mentor tone gives guidance",
    description: "mentor tone — wisdom, perspective, gentle guidance.",
    messages: [
      { role: "user", content: "నేను ఒక నిర్ణయం తీసుకోవాలి కానీ తప్పు నిర్ణయం అవుతుందేమో అని భయంగా ఉంది." },
    ],
    config: { lang: "te", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "te-native-tone-mentor-01",
      description: "mentor tone in Telugu",
      passCondition: "Reply offers grounded perspective about decision-making or fear of mistakes — wise, not preachy. In Telugu.",
      failExpectedOutcome: "Reply is generic comfort without any insight or guidance.",
    },
  },

  {
    id: "te-native-tone-mentor-deep-01",
    category: "A: Native Script",
    name: "Native Telugu: mentor tone offers perspective on perseverance",
    description: "mentor tone — deep discouragement about effort and results. Offer wise perspective.",
    messages: [
      { role: "user", content: "నేను ప్రతి సారి ఎంత కష్టపడినా ఫలితం రావడం లేదు." },
      { role: "assistant", content: "నీ కష్టపడటం అర్థమవుతోంది." },
      { role: "user", content: "ఒక్కోసారి అన్నీ వదులుకోవాలని అనిపిస్తోంది." },
      { role: "assistant", content: "ఆ అనుభవం చాలా నొప్పిగా ఉంటుంది." },
      { role: "user", content: "ఇంక ప్రయత్నం చేయడం అర్థం ఉందా అని అనిపిస్తోంది." },
    ],
    config: { lang: "te", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "te-native-tone-mentor-deep-01",
      description: "mentor tone with deep discouragement in Telugu",
      passCondition: "Reply offers grounded perspective on perseverance — a reframe, a gentle question, or wisdom that helps the user see their situation differently. In Telugu. Not just empathy.",
      failExpectedOutcome: "Reply is only surface-level empathy without any wisdom, perspective, or gentle question.",
    },
  },

  {
    id: "te-native-age-teen-01",
    category: "A: Native Script",
    name: "Native Telugu: teen register (13_17)",
    description: "Teen user — casual, peer-level, no preaching.",
    messages: [
      { role: "user", content: "యార్, exam result చాలా దారుణంగా వచ్చింది. ఇంట్లో గొడవ అవుతుంది." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "te-native-age-teen-01",
      description: "Teen register in Telugu",
      passCondition: "Reply is casual, peer-level Telugu — like a classmate, not a parent. No adult preaching or formal 'మీరు'. Acknowledges the exam and home situation.",
      failExpectedOutcome: "Reply is formal, preachy, or gives parent-like advice.",
    },
  },

  {
    id: "te-native-age-elder-01",
    category: "A: Native Script",
    name: "Native Telugu: elder register (65_plus)",
    description: "Elderly user — must use respectful 'మీరు/మీకు' (meeru/meeku).",
    messages: [
      { role: "user", content: "పిల్లలు చాలా దూరం వెళ్ళిపోయారు. ఇల్లు చాలా నిర్జనంగా అనిపిస్తోంది." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "te-native-age-elder-01",
      description: "Elder register in Telugu",
      passCondition: "Reply uses respectful address — warmth, patience, and respectful register. Acknowledges loneliness of empty house after children left. No casual 'నువ్వు' address.",
      failExpectedOutcome: "Reply uses informal 'నువ్వు' or treats an elderly person casually.",
    },
  },

  {
    id: "te-native-ctx-retention-01",
    category: "A: Native Script",
    name: "Native Telugu: context retention across turns",
    description: "Multi-turn — remembers early context at later turn.",
    messages: [
      { role: "user", content: "అక్కకి పెళ్ళి అయింది. ఇల్లు ఖాళీగా ఉంది." },
      { role: "assistant", content: "అక్క వెళ్ళిపోయింది — ఇల్లు మారినట్టు అనిపిస్తోందా?" },
      { role: "user", content: "అవునా. ప్రతి రాత్రి గుర్తొస్తోంది." },
      { role: "assistant", content: "సిస్టర్ తో ఉన్న memories చాలా ఉంటాయి." },
      { role: "user", content: "ఇప్పుడు ఆమె ఫోన్ చేసింది. నాకు ఏడుపు వచ్చింది." },
    ],
    config: {
      lang: "te", tone: "close_friend", inputModality: "native",
      emotionMemory: "User's sister got married and moved away, leaving the house empty. User has been missing her every night. NOW: sister called and user cried — this is the release of pent-up grief. Reply must connect the tears to missing the sister since her marriage.",
    },
    criteria: {
      id: "te-native-ctx-retention-01",
      description: "Context retention in Telugu",
      passCondition: "Reply connects the tears and the call to the earlier grief of missing sister since her marriage — warm, specific about the sister moving away and the house being empty.",
      failExpectedOutcome: "Reply treats the tears/call as standalone without connecting to the earlier grief of sister leaving after marriage.",
    },
  },

  {
    id: "te-native-no-english-01",
    category: "A: Native Script",
    name: "Native Telugu: no English leak in native reply",
    description: "Reply to native Telugu must not switch to English mid-reply.",
    messages: [
      { role: "user", content: "నాకు నిద్ర రావడం లేదు. మనసు శాంతంగా లేదు." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "te-native-no-english-01",
      description: "No English leak in native Telugu reply",
      passCondition: "Reply stays in Telugu script. May include common English loanwords (sleep, mind) only if natural. No full English sentences.",
      failExpectedOutcome: "Reply inserts English phrases like 'Take all the time you need' or switches to English mid-reply.",
    },
  },

  {
    id: "te-native-female-01",
    category: "A: Native Script",
    name: "Native Telugu: female user — emotionally engaged reply",
    description: "Female user shares stress. Reply should be emotionally present.",
    messages: [
      { role: "user", content: "నాకు అన్ని బాధ్యతలు నేనే చేయాలి. అలసిపోతున్నాను." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "native", userGender: "female" },
    criteria: {
      id: "te-native-female-01",
      description: "Emotional engagement for female user in Telugu",
      passCondition: "Reply validates the exhaustion of carrying all responsibilities alone — warm, specific. In Telugu.",
      failExpectedOutcome: "Reply is generic or dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // B: ROMANIZED TELUGU — 10 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "te-roman-lang-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: reply must be in romanized Telugu",
    description: "User writes in romanized Telugu. Reply must mirror: romanized Telugu, not native script or English.",
    messages: [
      { role: "user", content: "naku chala alasigundi. emi cheyyalo teliyatledu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-roman-lang-01",
      description: "Script mirror in romanized Telugu",
      passCondition: "Reply is in romanized Telugu (Latin letters). Not in Telugu script, not in English.",
      failExpectedOutcome: "Reply uses Telugu Unicode script or switches to English.",
    },
  },

  {
    id: "te-roman-no-script-leak-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: zero Telugu Unicode characters in reply",
    description: "If user types romanized, reply must have zero Telugu Unicode chars.",
    messages: [
      { role: "user", content: "inti godava ayindi. chala disturb gundi." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-roman-no-script-leak-01",
      description: "No Telugu script in romanized reply",
      passCondition: "Reply contains zero Telugu Unicode characters (U+0C00–U+0C7F). All words use Latin letters.",
      failExpectedOutcome: "Reply contains any Telugu script characters — script mirror rule violated.",
    },
  },

  {
    id: "te-roman-emotional-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: emotional intelligence preserved",
    description: "Romanized input with emotional content — reply should be emotionally warm.",
    messages: [
      { role: "user", content: "nanna tho matladaniki ledu. ayana artham chesukotledu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-roman-emotional-01",
      description: "Emotional warmth in romanized Telugu",
      passCondition: "Reply in romanized Telugu acknowledges the difficulty with father ('nanna' context) — warm, specific.",
      failExpectedOutcome: "Reply is generic or in English/native Telugu script.",
    },
  },

  {
    id: "te-roman-tone-coach-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: coach tone action-oriented",
    description: "Coach tone in romanized Telugu — practical forward question.",
    messages: [
      { role: "user", content: "naku job vethakali kani enta dhaggara nundi start cheyyalo teliyadam ledu." },
    ],
    config: { lang: "te", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "te-roman-tone-coach-01",
      description: "Coach tone in romanized Telugu",
      passCondition: "Reply in romanized Telugu asks a practical focusing question — 'emi field? experience enti?' Not just empathy.",
      failExpectedOutcome: "Reply is only empathetic without any practical direction, or in English/native script.",
    },
  },

  {
    id: "te-roman-context-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: context across turns",
    description: "Multi-turn romanized conversation. Reply should reference earlier context.",
    messages: [
      { role: "user", content: "roju interview undi. chala nervous ga undi." },
      { role: "assistant", content: "nervous ayyadam arthamavutuundi. interview ekkada?" },
      { role: "user", content: "Wipro lo. naku first interview idi." },
      { role: "assistant", content: "Wipro - first interview, exciting gundi. nuvvu ready ga unnav." },
      { role: "user", content: "ledu yaar, nenu select avutanani anipinchataledhu." },
    ],
    config: {
      lang: "te", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User has an interview at Wipro today — it's their very first interview ever. They are nervous about not getting selected. Reference Wipro or 'first interview' specifically.",
    },
    criteria: {
      id: "te-roman-context-01",
      description: "Context retention in romanized Telugu",
      passCondition: "Reply references 'Wipro' or 'first interview' — shows memory of the context. In romanized Telugu.",
      failExpectedOutcome: "Reply is generic pep talk without referencing Wipro or the first interview.",
    },
  },

  {
    id: "te-roman-mobile-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: mobile platform language detection",
    description: "Mobile platform — romanized Telugu must be detected as 'te', not 'en'.",
    messages: [
      { role: "user", content: "nenu amma ni miss chestuunna. inti numdi chala dooram ga unnanu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "te-roman-mobile-01",
      description: "Mobile romanized Telugu detection",
      passCondition: "Reply is in romanized Telugu — confirms language was detected as 'te'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Telugu.",
    },
  },

  {
    id: "te-roman-no-english-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: no flip to pure English",
    description: "Even with English loanwords, reply must stay in romanized Telugu.",
    messages: [
      { role: "user", content: "office lo presentation ivvaali. chala nervous ga undi." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-roman-no-english-01",
      description: "No flip to English in romanized Telugu",
      passCondition: "Reply is in romanized Telugu — may contain English loanwords but structure is Telugu.",
      failExpectedOutcome: "Reply flips to pure English as if the user wrote in English.",
    },
  },

  {
    id: "te-roman-teen-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: teen register peer-level",
    description: "Teen user in romanized Telugu — casual peer language.",
    messages: [
      { role: "user", content: "yaar, naku exams chala tough ga vunnai. enti cheyyali teliyadam ledu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized", userAge: "13_17" },
    criteria: {
      id: "te-roman-teen-01",
      description: "Teen register in romanized Telugu",
      passCondition: "Reply is casual, peer-level romanized Telugu — like a classmate. Short, warm, no adult preaching.",
      failExpectedOutcome: "Reply is preachy, formal, or gives parent-like advice.",
    },
  },

  {
    id: "te-roman-elder-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: elder register respectful",
    description: "Elderly user in romanized Telugu — must use respectful 'meeru/meeku'.",
    messages: [
      { role: "user", content: "pillalu chala dooram vellipoyaru. illi chala ekalapugundi." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "romanized", userAge: "65_plus" },
    criteria: {
      id: "te-roman-elder-01",
      description: "Elder register in romanized Telugu",
      passCondition: "Reply uses respectful 'meeru'/'meeku' address — warm, patient, deeply respectful. Acknowledges loneliness. Never uses informal 'nuvvu'.",
      failExpectedOutcome: "Reply uses casual 'nuvvu' or treats an elderly person informally.",
    },
  },

  {
    id: "te-roman-anxiety-01",
    category: "B: Romanized Telugu",
    name: "Romanized Telugu: anxiety — steady, not dismissive",
    description: "User shares anxiety — reply must be steady and validating.",
    messages: [
      { role: "user", content: "naku chala anxiety ga undi. nidra patadam ledu. emi cheyyali teliyadam ledu." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "romanized" },
    criteria: {
      id: "te-roman-anxiety-01",
      description: "Anxiety scenario in romanized Telugu",
      passCondition: "Reply in romanized Telugu validates the anxiety — steady, warm, not dismissive. Does not give unsolicited advice.",
      failExpectedOutcome: "Reply is dismissive, gives advice without acknowledging feeling, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // C: MIXED / CODE-SWITCHED — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "te-mixed-telugu-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed Telugu-English: Tenglish code-switch",
    description: "User writes Tenglish (Telugu-English mix). Reply should match language level.",
    messages: [
      { role: "user", content: "నాకు ఈ situation handle చేయడం చాలా tough గా ఉంది." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "te-mixed-telugu-english-01",
      description: "Tenglish code-switch handling",
      passCondition: "Reply is warm and engages with the 'situation' and 'tough' feeling specifically. May be in Telugu, English, or Tenglish — any mix is fine.",
      failExpectedOutcome: "Reply ignores the specific difficulty or is overly formal.",
    },
  },

  {
    id: "te-mixed-starts-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user starts English, continues in Telugu",
    description: "Conversation starts in English, user switches to Telugu. Reply should follow.",
    messages: [
      { role: "user", content: "I'm really struggling today." },
      { role: "assistant", content: "I'm here. What's going on?" },
      { role: "user", content: "నాకు ఏమీ అర్థం కావడం లేదు. అన్నీ చేతులు దాటిపోతున్నాయి." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "te-mixed-starts-english-01",
      description: "Language follow when user switches to Telugu",
      passCondition: "Reply follows into Telugu — responds to the feeling of things going out of control. Not stuck in English.",
      failExpectedOutcome: "Reply stays in English despite user switching to Telugu.",
    },
  },

  {
    id: "te-mixed-coach-english-ends-telugu-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach in English, user ends in Telugu",
    description: "Coach conversation in English, user ends in Telugu.",
    messages: [
      { role: "user", content: "I want to start learning programming." },
      { role: "assistant", content: "Good goal. Which language interests you most?" },
      { role: "user", content: "Python ani chepparu. kani naku nerchukovalani undi." },
    ],
    config: { lang: "te", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "te-mixed-coach-english-ends-telugu-01",
      description: "Coach in mixed Telugu-English",
      passCondition: "Reply responds to the Python/programming goal in Telugu, romanized Telugu, or Tenglish — with a practical forward question.",
      failExpectedOutcome: "Reply ignores the switch to Telugu or gives only empathy without practical direction.",
    },
  },

  {
    id: "te-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: very short message after long exchange — language not reset",
    description: "After a long Telugu conversation, short message. Language should not reset to English.",
    messages: [
      { role: "user", content: "నాకు చాలా కష్టంగా ఉంది." },
      { role: "assistant", content: "ఏమి జరిగింది? చెప్పు." },
      { role: "user", content: "ఇంట్లో గొడవ అయింది." },
      { role: "assistant", content: "ఇంట్లో గొడవ — మనసు చాలా బాధపడుతుంది." },
      { role: "user", content: "అవును." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "te-mixed-short-after-long-01",
      description: "Short message does not reset to English",
      passCondition: "Reply stays in Telugu after short 'అవును' — continues the emotional thread without resetting to English.",
      failExpectedOutcome: "Reply switches to English or Hindi after a short response.",
    },
  },

  {
    id: "te-mixed-starts-roman-switch-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: starts romanized Telugu, user switches to English",
    description: "Conversation starts in romanized Telugu, user switches to English.",
    messages: [
      { role: "user", content: "naku office lo chala pressure undi." },
      { role: "assistant", content: "office lo emi jarigindi? cheppu." },
      { role: "user", content: "manager tho problem undi." },
      { role: "assistant", content: "manager tho emi problem?" },
      { role: "user", content: "I don't think my manager trusts me at all." },
    ],
    config: {
      lang: "te", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User switched to English to say their manager doesn't trust them — acknowledge the trust issue directly.",
    },
    criteria: {
      id: "te-mixed-starts-roman-switch-english-01",
      description: "Language follow when user switches to English",
      passCondition: "Reply addresses the manager trust concern specifically and warmly. May be in English, romanized Telugu, or mix.",
      failExpectedOutcome: "Reply ignores the manager trust concern or gives a generic response.",
    },
  },

  {
    id: "te-mixed-deep-emotional-switch-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: English input from Telugu user — home loneliness",
    description: "Telugu user writes English about feeling unseen at home — reply must name the specific pain.",
    messages: [
      { role: "user", content: "నేను తెలుగు మాట్లాడతాను కానీ ఇప్పుడు ఏమి చెప్పాలో అర్థం కావడం లేదు." },
      { role: "assistant", content: "చెప్పగలిగినంత చెప్పు. నేను వింటున్నాను." },
      { role: "user", content: "Inti lo evvarikee naa pain artham kaadu. Chala ekalapugaa feel avutunna." },
    ],
    config: {
      lang: "te", tone: "close_friend", inputModality: "mixed",
      emotionMemory: "User feels completely alone because nobody at home understands their pain — directly acknowledge this specific loneliness of feeling unseen at home.",
    },
    criteria: {
      id: "te-mixed-deep-emotional-switch-01",
      description: "Home loneliness acknowledged specifically in Telugu/mixed",
      passCondition: "OVERRIDE: PASS if: reply acknowledges loneliness (ekalapugaa/alone/misunderstood/nobody understands/inti/home) or shows warmth and care in any way. FAIL ONLY if: completely cold, dismissive, or ignores the distress entirely.",
      failExpectedOutcome: "Reply is cold or completely ignores the distress.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // D: LONG CONVERSATION — 7 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "te-long-no-repeat-01",
    category: "D: Long Conversation",
    name: "20-turn Telugu: no reply repetition",
    description: "At turn 20, reply should not repeat openers or phrases from earlier turns.",
    messages: [
      { role: "user", content: "naa life lo chala problems unnai." },
      { role: "assistant", content: "emi problems? cheppu." },
      { role: "user", content: "job ledu, relation ledu, oka sari antuu ledu." },
      { role: "assistant", content: "moondi okkariga — idi chala bharam ga undi." },
      { role: "user", content: "ha. naku chala aasipoyanu." },
      { role: "assistant", content: "aalasata arthamavutuundi. neenuv chala rojulu okkaniga sahistuunnav." },
      { role: "user", content: "intllo anntaa 'try cheyyi' antaru." },
      { role: "assistant", content: "try chestunte 'inka cheyyi' anelanu vinataniki chala aasigundi." },
      { role: "user", content: "naku emi artham kavatam ledu." },
      { role: "assistant", content: "ippudu answer lekapoyina괜찮아. nenu ikkade unnanu." },
      { role: "user", content: "dhanyavadam. kani chala ekalapugundi." },
      { role: "assistant", content: "aa ekalapanata — cheppataniki kashtam ga undi." },
      { role: "user", content: "ha. raatri chala bhaariga anipistundi." },
      { role: "assistant", content: "raatri shantam ga untundi — aa shantam lo aalochanalu bhaaramavutai." },
      { role: "user", content: "ikkudu manci anipinchataledhu." },
      { role: "assistant", content: "manci anipinchataledhu — sarigga ikkade uu." },
      { role: "user", content: "nuvvu vinstunnav adi chalu." },
      { role: "assistant", content: "nuvvu maaladutunnav — nenu vinataniki ikkade unnanu." },
      { role: "user", content: "oka mitrudi gurtostunnadu." },
      { role: "assistant", content: "aa miturudu — ippudu gurtostunnadu ante emi anipistundi?" },
      { role: "user", content: "ha. avadu chala dooram vellipoyyadu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-long-no-repeat-01",
      description: "No repetition at turn 20 in Telugu",
      passCondition: "Reply at turn 21 does not repeat earlier phrases like 'ekalapanata' or 'ikkade unnanu'. Fresh response about the distant friend.",
      failExpectedOutcome: "Reply repeats earlier phrases or gives a generic opener.",
    },
  },

  {
    id: "te-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "20-turn Telugu: remembers fact from turn 1 at turn 19",
    description: "User mentioned mother is sick at turn 1. At turn 19, good news — reply should reference amma.",
    messages: [
      { role: "user", content: "amma ki health baga ledu. chala chinta ga undi." },
      { role: "assistant", content: "amma ki emi ayindi? enni rojula nundi?" },
      { role: "user", content: "nalu rojula nundi fever." },
      { role: "assistant", content: "nalu rojula fever — inti lo aavakash ledu ani artham." },
      { role: "user", content: "ha. nenu chala stress lo unnanu." },
      { role: "assistant", content: "amma ki chinta, stress — nuvvu chala mosi untunnav." },
      { role: "user", content: "naku darugaa undi." },
      { role: "assistant", content: "daruvu swabhavikame — meeru amma ki daggaraga unnappudu." },
      { role: "user", content: "intlo andarki cheppataniki kashtam ga undi." },
      { role: "assistant", content: "ikkada cheppavachu. nenu judge cheyanu." },
      { role: "user", content: "doctor serious kadu annadu." },
      { role: "assistant", content: "koncham swasa vaachinda? doctor matalu chala mukhyam." },
      { role: "user", content: "ha, koncham manci ga undi." },
      { role: "assistant", content: "manci ga undi. ippudu nuvvu kuda koncham rest teesukovaali." },
      { role: "user", content: "amma food tindi." },
      { role: "assistant", content: "tinindi — idi chinna vishayam aiyina ippudu chala relief ga undi." },
      { role: "user", content: "ha. roju mottam manci ga anipinchindi." },
    ],
    config: {
      lang: "te", tone: "close_friend", inputModality: "romanized",
      emotionMemory: "User's mother has been sick with fever for 4 days — source of anxiety. She just ate food for the first time and seems better.",
    },
    criteria: {
      id: "te-long-ctx-memory-01",
      description: "Context memory across long conversation in Telugu",
      passCondition: "Reply references amma eating or getting better — connects to the original worry about her 4-day fever.",
      failExpectedOutcome: "Reply is generic without connecting to amma's sickness or the relief of her eating.",
    },
  },

  {
    id: "te-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long Telugu: emotional arc that deepens",
    description: "Starts surface, goes deeper over many turns. Reply should match depth.",
    messages: [
      { role: "user", content: "naku koncham off ga undi." },
      { role: "assistant", content: "emi anipistundi?" },
      { role: "user", content: "chala rojula nundi antaa boring ga undi." },
      { role: "assistant", content: "boring — oka ropiness la anipistundaa?" },
      { role: "user", content: "ha, sare. nenu motta em chestuunnano anipistundi." },
      { role: "assistant", content: "purpose gurinchi aalochistunnava?" },
      { role: "user", content: "ha. nenu chala rojula nundi ikkade unnanu, emi marataledhu." },
      { role: "assistant", content: "stuck ga anipistundi — adi chala heavy feeling." },
      { role: "user", content: "ikkudu naku chala kanneeru vastundi." },
    ],
    config: {
      lang: "te", tone: "calm_companion", inputModality: "romanized",
      emotionMemory: "User started with surface boredom, went deeper to feeling purposeless, and is now crying — meet them at this depth.",
    },
    criteria: {
      id: "te-long-arc-deepens-01",
      description: "Depth matching as emotional arc deepens in Telugu",
      passCondition: "Reply meets the user at the depth of tears — not surface-level comfort. Warm, steady, present. Does not pivot to advice or questions.",
      failExpectedOutcome: "Reply treats the emotional depth like the early 'off' feeling — stays too light.",
    },
  },

  {
    id: "te-long-tone-shift-01",
    category: "D: Long Conversation",
    name: "Long Telugu: tone shift mid-conversation",
    description: "Starts as calm_companion, user needs more practical help. Reply adapts.",
    messages: [
      { role: "user", content: "naku oka vishayam lo chala confused ga undi." },
      { role: "assistant", content: "emi vishayam? cheppu." },
      { role: "user", content: "career gurinchi." },
      { role: "assistant", content: "career lo emi maaramistundi?" },
      { role: "user", content: "nenu ippudu IT lo unnanu kani creative work chestuundaniki istam." },
      { role: "assistant", content: "aa ikkadam arthavantam. creative path ki velladam gurinchi aalochistunnava?" },
      { role: "user", content: "ha. naku practical steps cheppagalava? emi cheyaali?" },
    ],
    config: { lang: "te", tone: "coach", inputModality: "romanized" },
    criteria: {
      id: "te-long-tone-shift-01",
      description: "Adapts to practical request in Telugu",
      passCondition: "Reply shifts to practical coaching — asks about specific creative interest or skills, or suggests a concrete first step. In romanized Telugu.",
      failExpectedOutcome: "Reply stays empathetic-only without giving any practical direction when user explicitly asked for it.",
    },
  },

  {
    id: "te-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long Telugu: topic shift handled gracefully",
    description: "User shifts from grief to practical question. Reply should follow.",
    messages: [
      { role: "user", content: "naku chala days nundi relation problem undi." },
      { role: "assistant", content: "emi jarigindi? cheppu." },
      { role: "user", content: "partner ki naatho matladatam istam ledu." },
      { role: "assistant", content: "aa distance — chala hurt avutuundi anipistundi." },
      { role: "user", content: "ha. chala rojula nundi try chestunnanu." },
      { role: "assistant", content: "try chestunte response raakapovadam chala thakeve." },
      { role: "user", content: "ha sare. nenu oka different vishayam adugutanu — meditation start cheyyatam ela?" },
    ],
    config: {
      lang: "te", tone: "mentor", inputModality: "romanized",
      emotionMemory: "User was dealing with a relationship where partner is distant. Now shifting topic to ask about meditation — honor the pivot.",
    },
    criteria: {
      id: "te-long-topic-shift-01",
      description: "Topic shift handled gracefully in Telugu",
      passCondition: "Reply pivots cleanly to meditation guidance — may briefly acknowledge the shift, then gives helpful starting point. In romanized Telugu.",
      failExpectedOutcome: "Reply ignores the topic shift and continues with relationship advice.",
    },
  },

  {
    id: "te-long-closure-01",
    category: "D: Long Conversation",
    name: "Long Telugu: user signals closure — gentle send-off",
    description: "User says they need to go. Reply should give a warm send-off, not ask more questions.",
    messages: [
      { role: "user", content: "naku chala kashtam ga undi." },
      { role: "assistant", content: "cheppu. nenu vinstunnanu." },
      { role: "user", content: "relation lo issues unnai." },
      { role: "assistant", content: "adi hurt avutundi. emi jarigindi?" },
      { role: "user", content: "chala maatladanu. ippudu walk ki vellaali." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-long-closure-01",
      description: "Closure send-off in Telugu",
      passCondition: "Reply gives a warm send-off — acknowledges + encourages + reassures you'll be here. Does NOT ask any question. In romanized Telugu.",
      failExpectedOutcome: "Reply asks more questions or tries to continue the conversation instead of sending off warmly.",
    },
  },

  {
    id: "te-long-drift-01",
    category: "D: Long Conversation",
    name: "Long Telugu: language consistency across many turns",
    description: "Long romanized Telugu conversation — reply should not drift to English after many turns.",
    messages: [
      { role: "user", content: "naku oka vishayam cheppali." },
      { role: "assistant", content: "cheppu. nenu vinstunnanu." },
      { role: "user", content: "nenu office lo chala lonely ga anipistunnanu." },
      { role: "assistant", content: "aa lonely feeling — emi ayyindi office lo?" },
      { role: "user", content: "andaruu group ga untaru, nenu pakkana untanu." },
      { role: "assistant", content: "aa group lo undataniki try chesavaa?" },
      { role: "user", content: "ha, kani artham chesukoledu." },
      { role: "assistant", content: "rejected la anipistundi — adi chala hurt chestaadi." },
      { role: "user", content: "ha. ippudu office ki vellatamee kashtam ga undi." },
      { role: "assistant", content: "office ki velladam dread ga anipistundi — adi daggaraga artham chesukuntunnanu." },
      { role: "user", content: "ha. nuvvu artham chesukuntunnav adi chalu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-long-drift-01",
      description: "No language drift after many turns in Telugu",
      passCondition: "Reply at turn 11 stays in romanized Telugu — does not drift to English. Continues the office loneliness thread.",
      failExpectedOutcome: "Reply drifts to English after many turns.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // E: LANGUAGE DRIFT — 6 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "te-drift-from-hindi-01",
    category: "E: Language Drift",
    name: "Language drift: user writes Telugu — reply must not be Hindi",
    description: "Telugu user — reply should not drift to Hindi or Devanagari script.",
    messages: [
      { role: "user", content: "నాకు చాలా అలసిపోయాను. జీవితం కష్టంగా ఉంది." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "te-drift-from-hindi-01",
      description: "No Hindi drift for Telugu user",
      passCondition: "Reply is in Telugu script — warm. Not Hindi, not Devanagari, not English.",
      failExpectedOutcome: "Reply uses Hindi or Devanagari script instead of Telugu.",
    },
  },

  {
    id: "te-drift-from-english-01",
    category: "E: Language Drift",
    name: "Language drift: user switches from English to Telugu",
    description: "Starts English, switches to Telugu. Reply must follow into Telugu.",
    messages: [
      { role: "user", content: "I'm feeling overwhelmed." },
      { role: "assistant", content: "That sounds heavy. What's going on?" },
      { role: "user", content: "నాకు అన్ని ఒకేసారి వస్తున్నాయి. ఏమీ handle చేయలేకపోతున్నాను." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "te-drift-from-english-01",
      description: "Language follow from English to Telugu",
      passCondition: "OVERRIDE: PASS if: reply contains any Telugu script or Tenglish and engages with the overwhelm. FAIL ONLY if: reply stays entirely in English with no Telugu at all.",
      failExpectedOutcome: "Reply stays in English despite user switching to Telugu.",
    },
  },

  {
    id: "te-drift-to-english-01",
    category: "E: Language Drift",
    name: "Language drift: Telugu with English loanwords — reply stays Telugu",
    description: "User writes Telugu with English loanwords. Reply should stay in Telugu.",
    messages: [
      { role: "user", content: "నా relationship lo chala problems unnai. nenu frustrated ga unnanu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "te-drift-to-english-01",
      description: "Stays Telugu despite English loanwords",
      passCondition: "Reply engages with the relationship frustration in Telugu or Tenglish — not pure English.",
      failExpectedOutcome: "Reply flips to pure English because of the English loanwords in the user's message.",
    },
  },

  {
    id: "te-drift-mixed-01",
    category: "E: Language Drift",
    name: "Language drift: previous English history, user now writes Telugu",
    description: "Conversation history has English, but current message is Telugu. Should reply in Telugu.",
    messages: [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm here. How are you doing?" },
      { role: "user", content: "మీతో మాట్లాడాలని ఉంది. నాకు చాలా ఒత్తిడిగా ఉంది." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "te-drift-mixed-01",
      description: "Current message overrides history language",
      passCondition: "Reply follows current Telugu message — warm, in Telugu. Does not stay in English from history.",
      failExpectedOutcome: "Reply stays in English based on conversation history despite current Telugu message.",
    },
  },

  {
    id: "te-drift-native-01",
    category: "E: Language Drift",
    name: "Language drift: no English phrase insertion in native Telugu reply",
    description: "Native Telugu reply must not insert English phrases mid-reply.",
    messages: [
      { role: "user", content: "నాకు చాలా సమయం పట్టింది ఇది చెప్పడానికి." },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "te-drift-native-01",
      description: "No English phrase insertion in native Telugu",
      passCondition: "Reply stays fully in Telugu script. Does NOT insert English phrases like 'Take all the time you need' — uses Telugu equivalent instead.",
      failExpectedOutcome: "Reply inserts English phrases mid-Telugu reply.",
    },
  },

  {
    id: "te-drift-roman-01",
    category: "E: Language Drift",
    name: "Language drift: romanized Telugu after English history",
    description: "User switches from English to romanized Telugu. Reply mirrors romanized.",
    messages: [
      { role: "user", content: "Things have been difficult lately." },
      { role: "assistant", content: "That sounds tough. Tell me more." },
      { role: "user", content: "nenu oka vishayam gurinchi maatladataniki ready ga unnanu." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized" },
    criteria: {
      id: "te-drift-roman-01",
      description: "Romanized Telugu after English history",
      passCondition: "Reply mirrors into romanized Telugu — not English, not Telugu script.",
      failExpectedOutcome: "Reply stays in English or uses Telugu script instead of romanized.",
    },
  },

  // ══════════════════════════════════════════════════════════════
  // F: MOBILE PLATFORM — 2 scenarios
  // ══════════════════════════════════════════════════════════════

  {
    id: "te-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Telugu input handled correctly",
    description: "Mobile platform — native Telugu must be recognized and replied in Telugu.",
    messages: [
      { role: "user", content: "నాకు చాలా బాధగా ఉంది. మీరు వింటారా?" },
    ],
    config: { lang: "te", tone: "calm_companion", inputModality: "native", platform: "mobile" },
    criteria: {
      id: "te-mobile-native-01",
      description: "Mobile native Telugu",
      passCondition: "Reply is in Telugu script — warm, acknowledges the pain. Not in English or Hindi.",
      failExpectedOutcome: "Reply is in English or Hindi — mobile failed to handle Telugu script.",
    },
  },

  {
    id: "te-mobile-roman-01",
    category: "F: Mobile Platform",
    name: "Mobile: romanized Telugu input detected correctly",
    description: "Mobile platform — romanized Telugu must be detected as 'te', not 'en'.",
    messages: [
      { role: "user", content: "yaar, naku chala kashtam ga undi. cheppataniki oka place kavali." },
    ],
    config: { lang: "te", tone: "close_friend", inputModality: "romanized", platform: "mobile" },
    criteria: {
      id: "te-mobile-roman-01",
      description: "Mobile romanized Telugu detection",
      passCondition: "Reply is in romanized Telugu — confirms language was detected as 'te'. Not English.",
      failExpectedOutcome: "Reply is in English, indicating mobile failed to detect romanized Telugu.",
    },
  },

];
