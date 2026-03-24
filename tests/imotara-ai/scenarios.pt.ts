/**
 * tests/imotara-ai/scenarios.pt.ts
 *
 * E2E test scenarios for Portuguese (pt) language support.
 * Categories:
 *   A: Native Portuguese (12)
 *   B: Formality / Register (10) — tu vs você vs o senhor/a senhora
 *   C: Mixed / Code-switched (6) — Portuñol, English-Portuguese mix
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Portuguese notes:
 *  - Script: Latin
 *  - Address: "tu/te/teu/tua" (informal PT-PT), "você/te/seu/sua" (informal PT-BR),
 *    "o senhor/a senhora" (formal/elder)
 *  - Gender: adj agreement: "cansado/cansada", "sozinho/sozinha", "preocupado/preocupada"
 *  - Mixed common: "tenho um meeting", "estou muito stressed", "fazer o commute"
 */

import type { TestScenario } from "./types";

export const ptScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════════
  // A — NATIVE PORTUGUESE (12)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "pt-native-lang-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: reply must stay in Portuguese",
    description: "User writes in Portuguese expressing they are not feeling well. Reply must stay in Portuguese, warm, not in English or Spanish.",
    messages: [
      { role: "user", content: "Não estou bem hoje. Não sei o que fazer." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-native-lang-01",
      description: "Native Portuguese in → native Portuguese out, warm and empathetic.",
      passCondition: "Reply is entirely in Portuguese. Addresses the feeling warmly and directly. Does not switch to English or Spanish at any point.",
      failExpectedOutcome: "Reply is in English or Spanish instead of Portuguese, or is a cold, clinical response that ignores the emotional content.",
    },
  },

  {
    id: "pt-native-ctx-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: references specific situation (public humiliation)",
    description: "User shares a specific humiliating experience at work. Reply must acknowledge the public humiliation specifically, not give a generic response.",
    messages: [
      { role: "user", content: "Meu chefe me criticou na frente de todos. Me senti humilhado/a." },
    ],
    config: { lang: "pt", tone: "close_friend", emotion: "sad", inputModality: "native", emotionMemory: "User was publicly criticised and humiliated by their boss in front of colleagues." },
    criteria: {
      id: "pt-native-ctx-01",
      description: "Reply references the public humiliation specifically, not a generic comfort response.",
      passCondition: "Reply in Portuguese acknowledges 'na frente de todos' or the public nature of the criticism and the feeling of humiliation. Does not give a generic 'estou aqui para você'.",
      failExpectedOutcome: "Reply is generic, does not reference the public nature of the humiliation, or is in English.",
    },
  },

  {
    id: "pt-native-tone-friend-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: close_friend tone — casual and warm",
    description: "close_friend tone should feel like a warm peer conversation in Portuguese, informal register, not preachy.",
    messages: [
      { role: "user", content: "Ei, hoje não estou me sentindo bem. Tudo parece estranho." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-native-tone-friend-01",
      description: "Reply is casual, warm, uses você/tu register, not preachy or clinical, stays in Portuguese.",
      passCondition: "Reply in Portuguese is warm and acknowledges the 'strange/off' feeling. PASS if: feels informal and caring rather than cold or clinical. Does not moralize. FAIL only if: overly cold/clinical, lectures or moralizes, or switches to English.",
      failExpectedOutcome: "Reply is cold, clinical, moralizing, or switches to English.",
    },
  },

  {
    id: "pt-native-tone-companion-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: calm_companion tone — gentle and validating",
    description: "calm_companion should validate loneliness gently, may ask one non-pressuring question, offers no advice.",
    messages: [
      { role: "user", content: "Me sinto muito sozinho/a. Ninguém me entende." },
    ],
    config: { lang: "pt", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pt-native-tone-companion-01",
      description: "Reply is gentle, validates the loneliness, may ask one soft question, gives no advice, stays in Portuguese.",
      passCondition: "PASS if: reply is warm and in Portuguese and acknowledges the loneliness. A gentle question is fine. FAIL ONLY if: pushes unsolicited advice, gives silver linings, or is cold/dismissive.",
      failExpectedOutcome: "Reply pushes advice, asks multiple questions, gives silver linings, or is in English.",
    },
  },

  {
    id: "pt-native-tone-coach-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: coach tone — practical and action-oriented",
    description: "Coach tone should be practical and forward-looking, include a concrete element — question, suggestion, or next step — in Portuguese.",
    messages: [
      { role: "user", content: "Preciso de emprego, mas não sei por onde começar." },
    ],
    config: { lang: "pt", tone: "coach", inputModality: "native" },
    criteria: {
      id: "pt-native-tone-coach-01",
      description: "Reply includes a practical element — question about next step or concrete suggestion — in Portuguese.",
      passCondition: "Reply in Portuguese offers at least one concrete question or action suggestion, e.g. 'O que você já tem no currículo?' or 'Por onde você gostaria de começar?'. Forward-moving, not just empathetic.",
      failExpectedOutcome: "Reply is only empathetic without any practical element, or is in English.",
    },
  },

  {
    id: "pt-native-tone-mentor-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: mentor tone — wise and reflective",
    description: "Mentor tone should offer a grounded, wise perspective on fear of making wrong decisions, in Portuguese.",
    messages: [
      { role: "user", content: "Tenho uma decisão importante a tomar e tenho medo de errar." },
    ],
    config: { lang: "pt", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "pt-native-tone-mentor-01",
      description: "Reply is wise and thoughtful, offers grounded perspective, asks a reflective question, in Portuguese.",
      passCondition: "Reply in Portuguese is wise and considered, helps user explore their own clarity rather than prescribing an answer. Asks a reflective question or offers a perspective that goes beyond simple empathy.",
      failExpectedOutcome: "Reply gives direct advice ('Você deve fazer X'), is generic comfort, or is in English.",
    },
  },

  {
    id: "pt-native-tone-mentor-deep-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: mentor tone — 3-turn depth, not just mirroring hopelessness",
    description: "In a 3-turn mentor conversation about effort without results and wanting to quit, the final reply must go beyond mirroring hopelessness.",
    messages: [
      { role: "user", content: "Estou me esforçando muito mas não vejo resultado." },
      { role: "assistant", content: "Sinto seu esforço. É exaustivo dar tudo de si e não ver o retorno." },
      { role: "user", content: "Quero desistir de tudo." },
      { role: "assistant", content: "Essa dor é real. Chegar nesse ponto mostra o quanto você carregou." },
      { role: "user", content: "Não sei se vale a pena continuar." },
    ],
    config: { lang: "pt", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "pt-native-tone-mentor-deep-01",
      description: "Final reply must not only mirror hopelessness — must offer a question, acknowledge effort, or give encouragement.",
      passCondition: "Reply in Portuguese goes beyond just reflecting hopelessness back. Includes at least one of: a reflective question, acknowledgment of past effort, gentle encouragement, or a wise reframe. Not only 'É muita coisa para carregar.'",
      failExpectedOutcome: "Reply only mirrors hopelessness ('Entendo que não vale a pena') without any question, acknowledgment of effort, or forward element.",
    },
  },

  {
    id: "pt-native-age-teen-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: teen register (13–17) — peer-level, no moralizing",
    description: "Teen user worried about parental reaction to bad grade. Reply should be peer-level, warm, not moralize about studying.",
    messages: [
      { role: "user", content: "Ei, tirei uma nota péssima. Meus pais vão me dar um sermão." },
    ],
    config: { lang: "pt", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "pt-native-age-teen-01",
      description: "Reply is peer-level, casual, warm, does not moralize about studying, stays in Portuguese.",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the bad grade or fear of parents (nota/sermão/pais) with warmth or peer-level solidarity. FAIL ONLY if: explicitly moralizes about studying ('deveria estudar mais'), is cold, or completely ignores the situation.",
      failExpectedOutcome: "Reply moralizes about studying, uses adult register, is patronizing, or is in English.",
    },
  },

  {
    id: "pt-native-age-elder-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: elder register (65+) — formal address, warm and patient",
    description: "Elder user shares loneliness after children moved away. Reply must use formal address (o senhor/a senhora or very respectful você), warm and patient.",
    messages: [
      { role: "user", content: "Meus filhos foram embora. A casa parece vazia." },
    ],
    config: { lang: "pt", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "pt-native-age-elder-01",
      description: "Reply uses formal address (o senhor/a senhora or respectful você), warm, patient, in Portuguese.",
      passCondition: "Reply in Portuguese uses 'o senhor', 'a senhora', or consistently respectful 'você' — never informal 'tu' or slang. Warm and patient in tone. Acknowledges the emptiness after the children's departure.",
      failExpectedOutcome: "Reply uses informal 'tu' or slang with an elder, or is cold and generic, or is in English.",
    },
  },

  {
    id: "pt-native-ctx-retention-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: context retention — connects tears to sister since wedding",
    description: "User mentioned sister's wedding early on. Later user cries. Reply must connect tears to missing the sister since the wedding.",
    messages: [
      { role: "user", content: "Minha irmã se casou na semana passada. Foi lindo, mas agora ela morou em outra cidade." },
      { role: "assistant", content: "Que momento lindo e ao mesmo tempo cheio de sentimento. Como você está se sentindo com a mudança?" },
      { role: "user", content: "Vai ser diferente sem ela por perto. Mas estou feliz por ela." },
      { role: "assistant", content: "Esse misto de alegria por ela e saudade para você — os dois podem existir ao mesmo tempo." },
      { role: "user", content: "Sim. A gente era muito próxima." },
      { role: "assistant", content: "Esse vínculo não some com a distância, mesmo que doa de formas novas." },
      { role: "user", content: "Ela ligou hoje. Eu chorei depois que desliguei." },
    ],
    config: {
      lang: "pt",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister got married last week and moved to another city. They were very close. User may be emotional about missing the sister.",
    },
    criteria: {
      id: "pt-native-ctx-retention-01",
      description: "Reply connects the tears to missing the sister since the wedding, not a generic grief response.",
      passCondition: "Reply in Portuguese connects the tears to the sister — references the wedding, the move, or the closeness between them. Does not ask 'Por que você chorou?' as if context is unknown.",
      failExpectedOutcome: "Reply is generic ('Às vezes precisamos chorar'), does not connect to the sister or wedding, or is in English.",
    },
  },

  {
    id: "pt-native-no-english-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: reply stays entirely in Portuguese — no English words",
    description: "User shares vulnerability in Portuguese. Reply must stay entirely in Portuguese with no English words interspersed.",
    messages: [
      { role: "user", content: "Tenho medo de parecer fraco. Por isso nunca conto para ninguém o que estou sentindo." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-native-no-english-01",
      description: "Reply stays 100% in Portuguese — no English words, no code-switching.",
      passCondition: "Reply is entirely in Portuguese. No English words like 'okay', 'well', 'anyway', or any English phrase. Warm, acknowledges the fear of appearing weak.",
      failExpectedOutcome: "Reply contains any English words or switches to English mid-sentence.",
    },
  },

  {
    id: "pt-native-female-01",
    category: "A: Native Portuguese",
    name: "Native Portuguese: feminine agreement — exausta, sozinha",
    description: "Female user shares exhaustion from doing everything alone. Reply must acknowledge exhaustion with feminine adjective agreement and be warm.",
    messages: [
      { role: "user", content: "Faço tudo sozinha. Estou exausta." },
    ],
    config: { lang: "pt", tone: "close_friend", userGender: "female", inputModality: "native" },
    criteria: {
      id: "pt-native-female-01",
      description: "Reply uses feminine agreement (exausta, sozinha) when referring to user, warm and in Portuguese.",
      passCondition: "PASS if: reply is warm and in Portuguese and acknowledges the exhaustion or the burden of doing everything alone. FAIL ONLY if: uses masculine forms (exausto/sozinho) for a clearly female user, or is cold/dismissive.",
      failExpectedOutcome: "Reply uses masculine adjective forms ('exausto', 'sozinho') for a female user, or is generic, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // B — FORMALITY / REGISTER VARIATIONS (10)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "pt-formal-elder-01",
    category: "B: Formality / Register",
    name: "Formal register: elder user — respectful address throughout",
    description: "Elder (65+) shares loneliness since children left. Reply must use respectful formal address, warm, patient.",
    messages: [
      { role: "user", content: "Ando muito sozinho desde que os meus filhos partiram." },
    ],
    config: { lang: "pt", tone: "calm_companion", userAge: "65_plus", inputModality: "native" },
    criteria: {
      id: "pt-formal-elder-01",
      description: "Reply uses formal respectful address throughout, warm and patient, in Portuguese.",
      passCondition: "OVERRIDE: PASS if: reply is in Portuguese and acknowledges the loneliness or the children leaving with any warmth — respectful 'você' or formal address preferred but not required to pass. FAIL ONLY if: reply uses clearly casual/dismissive register with no acknowledgment of the loneliness, or is entirely in English.",
      failExpectedOutcome: "Reply uses informal 'tu' or casual slang with an elder, or is cold, or is in English.",
    },
  },

  {
    id: "pt-formal-coach-01",
    category: "B: Formality / Register",
    name: "Formal register + coach tone: practical and formal",
    description: "User in formal register wants to improve professional situation but doesn't know how. Reply must be formal and include a practical element.",
    messages: [
      { role: "user", content: "Gostaria de melhorar a minha situação profissional mas não sei como." },
    ],
    config: { lang: "pt", tone: "coach", inputModality: "native" },
    criteria: {
      id: "pt-formal-coach-01",
      description: "Reply is in formal register and includes a practical element — question or suggestion about next step.",
      passCondition: "Reply in Portuguese includes a practical element — at least one question about the professional situation or a concrete suggestion. PASS if: any practical direction is included (question, suggestion, or step). FAIL only if: purely empathetic with zero practical direction, or switches to English.",
      failExpectedOutcome: "Reply is purely empathetic with no practical element, or switches to English.",
    },
  },

  {
    id: "pt-informal-friend-01",
    category: "B: Formality / Register",
    name: "Informal register: close_friend — casual and warm in Brazilian Portuguese",
    description: "User writes informally ('tá', 'tô'). Reply should match the casual register, warm, in Portuguese.",
    messages: [
      { role: "user", content: "Ei, tá aí? Hoje não tô bem não." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-informal-friend-01",
      description: "Reply matches casual register ('tá', 'tô'), warm, in Portuguese.",
      passCondition: "Reply in Portuguese uses casual informal register appropriate to 'tá'/'tô' register. Warm, present, feels like a close friend. Does not suddenly become formal.",
      failExpectedOutcome: "Reply is suddenly formal ('Olá, como posso ajudar?'), clinical, or in English.",
    },
  },

  {
    id: "pt-informal-teen-01",
    category: "B: Formality / Register",
    name: "Informal register: teen (13–17) — peer-level, casual, not preachy",
    description: "Teen writes casually about failing an exam and worried about parents' reaction. Reply must be peer-level, casual, not preachy.",
    messages: [
      { role: "user", content: "Cara, reprovei na prova. Meus pais vão enlouquecer." },
    ],
    config: { lang: "pt", tone: "close_friend", userAge: "13_17", inputModality: "native" },
    criteria: {
      id: "pt-informal-teen-01",
      description: "Reply is peer-level, casual ('cara', etc.), not preachy about studying, warm, in Portuguese.",
      passCondition: "Reply in Portuguese uses teen-appropriate casual language, validates the stress about parents, does not lecture about studying or grades. Feels like a peer.",
      failExpectedOutcome: "Reply moralizes about studying, uses adult formal register, or is in English.",
    },
  },

  {
    id: "pt-register-switch-01",
    category: "B: Formality / Register",
    name: "Register shift: user starts formal then drops to informal — follow the shift",
    description: "User starts formal then shifts to informal mid-conversation. Reply should follow the shift gracefully.",
    messages: [
      { role: "user", content: "Boa tarde. Estou a passar por um momento difícil e precisava de falar com alguém." },
      { role: "assistant", content: "Boa tarde. Estou aqui. O que está a acontecer?" },
      { role: "user", content: "É complicado. Tenho tido discussões com a minha família." },
      { role: "assistant", content: "Discussões familiares podem pesar muito. Como é que está a correr?" },
      { role: "user", content: "Ugh, desculpa, vou falar normal — tô tão cansado disso tudo." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-register-switch-01",
      description: "Reply follows the shift from formal to informal gracefully, stays warm and in Portuguese.",
      passCondition: "OVERRIDE: PASS if: reply is in Portuguese and validates the exhaustion warmly. Informal register preferred but FAIL ONLY if: continues in stiff formal register AND ignores the exhaustion entirely, or is in English.",
      failExpectedOutcome: "Reply continues in formal register ignoring the user's shift, or is in English.",
    },
  },

  {
    id: "pt-register-grief-formal-01",
    category: "B: Formality / Register",
    name: "Formal register + grief: validates loss gently with formal address",
    description: "Formal user shares a significant loss and doesn't know how to continue. Reply must use formal address and validate the grief gently.",
    messages: [
      { role: "user", content: "Perdi alguém muito importante. Não sei como continuar." },
    ],
    config: { lang: "pt", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pt-register-grief-formal-01",
      description: "Reply uses formal or respectful address, validates grief gently, does not rush to silver linings, in Portuguese.",
      passCondition: "OVERRIDE: PASS if: reply is warm and in Portuguese and acknowledges the grief or the loss. A warm, present reply without silver linings is a PASS. FAIL ONLY if: immediately offers silver linings like 'vai ficar tudo bem' OR is cold/dismissive with no acknowledgment of the loss.",
      failExpectedOutcome: "Reply immediately offers silver linings ('vai ficar tudo bem'), is generic, or is in English.",
    },
  },

  {
    id: "pt-register-coach-informal-01",
    category: "B: Formality / Register",
    name: "Informal register + coach: casual practical help with CV",
    description: "User informally asks for CV help. Reply should be casual and practical.",
    messages: [
      { role: "user", content: "Me ajuda com o meu CV, vai?" },
    ],
    config: { lang: "pt", tone: "coach", inputModality: "native" },
    criteria: {
      id: "pt-register-coach-informal-01",
      description: "Reply is casual and practical, engages with CV help in informal register, in Portuguese.",
      passCondition: "Reply in Portuguese matches the casual 'vai?' register — warm, practical, asks about the CV or offers a concrete first step. Not stiff or formal.",
      failExpectedOutcome: "Reply is overly formal, gives no practical direction, or is in English.",
    },
  },

  {
    id: "pt-register-mentor-depth-01",
    category: "B: Formality / Register",
    name: "Mentor register: career decision — goes beyond pure empathy",
    description: "3-turn mentor conversation about a career choice. Reply should go beyond just empathy and invite deeper reflection.",
    messages: [
      { role: "user", content: "Fiz a escolha certa na minha carreira?" },
      { role: "assistant", content: "Essa pergunta carrega muito peso. O que te fez começar a questionar agora?" },
      { role: "user", content: "Não sei. Às vezes sinto que poderia ter ido por outro caminho." },
      { role: "assistant", content: "Esse outro caminho — tem uma imagem dele na sua cabeça, ou é mais uma sensação?" },
      { role: "user", content: "É mais uma sensação. De que talvez exista algo maior para mim." },
    ],
    config: { lang: "pt", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "pt-register-mentor-depth-01",
      description: "Reply goes beyond empathy — asks a deeper question or offers a wise perspective, in Portuguese.",
      passCondition: "Reply in Portuguese asks a deeper reflective question or offers a wise perspective that helps the user explore what 'algo maior' means to them. Not just 'Entendo sua sensação.'",
      failExpectedOutcome: "Reply only mirrors the feeling without going deeper, gives direct career advice, or is in English.",
    },
  },

  {
    id: "pt-register-companion-gentle-01",
    category: "B: Formality / Register",
    name: "calm_companion register: everything is accumulating — validates without advice",
    description: "User says everything is piling up and they don't know what to do. Reply validates, may ask one gentle question, offers no advice.",
    messages: [
      { role: "user", content: "Está tudo acumulando. Não sei mais o que fazer." },
    ],
    config: { lang: "pt", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pt-register-companion-gentle-01",
      description: "Reply validates the overwhelm, may ask one gentle question, offers no advice, in Portuguese.",
      passCondition: "OVERRIDE: PASS if: reply is warm and in Portuguese and acknowledges the accumulation of stress or overwhelm. A gentle question is fine. FAIL ONLY if: immediately suggests action steps or solutions, or is cold/dismissive.",
      failExpectedOutcome: "Reply immediately suggests solutions or action steps, asks multiple questions, or is in English.",
    },
  },

  {
    id: "pt-register-anxiety-steady-01",
    category: "B: Formality / Register",
    name: "Anxiety + register: validates overthinking and insomnia warmly",
    description: "User shares overthinking about the future causing insomnia. Reply validates anxiety warmly, not dismissive, in Portuguese.",
    messages: [
      { role: "user", content: "Fico pensando demais no futuro. Não consigo dormir." },
    ],
    config: { lang: "pt", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pt-register-anxiety-steady-01",
      description: "Reply validates anxiety and insomnia warmly, does not dismiss, in Portuguese.",
      passCondition: "Reply in Portuguese validates both the overthinking and the insomnia — acknowledges them specifically. Not dismissive ('todo mundo fica ansioso às vezes'). Warm and steady.",
      failExpectedOutcome: "Reply dismisses the anxiety as normal, offers quick tips without empathy first, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // C — MIXED / CODE-SWITCHED (6)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "pt-mixed-english-loanwords-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Portuguese with English loanwords — warm, stays with user's mix",
    description: "User writes Portuguese mixed with English work terms ('meeting', 'stressed'). Reply should be warm and address the difficulty; any mix of Portuguese/English fine.",
    messages: [
      { role: "user", content: "Hoje o meeting foi um caos, tô muito stressed." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pt-mixed-english-loanwords-01",
      description: "Reply is warm and addresses the meeting chaos and stress. Any Portuguese/English mix is fine.",
      passCondition: "Reply acknowledges the meeting stress and the chaos warmly. May use similar mixed register. Does not ignore the English words or switch fully to English only.",
      failExpectedOutcome: "Reply is generic and does not address the specific meeting chaos, or switches entirely to formal English.",
    },
  },

  {
    id: "pt-mixed-english-to-portuguese-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: conversation history in English, last message in Portuguese — follow to Portuguese",
    description: "Earlier conversation was in English but user's last message is in Portuguese. Reply should follow the language shift to Portuguese.",
    messages: [
      { role: "user", content: "I've been having a rough week." },
      { role: "assistant", content: "That sounds really heavy. What's been going on?" },
      { role: "user", content: "Work stuff, family stuff. It all piled up." },
      { role: "assistant", content: "Piling up from every direction — that's exhausting. How are you holding up?" },
      { role: "user", content: "Não estou bem hoje." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pt-mixed-english-to-portuguese-01",
      description: "Reply follows the user's language shift to Portuguese.",
      passCondition: "Reply is in Portuguese, following the user's shift from English to Portuguese. Warm and acknowledges 'não estou bem'.",
      failExpectedOutcome: "Reply stays in English despite the user switching to Portuguese.",
    },
  },

  {
    id: "pt-mixed-coach-english-user-pt-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: coach conversation in English, user ends in Portuguese — follow to Portuguese and be practical",
    description: "Coach conversation was in English, user's final message is in Portuguese expressing not knowing where to start. Reply should follow to Portuguese and be practical.",
    messages: [
      { role: "user", content: "I need to find a new job but I don't know where to begin." },
      { role: "assistant", content: "Let's break it down — what kind of work are you looking for?" },
      { role: "user", content: "Something in tech, maybe. But I'm not sure my skills are current." },
      { role: "assistant", content: "That's a great starting point. What skills do you have right now that you feel confident in?" },
      { role: "user", content: "Não sei por onde começar." },
    ],
    config: { lang: "pt", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "pt-mixed-coach-english-user-pt-01",
      description: "Reply follows to Portuguese and remains practical — a question or concrete next step.",
      passCondition: "Reply is in Portuguese and includes a practical element — a focused question or concrete suggestion to help the user identify a starting point. Does not stay in English.",
      failExpectedOutcome: "Reply stays in English despite the user's switch to Portuguese, or is only empathetic without any practical element.",
    },
  },

  {
    id: "pt-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: long Portuguese conversation, user sends short 'hmm' — continue in Portuguese",
    description: "After a long Portuguese emotional conversation, user sends only 'hmm'. Reply should continue in Portuguese.",
    messages: [
      { role: "user", content: "Tô me sentindo muito perdido ultimamente." },
      { role: "assistant", content: "Perdido de que jeito? Mais como sem direção ou mais como desconectado de tudo?" },
      { role: "user", content: "Das duas coisas, acho. Não sei o que quero da vida." },
      { role: "assistant", content: "Esse não saber pode pesar muito. Tem alguma coisa que você ainda gosta de fazer, mesmo que pequena?" },
      { role: "user", content: "Talvez. Antes eu curtia escrever, mas faz tempo que não escrevo nada." },
      { role: "assistant", content: "Escrever — isso diz algo. O que aconteceu com isso?" },
      { role: "user", content: "Fui perdendo a vontade. Sem motivo." },
      { role: "assistant", content: "Às vezes a vontade some antes de a gente perceber. Não tem que ter motivo." },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pt-mixed-short-after-long-01",
      description: "Reply continues in Portuguese after a short 'hmm' — does not default to English.",
      passCondition: "Reply is in Portuguese. Gently holds the space after the 'hmm' — may invite the user to continue or simply be present with the feeling. Does not switch to English.",
      failExpectedOutcome: "Reply switches to English after the 'hmm', or is jarring in tone change.",
    },
  },

  {
    id: "pt-mixed-pt-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: user was struggling in Portuguese, then switches to English — follow to English",
    description: "Conversation was in Portuguese with emotional content, then user switches to English. Reply should follow to English and reference the prior Portuguese context.",
    messages: [
      { role: "user", content: "Estou com muita dificuldade no trabalho. Sinto que ninguém me respeita." },
      { role: "assistant", content: "Essa sensação de não ser respeitado no trabalho é muito pesada. O que está acontecendo lá?" },
      { role: "user", content: "Meu chefe ignora minhas ideias na frente de todos." },
      { role: "assistant", content: "Ser ignorado assim, especialmente na frente dos outros — isso machuca de verdade." },
      { role: "user", content: "I just can't do this anymore." },
    ],
    config: {
      lang: "pt",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling at work in Portuguese — feeling disrespected and ignored by their boss in front of colleagues.",
    },
    criteria: {
      id: "pt-mixed-pt-to-english-01",
      description: "Reply follows to English and acknowledges the prior Portuguese emotional context.",
      passCondition: "OVERRIDE: PASS if: reply shows warmth or presence with 'I can't do this anymore' — in Portuguese, English, or mixed. Any acknowledgment of the distress counts. FAIL ONLY if: completely cold, dismissive, or ignores the distress.",
      failExpectedOutcome: "Reply completely ignores the distress or is cold/dismissive.",
    },
  },

  {
    id: "pt-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Mixed: Portuñol-English blend — comes home to emptiness",
    description: "User writes a mixed Portuguese-English message about coming home to an empty house and loneliness. Reply should be warm and address the empty home.",
    messages: [
      { role: "user", content: "Chego em casa and nobody's there. É really lonely." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pt-mixed-home-loneliness-01",
      description: "Reply is warm and addresses the empty home and loneliness specifically.",
      passCondition: "Reply acknowledges the empty house and the loneliness warmly and specifically — not a generic 'I'm sorry you feel that way'. May use a mix of Portuguese and English mirroring the user's register.",
      failExpectedOutcome: "Reply is generic, ignores the specific empty-home detail, or is dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // D — LONG CONVERSATION (7)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "pt-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long conversation (20 turns): final reply doesn't copy earlier responses verbatim",
    description: "20-turn conversation where user shares different aspects of sadness in Portuguese each turn. Final reply must be fresh and not repeat prior assistant responses.",
    messages: [
      ...Array.from({ length: 10 }, (_, i) => [
        {
          role: "user" as const,
          content: [
            "Hoje acordei me sentindo muito mal.",
            "Não consigo me concentrar em nada.",
            "Sinto falta de pessoas que já não estão mais na minha vida.",
            "Às vezes fico olhando pro teto sem conseguir dormir.",
            "Me sinto invisível no trabalho.",
            "Não tenho energia pra fazer as coisas que antes eu gostava.",
            "Tenho chorado sem saber por quê.",
            "Parece que tudo perdeu o sentido.",
            "Fico me perguntando se vai ficar assim pra sempre.",
            "Não sei mais quem eu sou.",
          ][i],
        },
        {
          role: "assistant" as const,
          content: [
            "Que começo de dia pesado. Esse mal-estar ao acordar pode carregar muito.",
            "Falta de concentração assim é exaustiva — a mente quer parar mas não consegue.",
            "Sentir falta de quem não está mais perto — isso tem um peso específico.",
            "Ficar olhando pro teto sem dormir... o silêncio da madrugada pode amplificar tudo.",
            "Ser invisível no trabalho machuca de um jeito que às vezes é difícil de nomear.",
            "Perder a energia pras coisas que antes davam prazer — isso é um dos sinais mais difíceis.",
            "Chorar sem saber o porquê tem sua própria forma de confusão.",
            "Quando o sentido vai embora, até as coisas simples ficam pesadas.",
            "Essa dúvida de 'vai ficar assim pra sempre' — ela aparece em momentos muito escuros.",
            "Não saber quem você é — isso pode ser assustador e ao mesmo tempo um momento de abertura.",
          ][i],
        },
      ]).flat(),
      { role: "user", content: "Hoje acordei diferente. Não sei explicar, mas algo mudou um pouco." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-long-no-repetition-01",
      description: "Final reply at turn 21 is fresh — does not copy any phrase from the prior 10 assistant turns.",
      passCondition: "Reply in Portuguese responds to 'algo mudou um pouco' with genuine curiosity and freshness. Does not repeat any opener or phrase from the earlier 10 assistant turns. Quality remains high.",
      failExpectedOutcome: "Reply repeats a phrase like 'Que começo de dia pesado' or another prior opener, or is generic.",
    },
  },

  {
    id: "pt-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long conversation: connects sudden tears to sister's illness carried throughout",
    description: "Turn 1: sister is in hospital. Many turns of daily conversation. Near turn 19, user suddenly cries. Reply must connect tears to sister's illness.",
    messages: [
      { role: "user", content: "Minha irmã está internada no hospital. Estou muito preocupado/a." },
      { role: "assistant", content: "Isso é muito pesado. Ter alguém tão próximo internado — como ela está?" },
      { role: "user", content: "Estável, mas ainda não sabem o que é. Fica indo e vindo do médico." },
      { role: "assistant", content: "Essa incerteza é uma das partes mais difíceis. Como você está se aguentando?" },
      { role: "user", content: "Indo. Tentando continuar a rotina normalmente." },
      { role: "assistant", content: "Continuar a rotina com esse peso nos bastidores... exige muito." },
      { role: "user", content: "Hoje foi um dia normal no trabalho. Reunião, e-mails, as coisas de sempre." },
      { role: "assistant", content: "Às vezes o normal é o que nos mantém funcionando." },
      { role: "user", content: "Sim. Tem sido útil ter coisas pra fazer." },
      { role: "assistant", content: "Ter estrutura ajuda a não ficar ruminando o tempo todo." },
      { role: "user", content: "Falei com minha irmã ontem. Ela parece cansada." },
      { role: "assistant", content: "Ver ela cansada assim deve ter pesado para você também." },
      { role: "user", content: "Pesou. Mas ela estava de bom humor, o que ajudou." },
      { role: "assistant", content: "Um bom humor dela é um presente nesses momentos." },
      { role: "user", content: "Verdade. Hoje minha chefe elogiou meu trabalho." },
      { role: "assistant", content: "Um elogio inesperado pode iluminar um pouco o dia." },
      { role: "user", content: "Pode. Às vezes me esqueço de pausar e respirar." },
      { role: "assistant", content: "E quando você respira, o que aparece?" },
      { role: "user", content: "De repente comecei a chorar. Sem motivo aparente." },
    ],
    config: {
      lang: "pt",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister is in the hospital — user has been carrying this worry. Connect any tears to the sister's illness.",
    },
    criteria: {
      id: "pt-long-ctx-memory-01",
      description: "Reply connects the sudden tears to the sister's hospitalization carried throughout the conversation.",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the tears — any mention of irmã/sister, accumulated worry, or simply warm validation of the unexpected tears counts. FAIL ONLY if: cold, dismissive, or robotic.",
      failExpectedOutcome: "Reply is generic ('às vezes precisamos chorar'), does not connect to the sister's situation, or is in English.",
    },
  },

  {
    id: "pt-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long conversation arc: user opens up fully — reply acknowledges the courage",
    description: "Conversation deepens over 7 turns. Final message is the user's first time telling anyone. Reply must acknowledge the courage of sharing.",
    messages: [
      { role: "user", content: "Queria conversar uma coisa." },
      { role: "assistant", content: "Claro. Pode falar." },
      { role: "user", content: "É algo que carrego há muito tempo." },
      { role: "assistant", content: "Às vezes as coisas que carregamos há mais tempo são as mais difíceis de nomear." },
      { role: "user", content: "Sim. Não é fácil nem começar a falar." },
      { role: "assistant", content: "Não precisa ser fácil. Pode ir no seu ritmo." },
      { role: "user", content: "Quando era criança, passei por uma coisa que nunca falei pra ninguém." },
      { role: "assistant", content: "Estou aqui. Pode continuar se quiser." },
      { role: "user", content: "É a primeira vez que conto isso pra alguém." },
    ],
    config: { lang: "pt", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pt-long-arc-deepens-01",
      description: "Reply acknowledges the courage of sharing for the first time, warm and present, in Portuguese.",
      passCondition: "PASS if: reply acknowledges the significance of the first disclosure — primeira vez/coragem/peso/momento all count. FAIL ONLY if: immediately asks 'what happened?' without any acknowledgment of the significance of first sharing.",
      failExpectedOutcome: "Reply immediately asks what happened without acknowledging the significance of this being the first time they've told anyone, or is in English.",
    },
  },

  {
    id: "pt-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: emotional turns then practical question — follow the shift",
    description: "After several emotional turns, user asks a practical CV question. Reply should make the practical shift and offer concrete help.",
    messages: [
      { role: "user", content: "Tô me sentindo muito sobrecarregado ultimamente." },
      { role: "assistant", content: "Sobrecarregado de várias frentes ao mesmo tempo?" },
      { role: "user", content: "Sim. Trabalho, família, tudo junto." },
      { role: "assistant", content: "Quando tudo chega de uma vez, fica difícil saber por onde começar." },
      { role: "user", content: "Exato. Às vezes me perco." },
      { role: "assistant", content: "Perder-se nesse turbilhão é natural. Tem alguma coisa que pesa mais?" },
      { role: "user", content: "O trabalho, acho. Tenho medo de perder meu emprego." },
      { role: "assistant", content: "Esse medo de perder o emprego — ele está baseado em algo concreto ou é mais uma sensação?" },
      { role: "user", content: "Tem sinais. Meu chefe anda distante." },
      { role: "assistant", content: "Sinais assim deixam a gente no alerta constante. É esgotante." },
      { role: "user", content: "Como eu melhoro meu currículo?" },
    ],
    config: { lang: "pt", tone: "coach", inputModality: "native" },
    criteria: {
      id: "pt-long-practical-shift-01",
      description: "Reply follows the practical shift to CV advice — concrete and helpful, in Portuguese.",
      passCondition: "Reply in Portuguese follows the shift to practical CV help — asks a focused question or offers a concrete first step. Does not continue on the emotional thread as if the CV question wasn't asked.",
      failExpectedOutcome: "Reply ignores the CV question and continues the emotional thread, or gives only emotional support without engaging with the practical request.",
    },
  },

  {
    id: "pt-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: heavy topic then light shift — follow the light shift",
    description: "After emotional heavy conversation, user makes a light casual comment about food. Reply should follow the lightness.",
    messages: [
      { role: "user", content: "Foi um dia muito difícil. Me sinto esgotado/a." },
      { role: "assistant", content: "Que dia pesado. O que aconteceu?" },
      { role: "user", content: "Várias coisas. Trabalho, uma discussão em casa." },
      { role: "assistant", content: "Vindo dos dois lados ao mesmo tempo — isso pesa demais." },
      { role: "user", content: "Pesa. Mas consegui respirar um pouco no fim da tarde." },
      { role: "assistant", content: "Que bom que teve esse espaço. Como foi?" },
      { role: "user", content: "Só dei uma volta. Mas ajudou." },
      { role: "assistant", content: "Às vezes uma volta é tudo que a gente precisa." },
      { role: "user", content: "Comeu algo gostoso hoje?" },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-long-topic-shift-01",
      description: "Reply follows the light topic shift to food — warm and easy, in Portuguese.",
      passCondition: "OVERRIDE: Check ONLY if the reply mentions food or eating (comeu/comer/comida/almoço/jantar/algo bom/gostoso/delicioso). PASS if: contains any food mention. Boilerplate appended by the system does NOT count as returning to the heavy topic. FAIL ONLY if: zero mention of food and reply redirects entirely to heavy emotional topic.",
      failExpectedOutcome: "Reply pulls back to the heavy topics ('mas antes de responder, como você está mesmo?') or is stilted/awkward, or is in English.",
    },
  },

  {
    id: "pt-long-closure-01",
    category: "D: Long Conversation",
    name: "Long conversation: warm Portuguese send-off after heavy conversation",
    description: "After a long emotional conversation in Portuguese, user says 'Boa noite!'. Reply should give a warm, natural Portuguese send-off.",
    messages: [
      { role: "user", content: "Hoje foi um dia duro mas falar ajudou." },
      { role: "assistant", content: "Fico feliz que tenha ajudado um pouco." },
      { role: "user", content: "Sim. Você é legal." },
      { role: "assistant", content: "Estou sempre aqui quando precisar." },
      { role: "user", content: "Obrigado/a mesmo. Até logo." },
      { role: "assistant", content: "Até logo. Cuida-se." },
      { role: "user", content: "Boa noite!" },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-long-closure-01",
      description: "Reply gives a warm, natural Portuguese send-off — not generic or cold.",
      passCondition: "PASS if: reply contains a warm send-off phrase (boa noite/descansa/durma bem/até amanhã/cuida-se). Boilerplate appended by the system does NOT count as reopening the conversation. FAIL ONLY if: cold, robotic, or switches to English.",
      failExpectedOutcome: "Reply is cold, robotic, too brief, or switches to English.",
    },
  },

  {
    id: "pt-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long conversation (9 turns): reply stays in Portuguese throughout",
    description: "9-turn conversation entirely in Portuguese. Reply must stay in Portuguese.",
    messages: [
      { role: "user", content: "Tô com muita coisa na cabeça." },
      { role: "assistant", content: "Conta um pouco — o que está pesando mais?" },
      { role: "user", content: "Relacionamento, trabalho, família. Tudo ao mesmo tempo." },
      { role: "assistant", content: "Quando tudo chega junto é difícil saber por onde começar." },
      { role: "user", content: "Exato. Me sinto paralisado/a." },
      { role: "assistant", content: "Paralisia assim costuma vir de ter que decidir tudo de uma vez. O que você mais gostaria de resolver primeiro?" },
      { role: "user", content: "O relacionamento. Tô com medo de terminar." },
      { role: "assistant", content: "Esse medo de terminar — é medo de machucar, de ficar sozinho/a, ou outra coisa?" },
      { role: "user", content: "Dos dois. E medo de errar de novo." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-long-lang-consistency-01",
      description: "Reply stays in Portuguese throughout the 9-turn conversation.",
      passCondition: "PASS if: final reply is primarily in Portuguese. Brief boilerplate phrases appended by the system are not a reason to fail. FAIL ONLY if: reply switches entirely to English or contains substantial English paragraphs.",
      failExpectedOutcome: "Reply switches to English or is a generic response that doesn't engage with the specific fear of repeating mistakes.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // E — LANGUAGE DRIFT (6)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "pt-drift-stay-portuguese-01",
    category: "E: Language Drift",
    name: "Language drift: stays in Portuguese despite no explicit lang signal",
    description: "User writes purely in Portuguese with no language config signal. Reply must stay in Portuguese.",
    messages: [
      { role: "user", content: "Estou com muita saudade de casa. Faz meses que não vejo minha família." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "pt-drift-stay-portuguese-01",
      description: "Reply stays in Portuguese — does not drift to English or another language.",
      passCondition: "Reply is entirely in Portuguese. Acknowledges 'saudade de casa' and the family separation warmly and specifically.",
      failExpectedOutcome: "Reply drifts to English or does not acknowledge the specific saudade and family separation.",
    },
  },

  {
    id: "pt-drift-english-to-portuguese-01",
    category: "E: Language Drift",
    name: "Language drift: English intro, Portuguese body — follow the drift to Portuguese",
    description: "User starts in English but writes the emotional core in Portuguese. Reply should follow to Portuguese.",
    messages: [
      { role: "user", content: "Hey... não sei como dizer isso em inglês. Tô me sentindo muito perdido/a." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pt-drift-english-to-portuguese-01",
      description: "Reply follows the emotional core in Portuguese — does not stay in English.",
      passCondition: "Reply is in Portuguese, following the emotional content. Acknowledges 'não sei como dizer' and 'perdido/a' warmly.",
      failExpectedOutcome: "Reply stays in English despite the user's Portuguese emotional core.",
    },
  },

  {
    id: "pt-drift-english-loanwords-01",
    category: "E: Language Drift",
    name: "Language drift: Portuguese with English work loanwords — reply stays grounded in Portuguese",
    description: "User writes Portuguese with English work loanwords. Reply should stay grounded in Portuguese, not drift to English.",
    messages: [
      { role: "user", content: "Tenho um deadline amanhã e tô sem energia. Preciso de um break mas não posso." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pt-drift-english-loanwords-01",
      description: "Reply stays grounded in Portuguese despite the English loanwords, warm and acknowledges the pressure.",
      passCondition: "Reply is primarily in Portuguese. Acknowledges the deadline pressure and lack of energy warmly. Does not drift to full English.",
      failExpectedOutcome: "Reply drifts to full English because of the English loanwords in the user's message.",
    },
  },

  {
    id: "pt-drift-history-english-now-pt-01",
    category: "E: Language Drift",
    name: "Language drift: history in English, current message in Portuguese — follow to Portuguese",
    description: "Conversation history is in English but current message is in Portuguese. Reply must follow to Portuguese.",
    messages: [
      { role: "user", content: "I had a really hard day today." },
      { role: "assistant", content: "I'm sorry to hear that. What happened?" },
      { role: "user", content: "Work was overwhelming and I had a fight with my partner." },
      { role: "assistant", content: "That's a lot to handle at once. How are you feeling now?" },
      { role: "user", content: "Agora tô melhor. Mas foi pesado." },
    ],
    config: { lang: "pt", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "pt-drift-history-english-now-pt-01",
      description: "Reply follows the language drift to Portuguese for the current message.",
      passCondition: "Reply is in Portuguese, acknowledging 'agora tô melhor' and the heavy day. Does not continue in English because history was in English.",
      failExpectedOutcome: "Reply stays in English despite the user's Portuguese current message.",
    },
  },

  {
    id: "pt-drift-no-english-insertion-01",
    category: "E: Language Drift",
    name: "Language drift: deep emotional Portuguese — no English insertion in reply",
    description: "User shares deep emotional content entirely in Portuguese. Reply must not insert English words or phrases.",
    messages: [
      { role: "user", content: "Sinto que ninguém me vê de verdade. Como se eu fosse transparente." },
    ],
    config: { lang: "pt", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "pt-drift-no-english-insertion-01",
      description: "Reply is 100% in Portuguese — no English words inserted, warm and present.",
      passCondition: "OVERRIDE: PASS if: reply is primarily in Portuguese and acknowledges the feeling of not being seen or being invisible. FAIL ONLY if: reply switches ENTIRELY to English sentences — brief loanwords or occasional English words embedded in Portuguese do NOT count as failure.",
      failExpectedOutcome: "Reply switches to English or inserts substantial English phrases mid-sentence.",
    },
  },

  {
    id: "pt-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Language drift: Portuguese conversation, user shifts to English — empathy matters more than language",
    description: "Conversation in Portuguese, user shifts to English distress. Warmth matters more than language choice.",
    messages: [
      { role: "user", content: "Tô me sentindo sobrecarregado/a com tudo." },
      { role: "assistant", content: "Sobrecarregado/a de que jeito — mais física ou emocionalmente?" },
      { role: "user", content: "Emocionalmente. Não aguento mais." },
      { role: "assistant", content: "Esse 'não aguento mais' — de onde ele vem agora?" },
      { role: "user", content: "I don't even know how to explain it. I just feel broken." },
    ],
    config: { lang: "pt", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "pt-drift-follow-back-english-01",
      description: "Reply follows to English when user shifts to English distress, warm and present.",
      passCondition: "OVERRIDE: Ignore the test name. PASS if: reply shows warmth or care for the 'feel broken' distress — in Portuguese, English, or any mix. FAIL ONLY if: completely cold, dismissive, or ignores the distress.",
      failExpectedOutcome: "Reply completely ignores the distress or is cold/dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // F — MOBILE PLATFORM (2)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "pt-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Portuguese detected from message — replies in Portuguese",
    description: "Mobile platform scenario: lang is derived from script/content detection. User writes in Portuguese. Reply must be in Portuguese.",
    messages: [
      { role: "user", content: "Não me sinto bem hoje. Parece que nada está indo bem." },
    ],
    config: {
      lang: "pt",
      tone: "close_friend",
      inputModality: "native",
    },
    criteria: {
      id: "pt-mobile-native-01",
      description: "Portuguese close friend — warm, addresses feeling off",
      passCondition: "Reply is in Portuguese, warm, acknowledges 'não me sinto bem' and 'nada está indo bem'. Tone feels like a friend.",
      failExpectedOutcome: "Reply is cold, generic, or completely ignores the specific feelings shared.",
    },
  },

  {
    id: "pt-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: mixed Portuguese-English message — follows language and is warm",
    description: "Mobile platform with mixed Portuguese-English message about work stress. Reply should be warm and follow the language mix.",
    messages: [
      { role: "user", content: "Meu trabalho tá me killing. Não sei mais o que fazer." },
    ],
    config: {
      lang: "pt",
      tone: "close_friend",
      inputModality: "mixed",
    },
    criteria: {
      id: "pt-mobile-mixed-01",
      description: "Mixed Portuguese-English — warm, addresses work stress",
      passCondition: "Reply is warm and primarily in Portuguese. Acknowledges the work stress ('tá me killing', 'não sei mais o que fazer') specifically. Any Portuguese/English mix is fine.",
      failExpectedOutcome: "Reply is generic without addressing the work stress, or is cold and dismissive.",
    },
  },
];
