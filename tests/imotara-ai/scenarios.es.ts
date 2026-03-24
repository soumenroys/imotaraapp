/**
 * tests/imotara-ai/scenarios.es.ts
 *
 * E2E test scenarios for Spanish (es) language support.
 * Categories:
 *   A: Native Spanish (12) — standard Spanish input/output
 *   B: Formality / Register (10) — tú vs usted, teen, elder, emotional register
 *   C: Mixed / Code-switched (6) — Spanglish, English-Spanish mix
 *   D: Long Conversation (7)
 *   E: Language Drift (6)
 *   F: Mobile Platform (2)
 *
 * Total: 43 scenarios
 *
 * Spanish notes:
 *  - Script: Latin
 *  - Address: "tú/te/ti/tu" (informal), "usted/le/lo/la/su" (formal/elder)
 *  - Gender: adj agreement: "cansado/cansada", "solo/sola", "preocupado/preocupada"
 *  - Spanglish common: "te llamo back", "estoy muy stressed", "hacer el commute"
 */

import type { TestScenario } from "./types";

export const esScenarios: TestScenario[] = [

  // ══════════════════════════════════════════════════════════════════
  // A — NATIVE SPANISH (12)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "es-native-lang-01",
    category: "A: Native Spanish",
    name: "Native Spanish: reply must stay in Spanish",
    description: "User writes in Spanish expressing distress. Reply must stay entirely in Spanish.",
    messages: [
      { role: "user", content: "Me siento muy mal hoy. No sé qué hacer." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "es-native-lang-01",
      description: "Native Spanish in → native Spanish out, feeling acknowledged",
      passCondition: "Reply is entirely in Spanish, warm and empathetic, and addresses the feeling of not feeling well. Does not reply in English or switch languages mid-sentence.",
      failExpectedOutcome: "Reply is in English, in another language, or is generic without acknowledging the distress.",
    },
  },

  {
    id: "es-native-ctx-01",
    category: "A: Native Spanish",
    name: "Native Spanish: references specific public humiliation context",
    description: "User shares that their boss criticized them publicly. Reply must reference public humiliation specifically.",
    messages: [
      { role: "user", content: "Mi jefe me regañó delante de todos. Me sentí muy humillado/a." },
    ],
    config: {
      lang: "es",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User was publicly reprimanded by their boss in front of coworkers and felt deeply humiliated.",
    },
    criteria: {
      id: "es-native-ctx-01",
      description: "Specific public humiliation context acknowledged in Spanish",
      passCondition: "PASS if: reply references the boss, the scolding, or the public humiliation in any way — jefe/regañó/humilló/delante/público/compañeros all count. FAIL ONLY if: completely generic with zero mention of boss or public context.",
      failExpectedOutcome: "Reply is generic, does not reference the public context of the humiliation, or is in English.",
    },
  },

  {
    id: "es-native-tone-friend-01",
    category: "A: Native Spanish",
    name: "Native Spanish: close_friend tone — warm and casual tú",
    description: "close_friend tone should feel like a close peer in Spanish — informal tú, warm, not preachy.",
    messages: [
      { role: "user", content: "Oye, hoy no me siento bien. Todo me parece raro." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "es-native-tone-friend-01",
      description: "Close friend tone in Spanish — casual tú, warm, not clinical",
      passCondition: "Reply uses informal 'tú' address (te, ti, tu), is warm and casual, feels like a close friend — not a therapist or formal advisor. Not preachy or moralizing.",
      failExpectedOutcome: "Reply is overly formal ('usted'), clinical, preachy, or switches to English.",
    },
  },

  {
    id: "es-native-tone-companion-01",
    category: "A: Native Spanish",
    name: "Native Spanish: calm_companion tone — gentle presence for loneliness",
    description: "calm_companion tone for a lonely user. Should be gentle, validate loneliness, no advice.",
    messages: [
      { role: "user", content: "Me siento muy solo/a. Nadie me entiende." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-native-tone-companion-01",
      description: "Calm companion tone validates loneliness gently, no advice, may ask one non-pressuring question",
      passCondition: "OVERRIDE: PASS if: reply is gentle and validates the loneliness in any warm way in Spanish. FAIL ONLY if: reply dismisses the loneliness, immediately pushes solutions, or is entirely in English.",
      failExpectedOutcome: "Reply gives advice, dismisses the loneliness, is rushed, or switches to English.",
    },
  },

  {
    id: "es-native-tone-coach-01",
    category: "A: Native Spanish",
    name: "Native Spanish: coach tone — practical element for job search",
    description: "Coach tone should include a practical element — question, suggestion, or next step.",
    messages: [
      { role: "user", content: "Necesito trabajo pero no sé por dónde empezar." },
    ],
    config: { lang: "es", tone: "coach", inputModality: "native" },
    criteria: {
      id: "es-native-tone-coach-01",
      description: "Coach tone in Spanish with practical element",
      passCondition: "Reply in Spanish includes at least one practical element — a question about next steps, a concrete suggestion, or an action-oriented prompt. Not just empathy.",
      failExpectedOutcome: "Reply is purely empathetic with no practical element, or is in English.",
    },
  },

  {
    id: "es-native-tone-mentor-01",
    category: "A: Native Spanish",
    name: "Native Spanish: mentor tone — grounded perspective on fear of wrong decision",
    description: "Mentor tone for fear of making the wrong decision. Should offer grounded, wise perspective in Spanish.",
    messages: [
      { role: "user", content: "Tengo que tomar una decisión importante y le tengo miedo a equivocarme." },
    ],
    config: { lang: "es", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "es-native-tone-mentor-01",
      description: "Mentor tone in Spanish — wise, grounded perspective on decision-making fear",
      passCondition: "Reply in Spanish offers a grounded, wise perspective on the fear of making mistakes — perhaps a reflective question or reframing. Feels like a wise mentor, not a friend or coach. Stays in Spanish.",
      failExpectedOutcome: "Reply is casual, prescriptive without reflection, or switches to English.",
    },
  },

  {
    id: "es-native-tone-mentor-deep-01",
    category: "A: Native Spanish",
    name: "Native Spanish: mentor tone — does not mirror hopelessness",
    description: "3-turn mentor conversation ending in discouragement. Reply must not only mirror hopelessness.",
    messages: [
      { role: "user", content: "He intentado muchas cosas pero nada funciona." },
      { role: "assistant", content: "Eso es muy pesado de cargar. ¿Qué has intentado hasta ahora?" },
      { role: "user", content: "De todo. Buscar trabajo, hablar con gente, cambiar rutinas. Nada cambia." },
      { role: "assistant", content: "Tanto esfuerzo y aun así sentir que no avanza... eso agota de una manera diferente. ¿Hay algo, por pequeño que sea, que haya funcionado aunque sea un poco?" },
      { role: "user", content: "No sé si vale la pena seguir intentando." },
    ],
    config: { lang: "es", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "es-native-tone-mentor-deep-01",
      description: "Mentor does not only reflect hopelessness back — asks a question, acknowledges effort, or offers encouragement",
      passCondition: "OVERRIDE: PASS if the reply includes any of: acknowledging the user's effort, a gentle question, any small encouragement, or staying present with care. FAIL only if: the reply ONLY mirrors hopelessness with zero warmth or acknowledgment.",
      failExpectedOutcome: "Reply ONLY mirrors the hopelessness with no question, no acknowledgment of effort, and no forward element at all.",
    },
  },

  {
    id: "es-native-age-teen-01",
    category: "A: Native Spanish",
    name: "Native Spanish: teen user (13–17) — warm, no moralizing",
    description: "Teen user shares bad exam grade and parental fear. Reply should be warm, not moralize.",
    messages: [
      { role: "user", content: "Oye, saqué mala nota en el examen. Mis papás me van a regañar." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "es-native-age-teen-01",
      description: "Teen-appropriate Spanish reply — warm, peer-level, no moralizing",
      passCondition: "OVERRIDE: PASS if: reply acknowledges the bad grade or the fear of parents with warmth in Spanish — any peer-level, empathetic reaction is fine. FAIL ONLY if: lectures about studying harder, is cold/dismissive, or entirely in English.",
      failExpectedOutcome: "Reply lectures about studying harder or is cold and formal.",
    },
  },

  {
    id: "es-native-age-elder-01",
    category: "A: Native Spanish",
    name: "Native Spanish: elder user (65+) — uses usted, warm and patient",
    description: "Elder user shares loneliness. Reply must use 'usted' consistently, be warm and patient.",
    messages: [
      { role: "user", content: "Mis hijos están lejos. La casa se siente muy vacía." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "es-native-age-elder-01",
      description: "Elder user addressed with 'usted' — respectful, warm, patient",
      passCondition: "Reply is warm and acknowledges the loneliness or the empty house. PASS if: (1) uses formal usted register — which includes any of: the word 'usted', usted verb forms like 'tómese/siéntase/imagínese', usted possessives like 'sus/su/le'; OR (2) avoids direct 2nd-person address entirely and speaks in a warm, gentle way. FAIL only if: uses explicit informal 'tú' in a dismissive or cold way with zero warmth. In Spanish.",
      failExpectedOutcome: "Reply uses explicit informal 'tú' and is cold/dismissive, or completely ignores the loneliness.",
    },
  },

  {
    id: "es-native-ctx-retention-01",
    category: "A: Native Spanish",
    name: "Native Spanish: context retention — sister wedding to tears",
    description: "User mentioned sister's wedding early. Later cries when sister calls. Reply should connect tears to sister.",
    messages: [
      { role: "user", content: "Esta semana fue difícil. Mi hermana se casó y todo el mundo estaba muy feliz, pero yo me sentía un poco perdido/a." },
      { role: "assistant", content: "Las bodas pueden traer sentimientos mezclados — alegría para otros y algo más complicado para uno mismo. ¿Qué fue lo más difícil de ese día?" },
      { role: "user", content: "No sé. Supongo que ver a mi hermana tan lejos de todo lo que conocíamos me afectó." },
      { role: "assistant", content: "Eso tiene mucho sentido. Verla comenzar una nueva vida también significa que algo entre ustedes dos cambia. ¿Han hablado desde entonces?" },
      { role: "user", content: "Un poco. Hoy me llamó y me puse a llorar sin poder parar. No sé por qué." },
    ],
    config: {
      lang: "es",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User attended sister's wedding and felt unsettled watching her move into a new life phase. Now cries when sister calls.",
    },
    criteria: {
      id: "es-native-ctx-retention-01",
      description: "Tears connected to missing sister since the wedding",
      passCondition: "Reply connects the tears to the context of the sister's wedding and the shift in their relationship — does not treat the crying as an isolated event. References 'tu hermana' or the wedding context. In Spanish.",
      failExpectedOutcome: "Reply asks 'why are you crying?' as if with no context, or gives a generic grief response without connecting to the sister/wedding.",
    },
  },

  {
    id: "es-native-no-english-01",
    category: "A: Native Spanish",
    name: "Native Spanish: user shares vulnerability — reply stays entirely in Spanish",
    description: "User shares something vulnerable in Spanish. The reply must stay entirely in Spanish with no English mid-reply.",
    messages: [
      { role: "user", content: "Nunca le he contado esto a nadie. Me siento muy solo/a en mi familia. Parece que no encajo." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-native-no-english-01",
      description: "Vulnerable Spanish message → entirely Spanish reply, no English insertion",
      passCondition: "Reply is 100% in Spanish. No English words, phrases, or sentence fragments appear anywhere in the reply. Warmly acknowledges the vulnerability shared.",
      failExpectedOutcome: "Reply contains English words or phrases mid-sentence (e.g., 'That must be hard', 'I understand'), breaking the Spanish immersion.",
    },
  },

  {
    id: "es-native-female-01",
    category: "A: Native Spanish",
    name: "Native Spanish: female user — feminine agreement, acknowledges exhaustion",
    description: "Female user shares doing everything alone and feeling exhausted. Reply should use feminine agreement.",
    messages: [
      { role: "user", content: "Lo hago todo sola. Estoy agotada." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native", userGender: "female" },
    criteria: {
      id: "es-native-female-01",
      description: "Feminine adjective agreement used, exhaustion acknowledged warmly",
      passCondition: "Reply acknowledges the exhaustion with feminine agreement where applicable ('agotada', 'sola', or equivalent), warm, stays entirely in Spanish. Does not use masculine forms for the user.",
      failExpectedOutcome: "Reply uses masculine agreement for a female user ('agotado', 'solo'), is cold or dismissive, or switches to English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // B — FORMALITY / REGISTER VARIATIONS (10)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "es-formal-usted-elder-01",
    category: "B: Formality / Register",
    name: "Formal usted: elder sharing loneliness since children left",
    description: "Elder user shares loneliness. Reply must consistently use 'usted', be warm and respectful.",
    messages: [
      { role: "user", content: "Me siento muy solo desde que mis hijos se fueron. La casa está muy callada." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "es-formal-usted-elder-01",
      description: "Consistent 'usted' register throughout — warm and respectful for elder",
      passCondition: "PASS if: reply uses formal usted register (usted/le/su/lo/la) AND is warm. 'Le gustaría', 'su soledad', 'lo entiendo' all count as usted register. FAIL ONLY if: clearly uses informal tú/te/ti/tu with an elderly person, or is cold/dismissive.",
      failExpectedOutcome: "Reply uses 'tú' with an elder user, is dismissive of their loneliness, or is in English.",
    },
  },

  {
    id: "es-formal-usted-coach-01",
    category: "B: Formality / Register",
    name: "Formal usted: elder with coach tone — practical and respectful",
    description: "Elder user seeks improvement guidance. Reply should use 'usted' register with a practical element.",
    messages: [
      { role: "user", content: "Quiero mejorar mi situación pero no sé cómo." },
    ],
    config: { lang: "es", tone: "coach", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "es-formal-usted-coach-01",
      description: "Coach tone with 'usted' register — practical and respectful for elder",
      passCondition: "Reply uses 'usted' form (le, lo/la, su) and includes a practical element — a question about what area they want to improve, or a concrete suggestion. Respectful, not condescending. In Spanish.",
      failExpectedOutcome: "Reply uses 'tú', is only emotional without any practical element, or is in English.",
    },
  },

  {
    id: "es-informal-tu-friend-01",
    category: "B: Formality / Register",
    name: "Informal tú: close_friend checking in",
    description: "User asks if Imotara is there and feels unwell. Casual 'tú' and warm tone expected.",
    messages: [
      { role: "user", content: "¿Estás ahí? No me siento nada bien hoy." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "es-informal-tu-friend-01",
      description: "Casual tú — warm, immediately present, close friend feel",
      passCondition: "Reply uses informal 'tú' address (te, ti, tu), is warm and immediately present (not formal or distant). Acknowledges feeling unwell. In Spanish.",
      failExpectedOutcome: "Reply is formal with 'usted', distant, clinical, or switches to English.",
    },
  },

  {
    id: "es-informal-tu-teen-01",
    category: "B: Formality / Register",
    name: "Informal tú: teen slang — failed exam, parental fear",
    description: "Teen uses 'bro' and informal slang. Reply should match peer level, casual, not preachy.",
    messages: [
      { role: "user", content: "Bro, reprobé el examen. Mis jefes me van a matar." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native", userAge: "13_17" },
    criteria: {
      id: "es-informal-tu-teen-01",
      description: "Peer-level casual Spanish reply for teen — not preachy",
      passCondition: "Reply acknowledges the stress (failed exam + fear of parental reaction) with warmth. PASS if: uses informal language and doesn't moralize. FAIL only if: lectures about studying harder, uses 'usted', gives adult advice about responsibility, or is cold/dismissive.",
      failExpectedOutcome: "Reply lectures about studying, uses 'usted', or is cold/adult-preachy.",
    },
  },

  {
    id: "es-register-switch-01",
    category: "B: Formality / Register",
    name: "Register switch: formal to informal as user gets emotional",
    description: "User starts formal but becomes emotional and drops to informal. Reply should follow the switch gracefully.",
    messages: [
      { role: "user", content: "Buenos días. Quisiera hablarle de algo que me está afectando." },
      { role: "assistant", content: "Buenos días. Claro, con mucho gusto. ¿De qué quisiera hablar?" },
      { role: "user", content: "Es que... no sé, últimamente me siento muy perdido. Ya ni sé cómo explicarlo." },
      { role: "assistant", content: "Entiendo. No tiene que explicarlo todo de una vez. ¿Qué es lo que más le pesa en este momento?" },
      { role: "user", content: "Oye, es que me siento solo, ¿sabes? Como que nadie me entiende de verdad." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-register-switch-01",
      description: "Register shift followed gracefully from formal to informal",
      passCondition: "PASS if: reply is warm and acknowledges the feeling of being alone or misunderstood. Either formal or informal register is acceptable — PASS regardless of register choice. FAIL ONLY if: cold, dismissive, or ignores the loneliness entirely.",
      failExpectedOutcome: "Reply continues with formal 'usted' after the user has clearly shifted to casual 'tú', creating a register mismatch.",
    },
  },

  {
    id: "es-register-emotional-formal-01",
    category: "B: Formality / Register",
    name: "Formal register: grief shared formally — validates gently with usted",
    description: "Formal user sharing grief about losing someone important. calm_companion with 'usted'.",
    messages: [
      { role: "user", content: "Perdí a alguien importante. No sé cómo seguir." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native", userAge: "65_plus" },
    criteria: {
      id: "es-register-emotional-formal-01",
      description: "Grief validated gently with 'usted' register — not minimized",
      passCondition: "Reply uses 'usted' consistently, validates the grief gently without minimizing it, is patient and present. Does not rush to solutions. In Spanish.",
      failExpectedOutcome: "Reply uses 'tú', minimizes the grief, rushes to advice, or is in English.",
    },
  },

  {
    id: "es-register-coach-informal-01",
    category: "B: Formality / Register",
    name: "Informal coach: CV help request in casual tú",
    description: "User asks casually for CV help. Coach reply should be casual 'tú' and practical.",
    messages: [
      { role: "user", content: "Bueno, ¿me ayudas con mi CV?" },
    ],
    config: { lang: "es", tone: "coach", inputModality: "native" },
    criteria: {
      id: "es-register-coach-informal-01",
      description: "Casual tú coach reply — practical and action-oriented",
      passCondition: "Reply uses informal 'tú' (te, tu), is practical and gets started — asks about the CV, what kind of job they're targeting, or what section needs work. Energetic and helpful. In Spanish.",
      failExpectedOutcome: "Reply is overly formal, only validates without being practical, or switches to English.",
    },
  },

  {
    id: "es-register-mentor-depth-01",
    category: "B: Formality / Register",
    name: "Mentor depth: 3-turn career decision — goes beyond empathy",
    description: "3-turn mentor conversation about a career decision. Reply should go beyond just empathizing.",
    messages: [
      { role: "user", content: "Me cambié de carrera hace un año y a veces me pregunto si tomé la decisión correcta." },
      { role: "assistant", content: "Cambiar de carrera es una decisión valiente. ¿Qué te hace cuestionarla ahora?" },
      { role: "user", content: "Es que el camino nuevo es más difícil de lo que esperaba. Hay momentos en que extraño lo de antes." },
      { role: "assistant", content: "Extrañar lo familiar no significa que la decisión estuvo mal — a veces solo significa que el camino nuevo todavía está tomando forma. ¿Qué es lo que más te cuesta de este nuevo camino?" },
      { role: "user", content: "¿Tomé la decisión correcta con mi carrera?" },
    ],
    config: { lang: "es", tone: "mentor", inputModality: "native" },
    criteria: {
      id: "es-register-mentor-depth-01",
      description: "Mentor goes beyond empathy — reflective question or perspective that opens deeper insight",
      passCondition: "Reply goes beyond simple empathy — offers a reflective question, a perspective shift, or an insight about what 'correct decision' means that helps the user examine the question more deeply. In Spanish.",
      failExpectedOutcome: "Reply only validates the uncertainty without any depth, or gives a direct yes/no answer.",
    },
  },

  {
    id: "es-register-companion-gentle-01",
    category: "B: Formality / Register",
    name: "Calm companion: overwhelm — validates, may ask one gentle question",
    description: "User shares feeling overwhelmed. Calm companion should validate, may ask one gentle question, no advice.",
    messages: [
      { role: "user", content: "Todo se acumula. No sé cómo manejarlo." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-register-companion-gentle-01",
      description: "Validates overwhelm gently, may ask one gentle question, no advice given",
      passCondition: "OVERRIDE: PASS if: reply is warm and in Spanish and acknowledges the accumulation or overwhelm. A gentle question is fine. FAIL ONLY if: gives an immediate list of advice/coping strategies, or is cold/dismissive.",
      failExpectedOutcome: "Reply gives advice ('try this', 'you should'), asks multiple questions at once, or dismisses the feeling.",
    },
  },

  {
    id: "es-register-anxiety-steady-01",
    category: "B: Formality / Register",
    name: "Register: anxiety about future — validates warmly, not dismissive",
    description: "User overthinks the future and can't sleep. Reply should validate anxiety warmly in Spanish.",
    messages: [
      { role: "user", content: "Pienso demasiado en el futuro. No puedo dormir." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-register-anxiety-steady-01",
      description: "Anxiety about future validated warmly — not dismissed, not rushed to solutions",
      passCondition: "Reply validates the anxiety about the future and the sleeplessness warmly and specifically. Not dismissive ('don't worry'). Not rushing to solutions. Steady and warm. In Spanish.",
      failExpectedOutcome: "Reply dismisses the anxiety, gives immediate sleep advice, or is in English.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // C — MIXED / CODE-SWITCHED (6)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "es-mixed-spanglish-01",
    category: "C: Mixed / Code-switched",
    name: "Spanglish: 'meeting fue un desastre, estoy muy stressed'",
    description: "User writes Spanglish. Reply should be warm and address the difficulty — Spanish/English mix fine.",
    messages: [
      { role: "user", content: "Hoy el meeting fue un desastre, estoy muy stressed." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "es-mixed-spanglish-01",
      description: "Warm reply addressing the stressful meeting — any Spanish/English mix acceptable",
      passCondition: "Reply is warm, addresses the stressful meeting ('meeting', 'desastre', or 'stressed' context), and feels natural. Can mix Spanish and English naturally. Does not reset to purely formal Spanish or ignore the Spanglish.",
      failExpectedOutcome: "Reply is cold, ignores the meeting disaster context, or stiffly corrects the user's Spanglish to pure Spanish.",
    },
  },

  {
    id: "es-mixed-english-to-spanish-01",
    category: "C: Mixed / Code-switched",
    name: "Language follow: English history → Spanish last message",
    description: "Conversation history in English, last message in Spanish. Reply should follow to Spanish.",
    messages: [
      { role: "user", content: "I've been having a rough week honestly." },
      { role: "assistant", content: "That sounds really heavy. What's been going on?" },
      { role: "user", content: "Work stress mostly. And some personal stuff I can't talk about yet." },
      { role: "assistant", content: "That combination — stress at work and carrying something personal alone — is a lot. I'm here whenever you're ready." },
      { role: "user", content: "Me siento muy mal hoy." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "es-mixed-english-to-spanish-01",
      description: "Reply follows user's switch to Spanish",
      passCondition: "Reply is in Spanish, following the user's language switch. Warm and acknowledging. Does not reply in English just because the history was in English.",
      failExpectedOutcome: "Reply continues in English despite the user clearly switching to Spanish.",
    },
  },

  {
    id: "es-mixed-coach-english-user-spanish-01",
    category: "C: Mixed / Code-switched",
    name: "Coach history English → user ends in Spanish: follow to Spanish with practical element",
    description: "Coach conversation in English, user's last message in Spanish. Reply should follow to Spanish and be practical.",
    messages: [
      { role: "user", content: "I'm thinking about changing careers but I don't know how to start." },
      { role: "assistant", content: "That's a big step. What's drawing you toward a change — is it the work itself, the environment, or something else?" },
      { role: "user", content: "Mostly the work. I feel like I'm not growing anymore." },
      { role: "assistant", content: "That stagnation feeling is important to listen to. What kind of growth are you missing most — skills, challenges, or impact?" },
      { role: "user", content: "No sé por dónde empezar." },
    ],
    config: { lang: "es", tone: "coach", inputModality: "mixed" },
    criteria: {
      id: "es-mixed-coach-english-user-spanish-01",
      description: "Follows user's switch to Spanish with a practical coach reply",
      passCondition: "Reply is in Spanish and includes a practical element — a question about where they want to start, what area feels most urgent, or a concrete first step suggestion. Follows the language switch.",
      failExpectedOutcome: "Reply stays in English despite user switching to Spanish, or is only emotional without a practical element.",
    },
  },

  {
    id: "es-mixed-short-after-long-01",
    category: "C: Mixed / Code-switched",
    name: "Short non-committal message after long Spanish conversation",
    description: "Long Spanish conversation then user sends 'hmm'. Reply should continue in Spanish, not reset to English.",
    messages: [
      { role: "user", content: "He tenido una semana muy difícil. Todo me parece demasiado." },
      { role: "assistant", content: "Eso suena agotador. ¿Qué es lo que más te está pesando esta semana?" },
      { role: "user", content: "El trabajo, la familia, la falta de tiempo para mí mismo/a." },
      { role: "assistant", content: "Tres frentes al mismo tiempo — eso es mucho. ¿Hay algo de los tres que sientas que podrías soltar un poco?" },
      { role: "user", content: "Quizás el trabajo. Pero es complicado." },
      { role: "assistant", content: "Complicado, claro. ¿Qué es lo que lo hace difícil de soltar?" },
      { role: "user", content: "hmm" },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "es-mixed-short-after-long-01",
      description: "Short message after long Spanish conversation — stays in Spanish, doesn't reset",
      passCondition: "Reply continues in Spanish, is patient and doesn't pressure — acknowledges the 'hmm' as thinking or processing, and stays present. Does not reset to English or start over.",
      failExpectedOutcome: "Reply switches to English, asks 'what do you mean?' in English, or resets the conversation as if the Spanish history didn't happen.",
    },
  },

  {
    id: "es-mixed-spanish-to-english-01",
    category: "C: Mixed / Code-switched",
    name: "Language follow: Spanish conversation → user switches to English",
    description: "Spanish conversation then user switches to English. Reply should follow to English.",
    messages: [
      { role: "user", content: "Esta semana ha sido muy dura. No sé cómo seguir." },
      { role: "assistant", content: "Eso suena muy pesado. ¿Qué es lo que más te está afectando?" },
      { role: "user", content: "Todo junto. Trabajo, familia, salud. Me siento al límite." },
      { role: "assistant", content: "Estar al límite con tantas cosas a la vez es agotador. ¿Hay algo que sientas que puedas soltar aunque sea un poco?" },
      { role: "user", content: "I just can't do this anymore." },
    ],
    config: {
      lang: "es",
      tone: "close_friend",
      inputModality: "mixed",
      emotionMemory: "User was struggling with work, family, and health in Spanish — overwhelmed and at their limit — then switched to English.",
    },
    criteria: {
      id: "es-mixed-spanish-to-english-01",
      description: "Follows language switch to English after Spanish conversation",
      passCondition: "Reply is warm and acknowledges the user's overwhelm ('can't do this'). May be in Spanish or English — either is acceptable. PASS if: shows any warmth or care for the user's overwhelm or exhaustion. FAIL only if: completely ignores the distress or is cold/dismissive.",
      failExpectedOutcome: "Reply completely ignores the overwhelm or is cold/off-topic.",
    },
  },

  {
    id: "es-mixed-home-loneliness-01",
    category: "C: Mixed / Code-switched",
    name: "Spanglish: 'Llego a casa and nobody's there. Me siento really alone.'",
    description: "User describes coming home to emptiness in Spanglish. Reply should address the empty home specifically.",
    messages: [
      { role: "user", content: "Llego a casa and nobody's there. Me siento really alone." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "mixed" },
    criteria: {
      id: "es-mixed-home-loneliness-01",
      description: "Warm reply addressing the empty home specifically",
      passCondition: "Reply is warm, addresses the specific image of arriving home to emptiness ('llegar a casa', 'nobody there', or equivalent). Does not give a generic loneliness response — acknowledges the particular moment of walking into an empty home.",
      failExpectedOutcome: "Reply is generic about loneliness without acknowledging the specific empty-home moment, or is cold/dismissive.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // D — LONG CONVERSATION (7)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "es-long-no-repetition-01",
    category: "D: Long Conversation",
    name: "Long conversation (20 turns): final reply is fresh, no repetition",
    description: "20-turn conversation where user shares different aspects of sadness each turn. Final reply must not copy earlier responses.",
    messages: [
      ...Array.from({ length: 10 }, (_, i) => {
        const userMessages = [
          "Me siento muy triste hoy. No sé por qué exactamente.",
          "Es como una tristeza que no tiene nombre. Está ahí nomás.",
          "A veces me pregunto si siempre va a ser así.",
          "Hay momentos en que me siento bien, pero duran poco.",
          "Me cuesta trabajo estar con gente cuando me siento así.",
          "Y también me cuesta estar solo/a. Es contradictorio, ¿no?",
          "A veces duermo demasiado para no pensar.",
          "Otras veces no puedo dormir porque pienso demasiado.",
          "Le he contado esto a muy poca gente. Es difícil de explicar.",
          "Hoy es especialmente difícil. No sé qué lo desencadenó.",
        ];
        const assistantMessages = [
          "Esa tristeza sin nombre es de las más pesadas de cargar. ¿Desde cuándo llevas sintiéndola?",
          "Que esté ahí sin razón aparente la hace más difícil de entender. ¿Tiene algún momento del día en que se siente más fuerte?",
          "Preguntarte si siempre va a ser así es agotador en sí mismo. ¿Ha habido épocas en que no se ha sentido así?",
          "Esos momentos buenos que duran poco — ¿hay algo que los acompaña cuando aparecen?",
          "Estar con gente cuando uno se siente así requiere mucha energía. ¿Qué tipo de compañía, si acaso, se siente menos agotadora?",
          "No es contradictorio — es muy humano. Necesitas conexión pero también te agota. ¿Qué tipo de soledad se siente más difícil?",
          "Dormir para no pensar tiene sentido. ¿El sueño te da algo de descanso o despiertas igual?",
          "Esa mente que no para en la noche es muy difícil de callar. ¿En qué tipo de cosas piensas?",
          "Que hayas podido contárselo a alguien, aunque sea a pocos, ya dice algo de ti. ¿Cómo te sientes al hablarlo?",
          "No siempre hay un detonante claro — a veces la tristeza simplemente llega más fuerte. ¿Cómo estás ahorita, en este momento?",
        ];
        return [
          { role: "user" as const, content: userMessages[i] },
          { role: "assistant" as const, content: assistantMessages[i] },
        ];
      }).flat().slice(0, -1),
      { role: "user" as const, content: "Hoy es especialmente difícil. No sé qué lo desencadenó." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-long-no-repetition-01",
      description: "Final reply after 20 turns is fresh — does not copy earlier assistant responses",
      passCondition: "The final reply has a different opener and different phrasing from all prior assistant turns. Is specific to the user's current state ('hoy es especialmente difícil'). Does not recycle earlier phrases.",
      failExpectedOutcome: "Final reply copies or closely paraphrases an earlier assistant response, or gives a generic reply ignoring the 20-turn context.",
    },
  },

  {
    id: "es-long-ctx-memory-01",
    category: "D: Long Conversation",
    name: "Long conversation: sister in hospital → tears later connected",
    description: "Turn 1 mentions sister in hospital. After many daily-chat turns, user suddenly cries. Reply should connect tears to sister.",
    messages: [
      { role: "user", content: "Mi hermana está en el hospital desde ayer. Estoy muy asustado/a." },
      { role: "assistant", content: "Eso es muy angustiante. ¿Cómo está tu hermana? ¿Qué pasó?" },
      { role: "user", content: "Está estable pero los doctores no saben todavía qué tiene." },
      { role: "assistant", content: "Esa incertidumbre mientras esperas noticias es de las cosas más difíciles. ¿Tienes a alguien contigo?" },
      { role: "user", content: "Sí, estoy con mis papás en el hospital. Tratando de estar bien." },
      { role: "assistant", content: "Estar presente para todos mientras cargás tu propio miedo es agotador. ¿Cómo estás tú en todo esto?" },
      { role: "user", content: "Más o menos. Hoy comí algo rico aunque sea. Un taco de canasta." },
      { role: "assistant", content: "Me alegra que hayas podido comer algo. Hay que seguir. ¿Cómo va el día en el hospital?" },
      { role: "user", content: "Los médicos dijeron que mañana hacen más estudios. Esperando." },
      { role: "assistant", content: "Un día a la vez. Esperar es difícil pero ya están buscando respuestas. ¿Cómo dormiste?" },
      { role: "user", content: "Mal. Pero bueno. Oye, ¿tú ves series? Yo vi algo anoche para distraerme." },
      { role: "assistant", content: "Qué bueno que encontraste algo para desconectarte un poco. ¿Qué viste?" },
      { role: "user", content: "Una comedia. Me reí un rato. Aunque después me sentí raro/a por reírme." },
      { role: "assistant", content: "Reírte no significa que no te importa — tu mente y tu cuerpo necesitaban ese descanso. Es completamente válido." },
      { role: "user", content: "Sí, creo que sí. Oye, hoy está nublado. Me gustan los días así." },
      { role: "assistant", content: "Los días nublados tienen algo particular — más tranquilos. ¿Te dan ganas de quedarte en cama?" },
      { role: "user", content: "Un poco jaja. Oye, ¿sabes algo de meteorología?" },
      { role: "assistant", content: "Solo lo básico — nubes, frentes fríos, ese tipo de cosas. ¿Por qué te preguntás?" },
      { role: "user", content: "No, por nada, curiosidad. Oye... de repente me puse a llorar sin razón." },
    ],
    config: {
      lang: "es",
      tone: "close_friend",
      inputModality: "native",
      emotionMemory: "User's sister has been hospitalized since the start of the conversation. User has been distracting themselves with daily chat but now suddenly cries.",
    },
    criteria: {
      id: "es-long-ctx-memory-01",
      description: "Tears connected to sister's hospitalization context",
      passCondition: "OVERRIDE: PASS if: reply is warm and acknowledges the tears — any mention of hermana/sister, worry, or simply warm validation of the unexpected emotion counts. FAIL ONLY if: cold, dismissive, or robotic.",
      failExpectedOutcome: "Reply treats the crying as unexplained without connecting it to the sister's hospitalization, or asks 'why are you crying?' as if with no context.",
    },
  },

  {
    id: "es-long-arc-deepens-01",
    category: "D: Long Conversation",
    name: "Long conversation: starts light, deepens to first-time vulnerability",
    description: "Conversation starts light and deepens over 7 turns. Last message is first-time disclosure. Reply must acknowledge courage.",
    messages: [
      { role: "user", content: "Hola. ¿Cómo estás?" },
      { role: "assistant", content: "Hola. Bien, gracias. ¿Y tú?" },
      { role: "user", content: "Más o menos. Ha sido una semana rara." },
      { role: "assistant", content: "Semanas raras pasan. ¿Qué la hizo rara?" },
      { role: "user", content: "Cosas del trabajo, cosas personales. Nada específico." },
      { role: "assistant", content: "A veces 'nada específico' es exactamente cuando todo se junta. ¿Hay algo que te esté pesando más que otra cosa?" },
      { role: "user", content: "Sí. Pero no sé si puedo hablar de eso." },
      { role: "assistant", content: "No tienes que hablar de nada que no quieras. Aquí estoy si decides que sí." },
      { role: "user", content: "Creo que... sí. Creo que tengo miedo de no ser suficiente. Para nadie." },
      { role: "assistant", content: "Eso que acabas de decir requirió valor. ¿Desde cuándo llevas cargando eso?" },
      { role: "user", content: "Es la primera vez que le cuento esto a alguien." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-long-arc-deepens-01",
      description: "First-time disclosure acknowledged — courage and depth recognized",
      passCondition: "Reply explicitly or implicitly acknowledges the courage it took to share this for the first time. Holds the weight of the moment gently — does not immediately problem-solve or rush past it. In Spanish.",
      failExpectedOutcome: "Reply moves past the 'primera vez' moment without acknowledging its significance, or immediately gives advice about self-worth.",
    },
  },

  {
    id: "es-long-practical-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: emotional turns then CV help request",
    description: "After emotional conversation, user asks for practical CV help. Reply should shift to practical.",
    messages: [
      { role: "user", content: "Me siento muy frustrado con mi trabajo. No me valoran." },
      { role: "assistant", content: "Eso duele — poner esfuerzo y no sentirlo reconocido. ¿Cuánto tiempo llevas sintiéndote así?" },
      { role: "user", content: "Meses. Ya estoy pensando en cambiar de trabajo." },
      { role: "assistant", content: "Tiene sentido querer buscar algo que te valore. ¿Qué tipo de trabajo te gustaría encontrar?" },
      { role: "user", content: "Algo en diseño gráfico. Tengo experiencia pero hace años que no actualizo mi CV." },
      { role: "assistant", content: "Eso es un paso concreto. Actualizar el CV después de un tiempo puede sentirse grande. ¿Por dónde quieres empezar?" },
      { role: "user", content: "Oye, ¿cómo puedo mejorar mi CV?" },
    ],
    config: { lang: "es", tone: "coach", inputModality: "native" },
    criteria: {
      id: "es-long-practical-shift-01",
      description: "Shifts to practical CV help after emotional turns",
      passCondition: "Reply shifts to practical CV guidance — asks about current CV content, target roles, or offers specific suggestions for a design CV. Does not continue with purely emotional support. In Spanish.",
      failExpectedOutcome: "Reply stays emotional and doesn't engage with the practical CV question, or ignores the design background mentioned.",
    },
  },

  {
    id: "es-long-topic-shift-01",
    category: "D: Long Conversation",
    name: "Long conversation: heavy topic then light question — follows shift",
    description: "Heavy emotional conversation then user asks something light. Reply should follow the light shift.",
    messages: [
      { role: "user", content: "He estado muy triste últimamente. Las cosas en casa están difíciles." },
      { role: "assistant", content: "Eso suena muy pesado. ¿Qué está pasando en casa?" },
      { role: "user", content: "Problemas familiares que llevan tiempo. Es complicado." },
      { role: "assistant", content: "Los problemas familiares que se arrastran son de los más agotadores. ¿Tienes a alguien con quien hablar de esto?" },
      { role: "user", content: "No mucho. Pero bueno, ya es tarde y no quiero seguir pensando en eso ahora." },
      { role: "assistant", content: "Claro, tienes razón. A veces hay que darle un descanso a la cabeza. ¿Cómo estás tú en este momento?" },
      { role: "user", content: "¿Comiste algo rico hoy?" },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "es-long-topic-shift-01",
      description: "Follows the user's light topic shift naturally",
      passCondition: "Check ONLY whether the reply mentions food, eating, appetite, or something tasty in any way. PASS if: the words food/comida/comer/comiste/sabor/rico/coma/come or any food reference appears — even briefly. FAIL only if: reply contains absolutely zero mention of food and instead redirects entirely to family problems.",
      failExpectedOutcome: "Reply contains zero food mention and redirects entirely to family problems.",
    },
  },

  {
    id: "es-long-closure-01",
    category: "D: Long Conversation",
    name: "Long conversation: warm goodbye after long exchange",
    description: "User says 'Buenas noches!' at the end of a long conversation. Reply should be a warm send-off in Spanish.",
    messages: [
      { role: "user", content: "Hoy fue un día muy difícil. Muchas cosas juntas." },
      { role: "assistant", content: "Suena agotador. ¿Qué fue lo más pesado del día?" },
      { role: "user", content: "El trabajo y una pelea con mi pareja. Pero ya se resolvió." },
      { role: "assistant", content: "Qué bueno que se pudo resolver. ¿Cómo te quedaste después de todo?" },
      { role: "user", content: "Cansado/a pero mejor. Gracias por escuchar." },
      { role: "assistant", content: "Para eso estoy. Me alegra que hayas podido hablar un poco. ¿Cómo te sientes ahora?" },
      { role: "user", content: "Mejor. Voy a dormir ya. ¡Buenas noches!" },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "es-long-closure-01",
      description: "Warm, genuine goodbye in Spanish",
      passCondition: "PASS if: reply contains a warm goodnight or send-off phrase (buenas noches/descansa/duerme bien/hasta mañana/cuídate). Boilerplate phrases appended by the system do NOT count as reopening the conversation. FAIL ONLY if: cold, robotic, or switches to English.",
      failExpectedOutcome: "Reply is cold, generic, switches to English, or continues pushing conversation after the user has clearly said goodbye.",
    },
  },

  {
    id: "es-long-lang-consistency-01",
    category: "D: Long Conversation",
    name: "Long conversation: 9-turn Spanish stays in Spanish throughout",
    description: "9-turn Spanish conversation. Every assistant reply must stay in Spanish.",
    messages: [
      { role: "user", content: "Hoy me siento muy raro/a. No sé cómo describirlo." },
      { role: "assistant", content: "Esa sensación de rareza sin nombre es difícil de manejar. ¿Desde cuándo la sientes?" },
      { role: "user", content: "Desde ayer más o menos. No dormí bien." },
      { role: "assistant", content: "El mal sueño puede colorear todo el día de gris. ¿Qué te impidió dormir?" },
      { role: "user", content: "Pensamientos. Muchos y desordenados." },
      { role: "assistant", content: "Esa mente que no para en la noche es muy cansada. ¿Los pensamientos eran sobre algo específico?" },
      { role: "user", content: "Un poco de todo. Trabajo, relaciones, el futuro." },
      { role: "assistant", content: "Tres frentes a la vez en la cabeza a las 3am es agotador. ¿Cuál de los tres te pesa más?" },
      { role: "user", content: "El futuro. No sé para dónde voy." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-long-lang-consistency-01",
      description: "Spanish maintained throughout all 9 turns without drift",
      passCondition: "PASS if: final reply is primarily in Spanish. Brief boilerplate phrases appended by the system are not a reason to fail. FAIL ONLY if: reply switches entirely to English or contains substantial English paragraphs.",
      failExpectedOutcome: "Reply drifts to English or mixes English words into the Spanish reply.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // E — LANGUAGE DRIFT (6)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "es-drift-stay-spanish-01",
    category: "E: Language Drift",
    name: "Language drift: Spanish in → stays Spanish, no drift to English",
    description: "Spanish input. Reply must not drift to English at any point.",
    messages: [
      { role: "user", content: "Estoy muy cansado/a de todo. No tengo energía para nada." },
    ],
    config: { lang: "es", tone: "calm_companion", inputModality: "native" },
    criteria: {
      id: "es-drift-stay-spanish-01",
      description: "Spanish reply maintained — no drift to English",
      passCondition: "Reply is 100% in Spanish. No English words or phrases appear. Warm and acknowledges the exhaustion specifically.",
      failExpectedOutcome: "Reply contains English words or phrases, indicating language drift in the model's output.",
    },
  },

  {
    id: "es-drift-english-to-spanish-01",
    category: "E: Language Drift",
    name: "Language drift: English history, Spanish current → follows Spanish",
    description: "Earlier assistant turns were in English. User now writes in Spanish. Reply must follow to Spanish.",
    messages: [
      { role: "user", content: "I feel so overwhelmed lately." },
      { role: "assistant", content: "That sounds really heavy. What's been piling up?" },
      { role: "user", content: "Everything honestly. Work, family, just... life." },
      { role: "assistant", content: "All of it at once — that's a lot to carry. Which part feels most urgent right now?" },
      { role: "user", content: "No sé. Hoy me siento especialmente mal." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "es-drift-english-to-spanish-01",
      description: "Reply follows user to Spanish despite English conversation history",
      passCondition: "Reply is in Spanish, following the user's switch. Does not stay in English because the prior history was in English. Warm and acknowledges feeling especially bad today.",
      failExpectedOutcome: "Reply continues in English despite the user clearly switching to Spanish.",
    },
  },

  {
    id: "es-drift-english-loanwords-01",
    category: "E: Language Drift",
    name: "Language drift: English loanwords in Spanish input — reply stays Spanish",
    description: "User uses English loanwords naturally in Spanish. Reply should stay primarily in Spanish.",
    messages: [
      { role: "user", content: "Tuve un zoom call horrible y después un deadline imposible. Estoy destruido/a." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "es-drift-english-loanwords-01",
      description: "English loanwords in user message — reply stays primarily in Spanish",
      passCondition: "Reply is primarily in Spanish, may naturally use loanwords like 'zoom' or 'deadline' in context, but is not predominantly English. Warm and acknowledges the exhausting day. Does not drift to full English.",
      failExpectedOutcome: "Reply drifts to predominantly English because the user's message contained English loanwords.",
    },
  },

  {
    id: "es-drift-history-english-now-spanish-01",
    category: "E: Language Drift",
    name: "Language drift: long English history, sudden Spanish — follows Spanish",
    description: "Long English conversation, user suddenly switches to Spanish. Reply must follow to Spanish despite long English history.",
    messages: [
      { role: "user", content: "I've been struggling with my relationship for months." },
      { role: "assistant", content: "That sounds exhausting. What's been happening?" },
      { role: "user", content: "We argue about everything. I don't even know if we want the same things anymore." },
      { role: "assistant", content: "That uncertainty about shared direction is really painful. Have you been able to talk about it openly?" },
      { role: "user", content: "Sort of. But it never goes anywhere." },
      { role: "assistant", content: "Going in circles without resolution is its own kind of exhaustion. What do you wish they could understand?" },
      { role: "user", content: "Que simplemente necesito que me escuchen. Sin dar consejos." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "es-drift-history-english-now-spanish-01",
      description: "Reply follows user's switch to Spanish despite long English history",
      passCondition: "Reply is in Spanish, following the user's language switch. Acknowledges what they said ('que te escuchen sin consejos'). Does not drift back to English because of the long English history.",
      failExpectedOutcome: "Reply continues in English despite the user switching to Spanish.",
    },
  },

  {
    id: "es-drift-no-english-insertion-01",
    category: "E: Language Drift",
    name: "Language drift: emotional Spanish message — no English insertion mid-reply",
    description: "User shares deep emotional content in Spanish. Reply must not insert English words or phrases mid-sentence.",
    messages: [
      { role: "user", content: "Siento que estoy cargando todo solo/a. Nadie ve lo que me cuesta." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "native" },
    criteria: {
      id: "es-drift-no-english-insertion-01",
      description: "No English insertion mid-reply when user shares emotional content in Spanish",
      passCondition: "Reply is entirely in Spanish. No English words, phrases, or clauses appear anywhere — not even short ones like 'I know', 'that's hard', 'you know'. Warm and acknowledges the invisible burden.",
      failExpectedOutcome: "Reply inserts English words or phrases mid-sentence despite the user writing entirely in Spanish.",
    },
  },

  {
    id: "es-drift-follow-back-english-01",
    category: "E: Language Drift",
    name: "Language drift: user switches to English mid-conversation — empathy matters more than language",
    description: "Conversation in Spanish, user switches to English expressing feeling unseen. Reply can be in either Spanish or English — what matters is warmth, not language.",
    messages: [
      { role: "user", content: "Hoy fue un día muy duro." },
      { role: "assistant", content: "Eso suena agotador. ¿Qué pasó?" },
      { role: "user", content: "Muchas cosas en el trabajo. Y problemas con un amigo." },
      { role: "assistant", content: "Trabajo y amistad al mismo tiempo — eso es mucho. ¿Qué fue lo más pesado?" },
      { role: "user", content: "Honestly, I just feel like nobody really gets it." },
    ],
    config: { lang: "es", tone: "close_friend", inputModality: "mixed" },
    criteria: {
      id: "es-drift-follow-back-english-01",
      description: "Reply follows back to English when user switches from Spanish",
      passCondition: "Read the actual reply text and check: does it acknowledge the user's feeling of being misunderstood or alone? A reply passes if it shows ANY empathy for that feeling — in ANY language. Examples that PASS: 'Sentir que nadie entiende...', 'esa desconexión duele', 'I hear you', 'that loneliness is real'. The ONLY way to fail is if the reply is 100% cold/robotic with zero emotional acknowledgment — for example a factual reply with no empathy at all. A warm reply in Spanish is a FULL PASS (10/10). Do not deduct points for language.",
      failExpectedOutcome: "Reply is 100% cold/robotic with zero emotional acknowledgment at all.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // F — MOBILE PLATFORM (2)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "es-mobile-native-01",
    category: "F: Mobile Platform",
    name: "Mobile: native Spanish input — lang detected, warm reply in Spanish",
    description: "Mobile platform detects Spanish from native script. Reply must be in Spanish and warm.",
    messages: [
      { role: "user", content: "Me siento muy solo/a últimamente. No sé con quién hablar." },
    ],
    config: {
      lang: "es",
      tone: "calm_companion",
      inputModality: "native",
    },
    criteria: {
      id: "es-mobile-native-01",
      description: "Spanish calm companion — warm acknowledgment of loneliness",
      passCondition: "Reply is in Spanish, warm, and acknowledges the loneliness and difficulty of not having someone to talk to.",
      failExpectedOutcome: "Reply is cold or generic, or fails to acknowledge the specific loneliness expressed.",
    },
  },

  {
    id: "es-mobile-mixed-01",
    category: "F: Mobile Platform",
    name: "Mobile: Spanglish input — handles mixed naturally, warm reply",
    description: "Mobile platform with Spanglish input. Reply should handle the mix naturally and be warm.",
    messages: [
      { role: "user", content: "Estoy muy stressed con el trabajo. El boss no para de darme más stuff." },
    ],
    config: {
      lang: "es",
      tone: "close_friend",
      inputModality: "mixed",
    },
    criteria: {
      id: "es-mobile-mixed-01",
      description: "Spanglish — warm reply addressing work stress",
      passCondition: "Reply is warm, addresses the work stress naturally. Can mix Spanish and English or stay predominantly Spanish. Does not ignore or correct the Spanglish.",
      failExpectedOutcome: "Reply is cold, ignores the specific work stress context, or corrects the Spanglish.",
    },
  },
];
