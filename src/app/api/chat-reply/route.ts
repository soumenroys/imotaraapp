// src/app/api/chat-reply/route.ts
//
// Server endpoint to generate a single Imotara chat reply using the
// shared AI client (callImotaraAI). This is used by the Chat page
// to optionally upgrade the local/fallback reply templates.
//
// Request shape (current):
//   POST { messages: { role: "user" | "assistant" | "system"; content: string }[], emotion?: string }
//
// Extra compatibility (safe additions):
//   Also accepts POST { text: string } or { message: string } and converts to messages[].
//
// Response shape:
//   Same as ImotaraAIResponse from aiClient: { text, meta }

import { NextResponse } from "next/server";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import type { ImotaraAIResponse } from "@/lib/imotara/aiClient";
import { formatImotaraReply } from "@/lib/imotara/response/responseFormatter";

import {
  getSupabaseAdmin,
  getSupabaseUserServerClient,
} from "@/lib/supabaseServer";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";

type ChatReplyRequest = {
  user?: { id?: string; name?: string };
  // ✅ Privacy guard: when false, server will not read user_memory
  allowMemory?: boolean;

  // ✅ Companion tone + language (safe additions; backward compatible)
  // tone defaults to "close_friend" in formatter if not provided
  tone?: "close_friend" | "calm_companion" | "coach" | "mentor";
  lang?: string; // e.g. "en", "hi", "bn", "ta" ... (accepts "en-IN" etc.)

  // ✅ Age context (guides register/vocabulary without claiming to be human)
  userAge?: string;      // e.g. "13_17", "25_34", "65_plus"
  companionAge?: string; // age range of the companion persona

  // ✅ Gender context (verb conjugation and grammatical agreement in gendered languages)
  userGender?: "female" | "male" | "nonbinary" | "prefer_not" | "other";
  companionGender?: "female" | "male" | "nonbinary" | "prefer_not" | "other";

  messages?: {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  emotion?: string;

  // ✅ Long-term emotional memory summary (client-side localStorage → injected by runRespondWithConsent)
  emotionMemory?: string;

  // compat: some callers may send a single text field
  text?: string;
  message?: string;
};

// keep context + prompt modest
const MAX_TURNS = 8;
const MAX_CHARS = 4000;

// Keywords that signal emotional distress across all 21 languages Imotara supports.
// Structure:
//   \b(…)\b  — Latin-script terms: English + German + French + Spanish + Portuguese + Indonesian
//              + romanised Indic transliterations (hi/bn/mr/ta/te/gu/pa/kn/ml/or/ur)
//   |…        — Non-Latin scripts (naturally space-delimited; no \b needed):
//              Devanagari (hi/mr) · Bengali (bn) · Gurmukhi (pa) · Gujarati (gu)
//              Tamil (ta) · Telugu (te) · Kannada (kn) · Malayalam (ml) · Odia (or)
//              Arabic script (ar/ur) · Chinese (zh) · Japanese (ja) · Hebrew (he) · Cyrillic (ru)
const EMOTIONAL_SIGNAL_RE =
  /\b(sad|anxious|anxiety|stress(?:ed|ful)?|overwhelm(?:ed|ing)?|depressed|depression|lonely|exhaust(?:ed|ing)?|drained|frustrated|angry|upset|hurt|scared|fearful?|worried|worry|hopeless|empty|numb|cry(?:ing)?|lost|stuck|panic(?:ked|king)?|brok(?:en|e)|heavy|grief|grieve|grieving|tired|burnt?\s*out|traurig|ängstlich|einsam|erschöpft|hoffnungslos|wütend|Angst|triste|ansioso|ansiosa|sola|miedo|enojado|enojada|agotado|agotada|llorar|dolor|desesperado|desesperada|estrés|preocupado|preocupada|anxieux|anxieuse|seule|peur|épuisé|épuisée|désespéré|désespérée|sedih|cemas|kesepian|takut|marah|lelah|menangis|putus\s+asa|udaas|pareshan|ghabrana|akela|thaka|gussa|dard|rona|khauf|takleef|dukhi|nirash|kosto|bhoy|klanto|raag|kanna|hotash|kashtam|thanimai|payam|kopam|sorvu|kavalai|baadha|bhayam|ontariga|alasata|ikalla|ekutia)\b|दुखी|उदास|परेशान|चिंता|थका|थकान|डर|अकेला|टूटा|निराश|गुस्सा|घबराहट|रोना|दर्द|खोया|दुःख|त्रास|एकटा|काळजी|रडणे|भीती|दुखावलेलो|ਦੁੱਖ|ਡਰ|ਇਕੱਲਾ|ਥਕਾਵਟ|ਗੁੱਸਾ|ਰੋਣਾ|ਚਿੰਤਾ|દુઃખ|ચિંતા|ભય|એકલો|ગુસ્સો|થાક|રડવું|નિરાશ|দুঃখী|কষ্ট|একা|ভয়|চিন্তা|ক্লান্ত|রাগ|কান্না|হতাশ|ব্যথা|கஷ்டம்|தனிமை|பயம்|கோபம்|சோர்வு|கவலை|బాధ|భయం|ఒంటరిగా|అలసట|కోపం|ఆందోళన|ನೋವು|ಭಯ|ಒಂಟಿ|ಸುಸ್ತು|ಕೋಪ|ಅಳು|ಚಿಂತೆ|ನಿರಾಶ|വേദന|ഭയം|ഒറ്റപ്പെടൽ|ക്ഷീണം|ദേഷ്യം|കരച്ചിൽ|ഉത്കണ്ഠ|നിരാശ|ଦୁଃଖ|ଭୟ|ଏକୁଟିଆ|ଥକା|ଚିନ୍ତା|حزين|قلق|خائف|وحيد|غاضب|مرهق|ألم|يأس|ضغط|متعب|难过|焦虑|孤独|害怕|愤怒|疲惫|哭泣|痛苦|绝望|压力|伤心|悲しい|不安|怖い|怒り|疲れた|泣く|痛み|絶望|ストレス|עצוב|חרדה|בודד|פחד|כועס|עייף|בוכה|כאב|ייאוש|לחץ|грустн|тревог|одинок|страх|злой|устал|плакать|боль|отчаян|стресс/iu;

type EmotionalArcResult = {
  depth: "light" | "moderate" | "deep";
  emotionalTurnCount: number;
  userTurnCount: number;
};

function detectEmotionalArc(
  messages: { role: string; content: string }[],
): EmotionalArcResult {
  const userMsgs = messages.filter((m) => m.role === "user");
  const emotionalTurns = userMsgs.filter((m) =>
    EMOTIONAL_SIGNAL_RE.test(m.content),
  );
  const userTurnCount = userMsgs.length;
  const emotionalTurnCount = emotionalTurns.length;

  if (
    emotionalTurnCount >= 2 ||
    (userTurnCount >= 4 && emotionalTurnCount >= 1)
  ) {
    return { depth: "deep", emotionalTurnCount, userTurnCount };
  }
  if (emotionalTurnCount === 1 || userTurnCount >= 3) {
    return { depth: "moderate", emotionalTurnCount, userTurnCount };
  }
  return { depth: "light", emotionalTurnCount, userTurnCount };
}

function isBadPlaceholderText(s: string): boolean {
  const t = (s ?? "").trim();
  if (!t) return true;

  // The exact string you reported + common variants
  return (
    t.includes("soft, placeholder reply") ||
    t.includes("I tried to connect to Imotara's AI engine") ||
    t.includes("but something went wrong")
  );
}

export async function GET() {
  // Friendly response so opening in browser doesn't show 405
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/chat-reply",
      methods: ["GET", "POST"],
      expects:
        'POST { messages: [{ role: "user", content: "..." }], emotion?: "neutral" }',
      compat: 'Also accepts POST { text: "..." } or { message: "..." }',
    },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  try {
    console.log("[imotara][chat-reply] POST hit");
    const body = (await req.json()) as ChatReplyRequest | null;

    // ── Mythology repetition prevention ────────────────────────────────────────
    // Scan assistant messages for mythology references already used this session.
    // Build a deduplicated list and inject it into the system prompt so the LLM
    // avoids repeating the same story or mythological figure.
    const MYTH_REGEX = /\b(Mahabharata|Ramayana|Bhagavad\s*Gita|Purana|Jataka|Panchatantra|Upanishad|Rumi|Hafez|Sufi|1001\s*Nights|Zhuangzi|Laozi|Journey\s*to\s*the\s*West|Odyssey|Iliad|Baba\s*Yaga|Norse|Slavic|Zen\s*koan|Shinto|Talmudic|Hasidic|Arjuna|Krishna|Draupadi|Yudhishthira|Bhima|Pandava|Kaurava|Karna|Hanuman|Rama|Sita|Vishnu|Shiva|Ganesha|Lakshmi|Durga|Saraswati|Indra|Agni|Varuna|Narada|Garuda|Brahma|Dhruva|Prahlad|Savitri|Nachiketa|Milarepa|Bodhidharma|Confucius|Laozi|Zhuangzi|Sun\s*Wukong|Achilles|Odysseus|Hercules|Prometheus|Sisyphus|Orpheus|Penelope|Athena|Apollo|Hermes|Zeus|Persephone|Perseus|Theseus|Odin|Thor|Freya|Loki|Fenrir)\b/gi;
    const allMessages = Array.isArray(body?.messages) ? body!.messages : [];
    const assistantTexts = allMessages
        .filter((m) => m?.role === "assistant" && typeof m.content === "string")
        .map((m) => m.content as string);
    const usedMyths = new Set<string>();
    for (const text of assistantTexts) {
        const matches = text.matchAll(MYTH_REGEX);
        for (const m of matches) usedMyths.add(m[0]);
    }
    const uniqueMyths = [...usedMyths];

    // Allow single-text payloads without breaking existing behaviour
    let rawMessages = Array.isArray(body?.messages) ? body!.messages : [];

    if (!rawMessages.length) {
      const single =
        (typeof body?.text === "string" ? body.text : "") ||
        (typeof body?.message === "string" ? body.message : "");
      const cleaned = single.trim();
      if (cleaned) {
        rawMessages = [{ role: "user", content: cleaned }];
      }
    }

    // Keep only last few turns for context, and ensure valid shapes
    const recent = rawMessages
      .filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          m.content.trim().length > 0 &&
          (m.role === "user" || m.role === "assistant" || m.role === "system"),
      )
      .slice(-MAX_TURNS);

    const emotion = (body?.emotion || "").toLowerCase().trim();

    // Detect emotional depth across conversation turns
    const arc = detectEmotionalArc(recent);

    // ✅ Conversation state signal: detect "pause / goodbye / brb" so we don't reopen the topic.
    const lastUserMsg =
      [...recent]
        .reverse()
        .find((m) => m.role === "user")
        ?.content?.trim() ?? "";

    // Normalize message for detection
    const normalizedMsg = lastUserMsg
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    const isClosureIntent =
      normalizedMsg.length > 0 &&
      (// English
        normalizedMsg.includes("talk later") ||
        normalizedMsg.includes("chat later") ||
        normalizedMsg.includes("see you") ||
        normalizedMsg.includes("bye") ||
        normalizedMsg.includes("good night") ||
        normalizedMsg.includes("gn") ||
        normalizedMsg.includes("brb") ||
        normalizedMsg.includes("ttyl") ||
        normalizedMsg.includes("catch you") ||
        normalizedMsg.includes("going for a walk") ||
        normalizedMsg.includes("going out") ||
        normalizedMsg.includes("will talk later") ||
        // Hindi / Roman Indic
        normalizedMsg.includes("kal milte") ||
        normalizedMsg.includes("baad mein baat") ||
        normalizedMsg.includes("shubh ratri") ||
        normalizedMsg.includes("jaata hoon") ||
        normalizedMsg.includes("jaati hoon") ||
        normalizedMsg.includes("alvida") ||
        normalizedMsg.includes("phir milenge") ||
        normalizedMsg.includes("chalte hain") ||
        // Bengali Roman
        normalizedMsg.includes("pore kotha") ||
        normalizedMsg.includes("shubho ratri") ||
        normalizedMsg.includes("kal bolbo") ||
        // Tamil Roman
        normalizedMsg.includes("appuram pesalam") ||
        normalizedMsg.includes("poga poren") ||
        normalizedMsg.includes("innaikku poren") ||
        // Spanish
        normalizedMsg.includes("hasta luego") ||
        normalizedMsg.includes("hasta pronto") ||
        normalizedMsg.includes("buenas noches") ||
        normalizedMsg.includes("me voy") ||
        normalizedMsg.includes("nos vemos") ||
        // French
        normalizedMsg.includes("bonne nuit") ||
        normalizedMsg.includes("a bientot") ||
        normalizedMsg.includes("a plus") ||
        normalizedMsg.includes("je m en vais") ||
        normalizedMsg.includes("on se parle") ||
        // Portuguese
        normalizedMsg.includes("ate logo") ||
        normalizedMsg.includes("ate mais") ||
        normalizedMsg.includes("boa noite") ||
        normalizedMsg.includes("vou indo") ||
        // Indonesian
        normalizedMsg.includes("sampai jumpa") ||
        normalizedMsg.includes("selamat malam") ||
        normalizedMsg.includes("nanti ya") ||
        normalizedMsg.includes("dah dulu") ||
        normalizedMsg.includes("pamit dulu") ||
        // Arabic / Urdu script (raw message — normalizedMsg strips non-letter chars)
        lastUserMsg.includes("إلى اللقاء") ||
        lastUserMsg.includes("وداعاً") ||
        lastUserMsg.includes("مع السلامة") ||
        lastUserMsg.includes("تصبح على خير") ||
        lastUserMsg.includes("خداحافظ") ||     // Urdu goodbye
        lastUserMsg.includes("اللہ حافظ") ||   // Urdu Allah hafiz
        // Chinese
        lastUserMsg.includes("再见") ||
        lastUserMsg.includes("晚安") ||
        lastUserMsg.includes("先这样") ||
        lastUserMsg.includes("待会见") ||
        lastUserMsg.includes("回头见") ||
        // Russian
        normalizedMsg.includes("do svidaniya") ||
        normalizedMsg.includes("poka") ||
        lastUserMsg.includes("до свидания") ||
        lastUserMsg.includes("пока") ||
        lastUserMsg.includes("спокойной ночи") ||
        lastUserMsg.includes("увидимся") ||
        // Japanese
        lastUserMsg.includes("またね") ||
        lastUserMsg.includes("さようなら") ||
        lastUserMsg.includes("おやすみ") ||
        // Hebrew
        lastUserMsg.includes("להתראות") ||
        lastUserMsg.includes("לילה טוב"));

    console.log("[imotara][closure]", {
      lastUserMsg,
      normalizedMsg,
      isClosureIntent,
    });

    const closureHint = isClosureIntent
      ? [
          "STATE: The user is pausing/ending the chat (going for a walk / will talk later).",
          "Your reply must be a gentle send-off: acknowledge + encourage + reassure you'll be here later.",
          "CRITICAL: Do NOT ask ANY question. End the conversation naturally.",
          "Keep it to 1–2 short sentences.",
        ].join("\n")
      : "";

    // ✅ Optional memory: preferred name (spoof-proof)
    // - Identify user via Supabase Auth from cookies (anonymous auth supported)
    // - Use admin client only to read memory rows (bypasses RLS), BUT ONLY for the authenticated user id
    let preferredName = "";
    try {
      const allowMemory = body?.allowMemory !== false; // default true (backward compatible)
      if (allowMemory) {
        const supabaseUser = await getSupabaseUserServerClient();
        const { data } = await supabaseUser.auth.getUser();
        let authedUserId = data?.user?.id ?? "";

        // ✅ In production, if not authenticated, do not read memory
        if (!authedUserId && process.env.NODE_ENV === "production") {
          authedUserId = "";
        }

        if (authedUserId) {
          const supabaseAdmin = getSupabaseAdmin();
          const memories = await fetchUserMemories(
            supabaseAdmin as any,
            authedUserId,
            20,
          );

          const raw = Array.isArray(memories)
            ? (memories.find((m: any) => m?.key === "preferred_name")?.value ??
              "")
            : "";

          preferredName =
            typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
        }
      }
    } catch {
      // no-op: never block chat replies if memory fetch fails
    }

    let conversationText = recent
      .map((m) => {
        const label =
          m.role === "user"
            ? "User"
            : m.role === "assistant"
              ? "Imotara"
              : "System";
        return `${label}: ${m.content}`;
      })
      .join("\n");

    if (conversationText.length > MAX_CHARS) {
      // Keep the most recent part if the text is too long
      conversationText = conversationText.slice(-MAX_CHARS);
    }

    // ✅ Strong continuity: last 3 user turns (most recent last)
    const recentUserTurns = recent
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => String(m.content).trim())
      .filter(Boolean);

    const recentUserBlock = recentUserTurns.length
      ? recentUserTurns.map((t) => `- ${t}`).join("\n")
      : "";

    const emotionHint = emotion
      ? `The user currently seems to be feeling: ${emotion}.\n`
      : "";

    // ── Casual / greeting detection ────────────────────────────────────────────
    // If the latest user message is a simple greeting or casual opener (≤5 words,
    // no emotional keywords), tell the AI to respond lightly — NOT to infer hidden
    // emotion from a one-word "hi". A greeting is not a cry for help.
    const lastUserWordCount = lastUserMsg.trim().split(/\s+/).filter(Boolean).length;
    const isLightCasual =
      lastUserWordCount <= 5 &&
      arc.emotionalTurnCount === 0 &&
      !EMOTIONAL_SIGNAL_RE.test(lastUserMsg);

    const casualChatRule = isLightCasual
      ? [
          "CASUAL CHAT MODE: The user's message is a simple greeting or light opener — NOT an emotional signal.",
          "Respond warmly and conversationally, like a friend saying hello back.",
          "Do NOT read urgency, tension, or emotional significance into a one-word or short casual message.",
          "Do NOT try to 'name the emotion' or 'reference the situation' — there is no situation yet.",
          "Just respond naturally and invite them to share whatever is on their mind, without pressure.",
          "Keep it to 1 sentence. No deep reflections. No mythology. No quotes.",
        ].join("\n")
      : "";

    // Language instruction: tell GPT to mirror the user's current message language.
    // This overrides conversation history so switching from Bengali to Hindi mid-chat works.
    const langInstructionMap: Record<string, string> = {
      hi: "The user is writing in Hindi. Mirror their exact script — if they used Devanagari, respond in Devanagari; if they used Roman/Latin script (Hinglish), respond in Roman Hindi. FORMALITY: Match the user's register — if they write casually (using 'tum', 'yaar', informal words), respond with 'tum' form. Use 'aap' only if they write formally.",
      bn: "The user is writing in Bengali. Mirror their exact script — if they used Bengali script, respond in Bengali script; if they used Roman/Latin script, respond in Roman Bengali. FORMALITY: Default to 'tumi' form for casual Romanized Bengali. Use 'apni/aapnar' only if the user writes formally. CRITICAL: Use only Bengali words — do NOT mix in Hindi words. For example use 'Haa' or 'Hyaan' (Bengali) not 'Hain' (Hindi); use 'Ami' not 'Main'.",
      mr: "The user is writing in Marathi. Mirror their exact script — if they used Devanagari, respond in Devanagari Marathi; if they used Roman script, respond in Roman Marathi.",
      ta: "The user is writing in Tamil. Mirror their exact script — native Tamil script or Roman Tamil as they used.",
      te: "The user is writing in Telugu. Mirror their exact script — native Telugu script or Roman Telugu as they used.",
      gu: "The user is writing in Gujarati. Mirror their exact script — native Gujarati script or Roman Gujarati as they used.",
      kn: "The user is writing in Kannada. Mirror their exact script — native Kannada script or Roman Kannada as they used.",
      ml: "The user is writing in Malayalam. Mirror their exact script — native Malayalam script or Roman Malayalam as they used.",
      pa: "The user is writing in Punjabi. Mirror their exact script — Gurmukhi script or Roman Punjabi as they used.",
      or: "The user is writing in Odia. Mirror their exact script — native Odia script or Roman Odia as they used.",
      ur: "The user is writing in Urdu. Respond in Urdu (Nastaliq script preferred, or Roman Urdu if they wrote in Roman).",
      ar: "The user is writing in Arabic. Respond in Arabic.",
      zh: "The user is writing in Chinese. Respond in Chinese.",
      ja: "The user is writing in Japanese. Respond in Japanese.",
      he: "The user is writing in Hebrew. Respond in Hebrew.",
      de: "The user is writing in German. Respond in German.",
      fr: "The user is writing in French. Respond in French.",
      es: "The user is writing in Spanish. Respond in Spanish.",
      pt: "The user is writing in Portuguese. Respond in Portuguese.",
      ru: "The user is writing in Russian. Respond in Russian.",
      id: "The user is writing in Indonesian. Respond in Indonesian.",
    };
    const resolvedLang = typeof body?.lang === "string" ? body.lang.slice(0, 5).split("-")[0] : "";
    const langInstruction = resolvedLang && resolvedLang !== "en"
      ? (langInstructionMap[resolvedLang] ?? `Respond in the same language as the user's current message (detected: ${resolvedLang}).`)
      : "Match the user's language — if they write in English, respond in English.";

    const nameHint = preferredName
      ? `The user's preferred name is: ${preferredName}.\nUse it naturally (not every line).\n`
      : "";

    // Gender instruction: grammatical agreement, verb conjugation, and honorifics
    const genderLines: string[] = [];
    const ug = body?.userGender;
    const cg = body?.companionGender;
    if (ug && ug !== "prefer_not" && ug !== "other") {
      if (ug === "female") {
        genderLines.push(
          "USER GENDER: female — use feminine second-person verb agreement and adjective agreement in gendered languages: " +
          "Hindi: 'tum theek ho rahi ho', 'sambhal logi', 'kya hua tumhare saath'; " +
          "Bengali: 'tumi ki thik acho'; Tamil/Telugu/Kannada/Malayalam/Odia: 2nd-person is gender-neutral, no change needed; " +
          "Spanish: 'estás cansada', 'estás preocupada', 'qué tal estás'; " +
          "Portuguese: 'estás cansada', 'você está bem', 'como você está'; " +
          "French: 'tu vas bien' (verb unchanged, but adjectives agree: 'tu es courageuse'); " +
          "German: predicate adjectives after 'sein' do not inflect for 2nd-person gender — 'du bist müde' regardless; " +
          "Indonesian: gender-neutral ('kamu', 'Anda') — no change; " +
          "Russian: past-tense 2nd-person agrees with gender — 'ty byla zdes'' (f) vs 'ty byl zdes'' (m), 'ty spravіlas'' (f) vs 'ty spravilsya' (m); " +
          "Arabic: 'kayfa anti'; Hebrew: 'ma shlomech'."
        );
      } else if (ug === "male") {
        genderLines.push(
          "USER GENDER: male — use masculine second-person verb and adjective agreement in gendered languages: " +
          "Hindi: 'tum theek ho', 'sambhal loge'; " +
          "Spanish: 'estás cansado', 'estás preocupado'; " +
          "Portuguese: 'estás cansado', 'você está bem'; " +
          "French: 'tu es courageux'; " +
          "Russian: past-tense 2nd-person masculine — 'ty byl zdes'' (m), 'ty spravilsya' (m); " +
          "German: predicate adjectives after 'sein' do not inflect for 2nd-person gender — 'du bist müde' regardless; " +
          "Indonesian: gender-neutral — no change; " +
          "Arabic: 'kayfa anta'; Hebrew: 'ma shlomcha'."
        );
      } else if (ug === "nonbinary") {
        genderLines.push(
          "USER GENDER: non-binary — use gender-neutral or gender-inclusive forms. " +
          "In Hindi/Indic languages avoid strongly gendered endings where possible; default to neutral phrasing. " +
          "In Spanish/Portuguese use gender-neutral forms where available (e.g. 'estás bien', avoid -o/-a adjective agreement). " +
          "In French prefer neutral constructions. In German predicate adjectives after 'sein' are already uninflected for 2nd person. " +
          "In Russian avoid past-tense forms that reveal gender where possible; rephrase to present/future tense. " +
          "Indonesian is naturally gender-neutral. " +
          "In Arabic/Hebrew use the least gendered form available."
        );
      }
    }
    if (cg && cg !== "prefer_not" && cg !== "other") {
      if (cg === "female") {
        genderLines.push(
          "COMPANION/IMOTARA VOICE GENDER: female — when Imotara speaks in first person in gendered languages, " +
          "use feminine verb and adjective forms: " +
          "Hindi: 'sun rahi hoon', 'samajh gayi', 'yahan hoon'; " +
          "Bengali: 'ami bujhte parchhchi'; Marathi: 'mi aikte aahe'; Gujarati: 'hun sambhalu chhun'; " +
          "Punjabi: 'main sun rahi haan'; Tamil/Telugu/Kannada/Malayalam/Odia: 1st-person verbs are gender-neutral — no change needed; " +
          "Spanish: 'estoy aquí contigo', 'estoy lista', 'estaba preocupada' (feminine -a adjective); " +
          "Portuguese: 'estou aqui', 'estou pronta', 'estou contente' (feminine -a adjective); " +
          "French: use passé composé with être in feminine form: 'je suis venue', 'je suis restée'; " +
          "Russian: past-tense 1st-person feminine — 'ya была zdes'' (f), 'ya ponyala' (f), 'ya slyshala' (f); " +
          "German: predicate adjectives after 'sein' do not inflect for 1st person — 'ich bin müde' regardless; " +
          "Indonesian: gender-neutral — no change needed; " +
          "Arabic: 'ana huna laki'; Hebrew: 'ani kan bishvilech'."
        );
      } else if (cg === "male") {
        genderLines.push(
          "COMPANION/IMOTARA VOICE GENDER: male — use masculine first-person verb and adjective forms: " +
          "Hindi: 'sun raha hoon', 'samajh gaya'; Bengali: 'ami bujhte parchhi'; Marathi: 'mi aiket aahe'; " +
          "Tamil/Telugu/Kannada/Malayalam/Odia: 1st-person verbs are gender-neutral — no change needed; " +
          "Spanish: 'estoy aquí contigo', 'estoy listo', 'estaba preocupado' (masculine -o adjective); " +
          "Portuguese: 'estou aqui', 'estou pronto', 'estou contente' (masculine -o adjective); " +
          "French: 'je suis venu', 'je suis resté' (passé composé with être, masculine); " +
          "Russian: past-tense 1st-person masculine — 'ya byl zdes'' (m), 'ya ponyal' (m), 'ya slyshal' (m); " +
          "German: predicate adjectives after 'sein' do not inflect for 1st person — 'ich bin müde' regardless; " +
          "Indonesian: gender-neutral — no change needed; " +
          "Arabic: 'ana huna lak'; Hebrew: 'ani kan bishvilcha'."
        );
      } else if (cg === "nonbinary") {
        genderLines.push(
          "COMPANION/IMOTARA VOICE GENDER: non-binary — use gender-neutral first-person forms, avoid gendered verb or adjective endings. " +
          "In Spanish/Portuguese avoid -o/-a adjective agreement; use neutral phrasing. " +
          "In French avoid passé composé with être where agreement would reveal gender, or use the least marked form."
        );
      }
    }
    const genderInstruction = genderLines.length > 0 ? genderLines.join("\n") : "";

    // Companion persona: translate tone → natural writing style for the AI
    const tonePersonaMap: Record<string, string> = {
      close_friend: "You are speaking as a close, trusted friend — warm, casual, talks like a real person. Match the user's energy and language style naturally.",
      calm_companion: "You are speaking as a calm, gentle companion — patient, soft-spoken, never rushing. Keep phrasing unhurried and reassuring.",
      coach: "You are speaking as an encouraging coach — practical, forward-looking, motivating without being pushy. Gently nudge toward clarity or action when appropriate.",
      mentor: "You are speaking as a wise, thoughtful mentor — help the user find their own answers through gentle questions and perspective, not advice-giving.",
    };
    const companionPersonaHint = body?.tone
      ? tonePersonaMap[body.tone] ?? ""
      : "";

    // Age context: adapt vocabulary and register to the user's life stage
    const userAgeHintMap: Record<string, string> = {
      under_13: "The user is a child (under 13). Use very simple, gentle, encouraging language. Avoid adult idioms.",
      "13_17": "The user is a teenager (13–17). Use relatable, peer-like language — not patronising. They understand nuance.",
      "18_24": "The user is a young adult (18–24). Casual, direct, and real. Validate that talking about it is the right move. Match their energy without being preachy.",
      "25_34": "The user is in their late 20s or 30s. Peer-like tone — they're in the middle of life's complexity. Acknowledge that many people carry something like this; they're not alone.",
      "35_44": "The user is in their mid-30s to mid-40s. Grounded, non-patronising tone. It's okay if they don't have everything figured out — affirm that, gently.",
      "45_54": "The user is in their mid-40s to mid-50s. Steady and grounded. Affirm their right to prioritise themselves. They may be used to holding things for others — notice that.",
      "55_64": "The user is in their late 50s to early 60s. Patient and respectful register. Affirm that what they feel is completely valid and worth attention — don't minimise or rush them.",
      "65_plus": "The user is 65 or older. Use a warm, unhurried, respectful register — never condescending.",
    };
    const userAgeHint = body?.userAge
      ? (userAgeHintMap[body.userAge] ?? "")
      : "";

    // Arc-aware response depth instruction
    const lengthInstruction =
      arc.depth === "deep"
        ? "Use 2–3 sentences that feel warm and connected — not clinical or formulaic. If you include a mythology reference or quote, keep the total reply to 2–3 sentences including that element."
        : "Reply in 1–2 short sentences. If you include a mythology reference or quote, keep the total reply to 2 sentences including that element.";

    // For sustained emotional conversations, remind the model to honour the arc
    const arcDepthHint =
      arc.depth === "deep"
        ? [
            `CONVERSATION ARC: This is a sustained emotional conversation (${arc.userTurnCount} user turns, ${arc.emotionalTurnCount} with emotional signals).`,
            "Show that you have been listening across the whole conversation — not just the latest message.",
            "Your reply must feel continuous: acknowledge the ongoing thread, not restart the topic.",
            "First: validate what the user has been carrying. Then: stay present. Do not rush to advice.",
          ].join("\n")
        : arc.depth === "moderate"
          ? "This conversation has emotional context. Build on what the user shared earlier — reference at least one specific detail from a previous turn."
          : "";

    const emotionMemoryHint =
      typeof body?.emotionMemory === "string" && body.emotionMemory.trim()
        ? body.emotionMemory.trim()
        : "";

    const prompt = [
      "You are Imotara — a calm, warm, emotionally-aware companion (not a therapist).",
      langInstruction,
      genderInstruction,
      emotionMemoryHint,
      companionPersonaHint,
      userAgeHint,
      casualChatRule,
      lengthInstruction,
      "Do NOT sound generic. Never repeat the same opener style across turns — 'I'm with you / I'm here / I hear you' should not appear more than once per conversation. Instead open with something that reflects what the user specifically said: name the emotion, reference the situation, or mirror their energy.",
      "EMPATHY VARIETY RULE: Avoid overusing weight and burden metaphors ('that sounds heavy', 'you're carrying a lot', 'that's a lot to sit with'). Vary your empathy language — use specific, human, direct observations instead: 'That kind of hurt doesn't just go away on its own', 'I'd feel that way too', 'That's genuinely unfair', 'That sounds like it came out of nowhere'.",
      isLightCasual ? "" : "IMPORTANT: Your reply MUST reference at least one concrete detail from the user's most recent message OR the recent user messages below.",
      "If the user already gave context, do NOT ask vague questions like 'what's on your mind' or 'what's going on' — continue the same thread.",
      "QUESTION RULE: Do NOT end every reply with a question. A real friend sometimes just listens and reflects without asking anything. Only ask a question when it genuinely opens something new — not as a default closer. Maximum one question per reply, and skip it entirely if the user is sharing something tender.",
      "VENTING RULE: If the user is venting, releasing emotion, or explicitly says they just need to talk — respond with pure presence. No question at the end. Just be there: 'You don't have to figure this out right now.' / 'You're allowed to feel all of this.' / 'I'm not going anywhere.'",
      "OPENER RULE: Never start with 'Got it', 'Absolutely', 'Of course', or similar filler acknowledgements. Respond directly to what the user said.",
      "No medical, diagnostic, or crisis instructions. If serious risk appears, encourage reaching out to trusted people/local services.",
      "",
      [
        "MYTHOLOGY STORYTELLING (rare, only for deep emotional moments):",
        "DEFAULT: Do NOT include mythology. Skip it unless all three conditions are met:",
        "  1. The user has shared a genuinely heavy emotion — sustained sadness, grief, anxiety, exhaustion, loneliness, or deep confusion.",
        "  2. The conversation has had at least 4 user turns.",
        "  3. The current message itself carries emotional weight — not casual chat, not humour, not a positive update.",
        "If the user is saying something upbeat, joking, or just chatting, ALWAYS skip mythology entirely.",
        "",
        "CULTURAL PRIORITY RULES (important — follow these):",
        "1. Match mythology to the user's language and cultural background first:",
        "   - Hindi / Bengali / Tamil / Telugu / Kannada / Malayalam / Gujarati / Punjabi / Marathi / Odia / Indonesian → PRIMARILY Indian mythology (Mahabharata, Ramayana, Bhagavad Gita, Puranas, Jataka tales, Panchatantra, Upanishads). Occasionally reference other world mythologies.",
        "   - Arabic / Urdu → PRIMARILY Islamic/Sufi stories (Rumi, Hafez, Quranic parables, Sufi tales, 1001 Nights). Occasionally Indian.",
        "   - Chinese → PRIMARILY Chinese mythology and Taoist philosophy (Zhuangzi, Laozi, Journey to the West, Chinese folk tales). Occasionally Indian.",
        "   - Spanish / Portuguese / French / German → PRIMARILY Greco-Roman mythology (Odyssey, Iliad, Greek/Roman gods and heroes). Occasionally Indian.",
        "   - Russian → PRIMARILY Norse/Slavic mythology (Baba Yaga, Slavic heroes, Norse myths). Occasionally Indian.",
        "   - Japanese → PRIMARILY Japanese/Zen/Buddhist stories (Zen koans, Shinto mythology, Japanese folk tales). Occasionally Indian.",
        "   - Hebrew → PRIMARILY Jewish/Talmudic parables (Torah stories, Talmudic wisdom, Hasidic tales). Occasionally Indian.",
        "   - English → Indian mythology primarily (Imotara is an Indian product), with occasional world mythology.",
        "2. Promote Indian mythological stories overall — reference them more than any other single tradition across all users.",
        "3. Occasionally cross-reference: share a Rumi verse with a Hindi-speaking user, or a Jataka tale with a Spanish-speaking user — when it genuinely fits better.",
        "",
        "HOW: Introduce it naturally — 'There's a story from the Mahabharata that comes to mind...' / 'Rumi wrote something that feels true here...' / 'A Zen story I keep thinking about...' / 'In Greek mythology...'",
        "KEEP IT BRIEF: 1–2 sentences max — the essence of the story and why it connects to their situation.",
        "LANGUAGE: Always share in the user's language. If the original story is from another language, translate naturally.",
        "NEVER USE when: fewer than 4 user turns, the user is in crisis, asking a factual question, greeting, joking, sharing good news, or mentioning their cultural background/language/ethnicity — do NOT immediately reference cultural figures, poets, or literature just because a user says they are Bengali, Hindi-speaking, Tamil, etc.",
        "TONE RESTRICTION: If tone is 'close_friend' — skip mythology entirely unless the arc.depth is deep (5+ turns of heavy emotion). A close friend does NOT reach for scripture; they stay peer-level and human.",
        "TONE: Warm and human — like a friend who remembers a story. Never preachy or lecture-like.",
        "CRITICAL — QUOTE ACCURACY: NEVER attribute a quote, verse, or saying to any religious text, scripture, or religious figure (Krishna, Arjuna, Rumi, Buddha, Muhammad, Jesus, Torah, Quran, Gita, etc.) unless you are certain of the exact wording and canonical source. If you are not 100% certain a specific quote is real and verifiable, describe the STORY or CONCEPT from that tradition instead — do NOT invent or paraphrase as a direct quote. A fabricated quote attributed to a sacred figure is harmful and trust-breaking.",
        ...(uniqueMyths.length > 0
          ? [`MYTHOLOGY ALREADY USED IN THIS SESSION (do NOT repeat these): ${uniqueMyths.join(", ")}`]
          : []),
      ].join("\n"),
      "",
      [
        "FAMOUS QUOTES (optional, context-aware):",
        "Separately from mythology, you may also occasionally share a well-known quote from a philosopher, poet, scientist, spiritual figure, or thinker when it genuinely resonates with what the user is going through.",
        "Sources span all cultures and eras: Marcus Aurelius, Rumi, Seneca, Gandhi, Buddha, Tagore, Vivekananda, Maya Angelou, Einstein, Thich Nhat Hanh, Camus, Nietzsche, Tolstoy, Gibran, and others worldwide.",
        "HOW: Weave it naturally — 'A line I keep coming back to...' / 'Marcus Aurelius once wrote...' / 'There's a quote from Rumi that feels true here...' / 'Einstein put it beautifully:'",
        "FORMAT: Quote in quotation marks, followed by attribution — '\"[quote]\" — [Author]'.",
        "LANGUAGE: Translate or find an equivalent quote in the user's language if they write in Hindi, Arabic, French, etc. Attribute the author by name.",
        "FREQUENCY: Roughly 1 in 8 emotional or reflective turns. Never on the same turn as a mythology story. Never forced.",
        "NEVER USE when: the user is in crisis, light casual chat, greetings, direct factual questions, or when the user simply mentions their language/culture/ethnicity — a user saying 'I'm Bengali' or 'I speak Tamil' is NOT an invitation to quote Tagore or Thiruvalluvar.",
        "ACCURACY: Only use quotes you are certain are real, correctly worded, and correctly attributed. If uncertain, paraphrase the idea in your own words instead — do NOT invent a quote and attach a famous name to it.",
        "TONE: Like a friend who genuinely remembers a line — not a quotation database. Keep it short and connected to what they said.",
      ].join(" "),
      "",
      arcDepthHint,
      emotionHint,
      nameHint,
      closureHint,
      recentUserBlock
        ? "Recent user messages (last 3):\n" + recentUserBlock
        : "",
      "",
      "Full recent chat context (most recent at the end):",
      conversationText || "(No previous context; this is the first message.)",
      "",
      "Now write Imotara's next reply — warm, specific to what the user said, and feels like a natural continuation.",
    ]
      .filter(Boolean)
      .join("\n");

    const maxTokens = isClosureIntent
      ? 80
      : arc.depth === "deep"
        ? 380
        : arc.depth === "moderate"
          ? 300
          : 260;

    const ai: ImotaraAIResponse = await callImotaraAI("Reply now.", {
      system: prompt,
      maxTokens,
      temperature: 0.8,
      noQuestions: isClosureIntent,
    });

    // ✅ ROOT-CAUSE FIX:
    // If the AI client returns a placeholder/failure string, do NOT pass it through as a valid reply.
    // Return text="" and meta.from !== "openai" so the Chat page uses its existing fallback reply.
    const candidate = (ai?.text ?? "").trim();

    // Only flag as placeholder if there IS text and it matches known bad strings.
    // Empty text now means: AI unavailable → let fallback logic happen naturally.
    if (candidate && isBadPlaceholderText(candidate)) {
      return NextResponse.json(
        {
          text: "",
          meta: {
            ...(ai?.meta ?? {}),
            from: "fallback",
            reason: "filtered-placeholder-reply",
          },
        },
        { status: 200 },
      );
    }
    // ✅ Permanent architecture gate:
    // Force EVERY successful reply through the Three-Part Humanized framework.
    const lastUser =
      [...recent].reverse().find((m) => m.role === "user")?.content ?? "";
    const formatted = formatImotaraReply({
      raw: candidate,
      lang: body?.lang,
      tone: body?.tone,
      seed: `${lastUser}|${emotion}|${preferredName}`,
      intent: arc.depth !== "light" ? "emotional" : undefined,
    });

    // If formatting somehow yields empty, fall back to the original candidate.
    const finalText = (formatted || candidate).trim();

    // Normal successful path (same response shape)
    return NextResponse.json(
      {
        ...ai,
        text: finalText,
        meta: {
          ...(ai?.meta ?? {}),
          framework: "three-part-v1",
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const PROD = process.env.NODE_ENV === "production";
    const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

    if (SHOULD_LOG) {
      console.warn("[/api/chat-reply] error:", String(err));
    }

    // Return a valid ImotaraAIResponse shape so the client can ignore it
    // (meta.from !== "openai") and fall back gracefully.
    const fallback: ImotaraAIResponse = {
      text: "",
      meta: {
        usedModel: "unknown",
        from: "error",
        reason: "chat-reply route error",
      },
    };
    return NextResponse.json(fallback, { status: 200 });
  }
}
