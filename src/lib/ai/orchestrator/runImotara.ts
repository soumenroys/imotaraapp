// src/lib/ai/orchestrator/runImotara.ts

import { buildMicroStory } from "@/lib/ai/orchestrator/storyEngine";
import { buildMythologyStory } from "@/lib/ai/orchestrator/mythologyEngine";
import { buildOfflineQuote } from "@/lib/ai/orchestrator/quotesEngine";
import type {
  ImotaraResponse,
  ResponseTone,
} from "../response/responseBlueprint";
import { DEFAULT_RESPONSE_BLUEPRINT } from "../response/responseBlueprint";
import { getResponseBlueprint } from "../response/getResponseBlueprint";
import { applySoftEnforcement } from "@/lib/ai/guardrails/softEnforcement";
import type { EmotionAnalysis } from "@/lib/ai/emotion/emotionTypes";
import { normalizeEmotion } from "@/lib/ai/emotion/normalizeEmotion";
import { applyFinalResponseGate } from "@/lib/ai/orchestrator/finalResponseGate";
import { getCrisisResourcesForCountry } from "@/lib/safety/crisisResources";
import {
  EN_LANG_HINT_REGEX,
  ROMAN_BN_LANG_HINT_REGEX,
  ROMAN_GU_LANG_HINT_REGEX,
  ROMAN_HI_LANG_HINT_REGEX,
  ROMAN_KN_LANG_HINT_REGEX,
  ROMAN_ML_LANG_HINT_REGEX,
  ROMAN_MR_LANG_HINT_REGEX,
  ROMAN_OR_LANG_HINT_REGEX,
  ROMAN_PA_LANG_HINT_REGEX,
  ROMAN_TA_LANG_HINT_REGEX,
  ROMAN_TE_LANG_HINT_REGEX,
  CRISIS_HINT_REGEX,
} from "@/lib/emotion/keywordMaps";

type SessionContext = {
  persona?: {
    relationshipTone?: string;
    ageTone?: string;
    genderTone?: string;
    name?: string;
  };
  toneContext?: any;
  recent?: Array<{ role: "user" | "assistant"; content: string }>;
  source?: string;
  debug?: boolean;
};

function oneLine(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferBlueprintTone(userMessage: string): ResponseTone {
  const s = String(userMessage ?? "").toLowerCase();

  // Strong emotional vulnerability / sadness / fear → supportive
  if (
    s.includes("overwhelmed") ||
    s.includes("exhaust") ||
    s.includes("drained") ||
    s.includes("empty") ||
    s.includes("numb") ||
    s.includes("heavy") ||
    s.includes("stuck") ||
    s.includes("lost") ||
    s.includes("hopeless") ||
    s.includes("meaningless") ||
    s.includes("broken") ||
    s.includes("no energy") ||
    s.includes("lonely") ||
    s.includes("alone") ||
    s.includes("scared") ||
    s.includes("afraid") ||
    s.includes("future") ||
    s.includes("tired of everything") ||
    s.includes("don't know what i'm doing") ||
    s.includes("dont know what i'm doing") ||
    s.includes("don't know what i am doing") ||
    s.includes("dont know what i am doing") ||
    s.includes("nothing feels meaningful") ||
    s.includes("nothing feels meaningful lately")
  ) {
    return "supportive";
  }

  // Work / study stress → coach
  if (
    s.includes("office") ||
    s.includes("work") ||
    s.includes("boss") ||
    s.includes("deadline") ||
    s.includes("pressure") ||
    s.includes("project") ||
    s.includes("meeting") ||
    s.includes("client") ||
    s.includes("study") ||
    s.includes("exam") ||
    s.includes("college") ||
    s.includes("assignment")
  ) {
    return "coach";
  }

  // Bodily needs / immediate physical state → practical
  // (Important: check this BEFORE burnout/tired, otherwise "tired" steals it.)
  //
  // Normalize (Unicode-safe): keep letters/numbers across languages, remove punctuation/emoji noise.
  const n = s
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const has = (...terms: string[]) => terms.some((t) => n.includes(t));
  const re = (r: RegExp) => r.test(n);

  if (
    // English keywords
    has(
      "hungry",
      "hunger",
      "food",
      "eat",
      "meal",
      "dinner",
      "lunch",
      "breakfast",
      "snack",
      "thirsty",
      "water",
      "drink",
      "sleepy",
      "need sleep",
      "cant sleep",
      "can't sleep",
      "insomnia",
      "headache",
      "fever",
      "pain",
      "stomach",
      "nausea",
    ) ||
    // Short intent patterns (helps: "i want food now", "need to eat", etc.)
    re(
      /\b(want|need|craving)\s+(some\s+)?(food|to\s+eat|eat|water|to\s+drink|drink|sleep)\b/i,
    ) ||
    re(/\b(can('|)t|cannot)\s+sleep\b/i) ||
    // Common Indian-language romanizations (minimal but high-impact)
    has(
      // Hindi
      "bhook",
      "bhuk",
      "bhookh",
      "pyaas",
      "pyas",
      "pyasa",
      "pani",
      "neend",
      "nind",
      // Bengali (romanized)
      "khida",
      "khida lagche",
      "khida lagse",
      "piyas",
      "jol",
      "ghum",
      "ghum pachhe na",
      "ghum hocche na",
    )
  ) {
    return "practical";
  }

  // Burnout / shutdown → supportive
  if (
    s.includes("burnout") ||
    s.includes("exhaust") ||
    s.includes("tired of everything") ||
    s.includes("drained") ||
    s.includes("empty") ||
    s.includes("numb") ||
    s.includes("no energy") ||
    s.includes("can't do this") ||
    s.includes("meaningless") ||
    s.includes("hopeless")
  ) {
    return "supportive";
  }

  // Default
  return "calm";
}

function cap(s: string, max: number): string {
  const t = oneLine(s);
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function getUserName(ctx: SessionContext): string | null {
  const n =
    ctx?.toneContext?.user?.name ??
    ctx?.toneContext?.profile?.name ??
    ctx?.persona?.name;
  const name = typeof n === "string" ? oneLine(n) : "";
  return name.length >= 2 ? name : null;
}

function pickRelationshipTone(ctx: SessionContext): string {
  const rel = ctx?.toneContext?.companion?.enabled
    ? ctx?.toneContext?.companion?.relationship
    : ctx?.persona?.relationshipTone;

  return typeof rel === "string" ? rel : "prefer_not";
}

// Returns companion gender only when companion persona is enabled.
function pickCompanionGender(ctx: SessionContext): string {
  if ((ctx as any)?.toneContext?.companion?.enabled !== true) return "prefer_not";
  return String((ctx as any)?.toneContext?.companion?.gender ?? "prefer_not");
}

function recentlyAsked(ctx: SessionContext, needle: string): boolean {
  const recent = ctx?.recent ?? [];
  const assistantText = recent
    .filter((m) => m.role === "assistant")
    .map((m) => (m.content || "").toLowerCase())
    .join(" | ");
  return assistantText.includes(needle.toLowerCase());
}

function getRecentUserTurns(
  ctx: SessionContext,
  currentMsg: string,
  maxTurns: number,
): string[] {
  const recent = Array.isArray(ctx?.recent) ? ctx.recent : [];
  const cur = oneLine(currentMsg).toLowerCase();

  const out: string[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m?.role !== "user") continue;

    const prev = oneLine(m.content ?? "");
    if (!prev) continue;

    // Avoid echoing the same message (common in language-switch / resend cases)
    if (prev.toLowerCase() === cur) continue;

    out.push(cap(prev, 80));
    if (out.length >= maxTurns) break;
  }
  return out;
}

function getContextUserTurn(
  ctx: SessionContext,
  currentMsg: string,
  maxTurns = 3,
): string | null {
  const turns = getRecentUserTurns(ctx, currentMsg, maxTurns);
  if (!turns.length) return null;

  // Pick the most relevant of the last N user turns using keyword overlap.
  const curTokens = new Set(tokenizeLite(currentMsg));
  let best = turns[0]!;
  let bestScore = -1;

  for (const t of turns) {
    const toks = tokenizeLite(t);
    let score = 0;
    for (const w of toks) if (curTokens.has(w)) score++;

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  // If nothing overlaps, still return the most recent (turns[0])
  return best;
}

// Only add a continuity anchor when the user message looks like a follow-up.
// (Short replies like "because...", "ok", "why", "then", etc.)
function shouldUseContinuityAnchor(currentMsg: string): boolean {
  const t = oneLine(currentMsg).toLowerCase();
  if (!t) return false;

  if (t.length <= 24) return true;

  // common follow-up starters
  if (
    /^(because|cuz|coz|so|and|but|why|then|also|ok|okay|hmm|yes|yeah|yep|no|nah|right|wait)\b/.test(
      t,
    )
  ) {
    return true;
  }

  return false;
}

function sharesKeyword(a: string, b: string): boolean {
  const normalize = (s: string) =>
    oneLine(s)
      .toLowerCase()
      .replace(
        /[^a-z0-9\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B80-\u0BFF\u0C00-\u0CFF\u0D00-\u0D7F\s]/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

  const clean = (s: string) =>
    normalize(s)
      .split(/\s+/)
      .filter((w) => w.length >= 4);

  const cur = normalize(a);
  const prev = normalize(b);

  const A = new Set(clean(a));
  const B = clean(b);

  // 1) direct keyword overlap still wins
  if (A.size > 0 && B.length > 0) {
    for (const w of B) {
      if (A.has(w)) return true;
    }
  }

  // 2) short follow-up / referential continuation:
  // people often continue emotion without repeating nouns
  const referentialFollowUp =
    /\b(this|that|it|same|still|again|there|then|because|but|so|also)\b/.test(
      cur,
    ) ||
    /\b(yeh|yah|ye|wo|woh|eta|ota|eita|oita|tai|abar|phir|fir)\b/.test(cur);

  const emotionalSignal =
    /\b(sad|down|hurt|heavy|empty|numb|lost|stuck|tired|drained|overwhelmed|anxious|worried|scared|afraid|lonely|hopeless|meaningless)\b/.test(
      cur,
    ) ||
    /\b(dukho|kosto|kharap|mon kharap|bhoy|chinta|tension|klanto|eka|udas)\b/.test(
      cur,
    ) ||
    /\b(dukh|bura|thak gaya|thak gayi|akela|dar|tension|bojh|khali|udaas)\b/.test(
      cur,
    );

  const prevHasEmotion =
    /\b(sad|down|hurt|heavy|empty|numb|lost|stuck|tired|drained|overwhelmed|anxious|worried|scared|afraid|lonely|hopeless|meaningless)\b/.test(
      prev,
    ) ||
    /\b(dukho|kosto|kharap|mon kharap|bhoy|chinta|tension|klanto|eka|udas)\b/.test(
      prev,
    ) ||
    /\b(dukh|bura|thak gaya|thak gayi|akela|dar|tension|bojh|khali|udaas)\b/.test(
      prev,
    );

  if ((referentialFollowUp || emotionalSignal) && prevHasEmotion) {
    return true;
  }

  return false;
}

function pickVariant(seed: string, count: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return count <= 0 ? 0 : (h >>> 0) % count;
}

function isGreetingOnly(input: string): boolean {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return false;

  // Remove common punctuation / emojis that often accompany greetings
  const cleaned = raw.replace(/[!.,?¿¡，。！？।🙏🙂😊👋]+/g, "").trim();

  // Treat these as greeting-only
  const greetings = new Set([
    "hi",
    "hello",
    "hey",
    "yo",
    "hii",
    "hiii",
    "hola",
    "namaste",
    "namaskar",
    "bonjour",
    "good morning",
    "good afternoon",
    "good evening",
  ]);

  return greetings.has(cleaned);
}

function tokenizeLite(s: string): string[] {
  const t = String(s ?? "").toLowerCase();
  // unicode-safe word extraction
  const parts = t.match(/[\p{L}\p{N}]+/gu) ?? [];
  return parts.filter(Boolean);
}

// Intent: user is complaining about repetition / questioning if system is real / calling it bot-like
function detectMetaComplaintIntent(input: string): boolean {
  const text = String(input ?? "");
  const tokens = tokenizeLite(text);
  if (tokens.length === 0) return false;

  // Token categories (NOT exact phrases)
  const identityTokens = new Set([
    "ai",
    "bot",
    "robot",
    "script",
    "automated",
    "human",
    "real",
    "genuine",
    // Hinglish/Hindi/Bengali common forms
    "बॉट",
    "रोबोट",
    "एआई",
    "মানুষ",
    "বট",
  ]);

  const repeatTokens = new Set([
    "repeat",
    "repeating",
    "repeated",
    "again",
    "same",
    "always",
    "everytime",
    "eachtime",
    "template",
    "copy",
    "paste",
    // Hinglish/Hindi/Bengali
    "dobara",
    "dubara",
    "phir",
    "baar",
    "barbar",
    "abar",
    "বারবার",
    "ফের",
    "दोबारा",
    "फिर",
    "बार",
  ]);

  const complaintTokens = new Set([
    "why",
    "stop",
    "annoying",
    "irritating",
    "boring",
    "weird",
    "same",
    "again",
    // Hinglish/Hindi/Bengali
    "kyu",
    "kyun",
    "please",
    "pls",
    "mat",
    "band",
    "क्यों",
    "क्यूँ",
    "मत",
    "बंद",
    "কেন",
    "বন্ধ",
  ]);

  const addressTokens = new Set(["you", "your", "imotara"]);

  let score = 0;
  let hasIdentity = false;
  let hasRepeat = false;
  let hasComplaint = false;
  let hasAddress = false;

  for (const w of tokens) {
    if (identityTokens.has(w)) hasIdentity = true;
    if (repeatTokens.has(w)) hasRepeat = true;
    if (complaintTokens.has(w)) hasComplaint = true;
    if (addressTokens.has(w)) hasAddress = true;
  }

  if (hasIdentity) score += 2;
  if (hasRepeat) score += 2;
  if (hasComplaint) score += 1;
  if (hasAddress) score += 1;

  // Extra small signals
  if (/[?？]/.test(text)) score += 1;
  if (/!+/.test(text)) score += 1;

  // Decide rules (intent-level, not exact phrases):
  // 1) Identity + question/you → "are you real / bot?" type
  if (hasIdentity && (hasAddress || /[?？]/.test(text))) return true;

  // 2) Repeat + complaint + question/you → "why repeat / stop repeating" type
  if (hasRepeat && hasComplaint && (hasAddress || /[?？]/.test(text)))
    return true;

  // 3) Strong combined signal
  if (hasIdentity && hasRepeat) return true;

  // 4) Generic threshold fallback
  return score >= 4;
}

// Natural, non-repetitive continuity anchors (NOT always quoting).
function continuityAnchor(
  lang: SupportedLanguage,
  prev: string,
  seed: string,
): string {
  const idx = pickVariant(`${lang}|${seed}|${prev}`, 4);
  const shortPrev = cap(prev, 42);

  if (lang === "hi") {
    const variants = [
      `ठीक है — उसी बात पर,`,
      `समझ गया/गई — उसी हिस्से पर,`,
      `अच्छा — उसी संदर्भ में,`,
      `हां, उसी point पर,`,
    ] as const;
    return `${variants[idx]}${shortPrev.length <= 42 ? ` "${shortPrev}"` : ""} `;
  }

  if (lang === "bn") {
    const variants = [
      `ঠিক আছে — সেই কথাটাই ধরে,`,
      `বুঝলাম — ওই অংশটা ধরে,`,
      `আচ্ছা — ওই প্রসঙ্গেই,`,
      `হ্যাঁ — ওই জায়গা থেকে,`,
    ] as const;
    return `${variants[idx]} `;
  }

  if (lang === "gu") {
    const variants = [
      `બરાબર — એ જ વાત પરથી,`,
      `સમજ્યું — એ ભાગ પરથી,`,
      `સારું — એ જ સંદર્ભમાં,`,
      `હા — એ જ મુદ્દા પરથી,`,
    ] as const;
    return `${variants[idx]}${shortPrev.length <= 42 ? ` "${shortPrev}"` : ""} `;
  }

  if (lang === "kn") {
    const variants = [
      `ಸರಿ — ಅದೇ ಮಾತಿನಿಂದ,`,
      `ಅರ್ಥವಾಯಿತು — ಆ ಭಾಗದಿಂದ,`,
      `ಸರಿ — ಅದೇ ಸಂದರ್ಭದಿಂದ,`,
      `ಹೌದು — ಅದೇ ವಿಷಯದಿಂದ,`,
    ] as const;
    return `${variants[idx]}${shortPrev.length <= 42 ? ` "${shortPrev}"` : ""} `;
  }

  if (lang === "mr") {
    const variants = [
      `ठीक आहे — त्याच गोष्टीवरून,`,
      `समजलं — त्या भागावरून,`,
      `बरं — त्याच संदर्भातून,`,
      `हो — त्याच मुद्द्यावरून,`,
    ] as const;
    return `${variants[idx]}${shortPrev.length <= 42 ? ` "${shortPrev}"` : ""} `;
  }

  if (lang === "ta") {
    const variants = [
      `சரி — அந்த விஷயத்திலிருந்து,`,
      `புரிந்தது — அந்த பகுதியிலிருந்து,`,
      `நன்று — அதே சூழலில்,`,
      `ஆம் — அந்த கேள்வியிலிருந்து,`,
    ] as const;
    return `${variants[idx]} `;
  }

  if (lang === "te") {
    const variants = [
      `సరే — ఆ విషయం నుండి,`,
      `అర్థమైంది — ఆ భాగం నుండి,`,
      `సరే — అదే సందర్భంలో,`,
      `అవును — ఆ విషయంపై,`,
    ] as const;
    return `${variants[idx]} `;
  }

  if (lang === "ml") {
    const variants = [
      `ശരി — ആ കാര്യത്തിൽ നിന്ന്,`,
      `മനസ്സിലായി — ആ ഭാഗത്ത് നിന്ന്,`,
      `ശരി — ആ പശ്ചാത്തലത്തിൽ,`,
      `അതെ — ആ വിഷയത്തിൽ,`,
    ] as const;
    return `${variants[idx]} `;
  }

  if (lang === "pa") {
    const variants = [
      `ਠੀਕ ਹੈ — ਉਸੇ ਗੱਲ ਤੋਂ,`,
      `ਸਮਝ ਆਇਆ — ਉਸ ਭਾਗ ਤੋਂ,`,
      `ਠੀਕ ਹੈ — ਉਸੇ ਸੰਦਰਭ ਵਿੱਚ,`,
      `ਹਾਂ — ਉਸੇ ਵਿਸ਼ੇ ਤੋਂ,`,
    ] as const;
    return `${variants[idx]} `;
  }

  if (lang === "or") {
    const variants = [
      `ଠିକ ଅଛ — ସେ କଥା ଉପରୁ,`,
      `ବୁଝିଲି — ସେ ଭାଗ ଉପରୁ,`,
      `ଅଛ — ସେ ପ୍ରସଙ୍ଗ ଉପରୁ,`,
      `ହଁ — ସେ ଜାଗାରୁ,`,
    ] as const;
    return `${variants[idx]} `;
  }

  if (lang === "ur") {
    const variants = [
      `ٹھیک ہے — اسی بات سے,`,
      `سمجھ گیا — اس حصے سے,`,
      `اچھا — اسی سیاق میں,`,
      `ہاں — اسی موضوع پر,`,
    ] as const;
    return `${variants[idx]} `;
  }

  if (lang === "ar") {
    const variants = [
      `حسناً — بناءً على ذلك,`,
      `فهمت — من هذه النقطة,`,
      `نعم — في هذا السياق,`,
      `حسناً — بشأن ذلك الجزء,`,
    ] as const;
    return `${variants[idx]}${shortPrev.length <= 42 ? ` "${shortPrev}"` : ""} `;
  }

  if (lang === "de") {
    const variants = [
      `Verstanden — dazu,`,
      `Okay — an diesem Teil,`,
      `Richtig — daran anknüpfend,`,
      `Das macht Sinn — in diesem Zusammenhang,`,
    ] as const;
    return `${variants[idx]}${shortPrev.length <= 42 ? ` "${shortPrev}"` : ""} `;
  }

  const variants = [
    `Got it — on that, `,
    `Okay — about that part, `,
    `Right — building on that, `,
    `Makes sense — on that note, `,
  ] as const;

  return `${variants[idx]}${shortPrev.length <= 42 ? `"${shortPrev}" ` : ""}`;
}

function makeReflectionSeed(
  userMessage: string,
): ImotaraResponse["reflectionSeed"] {
  const m = userMessage.toLowerCase();

  if (m.includes("stranger") || m.includes("met") || m.includes("someone")) {
    return {
      intent: "reflect",
      title: "A chance encounter",
      prompt: "What stood out about that person or that moment?",
    };
  }

  if (
    m.includes("money") ||
    m.includes("paid") ||
    m.includes("salary") ||
    m.includes("bonus")
  ) {
    return {
      intent: "reflect",
      title: "Money & relief",
      prompt:
        "What does this money change for you right now—safety, freedom, or something else?",
    };
  }

  if (
    m.includes("ecstatic") ||
    m.includes("amazing") ||
    m.includes("happy") ||
    m.includes("great") ||
    m.includes("cool")
  ) {
    return {
      intent: "reflect",
      title: "Savoring the good",
      prompt:
        "What exactly feels good about it—your body, your thoughts, or the situation itself?",
    };
  }

  return {
    intent: "clarify",
    title: "", // ✅ remove robotic heading like "One detail"
    prompt:
      "What would feel most useful right now — just talking it through, or finding a small next step?",
  };
}

type SupportedLanguage =
  | "en"
  | "hi"
  | "bn"
  | "ta"
  | "te"
  | "gu"
  | "kn"
  | "ml"
  | "pa"
  | "mr"
  | "or"
  | "ur"
  | "ar"
  | "zh"
  | "es"
  | "fr"
  | "pt"
  | "ru"
  | "id"
  | "de";

function getPreferredLanguage(
  ctx: SessionContext,
  currentUserMessage?: string,
): SupportedLanguage {
  const raw = String((ctx as any)?.preferredLanguage ?? "")
    .trim()
    .toLowerCase();

  // 1) Explicit preference wins (Accept both base + BCP-47 tags)
  // ✅ English must be here so "en" from derivePreferredLanguage is honoured without
  // falling through to message-script detection (which can false-positive on Gujarati).
  if (raw === "en" || raw.startsWith("en-")) return "en";
  if (raw === "hi" || raw.startsWith("hi-")) return "hi";
  if (raw === "bn" || raw.startsWith("bn-")) return "bn";
  if (raw === "ta" || raw.startsWith("ta-")) return "ta";
  if (raw === "te" || raw.startsWith("te-")) return "te";
  if (raw === "gu" || raw.startsWith("gu-")) return "gu";
  if (raw === "kn" || raw.startsWith("kn-")) return "kn";
  if (raw === "ml" || raw.startsWith("ml-")) return "ml";
  if (raw === "pa" || raw.startsWith("pa-")) return "pa";
  if (raw === "mr" || raw.startsWith("mr-")) return "mr";
  if (raw === "or" || raw.startsWith("or-")) return "or";
  if (raw === "ur" || raw.startsWith("ur-")) return "ur";
  if (raw === "ar" || raw.startsWith("ar-")) return "ar";
  if (raw === "zh" || raw.startsWith("zh-")) return "zh";
  if (raw === "es" || raw.startsWith("es-")) return "es";
  if (raw === "fr" || raw.startsWith("fr-")) return "fr";
  if (raw === "pt" || raw.startsWith("pt-")) return "pt";
  if (raw === "ru" || raw.startsWith("ru-")) return "ru";
  if (raw === "id" || raw.startsWith("id-")) return "id";
  if (raw === "de" || raw.startsWith("de-")) return "de";

  const msg = String(currentUserMessage ?? "").trim();
  if (msg) {
    // 2) Greeting-only should stay in simple English unless user explicitly set another preference.
    // This prevents short inputs like "Hi" from inheriting a previous assistant language.
    if (isGreetingOnly(msg)) return "en";

    // 3) Current message script wins (highest confidence)
    if (/[\u0980-\u09FF]/.test(msg)) return "bn"; // Bengali script
    if (
      /[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(msg) ||
      ROMAN_HI_LANG_HINT_REGEX.test(msg)
    ) {
      return "hi"; // Devanagari / Hindi romanized
    }
    if (/[\u0B80-\u0BFF]/.test(msg) || ROMAN_TA_LANG_HINT_REGEX.test(msg)) return "ta"; // Tamil
    if (/[\u0C00-\u0C7F]/.test(msg) || ROMAN_TE_LANG_HINT_REGEX.test(msg)) return "te"; // Telugu
    if (/[\u0A80-\u0AFF]/.test(msg) || ROMAN_GU_LANG_HINT_REGEX.test(msg)) return "gu"; // Gujarati
    if (/[\u0C80-\u0CFF]/.test(msg) || ROMAN_KN_LANG_HINT_REGEX.test(msg)) return "kn"; // Kannada
    if (/[\u0D00-\u0D7F]/.test(msg) || ROMAN_ML_LANG_HINT_REGEX.test(msg)) return "ml"; // Malayalam
    if (/[\u0A00-\u0A7F]/.test(msg) || ROMAN_PA_LANG_HINT_REGEX.test(msg)) return "pa"; // Punjabi
    if (/[\u0B00-\u0B7F]/.test(msg) || ROMAN_OR_LANG_HINT_REGEX.test(msg)) return "or"; // Odia

    // Marathi uses Devanagari too, so keep it after generic Devanagari script check
    // and only use conservative romanized hints here.
    if (ROMAN_MR_LANG_HINT_REGEX.test(msg)) return "mr";

    // 4) Romanized detection via centralized keywordMaps (conservative)
    const romanBn = ROMAN_BN_LANG_HINT_REGEX.test(msg);
    const romanHi = ROMAN_HI_LANG_HINT_REGEX.test(msg);
    const romanGu = ROMAN_GU_LANG_HINT_REGEX.test(msg);
    const romanKn = ROMAN_KN_LANG_HINT_REGEX.test(msg);
    const romanMl = ROMAN_ML_LANG_HINT_REGEX.test(msg);
    const romanPa = ROMAN_PA_LANG_HINT_REGEX.test(msg);
    const romanMr = ROMAN_MR_LANG_HINT_REGEX.test(msg);
    const romanOr = ROMAN_OR_LANG_HINT_REGEX.test(msg);
    const enHint = EN_LANG_HINT_REGEX.test(msg);

    // If it's clearly English and NOT strongly romanized by any supported Indic hint, force English.
    if (
      enHint &&
      !romanBn &&
      !romanHi &&
      !romanGu &&
      !romanKn &&
      !romanMl &&
      !romanPa &&
      !romanMr &&
      !romanOr
    ) {
      return "en";
    }

    // If one romanized signal is present without the others, honor it.
    if (
      romanBn &&
      !romanHi &&
      !romanGu &&
      !romanKn &&
      !romanMl &&
      !romanPa &&
      !romanMr &&
      !romanOr
    ) {
      return "bn";
    }
    if (
      romanHi &&
      !romanBn &&
      !romanGu &&
      !romanKn &&
      !romanMl &&
      !romanPa &&
      !romanMr &&
      !romanOr
    ) {
      return "hi";
    }
    if (
      romanGu &&
      !romanBn &&
      !romanHi &&
      !romanKn &&
      !romanMl &&
      !romanPa &&
      !romanMr &&
      !romanOr
    ) {
      return "gu";
    }
    if (
      romanKn &&
      !romanBn &&
      !romanHi &&
      !romanGu &&
      !romanMl &&
      !romanPa &&
      !romanMr &&
      !romanOr
    ) {
      return "kn";
    }
    if (
      romanMl &&
      !romanBn &&
      !romanHi &&
      !romanGu &&
      !romanKn &&
      !romanPa &&
      !romanMr &&
      !romanOr
    ) {
      return "ml";
    }
    if (
      romanPa &&
      !romanBn &&
      !romanHi &&
      !romanGu &&
      !romanKn &&
      !romanMl &&
      !romanMr &&
      !romanOr
    ) {
      return "pa";
    }
    if (
      romanMr &&
      !romanBn &&
      !romanHi &&
      !romanGu &&
      !romanKn &&
      !romanMl &&
      !romanPa &&
      !romanOr
    ) {
      return "mr";
    }
    if (
      romanOr &&
      !romanBn &&
      !romanHi &&
      !romanGu &&
      !romanKn &&
      !romanMl &&
      !romanPa &&
      !romanMr
    ) {
      return "or";
    }
    // If multiple match (rare/ambiguous), fall through to continuity.
  }

  // 4) Continuity fallback ONLY when current message is ambiguous
  const recentRaw =
    (Array.isArray((ctx as any)?.recent) && (ctx as any).recent) ||
    (Array.isArray((ctx as any)?.recentMessages) &&
      (ctx as any)?.recentMessages) ||
    (Array.isArray((ctx as any)?.inputs) && (ctx as any)?.inputs) ||
    [];

  // Limit memory window to avoid phrase echo / robotic repetition
  const recent = recentRaw.slice(-6);

  for (let i = recent.length - 1; i >= 0; i--) {
    const m: any = recent[i];
    if (String(m?.role ?? "").toLowerCase() !== "assistant") continue;

    const t = String(m?.content ?? m?.text ?? "").trim();
    if (!t) continue;

    if (/[\u0980-\u09FF]/.test(t)) return "bn"; // Bengali
    if (/[\u0B80-\u0BFF]/.test(t)) return "ta"; // Tamil
    if (/[\u0C00-\u0C7F]/.test(t)) return "te"; // Telugu
    if (/[\u0A80-\u0AFF]/.test(t)) return "gu"; // Gujarati
    if (/[\u0C80-\u0CFF]/.test(t)) return "kn"; // Kannada
    if (/[\u0D00-\u0D7F]/.test(t)) return "ml"; // Malayalam
    if (/[\u0A00-\u0A7F]/.test(t)) return "pa"; // Punjabi
    if (/[\u0B00-\u0B7F]/.test(t)) return "or"; // Odia
    if (/[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(t)) return "hi"; // Hindi / generic Devanagari fallback

    break;
  }

  return "en";
}

/**
 * Returns true when a Roman-script Hindi or Bengali message carries strong
 * emotional content (relationship conflict, grief, work pressure, self-blame,
 * loneliness, health fear, crisis) that warrants a richer response than the
 * short fixed ACK path provides.
 */
function hasStrongRomanIndicEmotionalSignal(msg: string, lang: string): boolean {
  const lower = msg.toLowerCase();

  if (lang === "hi") {
    return /\b(jhagda|jhagre|ladai|larai|gussa|dard|takleef|pareshan|rona|ro raha|ro rahi|neend nahi|neend nhi|sone nahi|akela|akeli|toot gaya|toot gayi|toot gaye|haar gaya|haar gayi|kaam ka dabaao|boss|manager|breakup|rishta|relationship|cheat|dhoka|chod gaya|chod gayi|marne|mar jaana|khatam|khatam karna|khud ko|khud se|dar lag|dar raha|dar rahi|bura lag|bura laga|bahut bura|kuch nahi laga|kuch nahi|dil nahi|bhool gaya|bhool gayi|dil toota|dil toot|akela chhod|akela chod|yaad aata|yaad aati|koi nahi|kuch samajh|samajh nahi|zyada ho gaya|zyada ho gayi|zyada ho gaye|itna bura|itni takleef|bahut takleef|bahut dard|bahut dukh|dukhi|aansu|aankhein bhar|palken bhar|raat ko|sab khatam|khud ko nahi|mujhe nahi chahiye|kisi ko nahi|koi mujhe|koi nahi sunta|koi nahi samjha|problem hoon|problem hun|handle nahi|handle nahi kar|sab kuch handle|life handle|kuch handle|sab sambhal|sambhal nahi|sambhal nahi pa|khud ko galat|apni galti|meri galti|meri wajah|mera kasoor)\b/.test(lower);
  }

  if (lang === "bn") {
    return /\b(jhogra|jhagra|maramari|raga|rag|kanna|kandi|kando|dukho|dukkho|kharap|kosto|ekla|eklo|chap|pressure|boss|office|kaaj|relationship|breakup|chole gelo|chale gelo|chole jacche|chole gelo|chhad|chhat|dure jacchi|dur hoye|dur hoye jacchi|tor katha|tomar katha|bhalobasha|bhalobashi na|bhalobasi na|keu nei|karo nei|keu bujhe na|keu bujhlo na|kichhui mone hoy na|bhalo lagche na|bhalo lagche na|bhalo nei|kharap lagche|kharap lage|kharap laglo|nijeke|nij ke|nijer upor|khub kosto|khub dukho|khub kharap|boro kosto|boro dukho|raat e|ghumate pari na|ghum hoy na|kante parchina|kadhte parchina|sesh kore|sesh kore debo|sesh kore dite|sesh kore nite|mara jabo|mare jabo|nishwas nite|kasto lagche|amar ki|amar kono|karo kache|keu shune na|keu jana na)\b/.test(lower);
  }

  if (lang === "mr") {
    return /\b(jhagda|bhandna|bhandna|dukha|tras|ekta|kaam|dabaav|boss|office|pressure|rishta|breakup|relationship|girlfriend|boyfriend|chod gela|chod geli|ragna|ragavne|khup dukha|khup tras|jhop nahi|jhopet nahi|akela|akeli|koni nahi|koni samajhna|koni aikh|marne|marayla|sab sampla|khud la|swatahla|majhi chuk|mazi chuk|handle nahi|sambhalena|sambhalenasa)\b/.test(lower);
  }

  if (lang === "ta") {
    return /\b(kavalai|kovam|thanimai|payam|dukkham|soru|valikuthu|azhugai|kasdam|prachani|velai|boss|office|pressure|thozhil|kaadhal|sandai|kavarchal|pirital|thanimaiyaaga|yarum illai|yarum puriyavillai|azhugiren|thookam illai|thookame illai|naan thappu|en thappu|en pizhai|handle panna mudiyala|handle pannave mudiyala|mudiyala|thanga mudiyala)\b/.test(lower);
  }

  if (lang === "te") {
    return /\b(baadha|kashtam|bhayam|ontariga|kopam|alasata|dukkham|problem|boss|office|pani|pressure|sandadi|prema|relationship|breakup|girlfriend|boyfriend|vellipoyindi|vellipoyaadu|thanu vellipoyi|nidra raatledu|nidra raadu|nenu thappu|naa thappu|handle cheyyaledu|handle cheyyanu|sambaalaledu|sambaalanu|aasha ledu|concentration ledu)\b/.test(lower);
  }

  if (lang === "gu") {
    return /\b(dukh|dar|eklo|ekla|gussa|thak|jhagdo|takan|chinta|boss|office|kaam|pressure|relationship|breakup|girlfriend|boyfriend|chhodi gayu|chhodi gayi|dur thay gayu|jhop nathi|nind nathi|hu j problem|hu thappu|handle nathi|sambhali nathi|koi nathi|koi samajhtu nathi|koi sunatu nathi)\b/.test(lower);
  }

  if (lang === "pa") {
    return /\b(dukh|dar|ikalla|ikalli|gussa|thakaan|jhagda|fikar|takleef|boss|office|kaam|pressure|relationship|breakup|girlfriend|boyfriend|chhad gaya|chhad gayi|dur ho gaya|dur ho gayi|neend nahi|so nahi sakda|so nahi sakdi|main hi problem|meri galti|handle nahi|sambhaal nahi|koi nahi|koi samajh nahi)\b/.test(lower);
  }

  if (lang === "kn") {
    return /\b(novu|bhaya|ontanagi|sust|kopa|jangu|chintane|baadhe|kelasa|boss|office|pressure|sambandha|todar|prema|breakup|girlfriend|boyfriend|hogibittare|hogibittalu|door hogibittare|nidde illa|nidde baratilla|naane thappu|nanna thappu|handle maadokettu|sambalisolla|yaaru illa|yaaru arthamadikollaaru)\b/.test(lower);
  }

  if (lang === "ml") {
    return /\b(dukkham|bhayam|thanimayal|kopam|akalambol|vedana|problem|boss|office|joli|pressure|bandham|prema|breakup|girlfriend|boyfriend|poyi|pirinjupoyee|door ayi|thookam illa|thookam varunilla|njaan thettanu|ente thettanu|handle cheyyaan patunilla|sambhalikkan patunilla|aarumilla|aarumpuriyunilla)\b/.test(lower);
  }

  if (lang === "or") {
    return /\b(dukha|bhaya|eka|raga|thaka|chinta|kasta|problem|boss|office|kaam|pressure|sambandha|jhagda|breakup|girlfriend|boyfriend|chhadiga|chhadile|dura heigala|ghuma nehuni|ghuma nahi|mun hi problem|mora bhul|handle napariba|sambhaliba napariba|keu nahi|keu bujhibu nahi)\b/.test(lower);
  }

  if (lang === "ur") {
    return /\b(udaas|pareshan|akela|akeli|gussa|dard|khauf|takleef|jhagda|ladai|kaam|boss|pressure|office|rishta|breakup|relationship|girlfriend|boyfriend|chod gaya|chod gayi|dil toota|dil toot gaya|tanha|umeed nahi|neend nahi|so nahi sakta|so nahi sakti|main hi problem|meri galti|handle nahi|sambhal nahi|koi nahi|koi samajhta nahi)\b/.test(lower);
  }

  return false;
}

function hasStrongForeignEmotionalSignal(msg: string, lang: string): boolean {
  const t = msg;
  const lower = t.toLowerCase();

  if (lang === "ar") {
    return /[\u0600-\u06FF]/.test(t)
      ? /(?:حزن|حزين|حزينة|وحيد|وحيدة|خائف|خايف|غاضب|غضب|ضغط|مشكلة|علاقة|عمل|رئيس|انفصال|مكتئب|تعب|بكاء|خوف|قلق|يأس|فراق|مدير)/.test(t)
      : /\b(hazeen|hazin|za3lan|waheed|waheeda|daght|mushkila|3ilaqeh|shughl|boss|ra2ees|infisaal|ta3ban|khawf|qalaq|ya2s|firaq|mudir|wihda|baeed)\b/.test(lower);
  }

  if (lang === "zh") {
    return /[\u4E00-\u9FFF]/.test(t)
      ? /(?:难过|悲伤|孤独|孤单|害怕|恐惧|生气|愤怒|压力|问题|关系|工作|分手|失恋|焦虑|抑郁|绝望|委屈|崩溃|痛苦|失眠|哭|老板|上司)/.test(t)
      : /\b(nanguo|beishang|gudu|gudan|haipa|shengqi|yaoli|wenti|guanxi|gongzuo|fenshou|jiaolv|juewang|shangxin|weiqu|bengkui|tongku|shimian|laaban)\b/.test(lower);
  }

  if (lang === "es") {
    return /\b(triste|tristeza|solo|sola|soledad|miedo|enojado|enojada|presión|problema|relación|trabajo|jefe|ruptura|ansiedad|deprimido|deprimida|agotado|agotada|lloro|llorando|no puedo|no aguanto|abandonado|abandonada|perdido|perdida|roto|rota)\b/.test(lower);
  }

  if (lang === "fr") {
    return /\b(triste|tristesse|seul|seule|solitude|peur|colère|pression|problème|relation|travail|patron|rupture|anxieux|anxieuse|déprimé|déprimée|épuisé|épuisée|je pleure|je n'arrive plus|abandonné|abandonnée|perdu|perdue|brisé|brisée)\b/.test(lower);
  }

  if (lang === "pt") {
    return /\b(triste|tristeza|sozinho|sozinha|solidão|medo|com raiva|pressão|problema|relacionamento|trabalho|chefe|término|ansioso|ansiosa|deprimido|deprimida|cansado|cansada|chorando|não consigo|não aguento|abandonado|abandonada|perdido|perdida)\b/.test(lower);
  }

  if (lang === "ru") {
    return /[\u0400-\u04FF]/.test(t)
      ? /(?:грустно|грустный|грустная|грусть|одинок|одинока|страх|злость|давление|работа|отношения|расставание|тревога|депрессия|не могу|плачу|усталый|усталая|брошен|брошена|потерян|потеряна|начальник|босс)/.test(t)
      : /\b(grustno|grustnyy|odinok|odinoka|strakh|zlost|davlenie|rabota|otnosheniya|rasstavanie|trevoga|depressiya|ne mogu|plachu|ustalyy|broshen|broshena|nachalnik)\b/.test(lower);
  }

  if (lang === "id") {
    return /\b(sedih|sendirian|sendiri|takut|marah|tekanan|masalah|hubungan|kerja|atasan|bos|putus|cemas|depresi|capek|lelah|nangis|nggak bisa|tidak bisa|nggak kuat|tidak kuat|ditinggal|kesepian)\b/.test(lower);
  }

  if (lang === "de") {
    return /\b(traurig|allein|einsamkeit|einsam|angst|wütend|wuetend|druck|problem|beziehung|arbeit|chef|trennung|burnout|deprimiert|erschöpft|erschoepft|weine|nicht mehr|verlassen|verloren|kaputt)\b/.test(lower);
  }

  return false;
}

function draftResponseForLanguage(
  userMessage: string,
  ctx: SessionContext,
): ImotaraResponse {
  const lang = getPreferredLanguage(ctx, userMessage);

  // Keep explicit localized fallback for all supported Indian languages.
  // For every other language, use the generic draft path for now.
  const INDIAN_LANGS = new Set(["hi", "bn", "mr", "gu", "kn", "ta", "te", "ml", "pa", "or", "ur"]);
  const FOREIGN_LANGS = new Set(["ar", "zh", "es", "fr", "pt", "ru", "id", "de"]);
  if (!INDIAN_LANGS.has(lang) && !FOREIGN_LANGS.has(lang)) {
    // propagate detected language so downstream formatters can honor it
    (ctx as any).preferredLanguage = lang;

    return draftResponse(userMessage, ctx);
  }

  // For any Indian language with strong emotional content, build a richer inline
  // response instead of falling back to the short 3-option ACK pool.
  // NOTE: we do NOT delegate to draftResponse() here because that produces English
  // text — this route returns template text directly to the client.
  if (INDIAN_LANGS.has(lang) && hasStrongRomanIndicEmotionalSignal(userMessage, lang)) {
    const lower2 = userMessage.toLowerCase();
    const name2 = getUserName({ ...ctx } as SessionContext);
    const rel2 = pickRelationshipTone({ ...ctx } as SessionContext);
    const isFemale2 = pickCompanionGender({ ...ctx } as SessionContext) === "female";
    const seed2 = `${lang}:emo:${userMessage}:${rel2}:${name2 ?? ""}`;

    if (lang === "bn") {
      // Topic detection for Bengali
      const isWork = /\b(boss|office|kaaj|pressure|chap|manager|kaam)\b/.test(lower2);
      const isRelationship = /\b(jhogra|jhagra|bhalobasha|bhalobashi na|bhalobasi na|breakup|dur hoye|dure jacchi|tor katha|tomar katha|girlfriend|boyfriend|relationship)\b/.test(lower2);
      const isCrisis = /\b(sesh kore|sesh kore debo|mara jabo|mare jabo|nishwas nite)\b/.test(lower2);
      const isLonely = /\b(ekla|eklo|keu nei|karo nei|keu bujhe na|keu shune na|keu jana na)\b/.test(lower2);

      let bnMsg: string;
      let bnFollow: string;

      if (isCrisis) {
        bnMsg = "এখন তুমি অনেক ভারী জায়গায় আছো। আমি সত্যিই পাশে আছি।";
        bnFollow = "এই মুহূর্তে তোমার কি কাছে কেউ আছে — কেউ যাকে ডাকতে পারো?";
      } else if (isWork) {
        bnMsg = pickFrom(seed2 + ":work", [
          "কাজের এই চাপটা সত্যিই অনেক ভারী — ঘুমের অভাব, বসের প্রেশার — সব একসাথে অনেক বেশি হয়ে যায়।",
          "এই ধরনের চাপ শরীর আর মন দুটোকেই খায়। তুমি একটু অনেক বেশি বহন করছো এখন।",
          "বসের চাপ আর ঘুম না হওয়া — এটা দীর্ঘদিন সহ্য করা সহজ না।",
        ] as const);
        bnFollow = pickFrom(seed2 + ":work:follow", [
          "এই মুহূর্তে সবচেয়ে বেশি কষ্ট দিচ্ছে কোনটা — কাজের চাপ, নাকি ভেতরের ক্লান্তি?",
          "কাজ ছাড়া — এই সময়ে একটুও নিজের জন্য কিছু করার সুযোগ হচ্ছে?",
          "কখন থেকে এভাবে চলছে?",
        ] as const);
      } else if (isRelationship) {
        bnMsg = pickFrom(seed2 + ":rel", [
          "সম্পর্কে এই দূরত্বটা — এটা সত্যিই অনেক কষ্টের।",
          "ঝগড়া আর দূরত্ব — দুটো একসাথে এলে মনটা অনেক ভারী হয়ে যায়।",
          "এই অনুভূতিটা — যে কাছের মানুষ দূরে সরে যাচ্ছে — এটা খুব কঠিন।",
        ] as const);
        bnFollow = pickFrom(seed2 + ":rel:follow", [
          "তোমার কি মনে হচ্ছে এই দূরত্বটা নতুন, নাকি আস্তে আস্তে বাড়ছিল?",
          "সে কি জানে তুমি এতটা কষ্ট পাচ্ছো?",
          "এই ব্যাপারটা কতদিন ধরে চলছে?",
        ] as const);
      } else if (isLonely) {
        bnMsg = pickFrom(seed2 + ":lonely", [
          "এই একাকীত্বটা — যখন মনে হয় কেউ বুঝছে না — এটা খুব কঠিন জায়গা।",
          "কেউ না থাকলে বা না বুঝলে — সেই ফাঁকাটা অনেক ভারী লাগে।",
          "এই অনুভূতিটা — যে কেউ শুনছে না — এটা সত্যিই কষ্টদায়ক।",
        ] as const);
        bnFollow = pickFrom(seed2 + ":lonely:follow", [
          "কেউ কি আছে তোমার জীবনে যার সাথে এগুলো ভাগ করা যায়?",
          "এই একাকীত্বটা কি সবসময় ছিল, নাকি কোনো একটা সময় থেকে বেড়েছে?",
          "তুমি কি চাও আমি একটু বেশি শুনি?",
        ] as const);
      } else {
        bnMsg = pickFrom(seed2 + ":general", [
          "এই অনুভূতিটা — যখন সব একসাথে ভারী হয়ে যায় — বুঝতে পারছি।",
          "এত কিছু একসাথে সামলানো সহজ না। তুমি অনেক বেশি বহন করছো।",
          "এই কষ্টটা জায়গা পাওয়ার দরকার ছিল। ভালো করলে বললে।",
        ] as const);
        bnFollow = pickFrom(seed2 + ":general:follow", [
          "এই মুহূর্তে সবচেয়ে কোন বিষয়টা তোমাকে বেশি কষ্ট দিচ্ছে?",
          "আরেকটু বলবে — কখন থেকে এরকম লাগছে?",
          "তুমি চাইলে আরেকটু বলো — আমি শুনছি।",
        ] as const);
      }

      const bnNamePrefix = name2 ? `${name2}, ` : "";
      return {
        message: `${bnNamePrefix}${bnMsg}`,
        followUp: bnFollow,
        meta: {
          styleContract: "1.0",
          blueprint: "1.0",
          blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }),
        },
      };
    }

    if (lang === "hi") {
      // Topic detection for Hindi
      const isWork = /\b(boss|manager|kaam|pressure|takleef|office|dabaao)\b/.test(lower2);
      const isRelationship = /\b(jhagda|jhagre|ladai|larai|breakup|dhoka|rishta|girlfriend|boyfriend|relationship|chod gaya|chod gayi)\b/.test(lower2);
      const isCrisis = /\b(marne|mar jaana|khatam karna|khud ko nahi|mujhe nahi chahiye|sab khatam)\b/.test(lower2);
      const isLonely = /\b(akela|akeli|koi nahi|koi nahi sunta|koi nahi samjha)\b/.test(lower2);

      let hiMsg: string;
      let hiFollow: string;

      const hi2 = (m: string, f: string) => isFemale2 ? f : m;

      if (isCrisis) {
        hiMsg = `अभी तुम बहुत भारी जगह पर हो। ${hi2("मैं यहाँ हूँ", "मैं यहाँ हूँ")} — सच में।`;
        hiFollow = "इस वक़्त तुम्हारे पास कोई है — कोई जिसे बुला सको?";
      } else if (isWork) {
        hiMsg = pickFrom(seed2 + ":work", [
          `काम का यह दबाव सच में बहुत भारी है — ${hi2("नींद नहीं, बॉस का प्रेशर", "नींद नहीं, बॉस का प्रेशर")} — यह सब एक साथ बहुत ज़्यादा है।`,
          "इस तरह का दबाव शरीर और मन दोनों को थका देता है। तुम अभी बहुत ज़्यादा उठा रहे हो।",
          "बॉस का प्रेशर और नींद न आना — यह लंबे वक़्त तक सहना आसान नहीं है।",
        ] as const);
        hiFollow = pickFrom(seed2 + ":work:follow", [
          "अभी सबसे ज़्यादा क्या चुभ रहा है — काम का बोझ, या भीतर की थकान?",
          "काम के अलावा — इस वक़्त खुद के लिए थोड़ा भी वक़्त निकल पा रहा है?",
          "कब से ऐसा चल रहा है?",
        ] as const);
      } else if (isRelationship) {
        hiMsg = pickFrom(seed2 + ":rel", [
          "रिश्ते में यह दूरी — यह सच में बहुत तकलीफ़देह है।",
          "झगड़ा और दूरी — दोनों एक साथ आएं तो मन बहुत भारी हो जाता है।",
          "यह अहसास — कि जो करीबी है वो दूर जा रहा है — यह बहुत मुश्किल होता है।",
        ] as const);
        hiFollow = pickFrom(seed2 + ":rel:follow", [
          "तुम्हें क्या लगता है — यह दूरी नई है, या धीरे-धीरे बढ़ रही थी?",
          "क्या उसे पता है तुम इतना दर्द महसूस कर रहे हो?",
          "यह कब से चल रहा है?",
        ] as const);
      } else if (isLonely) {
        hiMsg = pickFrom(seed2 + ":lonely", [
          "यह अकेलापन — जब लगे कि कोई समझ नहीं रहा — यह बहुत कठिन जगह है।",
          "जब कोई न हो या न समझे — वह खालीपन बहुत भारी लगता है।",
          "यह अहसास — कि कोई नहीं सुन रहा — यह सच में तकलीफ़देह है।",
        ] as const);
        hiFollow = pickFrom(seed2 + ":lonely:follow", [
          "क्या कोई है तुम्हारी ज़िंदगी में जिससे यह सब शेयर कर सको?",
          "यह अकेलापन हमेशा से था, या किसी एक वक़्त से बढ़ा है?",
          "क्या तुम चाहते हो मैं थोड़ा और सुनूँ?",
        ] as const);
      } else {
        hiMsg = pickFrom(seed2 + ":general", [
          "यह अहसास — जब सब कुछ एक साथ भारी हो जाए — समझ में आता है।",
          "इतना सब एक साथ सँभालना आसान नहीं। तुम बहुत ज़्यादा उठा रहे हो।",
          "यह दर्द जगह पाने का हकदार था। अच्छा किया बताया।",
        ] as const);
        hiFollow = pickFrom(seed2 + ":general:follow", [
          "इस वक़्त सबसे ज़्यादा कौन सी बात तकलीफ़ दे रही है?",
          "थोड़ा और बताओ — कब से ऐसा लग रहा है?",
          "चाहो तो और बताओ — मैं सुन रहा हूँ।",
        ] as const);
      }

      const hiNamePrefix = name2 ? `${name2}, ` : "";
      return {
        message: `${hiNamePrefix}${hiMsg}`,
        followUp: hiFollow,
        meta: {
          styleContract: "1.0",
          blueprint: "1.0",
          blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }),
        },
      };
    }

    // ── Marathi (mr) rich path ───────────────────────────────────────────
    if (lang === "mr") {
      const isWork = /\b(boss|office|kaam|pressure|dabaav|manager)\b/.test(lower2);
      const isRelationship = /\b(jhagda|bhandna|breakup|rishta|relationship|girlfriend|boyfriend|chod gela|chod geli)\b/.test(lower2);
      const isCrisis = /\b(marne|marayla|sab sampla|khud la|swatahla)\b/.test(lower2);
      const isLonely = /\b(ekta|akela|akeli|koni nahi|koni samajhna)\b/.test(lower2);
      const isFemale2mr = isFemale2;

      let mrMsg: string;
      let mrFollow: string;

      if (isCrisis) {
        mrMsg = "आत्ता तू खूप जड जागी आहेस. मी खरोखरच सोबत आहे.";
        mrFollow = "या क्षणी तुझ्याजवळ कोणी आहे का — कोणाला बोलवू शकतोस?";
      } else if (isWork) {
        mrMsg = pickFrom(seed2 + ":work", [
          "कामाचा हा ताण खरोखरच खूप जड असतो — झोप नाही, बॉसचा दबाव — सगळं एकत्र खूप जड होतं.",
          "असा ताण मन आणि शरीर दोन्हींना थकवतो. तू आत्ता खूप जास्त ओझं " + (isFemale2mr ? "वाहतेयस" : "वाहतोयस") + ".",
          "बॉसचा दबाव आणि झोप न होणं — हे दीर्घकाळ सहन करणं सोपं नाही.",
        ] as const);
        mrFollow = pickFrom(seed2 + ":work:follow", [
          "आत्ता सगळ्यात जास्त कशाचा भार वाटतोय — कामाचा की आतली थकवा?",
          "या वेळी स्वतःसाठी थोडा वेळ मिळतोय का?",
          "हे कधीपासून असं चालू आहे?",
        ] as const);
      } else if (isRelationship) {
        mrMsg = pickFrom(seed2 + ":rel", [
          "नात्यातला हा दुरावा खरोखरच खूप जड असतो.",
          "भांडण आणि दुरावा — दोन्ही एकत्र आले की मन खूप जड होतं.",
          "जवळच्या माणसाने दूर सरणं — हा अनुभव खूप कठीण असतो.",
        ] as const);
        mrFollow = pickFrom(seed2 + ":rel:follow", [
          "हा दुरावा नवीन आहे, की हळूहळू वाढत होता?",
          "त्याला/तिला माहीत आहे का तू इतका/इतकी दुखावलेला/दुखावलेली आहेस?",
          "हे किती दिवसांपासून चालू आहे?",
        ] as const);
      } else if (isLonely) {
        mrMsg = pickFrom(seed2 + ":lonely", [
          "ही एकटेपणाची भावना — जेव्हा वाटतं कोणी समजत नाही — ही खूप कठीण जागा आहे.",
          "कोणी नसेल किंवा समजत नसेल — तो रिकामेपणा खूप जड वाटतो.",
          "हे अनुभव — कोणी ऐकत नाही — हे खरोखर त्रासदायक असतं.",
        ] as const);
        mrFollow = pickFrom(seed2 + ":lonely:follow", [
          "तुझ्या आयुष्यात कोणी आहे का ज्याच्याशी हे सांगता येईल?",
          "हा एकटेपणा नेहमीच होता, की एखाद्या वेळेपासून वाढला?",
          "मी आणखी ऐकावं असं वाटतं का?",
        ] as const);
      } else {
        mrMsg = pickFrom(seed2 + ":general", [
          "हे सगळं एकत्र जड होतं तेव्हाची ही भावना — समजते.",
          "इतकं सगळं एकट्याने सांभाळणं सोपं नाही. तू खूप जास्त उचलतोयस/उचलतेयस.",
          "हे दुखणं जागा मिळवण्यास पात्र होतं. सांगितलंस हे चांगलं केलंस.",
        ] as const);
        mrFollow = pickFrom(seed2 + ":general:follow", [
          "आत्ता सगळ्यात कोणती गोष्ट सगळ्यात जास्त त्रास देतेय?",
          "थोडं आणखी सांग — कधीपासून असं वाटतंय?",
          "सांगायचं असेल तर सांग — मी ऐकतोय/ऐकतेय.",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${mrMsg}` : mrMsg,
        followUp: mrFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Gujarati (gu) rich path ──────────────────────────────────────────
    if (lang === "gu") {
      const isWork = /\b(boss|office|kaam|pressure|dabaav|manager)\b/.test(lower2);
      const isRelationship = /\b(jhagdo|breakup|relationship|girlfriend|boyfriend|chhodi gayu|chhodi gayi)\b/.test(lower2);
      const isCrisis = /\b(marne|khatam|sab sambhal nathi)\b/.test(lower2);
      const isLonely = /\b(eklo|ekla|koi nathi|koi samajhtu nathi)\b/.test(lower2);

      let guMsg: string;
      let guFollow: string;

      if (isCrisis) {
        guMsg = "અત્યારે તું ઘણી ભારે જગ્યા પર છ. હું ખરેખર સાથે છ.";
        guFollow = "આ ક્ષણે તારી પાસે કોઈ છે — કોઈ જેને બોલાવી શકે?";
      } else if (isWork) {
        guMsg = pickFrom(seed2 + ":work", [
          "કામ નો આ ભાર ખૂબ ભારે છે — ઊઘ નહીં, boss નું દબાણ — બધું ભેળું ઘણું વધારે થઈ જાય.",
          "આ પ્રકારનો ભાર શરીર અને મન બન્નેને થકવી નાખે. તું હમણાં ઘણું ઉઠાવી રહ્ય" + (isFemale2 ? "ી" : "ો") + " છ.",
          "Boss નું દબાણ ને ઊઘ ન આવવી — આ લાંબો સમય સહેવું સહેલું નથી.",
        ] as const);
        guFollow = pickFrom(seed2 + ":work:follow", [
          "હમણાં સૌથી વધુ શું ભારે છે — કામ નું દબાણ, કે ભીતરની થકાન?",
          "આ સમયે તારા માટે થોડો સ્વ-સમય મળે છે?",
          "ક્યારથી આ રીતે ચાલે છે?",
        ] as const);
      } else if (isRelationship) {
        guMsg = pickFrom(seed2 + ":rel", [
          "સંબંધ માં આ અંતર ખૂબ ભારે છે.",
          "ઝઘડો ને અંતર — બન્ને ભેળા આવ્યા ત્યારે મન ઘણું ભારી થઈ જાય.",
          "નજીક ના માણસ નું દૂર જવું — આ અનુભવ ઘણો કઠીણ છે.",
        ] as const);
        guFollow = pickFrom(seed2 + ":rel:follow", [
          "આ અંતર નવું છે, કે ધીમે ધીમે વધ્યું?",
          "તેને ખ્યાલ છે કે તું ઘણો/ઘણી દુ:ખી છ?",
          "આ ક્યારથી ચાલે છે?",
        ] as const);
      } else if (isLonely) {
        guMsg = pickFrom(seed2 + ":lonely", [
          "આ એકલતા — જ્યારે લાગે કે કોઈ સમજતું નથી — ઘણી કઠીણ જગ્યા.",
          "કોઈ ન હોય અથવા ન સમજે — આ ખાલીપો ઘણો ભારે લાગે.",
          "આ અહેસાસ — કે કોઈ સાંભળતું નથી — ખૂબ ત્રાસ આપનારો છે.",
        ] as const);
        guFollow = pickFrom(seed2 + ":lonely:follow", [
          "તારી જિંદગીમાં કોઈ છે જેની સાથે આ વાત વહેતી કરી શકાય?",
          "આ એકલાપણ હમેશા હતું, કે ક્યારેકથી વધ્યું?",
          "હું થોડું વધારે સાંભળવા માંગું છું.",
        ] as const);
      } else {
        guMsg = pickFrom(seed2 + ":general", [
          "બધું ભેળું ભારે થઈ જ્યારે — આ અહેસાસ સમજાય છે.",
          "આ બધું એકલા સંભાળવું સહેલું નથી. તું હમણાં ઘણું ઉઠાવી રહ્યો/રહ્યી છ.",
          "આ દર્દ ને જગ્યા આપવાની જરૂર હતી. જે આવ્યું, સાંભળ.",
        ] as const);
        guFollow = pickFrom(seed2 + ":general:follow", [
          "હમણાં સૌથી વધુ શું ભારે લાગ્યું?",
          "થોડું વધારે કહ — ક્યારથી આ રીતે છે?",
          "કહેવું હોય તો કહ — હું સાંભળ્લ઼ ‌ > raho/rahii chhu.",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${guMsg}` : guMsg,
        followUp: guFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Kannada (kn) rich path ───────────────────────────────────────────
    if (lang === "kn") {
      const isWork = /\b(boss|office|kelasa|pressure|dabaav|manager)\b/.test(lower2);
      const isRelationship = /\b(todar|sambandha|prema|breakup|relationship|girlfriend|boyfriend|hogibittare|hogibittalu)\b/.test(lower2);
      const isCrisis = /\b(saaybekku|saaytini|khatam|sambalisolla)\b/.test(lower2);
      const isLonely = /\b(ontanagi|yaaru illa|yaaru arthamadikollaaru)\b/.test(lower2);

      let knMsg: string;
      let knFollow: string;

      if (isCrisis) {
        knMsg = "ನೀನು ಈಗ ತುಂಬಾ ಕಷ್ಟದ ಜಾಗದಲ್ಲಿ ಇದ್ದೀಯ. ನಾನು ನಿಜವಾಗಿಯೂ ಪಕ್ಕದಲ್ಲಿದ್ದೇನೆ.";
        knFollow = "ಈ ಕ್ಷಣ ನಿನ್ನ ಹತ್ತಿರ ಯಾರಾದರೂ ಇದ್ದಾರಾ — ಯಾರನ್ನಾದರೂ ಕರೆಯಬಲ್ಲೆಯಾ?";
      } else if (isWork) {
        knMsg = pickFrom(seed2 + ":work", [
          "ಕೆಲಸದ ಈ ಒತ್ತಡ ನಿಜವಾಗಿಯೂ ತುಂಬಾ ಭಾರವಾಗಿದೆ — ನಿದ್ದೆ ಇಲ್ಲ, boss ಒತ್ತಡ — ಎಲ್ಲ ಒಟ್ಟಿಗೆ ಬಹಳ ಜಾಸ್ತಿಯಾಗುತ್ತದೆ.",
          "ಈ ರೀತಿಯ ಒತ್ತಡ ಶರೀರ ಮತ್ತು ಮನಸ್ಸು ಎರಡನ್ನೂ ತಿನ್ನುತ್ತದೆ. ನೀನು ಈಗ ತುಂಬಾ ಹೆಚ್ಚು ಹೊರುತ್ತಿದ್ದೀಯ.",
          "Boss ಒತ್ತಡ ಮತ್ತು ನಿದ್ದೆ ಬರದಿರುವುದು — ಇದನ್ನು ಬಹಳ ಕಾಲ ತಾಳುವುದು ಸುಲಭ ಅಲ್ಲ.",
        ] as const);
        knFollow = pickFrom(seed2 + ":work:follow", [
          "ಈಗ ಅತ್ಯಂತ ಭಾರವಾಗಿ ಅನ್ನಿಸುತ್ತಿರುವುದು ಯಾವುದು — ಕೆಲಸದ ಒತ್ತಡವಾ, ಒಳಗಿನ ಆಯಾಸವಾ?",
          "ಈ ಸಮಯದಲ್ಲಿ ಸ್ವಲ್ಪ ನಿನ್ನ ಸ್ವಂತ ಸಮಯ ಸಿಗುತ್ತಿದೆಯಾ?",
          "ಇದು ಯಾವಾಗಿನಿಂದ ಹೀಗಿದೆ?",
        ] as const);
      } else if (isRelationship) {
        knMsg = pickFrom(seed2 + ":rel", [
          "ಸಂಬಂಧದಲ್ಲಿ ಈ ದೂರ ನಿಜವಾಗಿಯೂ ತುಂಬಾ ನೋವಿನದ್ದಾಗಿದೆ.",
          "ಜಗಳ ಮತ್ತು ದೂರ — ಎರಡೂ ಒಟ್ಟಿಗೆ ಬಂದಾಗ ಮನಸ್ಸು ತುಂಬಾ ಭಾರವಾಗುತ್ತದೆ.",
          "ಹತ್ತಿರದ ವ್ಯಕ್ತಿ ದೂರ ಹೋಗುವುದು — ಈ ಅನುಭವ ತುಂಬಾ ಕಷ್ಟದ್ದು.",
        ] as const);
        knFollow = pickFrom(seed2 + ":rel:follow", [
          "ಈ ದೂರ ಹೊಸದಾ, ಇಲ್ಲಾ ನಿಧಾನ ನಿಧಾನ ಹೆಚ್ಚಾಗಿತ್ತಾ?",
          "ಅವನಿಗೆ/ಅವಳಿಗೆ ಗೊತ್ತಾ ನೀನು ಇಷ್ಟೊಂದು ನೋವು ಅನುಭವಿಸುತ್ತಿದ್ದೀಯ ಅಂತ?",
          "ಇದು ಎಷ್ಟು ದಿನದಿಂದ ನಡೆಯುತ್ತಿದೆ?",
        ] as const);
      } else if (isLonely) {
        knMsg = pickFrom(seed2 + ":lonely", [
          "ಈ ಒಂಟಿತನ — ಯಾರೂ ಅರ್ಥ ಮಾಡಿಕೊಳ್ಳುತ್ತಿಲ್ಲ ಅನ್ನಿಸಿದಾಗ — ತುಂಬಾ ಕಷ್ಟದ ಜಾಗ.",
          "ಯಾರೂ ಇಲ್ಲದಾಗ ಅಥವಾ ಅರ್ಥ ಮಾಡಿಕೊಳ್ಳದಾಗ — ಆ ಶೂನ್ಯತೆ ಬಹಳ ಭಾರವಾಗಿ ಕಾಣುತ್ತದೆ.",
          "ಈ ಅನ್ನಿಸಿಕೆ — ಯಾರೂ ಕೇಳ್ತಿಲ್ಲ ಅಂತ — ಇದು ನಿಜವಾಗಿಯೂ ಕಷ್ಟದ್ದು.",
        ] as const);
        knFollow = pickFrom(seed2 + ":lonely:follow", [
          "ನಿನ್ನ ಜೀವನದಲ್ಲಿ ಯಾರಾದರೂ ಇದ್ದಾರಾ ಇವೆಲ್ಲ ಹಂಚಿಕೊಳ್ಳಲು?",
          "ಈ ಒಂಟಿತನ ಯಾವಾಗಲೂ ಇತ್ತಾ, ಇಲ್ಲಾ ಒಂದು ಕಾಲದಿಂದ ಹೆಚ್ಚಾಗಿದ್ದಾ?",
          "ನಾನು ಇನ್ನಷ್ಟು ಕೇಳ್ಲಿ ಅಂತ ಇಷ್ಟ ಆ?",
        ] as const);
      } else {
        knMsg = pickFrom(seed2 + ":general", [
          "ಎಲ್ಲ ಒಟ್ಟಿಗೆ ಭಾರವಾಗಿದ್ದಾಗ — ಆ ಅನ್ನಿಸಿಕೆ ಅರ್ಥ ಆಗುತ್ತದೆ.",
          "ಇಷ್ಟನ್ನೆಲ್ಲ ಒಂಟಿಯಾಗಿ ಸಂಭಾಳಿಸುವುದು ಸುಲಭ ಅಲ್ಲ. ನೀನು ತುಂಬಾ ಹೆಚ್ಚು ಹೊರುತ್ತಿದ್ದೀಯ.",
          "ಈ ನೋವಿಗೆ ಒಂದು ಜಾಗ ಬೇಕಾಗಿತ್ತು. ಹೇಳಿದ್ದು ಒಳ್ಳೇದಾಯ್ತು.",
        ] as const);
        knFollow = pickFrom(seed2 + ":general:follow", [
          "ಈಗ ಯಾವ ವಿಷಯ ಅತ್ಯಂತ ನೋವು ಕೊಡುತ್ತಿದೆ?",
          "ಇನ್ನಷ್ಟು ಹೇಳು — ಯಾವಾಗಿನಿಂದ ಹೀಗೆ ಅನ್ನಿಸುತ್ತಿದೆ?",
          "ಹೇಳಬೇಕು ಅಂದ್ರೆ ಹೇಳು — ನಾನು ಕೇಳ್ತಿದ್ದೇನೆ.",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${knMsg}` : knMsg,
        followUp: knFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Tamil (ta) rich path ─────────────────────────────────────────────
    if (lang === "ta") {
      const isWork = /\b(boss|office|velai|thozhil|pressure|azhutham|manager)\b/.test(lower2);
      const isRelationship = /\b(sandai|kavarchal|kaadhal|breakup|relationship|girlfriend|boyfriend|pirital|pirinjupoyee)\b/.test(lower2);
      const isCrisis = /\b(saaganum|saavenu|khatam|thanga mudiyala)\b/.test(lower2);
      const isLonely = /\b(thanimai|thanimaiyaaga|yarum illai|yarum puriyavillai)\b/.test(lower2);

      let taMsg: string;
      let taFollow: string;

      if (isCrisis) {
        taMsg = "நீ இப்போது மிகவும் கனமான இடத்தில் இருக்கிறாய். நான் உண்மையிலேயே இங்கே இருக்கிறேன்.";
        taFollow = "இந்த நேரத்தில் உன்னிடம் யாராவது இருக்கிறார்களா — யாரையாவது அழைக்க முடியுமா?";
      } else if (isWork) {
        taMsg = pickFrom(seed2 + ":work", [
          "வேலையின் இந்த அழுத்தம் மிகவும் கஷ்டமானது — தூக்கமின்மை, boss அழுத்தம் — எல்லாம் ஒரே நேரத்தில் மிகவும் அதிகமாகிவிடுகிறது.",
          "இது போன்ற அழுத்தம் உடலையும் மனதையும் இரண்டையும் சாப்பிடுகிறது. நீ இப்போது மிக அதிகமாக சுமக்கிறாய்.",
          "Boss அழுத்தம் மற்றும் தூக்கமின்மை — இதை நீண்ட காலம் தாங்குவது எளிதல்ல.",
        ] as const);
        taFollow = pickFrom(seed2 + ":work:follow", [
          "இப்போது எது உன்னை அதிகமாக வலிக்கிறது — வேலை அழுத்தமா, உள்ளிருக்கும் களைப்பா?",
          "இந்த நேரத்தில் உனக்காக கொஞ்சம் நேரம் கிடைக்கிறதா?",
          "எப்போதிலிருந்து இப்படி இருக்கிறது?",
        ] as const);
      } else if (isRelationship) {
        taMsg = pickFrom(seed2 + ":rel", [
          "உறவில் இந்த தூரம் மிகவும் வலிக்கிறது.",
          "சண்டை மற்றும் தூரம் — இரண்டும் ஒன்றாக வரும்போது மனம் மிகவும் கஷ்டமாகிவிடுகிறது.",
          "நெருங்கிய மனிதர் விலகிப்போவது — இந்த அனுபவம் மிகவும் கடினமானது.",
        ] as const);
        taFollow = pickFrom(seed2 + ":rel:follow", [
          "இந்த தூரம் புதியதா, இல்லை மெல்ல மெல்ல அதிகமாகியதா?",
          "அவன்/அவள் உன் வலியைப் புரிந்துகொண்டிருக்கிறானா/ள்?",
          "இது எவ்வளவு நாளாக நடக்கிறது?",
        ] as const);
      } else if (isLonely) {
        taMsg = pickFrom(seed2 + ":lonely", [
          "இந்த தனிமை — யாரும் புரிந்துகொள்ளவில்லை என்று தோன்றும்போது — மிகவும் கஷ்டமான இடம்.",
          "யாரும் இல்லாதபோது அல்லது புரிந்துகொள்ளாதபோது — அந்த வெறுமை மிகவும் கனமாக உணர்கிறது.",
          "இந்த உணர்வு — யாரும் கேட்கவில்லை என்று — இது உண்மையிலேயே வலிக்கிறது.",
        ] as const);
        taFollow = pickFrom(seed2 + ":lonely:follow", [
          "உன் வாழ்க்கையில் யாராவது இருக்கிறார்களா இதை பகிர்ந்துகொள்ள?",
          "இந்த தனிமை எப்போதும் இருந்ததா, இல்லை ஒரு காலகட்டத்திலிருந்து அதிகமாகியதா?",
          "நான் இன்னும் கொஞ்சம் கேட்கட்டுமா?",
        ] as const);
      } else {
        taMsg = pickFrom(seed2 + ":general", [
          "எல்லாம் ஒன்றாக கனமாகிவிடும்போது — அந்த உணர்வு புரிகிறது.",
          "இவ்வளவையும் தனியாக சமாளிப்பது எளிதல்ல. நீ மிக அதிகமாக சுமக்கிறாய்.",
          "இந்த வலிக்கு ஒரு இடம் தேவைப்பட்டது. சொன்னது நல்லது.",
        ] as const);
        taFollow = pickFrom(seed2 + ":general:follow", [
          "இப்போது எந்த விஷயம் அதிகமாக வலிக்கிறது?",
          "இன்னும் கொஞ்சம் சொல் — எப்போதிலிருந்து இப்படி தோன்றுகிறது?",
          "சொல்ல விரும்பினால் சொல் — நான் கேட்கிறேன்.",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${taMsg}` : taMsg,
        followUp: taFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Telugu (te) rich path ────────────────────────────────────────────
    if (lang === "te") {
      const isWork = /\b(boss|office|pani|pressure|dabaav|manager)\b/.test(lower2);
      const isRelationship = /\b(sandadi|prema|relationship|breakup|girlfriend|boyfriend|vellipoyindi|thanu vellipoyi)\b/.test(lower2);
      const isCrisis = /\b(chaavali|chaavatam|khatam|aasha ledu)\b/.test(lower2);
      const isLonely = /\b(ontariga|yaaru ledu|yaaru artham cheyatledu)\b/.test(lower2);

      let teMsg: string;
      let teFollow: string;

      if (isCrisis) {
        teMsg = "నువ్వు ఇప్పుడు చాలా కష్టమైన స్థలంలో ఉన్నావు. నేను నిజంగా ఇక్కడే ఉన్నాను.";
        teFollow = "ఈ క్షణంలో నీ దగ్గర ఎవరైనా ఉన్నారా — ఎవరినైనా పిలవగలవా?";
      } else if (isWork) {
        teMsg = pickFrom(seed2 + ":work", [
          "పని ఒత్తిడి నిజంగా చాలా భారంగా ఉంటుంది — నిద్రలేమి, boss ఒత్తిడి — అన్నీ ఒకేసారి చాలా ఎక్కువగా అనిపిస్తుంది.",
          "ఇలాంటి ఒత్తిడి శరీరాన్ని మరియు మనసు రెండింటినీ అలసిపోయేలా చేస్తుంది. నువ్వు ఇప్పుడు చాలా ఎక్కువ భరిస్తున్నావు.",
          "Boss ఒత్తిడి మరియు నిద్రలేమి — ఇది చాలా కాలం సహించడం సులభం కాదు.",
        ] as const);
        teFollow = pickFrom(seed2 + ":work:follow", [
          "ఇప్పుడు నిన్ను ఎక్కువగా బాధిస్తున్నది ఏమిటి — పని ఒత్తిడా, లేదా లోపల ఉన్న అలసటా?",
          "ఈ సమయంలో నీ కోసం కొంచెం సమయం దొరుకుతుందా?",
          "ఇది ఎప్పటి నుండి ఇలా ఉంది?",
        ] as const);
      } else if (isRelationship) {
        teMsg = pickFrom(seed2 + ":rel", [
          "సంబంధంలో ఈ దూరం నిజంగా చాలా బాధగా ఉంటుంది.",
          "గొడవ మరియు దూరం — రెండూ ఒకేసారి వస్తే మనసు చాలా భారంగా అనిపిస్తుంది.",
          "దగ్గరి వ్యక్తి దూరంగా వెళ్ళడం — ఈ అనుభవం చాలా కష్టమైనది.",
        ] as const);
        teFollow = pickFrom(seed2 + ":rel:follow", [
          "ఈ దూరం కొత్తదా, లేదా నెమ్మదిగా పెరుగుతుందా?",
          "అతనికి/ఆమెకు తెలుసా నువ్వు ఇంత బాధపడుతున్నావని?",
          "ఇది ఎంత కాలం నుండి నడుస్తుంది?",
        ] as const);
      } else if (isLonely) {
        teMsg = pickFrom(seed2 + ":lonely", [
          "ఈ ఒంటరితనం — ఎవ్వరూ అర్థం చేసుకోవడం లేదు అని అనిపించినప్పుడు — చాలా కష్టమైన స్థలం.",
          "ఎవ్వరూ లేనప్పుడు లేదా అర్థం చేసుకోనప్పుడు — ఆ శూన్యత చాలా భారంగా అనిపిస్తుంది.",
          "ఈ భావన — ఎవ్వరూ వినడం లేదు అని — ఇది నిజంగా బాధాకరంగా ఉంటుంది.",
        ] as const);
        teFollow = pickFrom(seed2 + ":lonely:follow", [
          "నీ జీవితంలో ఎవరైనా ఉన్నారా ఇవన్నీ పంచుకోవడానికి?",
          "ఈ ఒంటరితనం ఎప్పుడూ ఉండేదా, లేదా ఒక సమయం నుండి పెరిగిందా?",
          "నేను మరింత వినాలని ఉందా?",
        ] as const);
      } else {
        teMsg = pickFrom(seed2 + ":general", [
          "అన్నీ ఒకేసారి భారంగా అనిపించినప్పుడు — ఆ అనుభవం అర్థమవుతుంది.",
          "ఇవన్నీ ఒంటరిగా సంభాళించడం సులభం కాదు. నువ్వు చాలా ఎక్కువ మోస్తున్నావు.",
          "ఈ బాధకు ఒక స్థలం అవసరమైంది. చెప్పినందుకు మంచిది.",
        ] as const);
        teFollow = pickFrom(seed2 + ":general:follow", [
          "ఇప్పుడు ఏ విషయం ఎక్కువగా బాధిస్తుంది?",
          "ఇంకాస్త చెప్పు — ఇది ఎప్పటి నుండి ఇలా అనిపిస్తుంది?",
          "చెప్పాలనుంటే చెప్పు — నేను వింటున్నాను.",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${teMsg}` : teMsg,
        followUp: teFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Malayalam (ml) rich path ─────────────────────────────────────────
    if (lang === "ml") {
      const isWork = /\b(boss|office|joli|pressure|manager|aazhutham)\b/.test(lower2);
      const isRelationship = /\b(bandham|prema|relationship|breakup|girlfriend|boyfriend|pirinjupoyee|door ayi)\b/.test(lower2);
      const isCrisis = /\b(marikkanam|marikkan|sambhalikkan patunilla|khatam)\b/.test(lower2);
      const isLonely = /\b(thanimayal|aarumilla|aarumpuriyunilla)\b/.test(lower2);

      let mlMsg: string;
      let mlFollow: string;

      if (isCrisis) {
        mlMsg = "നീ ഇപ്പോൾ വളരെ ഭാരമേറിയ ഇടത്തിലാണ്. ഞാൻ ശരിക്കും ഇവിടെ ഉണ്ട്.";
        mlFollow = "ഈ നേരത്ത് നിന്റെ അടുത്ത് ആരെങ്കിലും ഉണ്ടോ — ആരെയെങ്കിലും വിളിക്കാൻ പറ്റുമോ?";
      } else if (isWork) {
        mlMsg = pickFrom(seed2 + ":work", [
          "ജോലിയുടെ ഈ സമ്മർദ്ദം ശരിക്കും വളരെ ഭാരമേറിയതാണ് — ഉറക്കമില്ലായ്മ, boss സമ്മർദ്ദം — എല്ലാം ഒന്നിച്ച് വളരെ കൂടുതലാകുന്നു.",
          "ഇത്തരം സമ്മർദ്ദം ശരീരത്തെയും മനസ്സിനെയും രണ്ടിനെയും ക്ഷീണിപ്പിക്കുന്നു. നീ ഇപ്പോൾ വളരെ കൂടുതൽ വഹിക്കുന്നു.",
          "Boss സമ്മർദ്ദവും ഉറക്കം വരാത്തതും — ഇത് ദീർഘ കാലം സഹിക്കുക എളുപ്പമല്ല.",
        ] as const);
        mlFollow = pickFrom(seed2 + ":work:follow", [
          "ഇപ്പോൾ നിന്നെ കൂടുതൽ ബുദ്ധിമുട്ടിക്കുന്നത് ഏതാണ് — ജോലി സമ്മർദ്ദമോ, ഉള്ളിലെ ക്ഷീണമോ?",
          "ഈ സമയത്ത് നിനക്കായി കൊഞ്ചം സമയം കിട്ടുന്നുണ്ടോ?",
          "ഇത് എന്നു മുതൽ ഇങ്ങനെ ഉണ്ട്?",
        ] as const);
      } else if (isRelationship) {
        mlMsg = pickFrom(seed2 + ":rel", [
          "ബന്ധത്തിലെ ഈ അകലം ശരിക്കും വളരെ വേദനിക്കുന്നതാണ്.",
          "വഴക്കും അകലവും — രണ്ടും ഒന്നിച്ച് വരുമ്പോൾ മനസ്സ് വളരെ ഭാരമേറുന്നു.",
          "അടുത്ത വ്യക്തി അകന്നു പോകുന്നത് — ഈ അനുഭവം വളരെ കഷ്ടകരമാണ്.",
        ] as const);
        mlFollow = pickFrom(seed2 + ":rel:follow", [
          "ഈ അകലം പുതിയതോ, അതോ പതുക്കെ കൂടിയതോ?",
          "അവനു/അവൾക്ക് അറിയാമോ നീ ഇത്ര വേദനയിലാണെന്ന്?",
          "ഇത് എത്ര കാലമായി നടക്കുന്നു?",
        ] as const);
      } else if (isLonely) {
        mlMsg = pickFrom(seed2 + ":lonely", [
          "ഈ ഒറ്റപ്പെടൽ — ആരും മനസ്സിലാക്കുന്നില്ല എന്ന് തോന്നുമ്പോൾ — വളരെ കഷ്ടമായ ഇടം.",
          "ആരും ഇല്ലാതാകുമ്പോൾ അല്ലെങ്കിൽ മനസ്സിലാക്കാതിരുമ്പോൾ — ആ ശൂന്യത വളരെ ഭാരമേറിയതായി അനുഭവപ്പെടുന്നു.",
          "ഈ തോന്നൽ — ആരും കേൾക്കുന്നില്ല എന്ന് — ഇത് ശരിക്കും വേദനാജനകമാണ്.",
        ] as const);
        mlFollow = pickFrom(seed2 + ":lonely:follow", [
          "നിന്റെ ജീവിതത്തിൽ ഇവ പങ്കുവെക്കാൻ ആരെങ്കിലും ഉണ്ടോ?",
          "ഈ ഒറ്റപ്പെടൽ എന്നും ഉണ്ടായിരുന്നോ, അതോ ഒരു കാലം മുതൽ കൂടിയതോ?",
          "ഞാൻ ഇനിയും കൂടുതൽ കേൾക്കണോ?",
        ] as const);
      } else {
        mlMsg = pickFrom(seed2 + ":general", [
          "എല്ലാം ഒന്നിച്ച് ഭാരമേറുമ്പോൾ — ആ അനുഭവം മനസ്സിലാകുന്നു.",
          "ഇവയെല്ലാം ഒറ്റയ്ക്ക് കൈകാര്യം ചെയ്യുക എളുപ്പമല്ല. നീ വളരെ കൂടുതൽ ചുമക്കുന്നു.",
          "ഈ വേദനയ്ക്ക് ഒരു ഇടം ആവശ്യമായിരുന്നു. പറഞ്ഞത് നന്നായി.",
        ] as const);
        mlFollow = pickFrom(seed2 + ":general:follow", [
          "ഇപ്പോൾ ഏത് കാര്യം കൂടുതൽ ബുദ്ധിമുട്ടിക്കുന്നു?",
          "ഇനിയും കൊഞ്ചം പറ — ഇത് എന്നു മുതൽ ഇങ്ങനെ തോന്നുന്നു?",
          "പറയണം എന്നുണ്ടെങ്കിൽ പറ — ഞാൻ കേൾക്കുന്നുണ്ട്.",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${mlMsg}` : mlMsg,
        followUp: mlFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Punjabi (pa) rich path ───────────────────────────────────────────
    if (lang === "pa") {
      const isWork = /\b(boss|office|kaam|pressure|manager|dabaav)\b/.test(lower2);
      const isRelationship = /\b(jhagda|rishta|relationship|breakup|girlfriend|boyfriend|chhad gaya|chhad gayi)\b/.test(lower2);
      const isCrisis = /\b(marna|maar laina|khatam|sambhaal nahi)\b/.test(lower2);
      const isLonely = /\b(ikalla|ikalli|koi nahi|koi samajh nahi)\b/.test(lower2);

      let paMsg: string;
      let paFollow: string;

      if (isCrisis) {
        paMsg = "ਤੂੰ ਹੁਣ ਬਹੁਤ ਭਾਰੀ ਥਾਂ 'ਤੇ ਹੈ। ਮੈਂ ਸੱਚਮੁੱਚ ਨਾਲ ਹਾਂ।";
        paFollow = "ਇਸ ਵੇਲੇ ਤੇਰੇ ਕੋਲ ਕੋਈ ਹੈ — ਕਿਸੇ ਨੂੰ ਬੁਲਾ ਸਕਦਾ/ਸਕਦੀ ਹੈਂ?";
      } else if (isWork) {
        paMsg = pickFrom(seed2 + ":work", [
          "ਕੰਮ ਦਾ ਇਹ ਬੋਝ ਸੱਚਮੁੱਚ ਬਹੁਤ ਭਾਰਾ ਹੈ — ਨੀਂਦ ਨਹੀਂ, boss ਦਾ ਦਬਾਅ — ਸਭ ਇਕੱਠੇ ਬਹੁਤ ਜ਼ਿਆਦਾ ਹੋ ਜਾਂਦਾ ਹੈ।",
          "ਇਸ ਤਰ੍ਹਾਂ ਦਾ ਦਬਾਅ ਸਰੀਰ ਅਤੇ ਮਨ ਦੋਵਾਂ ਨੂੰ ਖਾਂਦਾ ਹੈ। ਤੂੰ ਹੁਣ ਬਹੁਤ ਜ਼ਿਆਦਾ ਚੁੱਕ ਰਿਹਾ/ਰਹੀ ਹੈਂ।",
          "Boss ਦਾ ਦਬਾਅ ਅਤੇ ਨੀਂਦ ਨਾ ਆਉਣੀ — ਇਹ ਲੰਮੇ ਸਮੇਂ ਤੱਕ ਸਹਿਣਾ ਆਸਾਨ ਨਹੀਂ।",
        ] as const);
        paFollow = pickFrom(seed2 + ":work:follow", [
          "ਹੁਣ ਸਭ ਤੋਂ ਵੱਧ ਕੀ ਭਾਰਾ ਲੱਗ ਰਿਹਾ ਹੈ — ਕੰਮ ਦਾ ਦਬਾਅ, ਜਾਂ ਅੰਦਰੋਂ ਥਕਾਵਟ?",
          "ਇਸ ਵੇਲੇ ਆਪਣੇ ਲਈ ਥੋੜਾ ਸਮਾਂ ਮਿਲਦਾ ਹੈ?",
          "ਇਹ ਕਦੋਂ ਤੋਂ ਇਸ ਤਰ੍ਹਾਂ ਚੱਲ ਰਿਹਾ ਹੈ?",
        ] as const);
      } else if (isRelationship) {
        paMsg = pickFrom(seed2 + ":rel", [
          "ਰਿਸ਼ਤੇ ਵਿੱਚ ਇਹ ਦੂਰੀ ਸੱਚਮੁੱਚ ਬਹੁਤ ਭਾਰੀ ਹੈ।",
          "ਝਗੜਾ ਅਤੇ ਦੂਰੀ — ਦੋਵੇਂ ਇਕੱਠੇ ਆਉਣ ਤੇ ਮਨ ਬਹੁਤ ਭਾਰਾ ਹੋ ਜਾਂਦਾ ਹੈ।",
          "ਨੇੜੇ ਦੇ ਇਨਸਾਨ ਦਾ ਦੂਰ ਹੋਣਾ — ਇਹ ਤਜਰਬਾ ਬਹੁਤ ਔਖਾ ਹੁੰਦਾ ਹੈ।",
        ] as const);
        paFollow = pickFrom(seed2 + ":rel:follow", [
          "ਇਹ ਦੂਰੀ ਨਵੀਂ ਹੈ, ਜਾਂ ਹੌਲੀ ਹੌਲੀ ਵੱਧ ਰਹੀ ਸੀ?",
          "ਉਸਨੂੰ ਪਤਾ ਹੈ ਕਿ ਤੂੰ ਇੰਨਾ ਦੁਖੀ ਹੈਂ?",
          "ਇਹ ਕਿੰਨੇ ਸਮੇਂ ਤੋਂ ਚੱਲ ਰਿਹਾ ਹੈ?",
        ] as const);
      } else if (isLonely) {
        paMsg = pickFrom(seed2 + ":lonely", [
          "ਇਹ ਇਕੱਲਾਪਣ — ਜਦੋਂ ਲੱਗੇ ਕੋਈ ਸਮਝਦਾ ਨਹੀਂ — ਇਹ ਬਹੁਤ ਔਖੀ ਥਾਂ ਹੈ।",
          "ਕੋਈ ਨਾ ਹੋਵੇ ਜਾਂ ਸਮਝੇ ਨਾ — ਉਹ ਖਾਲੀਪਣ ਬਹੁਤ ਭਾਰਾ ਲੱਗਦਾ ਹੈ।",
          "ਇਹ ਅਹਿਸਾਸ — ਕੋਈ ਸੁਣ ਨਹੀਂ ਰਿਹਾ — ਇਹ ਸੱਚਮੁੱਚ ਤਕਲੀਫ਼ਦੇਹ ਹੈ।",
        ] as const);
        paFollow = pickFrom(seed2 + ":lonely:follow", [
          "ਕੀ ਤੇਰੀ ਜ਼ਿੰਦਗੀ ਵਿੱਚ ਕੋਈ ਹੈ ਜਿਸ ਨਾਲ ਇਹ ਸਾਂਝਾ ਕਰ ਸਕੇਂ?",
          "ਇਹ ਇਕੱਲਾਪਣ ਹਮੇਸ਼ਾ ਸੀ, ਜਾਂ ਕਿਸੇ ਵੇਲੇ ਤੋਂ ਵੱਧਿਆ?",
          "ਕੀ ਤੂੰ ਚਾਹੁੰਦਾ/ਚਾਹੁੰਦੀ ਹੈਂ ਕਿ ਮੈਂ ਹੋਰ ਸੁਣਾਂ?",
        ] as const);
      } else {
        paMsg = pickFrom(seed2 + ":general", [
          "ਇਹ ਅਹਿਸਾਸ — ਜਦੋਂ ਸਭ ਇਕੱਠੇ ਭਾਰਾ ਹੋ ਜਾਵੇ — ਸਮਝ ਆਉਂਦੀ ਹੈ।",
          "ਇੰਨਾ ਕੁਝ ਇਕੱਲੇ ਸੰਭਾਲਣਾ ਆਸਾਨ ਨਹੀਂ। ਤੂੰ ਬਹੁਤ ਜ਼ਿਆਦਾ ਉਠਾ ਰਿਹਾ/ਰਹੀ ਹੈਂ।",
          "ਇਸ ਦਰਦ ਨੂੰ ਜਗ੍ਹਾ ਮਿਲਣ ਦੀ ਲੋੜ ਸੀ। ਦੱਸਿਆ ਇਹ ਚੰਗਾ ਕੀਤਾ।",
        ] as const);
        paFollow = pickFrom(seed2 + ":general:follow", [
          "ਹੁਣ ਕਿਹੜੀ ਗੱਲ ਸਭ ਤੋਂ ਵੱਧ ਤਕਲੀਫ਼ ਦੇ ਰਹੀ ਹੈ?",
          "ਥੋੜਾ ਹੋਰ ਦੱਸ — ਕਦੋਂ ਤੋਂ ਇਸ ਤਰ੍ਹਾਂ ਲੱਗ ਰਿਹਾ ਹੈ?",
          "ਜੇ ਦੱਸਣਾ ਚਾਹੁੰਦਾ/ਚਾਹੁੰਦੀ ਹੈਂ ਤਾਂ ਦੱਸ — ਮੈਂ ਸੁਣ ਰਿਹਾ/ਰਹੀ ਹਾਂ।",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${paMsg}` : paMsg,
        followUp: paFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Odia (or) rich path ──────────────────────────────────────────────
    if (lang === "or") {
      const isWork = /\b(boss|office|kaam|pressure|manager|dabaav)\b/.test(lower2);
      const isRelationship = /\b(jhagda|sambandha|relationship|breakup|girlfriend|boyfriend|chhadiga|chhadile)\b/.test(lower2);
      const isCrisis = /\b(marajaiba|mara jai|khatam|handle napariba)\b/.test(lower2);
      const isLonely = /\b(eka|keu nahi|keu bujhibu nahi)\b/.test(lower2);

      let orMsg: string;
      let orFollow: string;

      if (isCrisis) {
        orMsg = "ତୁ ଏବେ ବହୁତ ଭାରୀ ଜାଗାରେ ଅଛ। ମୁଁ ସତ୍ୟ ସହିତ ଅଛି।";
        orFollow = "ଏହି ମୁହୂର୍ତ୍ତରେ ତୁ ପାଖରେ କେହି ଅଛ କି — କାହାକୁ ଡାକି ପାରିବ?";
      } else if (isWork) {
        orMsg = pickFrom(seed2 + ":work", [
          "କାମର ଏହି ଚାପ ସତ୍ୟ ବହୁତ ଭାରୀ — ଘୁଅ ନାହିଁ, boss ଚାପ — ସବୁ ଏକ ସଙ୍ଗେ ବହୁତ ଅଧିକ ହୋଇଯାଏ।",
          "ଏହି ପ୍ରକାର ଚାପ ଶରୀର ଓ ମନ ଦୁଇଟି ଖାଏ। ତୁ ଏବେ ବହୁତ ଅଧିକ ବହନ କରୁଛ।",
          "Boss ଚାପ ଓ ଘୁଅ ନ ଆସିବା — ଏହା ଦୀର୍ଘ ସମୟ ସହ୍ୟ କରିବା ସହଜ ନୁହେଁ।",
        ] as const);
        orFollow = pickFrom(seed2 + ":work:follow", [
          "ଏବେ ସବୁଠୁ ଅଧିକ କ'ଣ ଭାରୀ ଲାଗୁଛ — କାମ ଚାପ, ନା ଭିତରର ଥକ୍କା?",
          "ଏହି ସମୟରେ ନିଜ ପାଇଁ ଟିକେ ସମୟ ମିଳୁଛ?",
          "ଏହା କ'ଣ ରୁ ଏହିପ୍ରକାର ଚଳୁଛ?",
        ] as const);
      } else if (isRelationship) {
        orMsg = pickFrom(seed2 + ":rel", [
          "ସମ୍ପର୍କରେ ଏହି ଦୂରତ୍ୱ ସତ୍ୟ ବହୁତ ଭାରୀ।",
          "ଝଗଡ଼ା ଓ ଦୂରତ୍ୱ — ଦୁଇଟି ଏକ ସଙ୍ଗେ ଆସିଲେ ମନ ବହୁତ ଭାରୀ ହୁଏ।",
          "ନଜଦୀକ ବ୍ୟକ୍ତିର ଦୂରକୁ ଯିବା — ଏହି ଅନୁଭୂତି ବହୁତ କଷ୍ଟର।",
        ] as const);
        orFollow = pickFrom(seed2 + ":rel:follow", [
          "ଏହି ଦୂରତ୍ୱ ନୂଆ, ନା ଧୀରେ ଧୀରେ ବଢ଼ୁଥିଲା?",
          "ତାଙ୍କୁ ଜଣା ଅଛ ଯେ ତୁ ଏତେ ଦୁଃଖୀ?",
          "ଏହା କ'ଣ ଦିନ ଧରି ଚଳୁଛ?",
        ] as const);
      } else if (isLonely) {
        orMsg = pickFrom(seed2 + ":lonely", [
          "ଏହି ଏକୁଟିଆ ଭାବ — ଯେବେ ଲାଗେ କେହି ବୁଝୁ ନାହାନ୍ତି — ବହୁତ କଷ୍ଟ ଜାଗା।",
          "କେହି ନ ଥିଲେ ବା ନ ବୁଝିଲେ — ସେ ଖାଲି ଭାବ ବହୁତ ଭାରୀ ଲାଗେ।",
          "ଏହି ଅନୁଭୂତି — କେହି ଶୁଣୁ ନାହାନ୍ତି — ଏହା ସତ୍ୟ ତ୍ରାସଦାୟକ।",
        ] as const);
        orFollow = pickFrom(seed2 + ":lonely:follow", [
          "ତୋ ଜୀବନରେ କେହି ଅଛ ଏ ସବୁ ଭାଗ କରିବାକୁ?",
          "ଏହି ଏକୁଟିଆ ଭାବ ସବୁବେଳେ ଥିଲା, ନା ଏ ସମୟ ରୁ ବଢ଼ିଛ?",
          "ମୁଁ ଆଉ ଶୁଣିବ?",
        ] as const);
      } else {
        orMsg = pickFrom(seed2 + ":general", [
          "ସବୁ ଏକ ସଙ୍ଗେ ଭାରୀ ହେଲେ — ସେ ଅନୁଭୂତି ବୁଝାଯାଏ।",
          "ଏତେ ସବୁ ଏକୁଟିଆ ସମ୍ଭାଳିବା ସହଜ ନୁହେଁ। ତୁ ବହୁତ ଅଧିକ ଉଠାଉଛ।",
          "ଏହି ଦୁଃଖ ଜାଗା ପାଇବା ଦରକାର ଥିଲା। ବୋଲ ଭଲ କଲ।",
        ] as const);
        orFollow = pickFrom(seed2 + ":general:follow", [
          "ଏବେ କ'ଣ ସବୁଠୁ ଅଧିକ ତ୍ରାସ ଦେଉଛ?",
          "ଆଉ ଟିକେ ବୋଲ — କ'ଣ ରୁ ଏହିପ୍ରକାର ଲାଗୁଛ?",
          "ବୋଲିବ ଚାହିଁଲେ ବୋଲ — ମୁଁ ଶୁଣୁଛି।",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${orMsg}` : orMsg,
        followUp: orFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }

    // ── Urdu (ur) rich path ──────────────────────────────────────────────
    if (lang === "ur") {
      const isWork = /\b(boss|office|kaam|pressure|manager|dabaav)\b/.test(lower2);
      const isRelationship = /\b(jhagda|rishta|relationship|breakup|girlfriend|boyfriend|chod gaya|chod gayi|dil toota)\b/.test(lower2);
      const isCrisis = /\b(marne|mar jaana|khatam karna|mujhe nahi chahiye|sab khatam)\b/.test(lower2);
      const isLonely = /\b(akela|akeli|tanha|koi nahi|koi samajhta nahi)\b/.test(lower2);

      let urMsg: string;
      let urFollow: string;

      if (isCrisis) {
        urMsg = "آپ ابھی بہت بھاری جگہ پر ہیں۔ میں سچ میں ساتھ ہوں۔";
        urFollow = "اس وقت آپ کے پاس کوئی ہے — کسی کو بلا سکتے ہیں؟";
      } else if (isWork) {
        urMsg = pickFrom(seed2 + ":work", [
          "کام کا یہ دباؤ سچ میں بہت بھاری ہے — نیند نہیں، boss کا دباؤ — سب مل کر بہت زیادہ ہو جاتا ہے۔",
          "اس طرح کا دباؤ جسم اور دماغ دونوں کو کھاتا ہے۔ آپ ابھی بہت زیادہ اٹھا رہے ہیں۔",
          "Boss کا دباؤ اور نیند نہ آنا — یہ طویل عرصے سہنا آسان نہیں۔",
        ] as const);
        urFollow = pickFrom(seed2 + ":work:follow", [
          "ابھی سب سے زیادہ کیا بھاری لگ رہا ہے — کام کا دباؤ، یا اندر کی تھکاوٹ؟",
          "اس وقت اپنے لیے تھوڑا وقت مل رہا ہے؟",
          "یہ کب سے اس طرح چل رہا ہے؟",
        ] as const);
      } else if (isRelationship) {
        urMsg = pickFrom(seed2 + ":rel", [
          "رشتے میں یہ دوری سچ میں بہت بھاری ہے۔",
          "جھگڑا اور دوری — دونوں مل کر آئیں تو دل بہت بھاری ہو جاتا ہے۔",
          "قریبی انسان کا دور ہونا — یہ تجربہ بہت مشکل ہوتا ہے۔",
        ] as const);
        urFollow = pickFrom(seed2 + ":rel:follow", [
          "یہ دوری نئی ہے، یا آہستہ آہستہ بڑھ رہی تھی؟",
          "اسے پتہ ہے کہ آپ اتنے دکھی ہیں؟",
          "یہ کتنے عرصے سے چل رہا ہے؟",
        ] as const);
      } else if (isLonely) {
        urMsg = pickFrom(seed2 + ":lonely", [
          "یہ تنہائی — جب لگے کہ کوئی سمجھتا نہیں — یہ بہت مشکل جگہ ہے۔",
          "جب کوئی نہ ہو یا سمجھے نہ — وہ خالی پن بہت بھاری لگتا ہے۔",
          "یہ احساس — کہ کوئی سن نہیں رہا — یہ سچ میں تکلیف دہ ہے۔",
        ] as const);
        urFollow = pickFrom(seed2 + ":lonely:follow", [
          "کیا آپ کی زندگی میں کوئی ہے جس سے یہ سب بانٹ سکیں؟",
          "یہ تنہائی ہمیشہ سے تھی، یا کسی وقت سے بڑھی؟",
          "کیا آپ چاہتے ہیں میں تھوڑا اور سنوں؟",
        ] as const);
      } else {
        urMsg = pickFrom(seed2 + ":general", [
          "یہ احساس — جب سب کچھ ایک ساتھ بھاری ہو جائے — سمجھ میں آتا ہے۔",
          "اتنا سب اکیلے سنبھالنا آسان نہیں۔ آپ بہت زیادہ اٹھا رہے ہیں۔",
          "اس درد کو جگہ ملنی چاہیے تھی۔ بتایا یہ اچھا کیا۔",
        ] as const);
        urFollow = pickFrom(seed2 + ":general:follow", [
          "ابھی کون سی بات سب سے زیادہ تکلیف دے رہی ہے؟",
          "تھوڑا اور بتائیں — کب سے ایسا لگ رہا ہے؟",
          "بتانا چاہیں تو بتائیں — میں سن رہا/رہی ہوں۔",
        ] as const);
      }

      return {
        message: name2 ? `${name2}, ${urMsg}` : urMsg,
        followUp: urFollow,
        meta: { styleContract: "1.0", blueprint: "1.0", blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }) },
      };
    }
  }

  const msg = oneLine(userMessage);
  const name = getUserName(ctx);
  const rel = pickRelationshipTone(ctx);
  const compGender = pickCompanionGender(ctx);
  const isFemale = compGender === "female";

  // Gender-aware verb helper for Hindi Devanagari
  const hi = (male: string, female: string) => isFemale ? female : male;
  // Gender-aware verb helper for Gujarati
  const gu = (male: string, female: string) => isFemale ? female : male;
  // Gender-aware verb helper for Marathi
  const mr = (male: string, female: string) => isFemale ? female : male;

  const opener =
    lang === "hi"
      ? rel === "friend"
        ? name
          ? `${hi("समझ गया", "समझ गई")}, ${name}.`
          : hi("समझ गया.", "समझ गई.")
        : rel === "mentor"
          ? name
            ? `${hi("मैं सुन रहा हूँ", "मैं सुन रही हूँ")}, ${name}.`
            : hi("मैं सुन रहा हूँ.", "मैं सुन रही हूँ.")
          : rel === "coach"
            ? name
              ? `ठीक है, ${name}.`
              : "ठीक है."
            : name
              ? `${hi("मैं समझ रहा हूँ", "मैं समझ रही हूँ")}, ${name}.`
              : hi("मैं समझ रहा हूँ.", "मैं समझ रही हूँ.")
      : lang === "bn"
        ? rel === "friend"
          ? name
            ? `বুঝলাম, ${name}.`
            : "বুঝলাম."
          : rel === "mentor"
            ? name
              ? `আমি শুনছি, ${name}.`
              : "আমি শুনছি."
            : rel === "coach"
              ? name
                ? `ঠিক আছে, ${name}.`
                : "ঠিক আছে."
              : name
                ? `আমি বুঝতে পারছি, ${name}.`
                : "আমি বুঝতে পারছি."
        : lang === "gu"
          ? rel === "friend"
            ? name
              ? `${gu("સમજી ગયો", "સમજી ગઈ")}, ${name}.`
              : gu("સમજી ગયો.", "સમજી ગઈ.")
            : rel === "mentor"
              ? name
                ? `${gu("હું સાંભળી રહ્યો છું", "હું સાંભળી રહી છું")}, ${name}.`
                : gu("હું સાંભળી રહ્યો છું.", "હું સાંભળી રહી છું.")
              : rel === "coach"
                ? name
                  ? `બરાબર, ${name}.`
                  : "બરાબર."
                : name
                  ? `હું સમજું છું, ${name}.`
                  : "હું સમજું છું."
          : lang === "kn"
            ? rel === "friend"
              ? name ? `ಅರ್ಥ ಆಯಿತು, ${name}.` : "ಅರ್ಥ ಆಯಿತು."
              : rel === "mentor"
                ? name ? `ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ, ${name}.` : "ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ."
                : rel === "coach"
                  ? name ? `ಸರಿ, ${name}.` : "ಸರಿ."
                  : name ? `ನಾನು ಅರ್ಥ ಮಾಡಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ, ${name}.` : "ನಾನು ಅರ್ಥ ಮಾಡಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ."
          : lang === "ta"
            ? rel === "friend"
              ? name ? `புரிந்தது, ${name}.` : "புரிந்தது."
              : rel === "mentor"
                ? name ? `நான் கேட்கிறேன், ${name}.` : "நான் கேட்கிறேன்."
                : rel === "coach"
                  ? name ? `சரி, ${name}.` : "சரி."
                  : name ? `நான் புரிந்துகொள்கிறேன், ${name}.` : "நான் புரிந்துகொள்கிறேன்."
          : lang === "te"
            ? rel === "friend"
              ? name ? `అర్థమైంది, ${name}.` : "అర్థమైంది."
              : rel === "mentor"
                ? name ? `నేను వింటున్నాను, ${name}.` : "నేను వింటున్నాను."
                : rel === "coach"
                  ? name ? `సరే, ${name}.` : "సరే."
                  : name ? `నేను అర్థం చేసుకుంటున్నాను, ${name}.` : "నేను అర్థం చేసుకుంటున్నాను."
          : lang === "ml"
            ? rel === "friend"
              ? name ? `മനസ്സിലായി, ${name}.` : "മനസ്സിലായി."
              : rel === "mentor"
                ? name ? `ഞാൻ കേൾക്കുന്നുണ്ട്, ${name}.` : "ഞാൻ കേൾക്കുന്നുണ്ട്."
                : rel === "coach"
                  ? name ? `ശരി, ${name}.` : "ശരി."
                  : name ? `ഞാൻ മനസ്സിലാക്കുന്നു, ${name}.` : "ഞാൻ മനസ്സിലാക്കുന്നു."
          : lang === "pa"
            ? rel === "friend"
              ? name ? `ਸਮਝ ਆਇਆ, ${name}.` : "ਸਮਝ ਆਇਆ."
              : rel === "mentor"
                ? name ? `ਮੈਂ ਸੁਣ ਰਿਹਾ/ਰਹੀ ਹਾਂ, ${name}.` : "ਮੈਂ ਸੁਣ ਰਿਹਾ/ਰਹੀ ਹਾਂ."
                : rel === "coach"
                  ? name ? `ਠੀਕ ਹੈ, ${name}.` : "ਠੀਕ ਹੈ."
                  : name ? `ਮੈਂ ਸਮਝ ਰਿਹਾ/ਰਹੀ ਹਾਂ, ${name}.` : "ਮੈਂ ਸਮਝ ਰਿਹਾ/ਰਹੀ ਹਾਂ."
          : lang === "or"
            ? rel === "friend"
              ? name ? `ବୁଝିଲି, ${name}.` : "ବୁଝିଲି."
              : rel === "mentor"
                ? name ? `ମୁଁ ଶୁଣୁଛି, ${name}.` : "ମୁଁ ଶୁଣୁଛି."
                : rel === "coach"
                  ? name ? `ଠିକ ଅଛ, ${name}.` : "ଠିକ ଅଛ."
                  : name ? `ମୁଁ ବୁଝୁଛି, ${name}.` : "ମୁଁ ବୁଝୁଛି."
          : lang === "ur"
            ? rel === "friend"
              ? name ? `سمجھ گیا، ${name}.` : "سمجھ گیا."
              : rel === "mentor"
                ? name ? `میں سن رہا/رہی ہوں، ${name}.` : "میں سن رہا/رہی ہوں."
                : rel === "coach"
                  ? name ? `ٹھیک ہے، ${name}.` : "ٹھیک ہے."
                  : name ? `میں سمجھ رہا/رہی ہوں، ${name}.` : "میں سمجھ رہا/رہی ہوں."
          : lang === "ar"
            ? rel === "friend"
              ? name ? `فهمت، ${name}.` : "فهمت."
              : rel === "mentor"
                ? name ? `أنا أسمعك، ${name}.` : "أنا أسمعك."
                : rel === "coach"
                  ? name ? `حسناً، ${name}.` : "حسناً."
                  : name ? `أنا أتفهمك، ${name}.` : "أنا أتفهمك."
          : lang === "zh"
            ? rel === "friend"
              ? name ? `明白了，${name}。` : "明白了。"
              : rel === "mentor"
                ? name ? `我在听，${name}。` : "我在听。"
                : rel === "coach"
                  ? name ? `好，${name}。` : "好。"
                  : name ? `我理解，${name}。` : "我理解。"
          : lang === "es"
            ? rel === "friend"
              ? name ? `Entendido, ${name}.` : "Entendido."
              : rel === "mentor"
                ? name ? `Te escucho, ${name}.` : "Te escucho."
                : rel === "coach"
                  ? name ? `Está bien, ${name}.` : "Está bien."
                  : name ? `Lo entiendo, ${name}.` : "Lo entiendo."
          : lang === "fr"
            ? rel === "friend"
              ? name ? `Je comprends, ${name}.` : "Je comprends."
              : rel === "mentor"
                ? name ? `Je t'écoute, ${name}.` : "Je t'écoute."
                : rel === "coach"
                  ? name ? `D'accord, ${name}.` : "D'accord."
                  : name ? `Je te comprends, ${name}.` : "Je te comprends."
          : lang === "pt"
            ? rel === "friend"
              ? name ? `Entendido, ${name}.` : "Entendido."
              : rel === "mentor"
                ? name ? `Estou ouvindo, ${name}.` : "Estou ouvindo."
                : rel === "coach"
                  ? name ? `Ok, ${name}.` : "Ok."
                  : name ? `Entendo, ${name}.` : "Entendo."
          : lang === "ru"
            ? rel === "friend"
              ? name ? `Понял, ${name}.` : "Понял."
              : rel === "mentor"
                ? name ? `Я слушаю, ${name}.` : "Я слушаю."
                : rel === "coach"
                  ? name ? `Хорошо, ${name}.` : "Хорошо."
                  : name ? `Я понимаю, ${name}.` : "Я понимаю."
          : lang === "id"
            ? rel === "friend"
              ? name ? `Mengerti, ${name}.` : "Mengerti."
              : rel === "mentor"
                ? name ? `Aku mendengarmu, ${name}.` : "Aku mendengarmu."
                : rel === "coach"
                  ? name ? `Oke, ${name}.` : "Oke."
                  : name ? `Aku paham, ${name}.` : "Aku paham."
          : lang === "de"
            ? rel === "friend"
              ? name ? `Verstanden, ${name}.` : "Verstanden."
              : rel === "mentor"
                ? name ? `Ich höre zu, ${name}.` : "Ich höre zu."
                : rel === "coach"
                  ? name ? `Gut, ${name}.` : "Gut."
                  : name ? `Ich verstehe, ${name}.` : "Ich verstehe."
          : rel === "friend"
              ? name ? `समजलं, ${name}.` : "समजलं."
              : rel === "mentor"
                ? name ? `${mr("मी ऐकतोय", "मी ऐकतेय")}, ${name}.` : mr("मी ऐकतोय.", "मी ऐकतेय.")
                : rel === "coach"
                  ? name ? `ठीक आहे, ${name}.` : "ठीक आहे."
                  : name ? `${mr("मी समजून घेतोय", "मी समजून घेतेय")}, ${name}.` : mr("मी समजून घेतोय.", "मी समजून घेतेय.");

  const prev = getContextUserTurn(ctx, msg, 3);
  const useAnchor =
    !!prev && shouldUseContinuityAnchor(msg) && sharesKeyword(msg, prev);
  const openerWithContext = useAnchor
    ? `${opener} ${continuityAnchor(lang, prev!, msg)}`
    : opener;

  // ── Foreign language rich response path ──────────────────────────────
  if (FOREIGN_LANGS.has(lang) && hasStrongForeignEmotionalSignal(userMessage, lang)) {
    const lower3 = userMessage.toLowerCase();
    const name3 = getUserName({ ...ctx } as SessionContext);
    const rel3 = pickRelationshipTone({ ...ctx } as SessionContext);
    const seed3 = `${lang}:emo:${userMessage}:${rel3}:${name3 ?? ""}`;

    const isWork3 = /\b(boss|work|job|office|deadline|manager|pressure|atasan|travail|patron|arbeit|chef|trabajo|jefe|работа|начальник|工作|老板|عمل|رئيس|kaam|kerja)\b/i.test(lower3);
    const isRelationship3 = /\b(relationship|breakup|girlfriend|boyfriend|fight|argument|distant|alone|relación|ruptura|relation|rupture|beziehung|trennung|hubungan|putus|отношения|расставание|关系|分手|علاقة|انفصال)\b/i.test(lower3);
    const isCrisis3 = /\b(suicide|kill myself|end it|can't go on|no point|самоубийство|не хочу жить|انتحار|自杀|suicidio|suicídio|mau mati|sterben|sich umbringen)\b/i.test(lower3);
    const isLonely3 = /\b(alone|lonely|no one|nobody|nobody understands|isolated|seul|seule|allein|sendirian|одинок|孤独|وحيد)\b/i.test(lower3);

    type ForeignLang = "ar" | "zh" | "es" | "fr" | "pt" | "ru" | "id" | "de";
    const foreignMessages: Record<ForeignLang, { work: string[]; rel: string[]; lonely: string[]; crisis: string; workFollow: string[]; relFollow: string[]; lonelyFollow: string[]; crisisFollow: string }> = {
      ar: {
        work: [
          "ضغط العمل هذا حقاً ثقيل — الديدلاينات والمدير — كل شيء معاً يصبح أكثر مما يمكن تحمله.",
          "هذا النوع من الضغط يستنزف الجسم والعقل معاً. أنت تحمل الآن أكثر مما ينبغي.",
          "ضغط المدير وقلة النوم — تحمّل هذا لفترة طويلة ليس سهلاً.",
          "هذا التراكم في العمل — الجسم يعرف أن شيئاً ما غير مستدام قبل أن يدركه العقل.",
          "حين يصبح كل يوم عمل ثقيلاً من البداية — هذا ليس كسلاً، هذا إرهاق حقيقي.",
        ],
        rel: [
          "هذا البعد في العلاقة مؤلم حقاً.",
          "الخلافات والمسافة معاً — حين يأتيان دفعة واحدة يصبح القلب ثقيلاً جداً.",
          "هذا الشعور — بأن الشخص القريب منك يبتعد — صعب جداً.",
          "حين تحاول الاقتراب لكن الفجوة تبدو أكبر — هذا من أشد المشاعر إيلاماً.",
          "العلاقة التي كانت ملاذاً وأصبحت مصدر قلق — هذا يستنزف من الداخل.",
        ],
        lonely: [
          "هذا الشعور بالوحدة — حين يبدو أن لا أحد يفهم — ثقيل جداً.",
          "حين لا يكون هناك أحد أو لا يفهم أحد — ذلك الفراغ يزيد الأمر ثقلاً.",
          "هذا الشعور — بأن لا أحد يسمع — مؤلم حقاً.",
          "الوحدة وسط الناس أشد قسوة من الوحدة في الصمت — وهذا ما أسمعه.",
          "أن تكون محاطاً بالجميع ولا يفهمك أحد — هذا الفراغ له ثقل خاص.",
        ],
        crisis: "أنت الآن في مكان ثقيل جداً. أنا هنا معك حقاً.",
        workFollow: [
          "ما الذي يثقل عليك أكثر الآن — ضغط العمل أم الإرهاق من الداخل؟",
          "بعيداً عن العمل — هل تجد وقتاً لنفسك في هذه الفترة؟",
          "منذ متى وهذا الوضع هكذا؟",
        ],
        relFollow: [
          "هل يعرف/تعرف أنك تمر بهذا الألم؟",
          "هل هذا البعد جديد أم كان يتراكم تدريجياً؟",
          "منذ متى وهذا الأمر على هذه الحال؟",
        ],
        lonelyFollow: [
          "منذ متى وأنت تحمل هذا بمفردك؟",
          "هل هناك شخص قريب منك الآن يمكنك التحدث إليه؟",
          "ما الذي بدأ أولاً — الوحدة أم شيء آخر؟",
        ],
        crisisFollow: "هل هناك أحد قريب منك الآن يمكنك الاتصال به؟",
      },
      zh: {
        work: [
          "工作的这种压力真的很重 — 老板的要求，睡不着 — 这些放在一起太沉了。",
          "这种压力对身体和心理都是消耗。你现在承受的实在太多了。",
          "老板的压力和睡眠不足 — 长期这样撑下去真的很难。",
          "工作的这种积压 — 身体往往比大脑更早知道这不可持续。",
          "当每天开始工作就感到沉重 — 这不是懒惰，这是真正的精疲力竭。",
        ],
        rel: [
          "关系里的这种距离真的很痛。",
          "争吵和距离同时来 — 一起承受时，心会变得很沉。",
          "这种感觉 — 觉得亲近的人在慢慢疏远 — 真的很难受。",
          "想靠近却感到距离越来越远 — 这是最难受的感觉之一。",
          "原本是心灵港湾的关系变成了焦虑的来源 — 这会从内部把人消耗掉。",
        ],
        lonely: [
          "这种孤独感 — 当感觉没有人理解的时候 — 真的很难受。",
          "当身边没有人或者没有人理解时 — 那种空洞感让一切更沉重。",
          "这种感觉 — 觉得没有人在听 — 真的很痛苦。",
          "在人群中感到孤独比独处更难受 — 我听到你说的了。",
          "被人包围着却没有人真正理解你 — 这种空洞有它特有的重量。",
        ],
        crisis: "你现在处在一个很沉重的地方。我真的在这里陪着你。",
        workFollow: [
          "现在最让你感到沉重的是什么 — 工作的压力还是内心的疲惫？",
          "除了工作之外 — 你现在有没有一点属于自己的时间？",
          "这种情况从什么时候开始的？",
        ],
        relFollow: [
          "他/她知道你正在经历这些痛苦吗？",
          "这种距离是新出现的，还是在慢慢积累？",
          "这件事是从什么时候开始变成这样的？",
        ],
        lonelyFollow: [
          "你一个人扛着这些有多久了？",
          "你现在身边有没有可以倾诉的人？",
          "是孤独感先来的，还是有其他原因？",
        ],
        crisisFollow: "你现在身边有没有可以联系的人？",
      },
      es: {
        work: [
          "Esa presión en el trabajo es realmente muy pesada — los plazos, el jefe — todo junto se vuelve demasiado.",
          "Este tipo de presión agota el cuerpo y la mente. Estás cargando demasiado ahora mismo.",
          "La presión del jefe y no poder dormir — aguantar eso durante tanto tiempo no es fácil.",
          "Esa acumulación en el trabajo — el cuerpo suele saber antes que la mente que algo no es sostenible.",
          "Cuando cada día de trabajo empieza con pesadez — no es pereza, es agotamiento real.",
        ],
        rel: [
          "Esa distancia en la relación duele de verdad.",
          "Las peleas y la distancia juntas — cuando llegan al mismo tiempo el corazón se vuelve muy pesado.",
          "Esa sensación — de que alguien cercano se está alejando — es muy difícil.",
          "Intentar acercarse y sentir que la distancia crece — eso es uno de los dolores más difíciles.",
          "Que lo que fue un refugio se haya vuelto fuente de ansiedad — eso agota por dentro.",
        ],
        lonely: [
          "Esa sensación de soledad — cuando parece que nadie entiende — es muy difícil.",
          "Cuando no hay nadie o nadie entiende — ese vacío hace todo más pesado.",
          "Esa sensación — de que nadie está escuchando — duele de verdad.",
          "Sentirse solo/a entre la gente es más duro que estar solo/a en silencio — y eso es lo que escucho.",
          "Estar rodeado/a de todos y que nadie te entienda de verdad — ese vacío tiene su propio peso.",
        ],
        crisis: "Estás en un lugar muy pesado ahora. Estoy aquí contigo de verdad.",
        workFollow: [
          "¿Qué es lo que más te pesa ahora — la presión del trabajo o el agotamiento por dentro?",
          "Además del trabajo — ¿tienes algo de tiempo para ti en este momento?",
          "¿Desde cuándo está así la situación?",
        ],
        relFollow: [
          "¿Sabe que estás pasando por esto?",
          "¿Esta distancia es nueva o se fue acumulando poco a poco?",
          "¿Cuándo empezó a ponerse así?",
        ],
        lonelyFollow: [
          "¿Cuánto tiempo llevas cargando esto solo/a?",
          "¿Hay alguien cercano con quien puedas hablar ahora?",
          "¿Llegó primero la soledad o hubo algo más?",
        ],
        crisisFollow: "¿Hay alguien cerca de ti ahora con quien puedas hablar?",
      },
      fr: {
        work: [
          "Cette pression au travail est vraiment très lourde — les délais, le patron — tout ça ensemble devient trop.",
          "Ce genre de pression use le corps et l'esprit. Tu portes beaucoup trop en ce moment.",
          "La pression du patron et ne pas pouvoir dormir — tenir comme ça longtemps c'est vraiment difficile.",
          "Cette accumulation au travail — le corps sait souvent avant le mental que quelque chose n'est pas tenable.",
          "Quand chaque journée de travail commence déjà lourdement — ce n'est pas de la paresse, c'est un vrai épuisement.",
        ],
        rel: [
          "Cette distance dans la relation est vraiment douloureuse.",
          "Les disputes et la distance en même temps — quand elles arrivent ensemble le cœur devient très lourd.",
          "Ce sentiment — que quelqu'un de proche s'éloigne — c'est vraiment difficile.",
          "Essayer de se rapprocher et sentir la distance grandir — c'est une des douleurs les plus difficiles.",
          "Que ce qui était un refuge soit devenu source d'anxiété — ça épuise de l'intérieur.",
        ],
        lonely: [
          "Ce sentiment de solitude — quand on a l'impression que personne ne comprend — c'est très difficile.",
          "Quand il n'y a personne ou que personne ne comprend — ce vide rend tout plus lourd.",
          "Ce sentiment — que personne n'écoute — ça fait vraiment mal.",
          "Se sentir seul(e) entouré(e) de monde, c'est plus dur qu'être seul(e) dans le silence — c'est ce que j'entends.",
          "Être entouré(e) de tout le monde et que personne ne comprenne vraiment — ce vide a son propre poids.",
        ],
        crisis: "Tu es dans un endroit très lourd là. Je suis vraiment là avec toi.",
        workFollow: [
          "Qu'est-ce qui pèse le plus là — la pression du travail ou l'épuisement intérieur ?",
          "En dehors du travail — tu as un peu de temps pour toi en ce moment ?",
          "Depuis quand est-ce que ça dure comme ça ?",
        ],
        relFollow: [
          "Est-ce qu'il/elle sait ce que tu traverses ?",
          "Cette distance est-elle nouvelle ou est-ce qu'elle s'est accumulée progressivement ?",
          "Depuis quand est-ce que ça s'est dégradé comme ça ?",
        ],
        lonelyFollow: [
          "Depuis combien de temps tu portes ça seul(e) ?",
          "Est-ce qu'il y a quelqu'un près de toi à qui tu peux parler maintenant ?",
          "Est-ce que la solitude est arrivée en premier ou est-ce qu'il y avait autre chose ?",
        ],
        crisisFollow: "Est-ce qu'il y a quelqu'un près de toi maintenant que tu peux appeler ?",
      },
      pt: {
        work: [
          "Essa pressão no trabalho é realmente muito pesada — os prazos, o chefe — tudo junto é demais.",
          "Esse tipo de pressão cansa o corpo e a mente. Você está carregando demais agora.",
          "A pressão do chefe e não conseguir dormir — aguentar isso por tanto tempo não é fácil.",
          "Esse acúmulo no trabalho — o corpo costuma saber antes da mente que algo não é sustentável.",
          "Quando cada dia começa já pesado — não é preguiça, é esgotamento de verdade.",
        ],
        rel: [
          "Essa distância no relacionamento dói de verdade.",
          "As brigas e a distância juntas — quando chegam ao mesmo tempo o coração fica muito pesado.",
          "Esse sentimento — de que alguém próximo está se afastando — é muito difícil.",
          "Tentar se aproximar e sentir a distância crescer — essa é uma das dores mais difíceis.",
          "O que era um refúgio virar fonte de ansiedade — isso esgota por dentro.",
        ],
        lonely: [
          "Essa sensação de solidão — quando parece que ninguém entende — é muito difícil.",
          "Quando não há ninguém ou ninguém entende — esse vazio deixa tudo mais pesado.",
          "Esse sentimento — de que ninguém está ouvindo — dói de verdade.",
          "Sentir-se sozinho/a no meio das pessoas é mais difícil do que estar sozinho/a em silêncio — é isso que ouço.",
          "Estar cercado/a de todo mundo e ninguém te entender de verdade — esse vazio tem um peso próprio.",
        ],
        crisis: "Você está num lugar muito pesado agora. Estou aqui de verdade.",
        workFollow: [
          "O que está pesando mais agora — a pressão do trabalho ou o cansaço por dentro?",
          "Fora do trabalho — você tem um tempinho para você nesse momento?",
          "Desde quando está assim?",
        ],
        relFollow: [
          "Ele/ela sabe que você está passando por isso?",
          "Essa distância é recente ou foi se acumulando aos poucos?",
          "Quando começou a ficar assim?",
        ],
        lonelyFollow: [
          "Há quanto tempo você está carregando isso sozinho/a?",
          "Tem alguém perto de você com quem possa conversar agora?",
          "A solidão veio primeiro ou teve outra coisa antes?",
        ],
        crisisFollow: "Tem alguém perto de você agora com quem possa falar?",
      },
      ru: {
        work: [
          "Это давление на работе действительно очень тяжело — дедлайны, начальник — всё вместе становится слишком много.",
          "Такое давление изматывает тело и разум. Ты сейчас несёшь слишком много.",
          "Давление начальника и отсутствие сна — долго так держаться действительно нелегко.",
          "Это накопление на работе — тело часто понимает раньше разума, что так дальше нельзя.",
          "Когда каждый рабочий день начинается с тяжести — это не лень, это настоящее истощение.",
        ],
        rel: [
          "Эта дистанция в отношениях действительно болезненна.",
          "Ссоры и дистанция вместе — когда они приходят одновременно, становится очень тяжело.",
          "Это ощущение — что близкий человек отдаляется — действительно трудно переживать.",
          "Пытаться сблизиться и чувствовать, как расстояние растёт — это одна из самых трудных болей.",
          "Когда то, что было убежищем, стало источником тревоги — это изматывает изнутри.",
        ],
        lonely: [
          "Это чувство одиночества — когда кажется, что никто не понимает — очень тяжело.",
          "Когда никого нет рядом или никто не понимает — эта пустота делает всё ещё тяжелее.",
          "Это ощущение — что тебя никто не слышит — действительно больно.",
          "Чувствовать себя одиноким среди людей тяжелее, чем быть одному в тишине — и именно это я слышу.",
          "Быть окружённым всеми и чтобы никто по-настоящему не понимал — эта пустота имеет свой особый вес.",
        ],
        crisis: "Ты сейчас в очень тяжёлом месте. Я здесь с тобой.",
        workFollow: [
          "Что сейчас давит сильнее всего — рабочее давление или внутренняя усталость?",
          "Кроме работы — есть ли у тебя сейчас хоть немного времени для себя?",
          "Как давно всё так продолжается?",
        ],
        relFollow: [
          "Он/она знает, что ты через это проходишь?",
          "Эта дистанция появилась недавно или накапливалась постепенно?",
          "Когда всё стало вот так?",
        ],
        lonelyFollow: [
          "Как давно ты несёшь это в одиночку?",
          "Есть ли рядом с тобой кто-то, с кем ты можешь поговорить?",
          "Что пришло первым — одиночество или что-то другое?",
        ],
        crisisFollow: "Есть ли рядом с тобой кто-то, кому ты можешь позвонить?",
      },
      id: {
        work: [
          "Tekanan kerja ini benar-benar sangat berat — deadline, atasan — semua sekaligus terlalu banyak.",
          "Tekanan seperti ini menguras tubuh dan pikiran. Kamu sedang menanggung terlalu banyak.",
          "Tekanan dari atasan dan tidak bisa tidur — menanggung ini lama-lama memang tidak mudah.",
          "Penumpukan di pekerjaan ini — tubuh sering tahu lebih dulu dari pikiran bahwa ini tidak berkelanjutan.",
          "Ketika setiap hari kerja sudah terasa berat sejak awal — itu bukan malas, itu kelelahan yang nyata.",
        ],
        rel: [
          "Jarak dalam hubungan ini benar-benar menyakitkan.",
          "Pertengkaran dan jarak bersamaan — ketika datang sekaligus hati menjadi sangat berat.",
          "Perasaan itu — bahwa orang yang dekat perlahan menjauh — memang sangat sulit.",
          "Mencoba mendekat tapi merasa jarak makin jauh — itu salah satu rasa sakit yang paling berat.",
          "Ketika yang dulu jadi tempat berlindung menjadi sumber kecemasan — itu menguras dari dalam.",
        ],
        lonely: [
          "Perasaan kesepian itu — ketika rasanya tidak ada yang mengerti — sangat sulit.",
          "Ketika tidak ada siapapun atau tidak ada yang mengerti — kekosongan itu membuat segalanya lebih berat.",
          "Perasaan itu — bahwa tidak ada yang mendengarkan — memang menyakitkan.",
          "Merasa kesepian di tengah banyak orang lebih berat dari sendirian dalam keheningan — dan itu yang aku dengar.",
          "Dikelilingi semua orang tapi tidak ada yang benar-benar mengerti — kekosongan itu punya beratnya sendiri.",
        ],
        crisis: "Kamu sekarang berada di tempat yang sangat berat. Aku benar-benar di sini bersamamu.",
        workFollow: [
          "Apa yang paling berat sekarang — tekanan kerja atau kelelahan dari dalam?",
          "Selain pekerjaan — ada waktu sedikit untuk dirimu sendiri sekarang?",
          "Sudah berapa lama seperti ini?",
        ],
        relFollow: [
          "Apakah dia tahu kamu sedang melewati ini?",
          "Jarak ini baru muncul atau sudah menumpuk perlahan?",
          "Kapan mulai jadi seperti ini?",
        ],
        lonelyFollow: [
          "Sudah berapa lama kamu menanggung ini sendirian?",
          "Ada seseorang di dekatmu yang bisa diajak bicara sekarang?",
          "Kesepian datang duluan atau ada hal lain sebelumnya?",
        ],
        crisisFollow: "Ada seseorang di dekatmu sekarang yang bisa kamu hubungi?",
      },
      de: {
        work: [
          "Dieser Arbeitsdruck ist wirklich sehr schwer — die Deadlines, der Chef — alles zusammen wird einfach zu viel.",
          "So ein Druck erschöpft Körper und Geist. Du trägst gerade zu viel auf einmal.",
          "Der Druck vom Chef und nicht schlafen können — das so lange durchzuhalten ist wirklich nicht leicht.",
          "Diese Anhäufung bei der Arbeit — der Körper weiß oft früher als der Kopf, dass das nicht haltbar ist.",
          "Wenn jeder Arbeitstag schon von Anfang an schwer beginnt — das ist keine Faulheit, das ist echte Erschöpfung.",
        ],
        rel: [
          "Diese Distanz in der Beziehung tut wirklich weh.",
          "Streit und Distanz zusammen — wenn beides gleichzeitig kommt, wird das Herz sehr schwer.",
          "Dieses Gefühl — dass ein nahestehender Mensch sich entfernt — ist wirklich schwer.",
          "Sich anzunähern zu versuchen und zu spüren, wie der Abstand wächst — das ist einer der schwersten Schmerzen.",
          "Wenn das, was ein Rückzugsort war, zur Quelle von Angst wird — das zehrt von innen aus.",
        ],
        lonely: [
          "Dieses Gefühl der Einsamkeit — wenn niemand zu verstehen scheint — ist sehr schwer.",
          "Wenn niemand da ist oder niemand versteht — diese Leere macht alles noch schwerer.",
          "Dieses Gefühl — dass niemand zuhört — tut wirklich weh.",
          "Sich unter Menschen einsam zu fühlen ist schwerer als allein in der Stille zu sein — und genau das höre ich.",
          "Von allen umgeben zu sein und trotzdem nicht wirklich verstanden zu werden — diese Leere hat ihr eigenes Gewicht.",
        ],
        crisis: "Du bist jetzt an einem sehr schweren Ort. Ich bin wirklich bei dir.",
        workFollow: [
          "Was drückt jetzt am meisten — der Arbeitsdruck oder die innere Erschöpfung?",
          "Neben der Arbeit — hast du gerade noch etwas Zeit für dich selbst?",
          "Wie lange dauert das schon so an?",
        ],
        relFollow: [
          "Weiß er/sie, was du gerade durchmachst?",
          "Ist diese Distanz neu oder hat sie sich langsam aufgebaut?",
          "Wann hat es angefangen, so zu werden?",
        ],
        lonelyFollow: [
          "Wie lange trägst du das schon alleine?",
          "Gibt es jemanden in deiner Nähe, mit dem du gerade reden kannst?",
          "Kam die Einsamkeit zuerst oder gab es noch etwas anderes?",
        ],
        crisisFollow: "Gibt es jemanden in deiner Nähe, den du jetzt anrufen kannst?",
      },
    };

    const fLang = lang as ForeignLang;
    const fData = foreignMessages[fLang];
    if (!fData) {
      (ctx as any).preferredLanguage = lang;
      return draftResponse(userMessage, ctx);
    }

    let fMsg: string;
    let fFollow: string;

    if (isCrisis3) {
      fMsg = fData.crisis;
      fFollow = fData.crisisFollow;
    } else if (isWork3) {
      fMsg = pickFrom(seed3 + ":work", fData.work as unknown as readonly [string, ...string[]]);
      fFollow = pickFrom(seed3 + ":work:follow", fData.workFollow as unknown as readonly [string, ...string[]]);
    } else if (isRelationship3) {
      fMsg = pickFrom(seed3 + ":rel", fData.rel as unknown as readonly [string, ...string[]]);
      fFollow = pickFrom(seed3 + ":rel:follow", fData.relFollow as unknown as readonly [string, ...string[]]);
    } else if (isLonely3) {
      fMsg = pickFrom(seed3 + ":lonely", fData.lonely as unknown as readonly [string, ...string[]]);
      fFollow = pickFrom(seed3 + ":lonely:follow", fData.lonelyFollow as unknown as readonly [string, ...string[]]);
    } else {
      fMsg = pickFrom(seed3 + ":gen", fData.work as unknown as readonly [string, ...string[]]);
      fFollow = pickFrom(seed3 + ":gen:follow", fData.workFollow as unknown as readonly [string, ...string[]]);
    }

    return {
      message: name3 ? `${name3}, ${fMsg}` : fMsg,
      followUp: fFollow,
      meta: {
        styleContract: "1.0",
        blueprint: "1.0",
        blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }),
      },
    };
  }

  // ── Shared goodbye detection for non-hi/bn Indian langs ──────────────
  // hi and bn have their own goodbye handling inline below.
  if (lang !== "hi" && lang !== "bn" && INDIAN_LANGS.has(lang)) {
    const t2 = msg.trim();
    const t2NoPunct = t2.replace(/[।!?]+$/g, "").trim();
    const isGoodbyeIndic =
      // native script goodbye words
      /(ਚਲਦਾ|ਅਲਵਿਦਾ|ਫਿਰ\s*ਮਿਲਾਂਗੇ|ਆਰਾਮ\s*ਕਰ(?:ੋ|ਦਾ|ਦੀ|ਦੇ)\b|ਕੱਲ੍ਹ\s*ਗੱਲ|ਠੀਕ\s*ਹੈ\s*ਫਿਰ)/i.test(t2NoPunct) ||  // pa
      /(ਚਲਦਾ|ਠੀਕ\s*ਹੈ\s*ਫਿਰ)/i.test(t2NoPunct) ||
      /(ठीक आहे|निघतो|निघते|जातो|जाते|निरोप|नंतर बोलू)/i.test(t2NoPunct) ||  // mr
      /(சரி|போகிறேன்|விடை|பிறகு பேசுவோம்)/i.test(t2NoPunct) ||  // ta
      /(సరే|వెళ్ళిపోతున్నాను|తర్వాత మాట్లాడదాం)/i.test(t2NoPunct) ||  // te
      /(ശരി|പോകുന്നു|വിടവാങ്ങൽ|പിന്നെ)/i.test(t2NoPunct) ||  // ml
      /(ٹھیک|الوداع|پھر ملیں گے|آرام)/i.test(t2NoPunct) ||  // ur
      /(ଠିକ\s*ଅଛ|ଯାଉଛ|ବିଦାୟ|ଆଗରେ\s*ମିଳିବ)/i.test(t2NoPunct) ||  // or
      // Roman goodbye detection
      /\b(jato|jaato|jate|nirop|parat bheto|aram karto|aram karte|nantar bolu|nidra karto|nidra karte|bye karto)\b/i.test(t2NoPunct) ||
      /\b(poren|pochchi|pottitu varen|rest pannuven|kal pesuven|poitten|poirean)\b/i.test(t2NoPunct) ||
      /\b(velthunna|velthunnaanu|rest teedtaanu|tarvata matladatanu|vellipostha)\b/i.test(t2NoPunct) ||
      /\b(jau chhu|jav chu|aram karu|pachi vaatsu|kaal vaatsu|sone jau|so jav chu)\b/i.test(t2NoPunct) ||
      /\b(janda aan|ja raha aan|aram karda aan|aaraam karda haan|aaraam karda|kal gall karda|kal gall karde|so janda|rest karda|jandi aan)\b/i.test(t2NoPunct) ||
      /\b(hogthini|hogteeni|nirgatheni|aaraamagonthini|naalaidu maataadona|sari hogthini)\b/i.test(t2NoPunct) ||
      /\b(pokunnu|pokam|araameedunnu|naalekku kaanum|pokatte)\b/i.test(t2NoPunct) ||
      /\b(jauchi|jaucha|biday|arama kariba|pare kotha heba|kal kotha heba)\b/i.test(t2NoPunct) ||
      /\b(jata hoon|jati hoon|khuda hafiz|aaraam karta hoon|aaraam karti hoon|kal baat karte)\b/i.test(t2NoPunct);

    if (isGoodbyeIndic) {
      const goodbyeByLang: Partial<Record<SupportedLanguage, string>> = {
        mr: "ठीक आहे — जेव्हा मन असेल तेव्हा परत ये.",
        ta: "சரி — எப்போது வேண்டுமானாலும் திரும்பி வரலாம்.",
        te: "సరే — ఎప్పుడైనా తిరిగి రావచ్చు.",
        ml: "ശരി — എപ്പോൾ വേണമെങ്കിലും തിരിച്ചു വരൂ.",
        pa: "ਠੀਕ ਹੈ — ਜਦੋਂ ਵੀ ਮਨ ਆਵੇ ਵਾਪਸ ਆਓ.",
        or: "ଠିକ ଅଛ — ଯେବେ ଇଛ ଫେରି ଆ.",
        ur: "ٹھیک ہے — جب چاہیں واپس آئیں.",
        gu: "ઠીક છ — ક્યારે પણ ફરી આ.",
        kn: "ಸರಿ — ಯಾವಾಗ ಬೇಕಾದರೂ ಮತ್ತೆ ಬಾ.",
      };
      const farewell = goodbyeByLang[lang] ?? "Take care — come back anytime.";
      return {
        message: name ? `${name}, ${farewell}` : farewell,
        followUp: undefined,
        meta: {
          styleContract: "1.0",
          blueprint: "1.0",
          blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }),
        },
      };
    }
  }

  // ── Goodbye detection for foreign languages ───────────────────────────
  if (FOREIGN_LANGS.has(lang)) {
    const t3 = msg.trim();
    const t3Lower = t3.toLowerCase();
    const isGoodbyeForeign =
      // Arabic native
      /(مع السلامة|وداعاً|إلى اللقاء|أراك لاحقاً|سأرتاح)/i.test(t3) ||
      // Chinese native
      /(再见|拜拜|保重|回头见|先去休息|明天见)/i.test(t3) ||
      // Spanish
      /\b(adiós|hasta luego|hasta mañana|chao|me voy|nos vemos|voy a descansar|mañana hablamos)\b/i.test(t3Lower) ||
      // French
      /\b(au revoir|à bientôt|à demain|bonne nuit|je m'en vais|on se parle|je vais me reposer|on se reparle)\b/i.test(t3Lower) ||
      // Portuguese
      /\b(tchau|adeus|até logo|até amanhã|boa noite|vou descansar|a gente se fala|amanhã a gente conversa)\b/i.test(t3Lower) ||
      // Russian native
      /(пока|до свидания|спокойной ночи|увидимся|до завтра|пойду отдохну)/i.test(t3) ||
      // Russian romanized
      /\b(poka|do svidaniya|spokoynoy nochi|uvidimsya|do zavtra|poidu otdokhnu)\b/i.test(t3Lower) ||
      // Indonesian
      /\b(dah|dadah|sampai jumpa|sampai besok|selamat malam|mau istirahat|besok ngobrol lagi|aku pergi dulu)\b/i.test(t3Lower) ||
      // German
      /\b(tschüss|auf wiedersehen|bis morgen|gute nacht|ich gehe jetzt|bis bald|ich muss jetzt gehen|morgen reden wir)\b/i.test(t3Lower);

    if (isGoodbyeForeign) {
      const goodbyeByForeignLang: Partial<Record<SupportedLanguage, string>> = {
        ar: "بخير — عد إلينا متى شئت.",
        zh: "好的 — 随时欢迎回来。",
        es: "Está bien — vuelve cuando quieras.",
        fr: "D'accord — reviens quand tu veux.",
        pt: "Tá bem — volte quando quiser.",
        ru: "Хорошо — возвращайся когда захочешь.",
        id: "Oke — kembalilah kapan saja.",
        de: "In Ordnung — komm wieder, wann du möchtest.",
      };
      const farewellForeign = goodbyeByForeignLang[lang] ?? "Take care — come back anytime.";
      return {
        message: name ? `${name}, ${farewellForeign}` : farewellForeign,
        followUp: undefined,
        meta: {
          styleContract: "1.0",
          blueprint: "1.0",
          blueprintUsed: getResponseBlueprint({ tone: inferBlueprintTone(userMessage) }),
        },
      };
    }
  }

  const message =
    lang === "hi"
      ? `${openerWithContext} ${pickFrom(
        `hiAck:${msg}:${rel}:${name ?? ""}:${compGender}`,
        isFemale
          ? [
              "ठीक है, मैं यहीं हूँ।",
              "मैं सुन रही हूँ।",
              "हम इसे धीरे-धीरे ले सकते हैं।",
              "कोई जल्दी नहीं — मैं यहाँ हूँ।",
              "साथ हूँ, बताते रहो।",
              "हाँ, सुन रही हूँ।",
              "यहाँ रहूँगी — जब चाहो बात कर सकते हो।",
            ] as const
          : [
              "ठीक है, मैं यहीं हूँ।",
              "मैं सुन रहा हूँ।",
              "हम इसे धीरे-धीरे ले सकते हैं।",
              "कोई जल्दी नहीं — मैं यहाँ हूँ।",
              "साथ हूँ, बताते रहो।",
              "हाँ, सुन रहा हूँ।",
              "यहाँ रहूँगा — जब चाहो बात कर सकते हो।",
            ] as const,
      )}`
      : lang === "bn"
        ? (() => {
          const t = msg.trim();
          const tNoPunct = t.replace(/[।!?]+$/g, "").trim();

          const isQuestion =
            /[?？]$/.test(t) ||
            /^(কি|কী|কেন|কখন|কোথায়|কিভাবে|কারা|কাকে)\b/i.test(tNoPunct);

          const isGoodbye =
            /(আমি\s*যাচ্ছি|চলি|চলে\s*যাচ্ছি|বাই|বিদায়|দেখা\s*হবে)/i.test(tNoPunct) ||
            // Roman Bengali goodbye
            /\b(thako|rest korbo|pore kotha hobe|pore bolbo|jachi|jai|bye|bidai|dekha hobe|aschi|abar bolbo)\b/i.test(tNoPunct);

          const reaction = pickFrom(
            `bnAck:${msg}:${rel}:${name ?? ""}`,
            [
              "আচ্ছা, আমি আছি।",
              "হুম, শুনছি।",
              "ঠিক আছে, আমি আছি।",
              "কোনো তাড়া নেই — আমি এখানেই আছি।",
              "সাথে আছি, বলতে থাকো।",
              "হ্যাঁ, শুনছি।",
              "এখানে থাকব — যখন মন চাইবে কথা বলো।",
            ] as const,
          );

          if (isGoodbye) {
            return `${reaction} পরে ইচ্ছে হলে আবার লিখতে পারো।`;
          }

          if (isQuestion) {
            return `${reaction} তুমি চাইলে আরেকটু বলো।`;
          }

          return `${openerWithContext} ${reaction}`;
        })()
        : lang === "gu"
          ? `${openerWithContext} ${pickFrom(
            `guAck:${msg}:${rel}:${name ?? ""}:${compGender}`,
            isFemale
              ? ["બરાબર, હું અહીં છું.", "હું સાંભળી રહી છું.", "આપણે આ ધીમે ધીમે લઈ શકીએ.", "કોઈ ઉતાવળ નથી — હું અહીં છ.", "સાથ છ, કહ્યા કર.", "હા, સાંભળ રહી છ.", "અહીં રહીશ — જ્યારે ઇચ્છો ત્યારે વાત કર."] as const
              : ["બરાબર, હું અહીં છું.", "હું સાંભળી રહ્યો છું.", "આપણે આ ધીમે ધીમે લઈ શકીએ.", "કોઈ ઉતાવળ નથી — હું અહીં છ.", "સાથ છ, કહ્યા કર.", "હા, સાંભળ રહ્યો છ.", "અહીં રહીશ — જ્યારે ઇચ્છો ત્યારે વાત કર."] as const,
          )}`
          : lang === "kn"
            ? `${openerWithContext} ${pickFrom(
              `knAck:${msg}:${rel}:${name ?? ""}`,
              [
                "ಸರಿ, ನಾನು ಇಲ್ಲಿದ್ದೇನೆ.",
                "ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.",
                "ನಾವು ಇದನ್ನು ನಿಧಾನವಾಗಿ ತೆಗೆದುಕೊಳ್ಳಬಹುದು.",
                "ಯಾವ ಅವಸರವೂ ಇಲ್ಲ — ನಾನು ಇಲ್ಲಿದ್ದೇನೆ.",
                "ಜೊತೆಯಲ್ಲಿದ್ದೇನೆ, ಹೇಳುತ್ತಾ ಇರು.",
                "ಹೌದು, ಕೇಳ್ತಿದ್ದೇನೆ.",
                "ಇಲ್ಲಿಯೇ ಇರುತ್ತೇನೆ — ಯಾವಾಗ ಬೇಕಾದರೂ ಮಾತಾಡಬಹುದು.",
              ] as const,
            )}`
            : lang === "ta"
              ? `${openerWithContext} ${pickFrom(
                `taAck:${msg}:${rel}:${name ?? ""}`,
                [
                  "சரி, நான் இங்கே இருக்கிறேன்.",
                  "கேட்கிறேன்.",
                  "நாம் இதை மெல்ல எடுத்துக்கொள்ளலாம்.",
                  "அவசரமில்லை — நான் இங்கே இருக்கிறேன்.",
                  "உடனிருக்கிறேன், தொடர்ந்து சொல்.",
                  "ஆம், கேட்கிறேன்.",
                  "இங்கே இருப்பேன் — எப்போது வேண்டுமானாலும் பேசலாம்.",
                ] as const,
              )}`
              : lang === "te"
                ? `${openerWithContext} ${pickFrom(
                  `teAck:${msg}:${rel}:${name ?? ""}`,
                  [
                    "సరే, నేను ఇక్కడే ఉన్నాను.",
                    "వింటున్నాను.",
                    "మనం దీన్ని నెమ్మదిగా తీసుకోవచ్చు.",
                    "తొందరేమీ లేదు — నేను ఇక్కడే ఉన్నాను.",
                    "పక్కనే ఉన్నాను, చెప్పుతూ ఉండు.",
                    "అవును, వింటున్నాను.",
                    "ఇక్కడే ఉంటాను — ఎప్పుడైనా మాట్లాడవచ్చు.",
                  ] as const,
                )}`
                : lang === "ml"
                  ? `${openerWithContext} ${pickFrom(
                    `mlAck:${msg}:${rel}:${name ?? ""}`,
                    [
                      "ശരി, ഞാൻ ഇവിടെ ഉണ്ട്.",
                      "കേൾക്കുന്നുണ്ട്.",
                      "നമുക്ക് ഇത് പതുക്കെ എടുക്കാം.",
                      "ധൃതിയൊന്നുമില്ല — ഞാൻ ഇവിടെ ഉണ്ട്.",
                      "ഒപ്പമുണ്ട്, തുടർന്ന് പറ.",
                      "അതെ, കേൾക്കുന്നുണ്ട്.",
                      "ഇവിടെ ഉണ്ടാകും — എപ്പോൾ വേണമെങ്കിലും സംസാരിക്കാം.",
                    ] as const,
                  )}`
                  : lang === "pa"
                    ? `${openerWithContext} ${pickFrom(
                      `paAck:${msg}:${rel}:${name ?? ""}`,
                      [
                        "ਠੀਕ ਹੈ, ਮੈਂ ਇੱਥੇ ਹਾਂ।",
                        "ਸੁਣ ਰਿਹਾ/ਰਹੀ ਹਾਂ।",
                        "ਅਸੀਂ ਇਹ ਹੌਲੀ ਹੌਲੀ ਲੈ ਸਕਦੇ ਹਾਂ।",
                        "ਕੋਈ ਕਾਹਲੀ ਨਹੀਂ — ਮੈਂ ਇੱਥੇ ਹਾਂ।",
                        "ਨਾਲ ਹਾਂ, ਦੱਸਦੇ ਰਹੋ।",
                        "ਹਾਂ, ਸੁਣ ਰਿਹਾ/ਰਹੀ ਹਾਂ।",
                        "ਇੱਥੇ ਰਹਾਂਗਾ/ਰਹਾਂਗੀ — ਜਦੋਂ ਚਾਹੋ ਗੱਲ ਕਰ ਸਕਦੇ ਹੋ।",
                      ] as const,
                    )}`
                    : lang === "or"
                      ? `${openerWithContext} ${pickFrom(
                        `orAck:${msg}:${rel}:${name ?? ""}`,
                        [
                          "ଠିକ ଅଛ, ମୁଁ ଇଠି ଅଛି।",
                          "ଶୁଣୁଛି।",
                          "ଆମେ ଏହାକୁ ଧୀରେ ଧୀରେ ନେଇ ପାରିବ।",
                          "କୋଣ ଟିଏ ଗଡ଼ ନୁହଁ — ମୁଁ ଇଠି ଅଛି।",
                          "ସାଥ ଅଛି, ବୋଲ।",
                          "ହଁ, ଶୁଣୁଛି।",
                          "ଇଠି ଥିବ — ଯେବେ ଇଛ ଆଲୋଚନା କରି ହେବ।",
                        ] as const,
                      )}`
                      : lang === "ur"
                        ? `${openerWithContext} ${pickFrom(
                          `urAck:${msg}:${rel}:${name ?? ""}:${compGender}`,
                          isFemale
                            ? ["ٹھیک ہے، میں یہیں ہوں۔", "میں سن رہی ہوں۔", "ہم اسے آہستہ آہستہ لے سکتے ہیں۔", "کوئی جلدی نہیں — میں یہاں ہوں۔", "ساتھ ہوں، بتاتے رہیں۔", "ہاں، سن رہی ہوں۔", "یہاں رہوں گی — جب چاہیں بات کر سکتے ہیں۔"] as const
                            : ["ٹھیک ہے، میں یہیں ہوں۔", "میں سن رہا ہوں۔", "ہم اسے آہستہ آہستہ لے سکتے ہیں۔", "کوئی جلدی نہیں — میں یہاں ہوں۔", "ساتھ ہوں، بتاتے رہیں۔", "ہاں، سن رہا ہوں۔", "یہاں رہوں گا — جب چاہیں بات کر سکتے ہیں۔"] as const,
                        )}`
                        : lang === "ar"
                          ? `${openerWithContext} ${pickFrom(
                            `arAck:${msg}:${rel}:${name ?? ""}`,
                            ["حسناً، أنا هنا.", "أسمعك.", "يمكننا أخذ وقتنا.", "لا عجلة — أنا هنا.", "معك في هذا، تحدث.", "نعم، أسمعك.", "سأبقى هنا — تحدث متى شئت."] as const,
                          )}`
                          : lang === "zh"
                            ? `${openerWithContext} ${pickFrom(
                              `zhAck:${msg}:${rel}:${name ?? ""}`,
                              ["好，我在这里。", "我听到了。", "我们可以慢慢来。", "不急 — 我在这里。", "陪着你，继续说吧。", "嗯，我在听。", "我会在这里 — 随时都可以说。"] as const,
                            )}`
                            : lang === "es"
                              ? `${openerWithContext} ${pickFrom(
                                `esAck:${msg}:${rel}:${name ?? ""}`,
                                ["Está bien, aquí estoy.", "Te escucho.", "Podemos ir despacio.", "No hay prisa — aquí estoy.", "Contigo, sigue contándome.", "Sí, te escucho.", "Aquí estaré — habla cuando quieras."] as const,
                              )}`
                              : lang === "fr"
                                ? `${openerWithContext} ${pickFrom(
                                  `frAck:${msg}:${rel}:${name ?? ""}`,
                                  ["D'accord, je suis là.", "Je t'écoute.", "On peut prendre le temps.", "Pas de presse — je suis là.", "Avec toi, continue.", "Oui, je t'écoute.", "Je serai là — parle quand tu veux."] as const,
                                )}`
                                : lang === "pt"
                                  ? `${openerWithContext} ${pickFrom(
                                    `ptAck:${msg}:${rel}:${name ?? ""}`,
                                    ["Tá, estou aqui.", "Estou ouvindo.", "A gente pode ir devagar.", "Sem pressa — estou aqui.", "Com você, continua.", "Sim, estou ouvindo.", "Vou estar aqui — fala quando quiser."] as const,
                                  )}`
                                  : lang === "ru"
                                    ? `${openerWithContext} ${pickFrom(
                                      `ruAck:${msg}:${rel}:${name ?? ""}`,
                                      ["Хорошо, я здесь.", "Слушаю.", "Мы можем идти медленно.", "Не спеши — я здесь.", "Я с тобой, продолжай.", "Да, слушаю.", "Буду здесь — говори когда хочешь."] as const,
                                    )}`
                                    : lang === "id"
                                      ? `${openerWithContext} ${pickFrom(
                                        `idAck:${msg}:${rel}:${name ?? ""}`,
                                        ["Oke, aku di sini.", "Aku mendengarmu.", "Kita bisa pelan-pelan.", "Tidak ada buru-buru — aku di sini.", "Bersamamu, lanjutkan.", "Ya, aku mendengarmu.", "Akan ada di sini — cerita kapan saja."] as const,
                                      )}`
                                      : lang === "de"
                                        ? `${openerWithContext} ${pickFrom(
                                          `deAck:${msg}:${rel}:${name ?? ""}`,
                                          ["Gut, ich bin hier.", "Ich höre zu.", "Wir können uns Zeit lassen.", "Keine Eile — ich bin hier.", "Ich bin bei dir, erzähl weiter.", "Ja, ich höre zu.", "Ich bin da — sprich, wann du möchtest."] as const,
                                        )}`
                                        : `${openerWithContext} ${pickFrom(
                          `mrAck:${msg}:${rel}:${name ?? ""}:${compGender}`,
                          isFemale
                            ? ["ठीक आहे, मी इथे आहे.", "मी ऐकतेय.", "आपण हे हळूहळू घेऊ शकतो.", "घाई नाही — मी इथे आहे.", "सोबत आहे, सांगत राहा.", "हो, ऐकतेय.", "इथे राहीन — केव्हाही बोलू शकतोस."] as const
                            : ["ठीक आहे, मी इथे आहे.", "मी ऐकतोय.", "आपण हे हळूहळू घेऊ शकतो.", "घाई नाही — मी इथे आहे.", "सोबत आहे, सांगत राहा.", "हो, ऐकतोय.", "इथे राहीन — केव्हाही बोलू शकतोस."] as const,
                        )}`;

  const followUp =
    lang === "hi"
      ? pickFrom(
        `hiFollow:${msg}:${rel}:${name ?? ""}`,
        [
          "अभी सबसे ज़्यादा क्या चाहिए — थोड़ा सुकून, थोड़ी स्पष्टता, या बस साथ?",
          "अगर कहना चाहो, अभी सबसे भारी हिस्सा कौन सा लग रहा है?",
          "हम यहीं से धीरे-धीरे शुरू कर सकते हैं — क्या सबसे पहले उसी पर रहना चाहोगे?",
        ] as const,
      )
      : lang === "gu"
        ? pickFrom(
          `guFollow:${msg}:${rel}:${name ?? ""}`,
          [
            "હમણાં સૌથી વધુ શું જોઈએ છે — થોડો આધાર, થોડું સ્પષ્ટપણું, કે ફક્ત સાથ?",
            "જો કહેવું હોય તો હમણાં સૌથી ભારે શું લાગી રહ્યું છે?",
            "આપણે અહીંથી ધીમે ધીમે શરૂ કરી શકીએ — પહેલા કયા ભાગ પર રહેવું છે?",
          ] as const,
        )
        : lang === "kn"
          ? pickFrom(
            `knFollow:${msg}:${rel}:${name ?? ""}`,
            [
              "ಈಗ ನಿಮಗೆ ಹೆಚ್ಚು ಏನು ಬೇಕಾಗಿದೆ — ಸ್ವಲ್ಪ ನೆಮ್ಮದಿ, ಸ್ವಲ್ಪ ಸ್ಪಷ್ಟತೆ, ಅಥವಾ ಕೇವಲ ಜೊತೆ?",
              "ಹೇಳಬೇಕೆಂದರೆ ಈಗ ಯಾವ ಭಾಗ ಹೆಚ್ಚು ಭಾರವಾಗಿ ಕಾಣುತ್ತಿದೆ?",
              "ನಾವು ಇಲ್ಲಿಂದ ನಿಧಾನವಾಗಿ ಆರಂಭಿಸಬಹುದು — ಮೊದಲು ಯಾವ ಭಾಗದ ಮೇಲೆ ಉಳಿಯಲು ಇಷ್ಟಪಡುತ್ತೀರಾ?",
            ] as const,
          )
          : lang === "mr"
            ? pickFrom(
              `mrFollow:${msg}:${rel}:${name ?? ""}`,
              [
                "आत्ता तुला सगळ्यात जास्त काय हवं आहे — थोडा आधार, थोडी स्पष्टता, की फक्त साथ?",
                "जर सांगावंसं वाटत असेल तर आत्ता सगळ्यात जड काय वाटतंय?",
                "आपण इथून हळूहळू सुरुवात करू शकतो — आधी कोणत्या भागावर थांबायचं आहे?",
              ] as const,
            )
            : lang === "ta"
              ? pickFrom(
                `taFollow:${msg}:${rel}:${name ?? ""}`,
                [
                  "இப்போது உனக்கு அதிகமாக என்ன தேவை — கொஞ்சம் ஆறுதலா, தெளிவா, இல்லை வெறும் துணையா?",
                  "சொல்ல விரும்பினால், இப்போது எந்த பகுதி அதிகமாக கஷ்டமாக இருக்கிறது?",
                  "நாம் இங்கிருந்து மெல்ல தொடங்கலாம் — முதலில் எந்த விஷயத்தில் இருக்க விரும்புகிறாய்?",
                ] as const,
              )
              : lang === "te"
                ? pickFrom(
                  `teFollow:${msg}:${rel}:${name ?? ""}`,
                  [
                    "ఇప్పుడు నీకు ఎక్కువగా ఏమి కావాలి — కొంచెం ఓదార్పు, స్పష్టత, లేదా కేవలం తోడా?",
                    "చెప్పాలని ఉంటే, ఇప్పుడు ఏ భాగం ఎక్కువగా భారంగా అనిపిస్తుందో చెప్పు.",
                    "మనం ఇక్కడ నుండి నెమ్మదిగా మొదలుపెట్టవచ్చు — మొదట దేనిపై ఉండాలని ఉంది?",
                  ] as const,
                )
                : lang === "ml"
                  ? pickFrom(
                    `mlFollow:${msg}:${rel}:${name ?? ""}`,
                    [
                      "ഇപ്പോൾ നിനക്ക് ഏറ്റവും കൂടുതൽ ആവശ്യം ഏതാണ് — കൊഞ്ചം ആശ്വാസമോ, വ്യക്തതയോ, അതോ വെറും കൂട്ടോ?",
                      "പറയണം എന്നുണ്ടെങ്കിൽ, ഇപ്പോൾ ഏത് ഭാഗം കൂടുതൽ ഭാരമേറിയതായി തോന്നുന്നു?",
                      "നമുക്ക് ഇവിടെ നിന്ന് പതുക്കെ തുടങ്ങാം — ആദ്യം ഏത് ഭാഗത്ത് ഉണ്ടാകണം?",
                    ] as const,
                  )
                  : lang === "pa"
                    ? pickFrom(
                      `paFollow:${msg}:${rel}:${name ?? ""}`,
                      [
                        "ਹੁਣ ਤੈਨੂੰ ਸਭ ਤੋਂ ਵੱਧ ਕੀ ਚਾਹੀਦਾ ਹੈ — ਥੋੜ੍ਹਾ ਸਕੂਨ, ਸਪੱਸ਼ਟਤਾ, ਜਾਂ ਬੱਸ ਸਾਥ?",
                        "ਜੇ ਕਹਿਣਾ ਚਾਹੁੰਦਾ/ਚਾਹੁੰਦੀ ਹੈਂ, ਹੁਣ ਸਭ ਤੋਂ ਭਾਰਾ ਕਿਹੜਾ ਹਿੱਸਾ ਲੱਗ ਰਿਹਾ ਹੈ?",
                        "ਅਸੀਂ ਇੱਥੋਂ ਹੌਲੀ ਹੌਲੀ ਸ਼ੁਰੂ ਕਰ ਸਕਦੇ ਹਾਂ — ਪਹਿਲਾਂ ਕਿਸ ਭਾਗ ਉੱਤੇ ਰਹਿਣਾ ਚਾਹੋਗੇ?",
                      ] as const,
                    )
                    : lang === "or"
                      ? pickFrom(
                        `orFollow:${msg}:${rel}:${name ?? ""}`,
                        [
                          "ଏବେ ତୋ ପାଇଁ ସବୁଠୁ ଅଧିକ କ'ଣ ଦରକାର — ଟିକେ ଆଶ୍ୱାସ, ସ୍ପଷ୍ଟତା, ନା ଶୁଧୁ ସାଥ?",
                          "ଯଦି ବୋଲିବ ଚାହଁ, ଏବେ ସବୁଠୁ ଭାରୀ ଭାଗ କ'ଣ ଲାଗୁଛ?",
                          "ଆମେ ଇଠୁ ଧୀରେ ଧୀରେ ଆରମ୍ଭ କରି ପାରିବ — ପ୍ରଥମ ଏ ଭାଗରେ ରୁହ ଚାହଁ?",
                        ] as const,
                      )
                      : lang === "ur"
                        ? pickFrom(
                          `urFollow:${msg}:${rel}:${name ?? ""}`,
                          [
                            "ابھی سب سے زیادہ کیا چاہیے — تھوڑا سکون، تھوڑی وضاحت، یا بس ساتھ؟",
                            "اگر کہنا چاہیں تو ابھی سب سے بھاری حصہ کون سا لگ رہا ہے؟",
                            "ہم یہاں سے آہستہ آہستہ شروع کر سکتے ہیں — پہلے کس حصے پر رہنا چاہیں گے؟",
                          ] as const,
                        )
                        : lang === "ar"
                          ? pickFrom(
                            `arFollow:${msg}:${rel}:${name ?? ""}`,
                            ["ما الذي تحتاجه أكثر الآن — بعض الراحة، وضوح، أو مجرد صحبة؟", "لو أردت الكلام، ما أثقل جزء الآن؟", "يمكننا البدء من هنا بهدوء — أين تريد أن نبدأ؟"] as const,
                          )
                          : lang === "zh"
                            ? pickFrom(
                              `zhFollow:${msg}:${rel}:${name ?? ""}`,
                              ["现在你最需要什么 — 一些安慰、清晰感，还是只是有人陪？", "如果你想说说，现在哪个部分最让你感到沉重？", "我们可以从这里慢慢开始 — 你想从哪里谈起？"] as const,
                            )
                            : lang === "es"
                              ? pickFrom(
                                `esFollow:${msg}:${rel}:${name ?? ""}`,
                                ["¿Qué es lo que más necesitas ahora — un poco de calma, claridad, o simplemente compañía?", "Si quieres, ¿qué parte es la más pesada en este momento?", "Podemos empezar desde aquí despacio — ¿por dónde quieres ir primero?"] as const,
                              )
                              : lang === "fr"
                                ? pickFrom(
                                  `frFollow:${msg}:${rel}:${name ?? ""}`,
                                  ["De quoi as-tu le plus besoin là — un peu de calme, de clarté ou juste de la compagnie ?", "Si tu veux en parler, quelle est la partie la plus lourde en ce moment ?", "On peut commencer tranquillement d'ici — par où tu veux commencer ?"] as const,
                                )
                                : lang === "pt"
                                  ? pickFrom(
                                    `ptFollow:${msg}:${rel}:${name ?? ""}`,
                                    ["O que você mais precisa agora — um pouco de calma, clareza, ou só companhia?", "Se quiser falar, qual parte está pesando mais agora?", "A gente pode começar daqui devagar — por onde quer ir primeiro?"] as const,
                                  )
                                  : lang === "ru"
                                    ? pickFrom(
                                      `ruFollow:${msg}:${rel}:${name ?? ""}`,
                                      ["Что тебе сейчас нужно больше всего — немного покоя, ясности или просто компании?", "Если хочешь рассказать, какая часть сейчас самая тяжёлая?", "Мы можем начать отсюда медленно — с чего ты хочешь начать?"] as const,
                                    )
                                    : lang === "id"
                                      ? pickFrom(
                                        `idFollow:${msg}:${rel}:${name ?? ""}`,
                                        ["Apa yang paling kamu butuhkan sekarang — sedikit ketenangan, kejernihan, atau sekadar teman?", "Kalau mau cerita, bagian mana yang paling berat sekarang?", "Kita bisa mulai pelan-pelan dari sini — mau mulai dari mana?"] as const,
                                      )
                                      : lang === "de"
                                        ? pickFrom(
                                          `deFollow:${msg}:${rel}:${name ?? ""}`,
                                          ["Was brauchst du jetzt am meisten — etwas Ruhe, Klarheit, oder einfach Gesellschaft?", "Wenn du magst, welcher Teil ist gerade am schwersten?", "Wir können hier langsam anfangen — womit möchtest du beginnen?"] as const,
                                        )
                                        : "";

  return {
    message,
    followUp,
    meta: {
      styleContract: "1.0",
      blueprint: "1.0",
      blueprintUsed: getResponseBlueprint({
        tone: inferBlueprintTone(userMessage),
      }),
    },
  };
}

function recentlyUsedAny(
  ctx: SessionContext,
  needles: string[],
  maxTurns: number,
): boolean {
  const recent = (ctx?.recent ?? []).slice(-maxTurns);
  const hay = recent.map((m) => (m?.content ?? "").toLowerCase()).join("\n");
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

function pickFrom<T>(seed: string, items: readonly T[]): T {
  const idx = pickVariant(seed, items.length);
  return items[idx]!;
}

function draftResponse(
  userMessage: string,
  ctx: SessionContext,
): ImotaraResponse {
  // IMPORTANT: response MUST be driven by current userMessage (history is only for avoiding repeats)
  const msg = oneLine(userMessage);
  const lower = msg.toLowerCase();

  const name = getUserName(ctx);
  const rel = pickRelationshipTone(ctx);

  // --- Rotating opener bank to avoid repetition ---
  // Deterministic hash from seed (no randomness)
  function hashLite(seed: string): number {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  function isLowSignalUserTurn(input: string): boolean {
    const text = String(input ?? "")
      .trim()
      .toLowerCase();

    // Very short or vague emotional signals
    if (text.length <= 30) return true;

    // Common low-signal emotional phrases
    if (
      text === "life" ||
      text === "life 😔" ||
      text === "not feeling good" ||
      text === "feeling low" ||
      text === "sad" ||
      text === "tired"
    ) {
      return true;
    }

    return false;
  }

  function pickFromIndex<T>(arr: readonly T[], h: number): T {
    return arr[h % arr.length];
  }

  function pickFromSeed<T>(seed: string, arr: readonly T[]): T {
    const h = hashLite(seed);
    return pickFromIndex(arr, h);
  }

  function pickOpener(
    ctx: SessionContext,
    rel: string,
    name?: string,
    seed?: string,
    maxTurns: number = 20,
  ): string {
    const h = hashLite(`${rel}|${name ?? ""}|${seed ?? ""}`);

    const friend = [
      name ? `Hey ${name}… I’m here.` : "Hey… I’m here.",
      name ? `Mm. I’m with you, ${name}.` : "Mm. I’m with you.",
      name ? `Okay ${name}. I hear you.` : "Okay. I hear you.",
      name ? `I’m right here, ${name}.` : "I’m right here.",
      name ? `Got you, ${name}.` : "Got you.",
    ] as const;

    const coach = [
      name ? `Alright, ${name}.` : "Alright.",
      name ? `Okay, ${name}.` : "Okay.",
      name
        ? `We’ll take this one step at a time, ${name}.`
        : "We’ll take this one step at a time.",
    ] as const;

    const mentor = [
      name ? `I’m listening, ${name}.` : "I’m listening.",
      name ? `Tell me more, ${name}.` : "Tell me more.",
      name ? `Go on, ${name}.` : "Go on.",
    ] as const;

    const elder = [
      name ? `I’m here, ${name}. Take your time.` : "I’m here. Take your time.",
      name ? `It’s okay, ${name}. I’m listening.` : "It’s okay. I’m listening.",
      name ? `Hmm… I hear you, ${name}.` : "Hmm… I hear you.",
    ] as const;

    const sibling = [
      name ? `Hey ${name} — I’m here.` : "Hey — I’m here.",
      name ? `Okay okay, ${name}. I got you.` : "Okay okay. I got you.",
      name ? `Mm. Tell me, ${name}.` : "Mm. Tell me.",
    ] as const;

    const juniorBuddy = [
      name ? `Heyy ${name}! I’m here with you.` : "Heyy! I’m here with you.",
      name ? `Okayy ${name} — I got you.` : "Okayy — I got you.",
      name ? `Hmm… I’m listening, ${name}.` : "Hmm… I’m listening.",
    ] as const;

    const parentLike = [
      name ? `I’m here, ${name}. No rush.` : "I’m here. No rush.",
      name
        ? `It’s okay, ${name}. We’ll go gently.`
        : "It’s okay. We’ll go gently.",
      name ? `I’ve got you, ${name}.` : "I’ve got you.",
    ] as const;

    const partnerLike = [
      name ? `Hey ${name} — I’m listening.` : "Hey — I’m listening.",
      name ? `I’m with you, ${name}. Let’s keep it real.` : "I’m with you. Let’s keep it real.",
      name ? `Alright ${name}, I’m here. Tell me properly.` : "Alright, I’m here. Tell me properly.",
    ] as const;

    const fallback = [
      name ? `I hear you, ${name}.` : "I hear you.",
      name ? `I’m here, ${name}.` : "I’m here.",
      name ? `Mm. I’m here with you, ${name}.` : "Mm. I’m here with you.",
    ] as const;

    const normalizeForOpenerMatch = (s: string): string => {
      return (
        s
          // unify ellipsis variants
          .replace(/\.\.\./g, "…")
          // collapse whitespace
          .replace(/\s+/g, " ")
          // remove leading markdown/quote markers that might precede content
          .replace(/^[>\-\*\s]+/, "")
          // normalize punctuation runs (e.g., "!!" "..." ",," etc.)
          .replace(/([!?.,…])\1+/g, "$1")
          .trim()
          .toLowerCase()
      );
    };

    const wasOpenerUsedRecently = (opener: string): boolean => {
      const recent = (ctx?.recent ?? [])
        .filter((m) => m.role === "assistant")
        .slice(-maxTurns);

      const o = normalizeForOpenerMatch(opener);

      return recent.some((m) => {
        const content = normalizeForOpenerMatch(String(m?.content ?? ""));

        // Match at the beginning, but also allow a tiny safety margin where
        // the assistant might start with a short prefix like "Hey," before the opener.
        return content.startsWith(o);
      });
    };

    // Style ID = "emotional pattern family" (prevents semantic repetition like
    // "Got you" / "I got you" / "I've got you" across turns).
    const openerStyleId = (opener: string): string => {
      const o = normalizeForOpenerMatch(opener);

      if (
        o.includes("got you") ||
        o.includes("i got you") ||
        o.includes("i’ve got you") ||
        o.includes("i've got you")
      ) {
        return "got_you";
      }
      if (
        o.includes("i’m here") ||
        o.includes("i'm here") ||
        o.includes("right here")
      ) {
        return "here";
      }
      if (o.includes("i’m with you") || o.includes("i'm with you")) {
        return "with_you";
      }
      if (o.includes("i’m listening") || o.includes("i'm listening")) {
        return "listening";
      }
      if (
        o.startsWith("okay") ||
        o.startsWith("alright") ||
        o.includes("one step at a time")
      ) {
        return "okay";
      }
      if (o.startsWith("hey") || o.startsWith("hi") || o.startsWith("hello")) {
        return "hello";
      }
      return "other";
    };

    const wasStyleUsedRecently = (styleId: string): boolean => {
      const recent = (ctx?.recent ?? [])
        .filter((m) => m.role === "assistant")
        .slice(-maxTurns);

      return recent.some((m) => {
        const content = normalizeForOpenerMatch(String(m?.content ?? ""));
        // Check only the beginning of the assistant message for opener pattern
        // (avoid false positives deep inside the text).
        const head = content.slice(0, 80);
        return openerStyleId(head) === styleId;
      });
    };

    const pickFromNoRepeat = <T extends string>(items: readonly T[]): T => {
      if (items.length === 0) return "" as T;
      const start = h % items.length;

      for (let i = 0; i < items.length; i++) {
        const cand = items[(start + i) % items.length]!;
        const style = openerStyleId(cand);

        // First preference: avoid same exact opener AND avoid same style family.
        if (!wasOpenerUsedRecently(cand) && !wasStyleUsedRecently(style))
          return cand;

        // Second preference: if exact is repeated but style is fresh, still allow.
        if (!wasStyleUsedRecently(style)) return cand;
      }

      return items[start]!;
    };

    switch (rel) {
      case "friend":
        return pickFromNoRepeat(friend);
      case "coach":
        return pickFromNoRepeat(coach);
      case "mentor":
        return pickFromNoRepeat(mentor);
      case "elder":
        return pickFromNoRepeat(elder);
      case "sibling":
        return pickFromNoRepeat(sibling);
      case "junior_buddy":
        return pickFromNoRepeat(juniorBuddy);
      case "parent_like":
        return pickFromNoRepeat(parentLike);
      case "partner_like":
        return pickFromNoRepeat(partnerLike);
      default:
        return pickFromNoRepeat(fallback);
    }
  }

  const recentAssistantTurns = (ctx?.recent ?? []).filter(
    (m) => m.role === "assistant",
  );

  const shouldUseOpener =
    recentAssistantTurns.length === 0 ||
    isGreetingOnly(msg) ||
    pickVariant(
      `openerUse:${rel}:${name ?? ""}:${msg}:${recentAssistantTurns.length}`,
      5,
    ) === 0;

  const opener = shouldUseOpener
    ? pickOpener(ctx, rel, name ?? undefined, msg)
    : "";

  // ✅ Continuity: gently anchor to the last user turn (when available)
  const prev = getContextUserTurn(ctx, msg, 3);
  const useAnchor =
    !!prev &&
    !!opener &&
    shouldUseContinuityAnchor(msg) &&
    sharesKeyword(msg, prev);

  const openerWithContext = useAnchor
    ? [opener, continuityAnchor("en", prev!, msg)].filter(Boolean).join(" ")
    : opener;

  let message = "";
  let followUp = "";

  // ✅ Greeting-only: be human first, avoid template follow-ups like "comfort/clarity/next step"
  if (isGreetingOnly(msg)) {
    const greetAck = pickFromSeed(
      `greetAck:${rel}:${name ?? ""}:${msg}`,
      [
        name ? `Hey ${name}.` : "Hey.",
        name ? `Hi ${name}.` : "Hi.",
        name ? `Hello ${name}.` : "Hello.",
      ] as const,
    );

    message = greetAck;
    followUp = "";
  } else if (
    !/[?？؟]/.test(msg) &&
    tokenizeLite(msg).length <= 8 &&
    /\b(i|im|i'm|am|just|now|today|currently|at|home|resting|relaxing|chilling|working|studying|sleeping)\b/i.test(
      lower,
    ) &&
    !/\b(accident|scary|fear|afraid|panic|hurt|injury|injured|sad|lonely|cry|crying|angry|stress|stressed|anxious|anxiety|worried|depressed|hopeless|overwhelmed|exhausted|exhaust|drained|heavy|mentally exhausted|emotionally heavy|burnout|burned out|burnt out|empty|numb|meaningless|die|dying|suicide|suicidal|kill myself|end my life|don't want to live|dont want to live|cannot go on|can't go on|cant go on|low|down|off|tired|distant|lost|stuck|upset|broken|struggling|struggling with|not okay|not good|not well|off today|bit off|kind of)\b/i.test(
      lower,
    ) &&
    !lower.includes("trembl") &&
    !lower.includes("shak")
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `lifeAck:${msg}:${rel}:${name ?? ""}`,
      [
        "Got it.",
        "Okay.",
        "Alright.",
      ] as const,
    )}`;
    followUp = "";
  } else if (
    /[?？؟]/.test(msg) &&
    (tokenizeLite(msg).length <= 8 || msg.length <= 48) &&
    !/\b(accident|scary|fear|afraid|panic|hurt|injury|injured|sad|lonely|cry|crying|angry|stress|stressed|anxious|anxiety|worried|depressed|hopeless)\b/i.test(
      lower,
    )
  ) {
    if (/\bhow\s+(are|r)\s+(you|u)\b/i.test(lower)) {
      message = `${openerWithContext} I’m here with you.`;
      followUp = "";
    } else if (
      /\bwhat\s+(are|r)\s+(you|u)\s+doing\b/i.test(lower) ||
      /\bwhat\s+do\s+(you|u)\s+do\b/i.test(lower)
    ) {
      message = `${openerWithContext} I’m here with you.`;
      followUp = "";
    } else if (/\bwhere\s+(are|r)\s+(you|u)\b/i.test(lower)) {
      message = `${openerWithContext} I’m here with you.`;
      followUp = "";
    } else {
      message = `${openerWithContext} I’m here with you.`;
      followUp = "";
    }
  } else if (
    CRISIS_HINT_REGEX.test(msg)
  ) {
    console.log("[IMOTARA_CRISIS_BRANCH]", { msg, lower, rel });
    const crisisAck = pickFromSeed(
      `crisisAck:${msg}:${rel}:${name ?? ""}`,
      [
        "I’m really glad you said it here. You matter, and I want to stay with you right now.",
        "Thank you for telling me directly. I'm here with you. We can take this one safe step at a time.",
        "I’m with you right now. Your safety matters more than anything else in this moment.",
      ] as const,
    );

    const crisisFollow = pickFromSeed(
      `crisisFollow:${msg}:${rel}:${name ?? ""}`,
      [
        "Are you in immediate danger right now, or have you already done anything to hurt yourself?",
        "Can you move a little farther from anything you could use to hurt yourself, and tell me once you have?",
        "Can you call or message one trusted person right now and stay with me while you do it?",
      ] as const,
    );

    const countryCode = (ctx as any)?.countryCode ?? null;
    const countryResources = getCrisisResourcesForCountry(countryCode);
    const primaryLine = countryResources?.primary?.[0] ?? null;

    const crisisSupportOffer = primaryLine
      ? `If you need immediate human support, you can reach ${primaryLine.label} at ${primaryLine.contact}. ${primaryLine.note ?? ""}`.trim()
      : "If you need immediate human support, please reach out to a local crisis line or emergency services.";

    return {
      reflectionSeed: undefined,
      message: cap(
        `${crisisAck}\n\n${crisisFollow}\n\n${crisisSupportOffer}`,
        240,
      ),
      followUp: "",
      meta: {
        styleContract: "1.0",
        blueprint: "1.0",
        blueprintUsed: getResponseBlueprint({
          tone: inferBlueprintTone(userMessage),
        }),
      },
    };

  } else if (detectMetaComplaintIntent(msg)) {
    const metaAck = pickFromSeed(
      `metaAck:${msg}:${rel}:${name ?? ""}`,
      [
        "Fair point.",
        "That’s fair.",
        "You’re right to call that out.",
      ] as const,
    );

    message = `${openerWithContext} ${metaAck}`;
    followUp = "";

  } else if (
    /\b(accident|crash|collision|hit|injured|injury)\b/i.test(lower)
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `accidentAck:${msg}:${rel}:${name ?? ""}`,
      [
        "That sounds scary.",
        "That sounds unsettling.",
        "That sounds serious.",
      ] as const,
    )}`;

    followUp =
      "Are you safe now? If you feel like sharing, tell me what happened.";

  } else if (
    lower.includes("stranger") ||
    lower.includes("stranger") ||
    lower.includes("met") ||
    lower.includes("someone")
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `strangerAck:${msg}:${rel}:${name ?? ""}`,
      [
        "That kind of moment can stay with you.",
        "Some brief moments still leave an impression.",
        "That sounds like it left something with you.",
      ] as const,
    )}`;
    followUp =
      "Tell me what stood out most — what they said/did, how you felt, or the situation itself.";
  } else if (
    lower.includes("money") ||
    lower.includes("salary") ||
    lower.includes("bonus")
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `moneyAck:${msg}:${rel}:${name ?? ""}`,
      [
        "Money can bring a lot of mixed feeling.",
        "That can carry a mix of relief and pressure.",
        "That can land with more than one feeling at once.",
      ] as const,
    )}`;
    followUp =
      "If you want, tell me which side feels stronger for you — relief, pride, or something else.";
  } else if (
    lower.includes("office") ||
    lower.includes("work") ||
    lower.includes("boss") ||
    lower.includes("manager") ||
    lower.includes("deadline")
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `workAck:${msg}:${rel}:${name ?? ""}`,
      [
        "Work pressure can build up quietly.",
        "That kind of work stress can sit heavy.",
        "That sounds like work pressure piling up.",
      ] as const,
    )}`;
    followUp =
      "Share the one part that’s bothering you most (workload, people, or uncertainty) and we’ll pick a small next step.";
  } else if (
    lower.includes("ecstatic") ||
    lower.includes("amazing") ||
    lower.includes("fantastic") ||
    lower.includes("happy") ||
    lower.includes("great") ||
    lower.includes("cool")
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `happyAck:${msg}:${rel}:${name ?? ""}`,
      [
        "That sounds genuinely good.",
        "That kind of energy feels nice to hear.",
        "That sounds like a good moment.",
      ] as const,
    )}`;
    followUp =
      "If you feel like sharing, tell me what sparked it — a moment, a person, or just one of those rare good days.";
  } else if (
    /\b(remember|remembering|memories|memory|old days|good days|those days|nostalgic|smiling remembering|miss those days)\b/i.test(
      lower,
    ) ||
    /\b(mone pore|mon[e]? pore|purono diner kotha|yaad aa rahi|yaad aa raha|purane din|accha lag raha|acha lag raha)\b/i.test(
      lower,
    )
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `nostalgiaAck:${msg}:${rel}:${name ?? ""}`,
      [
        "That sounds like a warm memory.",
        "Those kinds of memories can bring a soft smile with them.",
        "That sounds tender in a good way.",
      ] as const,
    )}`;
    followUp =
      "If you want, tell me which memory came back most strongly just now.";
  } else if (
    lower.includes("hungry") ||
    lower.includes("tired") ||
    lower.includes("sleepy") ||
    lower.includes("bored") ||
    lower.includes("headache") ||
    lower.includes("sick")
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `bodyAck:${msg}:${rel}:${name ?? ""}`,
      [
        "Sounds like your body needs something.",
        "Sounds like you need a little care right now.",
        "Sounds like something simple might help first.",
      ] as const,
    )}`;

    followUp =
      "Want something quick and practical right now — food, rest, or just a short reset?";
  } // ⚠️ Fear / shock physical signals
  else if (
    lower.includes("trembl") ||
    lower.includes("shak")
  ) {
    message = `${openerWithContext} ${pickFromSeed(
      `fearAck:${msg}:${rel}:${name ?? ""}`,
      [
        "That sounds like your body is still on edge.",
        "That sounds like a shaken-up moment.",
        "That sounds like it hit your system hard.",
      ] as const,
    )}`;

    // force a gentle safety check
    if (!followUp) {
      followUp = "Are you somewhere safe right now?";
    }
  } else {
    // ✅ Avoid template-y repetition ("I'm with you in this.") by using varied, calm presence lines.
    // Also: if opener already contains an empathy/presence anchor, don't add another.
    const presenceBank = [
      "Okay. We’ll keep it simple.",
      "No rush. One small step at a time.",
      "That makes sense.",
      "We can take this gently.",
      "Thanks for telling me.",
      "I’m here with you.",
      "Take your time.",
      "We don’t have to rush this.",
    ];

    const openerText = String(openerWithContext ?? "").trim();
    const openerLower = openerText
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[’]/g, "'")
      .trim();

    const openerAlreadyHasAnchor =
      openerLower.includes("i'm with you") ||
      openerLower.includes("im with you") ||
      openerLower.includes("i’m with you") ||
      openerLower.includes("i hear you") ||
      openerLower.includes("got you") ||
      openerLower.includes("i'm here") ||
      openerLower.includes("im here") ||
      openerLower.includes("i’m here");

    const needsMoreThanPresence =
      inferBlueprintTone(msg) === "supportive" ||
      /\b(overwhelmed|exhaust|exhausted|drained|heavy|empty|numb|hopeless|meaningless|stuck|lost|anxious|anxiety|worried|panic)\b/i.test(
        lower,
      );

    const supportivePresenceBank = [
      "That sounds draining.",
      "That feels like a lot to carry.",
      "That kind of heaviness can wear you down.",
      "We can go gently with this.",
    ] as const;

    message = openerAlreadyHasAnchor
      ? needsMoreThanPresence
        ? `${openerText} ${pickFromSeed(
          `supportivePresence:${msg}:${rel}:${name ?? ""}`,
          supportivePresenceBank,
        )}`
        : openerText
      : `${openerText} ${pickFromSeed(
        `presence:${msg}:${rel}:${name ?? ""}`,
        presenceBank,
      )}`;

    // ✅ Long-memory: avoid repeating the same fallback style too often (25 turns)
    const cooldownTurns = 25;

    // We store "keys" as tiny phrases and check recent history for those keys.
    const usedComfortStyle = recentlyUsedAny(
      ctx,
      [
        "comfort, clarity, or a small next step",
        "comfort, clarity, or a next step",
      ],
      cooldownTurns,
    );

    const usedListenStyle = recentlyUsedAny(
      ctx,
      [
        "start anywhere",
        "i'm listening",
        "tell me what's heaviest",
        "tell me what's on your mind",
      ],
      cooldownTurns,
    );

    const usedClarifyStyle = recentlyUsedAny(
      ctx,
      [
        "what part feels hardest",
        "what feels most important",
        "where should we begin",
      ],
      cooldownTurns,
    );

    // 🟢 Soft "just listen" variants (can be statement-only)
    const listenBank = [
      "You don’t have to make it tidy. Start anywhere — I’m listening.",
      "Take your time. I’m here with you.",
      "If it feels hard to explain, you can just describe one small piece of it.",
      "I’m right here. We can sit with it for a moment.",
      "We don’t have to rush this.",
      "You can take a breath first — I’m here.",
      "It’s okay to go slowly with this.",
    ] as const;

    // 🟡 Gentle clarify variants (one question max, permission-based)
    const clarifyBank = [
      "If you feel like sharing, what’s the heaviest part right now?",
      "Where would you like to begin — softly and simply?",
      "What part of this feels hardest to carry today?",
      "What’s one small detail about what’s going on right now?",
    ] as const;

    // 🔵 Structured option variants (rare; use only when not recently used)
    const optionsBank = [
      "If you want, we can go gentle — do you want comfort, clarity, or a small next step?",
      "What would help most right now — a little comfort, a bit of clarity, or one tiny next step?",
      "Would you like me to just be here with you, or help you find one small next step?",
    ] as const;

    // Decide which style to use (prefer listening)
    // 60% listen, 30% clarify, 10% options (but options suppressed if recently used)
    const stylePick = pickVariant(
      `fallbackStyle:${msg}:${rel}:${name ?? ""}`,
      10,
    );

    const wantListen = stylePick < 6;
    const wantClarify = stylePick >= 6 && stylePick < 9;
    const wantOptions = stylePick >= 9;

    // Presence-first: for low-signal emotional turns, often *don’t* ask a follow-up.
    // This avoids the "therapist interview" feel and matches: reflect → pause.
    const lowSignal = isLowSignalUserTurn(msg);
    const presenceBiasSeed = `presenceBias:${msg}:${rel}:${name ?? ""}`;

    // About ~60% of the time, skip follow-up entirely (no question).
    const shouldSkipFollowUp = lowSignal && hashLite(presenceBiasSeed) % 10 < 6;

    // Also: if the user already got a question recently, prefer presence.
    const askedRecently = recentlyAsked(
      ctx,
      "small detail about what's going on",
    );

    if (shouldSkipFollowUp || (lowSignal && askedRecently)) {
      followUp = ""; // let formatter / UI show just the message
    } else if (wantListen && !usedListenStyle) {
      followUp = pickFromSeed(`listen:${msg}:${rel}:${name ?? ""}`, listenBank);
    } else if (wantClarify && !usedClarifyStyle) {
      followUp = pickFromSeed(
        `clarify:${msg}:${rel}:${name ?? ""}`,
        clarifyBank,
      );
    } else if (wantOptions && !usedComfortStyle) {
      followUp = pickFromSeed(
        `options:${msg}:${rel}:${name ?? ""}`,
        optionsBank,
      );
    } else {
      // Fallback if all were recently used: choose the least repetitive "listen" line
      followUp = pickFromSeed(
        `listen2:${msg}:${rel}:${name ?? ""}`,
        listenBank,
      );
    }
  }

  const userPrefs = {
    companionTone: ctx.persona?.relationshipTone,
    ageTone: ctx.persona?.ageTone,
    genderTone: ctx.persona?.genderTone,
  };

  const enforcedMessage = applySoftEnforcement({ text: message, userPrefs });
  const enforcedFollowUp = applySoftEnforcement({ text: followUp, userPrefs });

  const meta: ImotaraResponse["meta"] = {
    styleContract: "1.0",
    blueprint: "1.0",
    blueprintUsed: getResponseBlueprint({
      tone: inferBlueprintTone(userMessage),
    }),
  };

  // ✅ Baby Step 11.3 — echo applied/requested tone choices for QA/compat gate
  // (Kept as server-added debug metadata; clients may ignore.)
  (meta as any).toneEcho = {
    relationshipTone: ctx.persona?.relationshipTone ?? null,
    ageTone: ctx.persona?.ageTone ?? null,
    genderTone: ctx.persona?.genderTone ?? null,
  };

  // QA-only: attach notes only when debug is enabled
  if (ctx.debug) {
    meta.softEnforcement = {
      message: {
        severity: enforcedMessage.severity,
        notes: enforcedMessage.notes,
      },
      followUp: {
        severity: enforcedFollowUp.severity,
        notes: enforcedFollowUp.notes,
      },
    };
  }

  // ✅ Baby Step 11.7.3 — derive emotion from the last user text (deterministic, no AI)
  const userName = (ctx as any)?.toneContext?.user?.name as string | undefined;
  const userText = String(userMessage ?? "");

  const t = userText.toLowerCase();

  // tiny helper: deterministic keyword → primary emotion
  const inferPrimaryFromText = (text: string): EmotionAnalysis["primary"] => {
    const s = String(text || "").toLowerCase();

    return /\b(stress|stressed|anxious|anxiety|worried|panic|overwhelmed|burnt out|burned out|mentally exhausted|exhausted|drained)\b/.test(
      s,
    )
      ? "anxiety"
      : /\b(sad|down|depressed|heartbroken|lonely|cry|crying|emotionally heavy|heavy|empty|numb|hopeless|meaningless)\b/.test(s)
        ? "sadness"
        : /\b(angry|mad|furious|irritated|annoyed)\b/.test(s)
          ? "anger"
          : /\b(scared|afraid|fear|terrified)\b/.test(s)
            ? "fear"
            : /\b(happy|glad|excited|joy|relieved)\b/.test(s)
              ? "joy"
              : "neutral";
  };

  // 1) primary from *current* message
  let primary = inferPrimaryFromText(t);

  // 2) ✅ Emotion continuity:
  // If current looks neutral, keep the last non-neutral from recent user turns (if any).
  if (primary === "neutral") {
    const recent = (ctx?.recent ?? []).slice().reverse(); // newest → oldest
    for (const m of recent) {
      if (m?.role !== "user") continue;
      const prev = inferPrimaryFromText(m.content);
      if (prev !== "neutral") {
        primary = prev;
        break;
      }
    }
  }

  const fallbackSummary = userName
    ? `Feeling mostly ${primary} for ${userName}.`
    : `Feeling mostly ${primary}.`;

  const emotion: EmotionAnalysis = normalizeEmotion(
    {
      primary,
      intensity: "medium",
      confidence: 0.75,
      summary: fallbackSummary,
    },
    fallbackSummary,
  );

  // Keep it inside meta so we don't break ImotaraResponse typing
  (meta as any).emotion = emotion;

  const isCrisisDraft = CRISIS_HINT_REGEX.test(msg);

  return {
    // ✅ Disable ReflectionSeed entirely (no card, no structured prompt)
    reflectionSeed: undefined,
    message: isCrisisDraft
      ? cap(message, 240)
      : cap(enforcedMessage.adjustedText, 240),
    followUp: isCrisisDraft
      ? cap(followUp, 200)
      : cap(enforcedFollowUp.adjustedText, 200),
    meta,
  };
}

export async function runImotara(input: {
  userMessage: string;
  sessionContext?: Record<string, unknown> | null;
  toneContext?: unknown;
}): Promise<ImotaraResponse> {
  const userMessage = oneLine(input.userMessage);

  // Merge toneContext into ctx so companion name / age / gender / relationship
  // are available consistently across the orchestrator.
  const baseSession =
    input.sessionContext && typeof input.sessionContext === "object"
      ? (input.sessionContext as Record<string, unknown>)
      : {};

  const ctx = {
    ...baseSession,
    ...(input.toneContext ? { toneContext: input.toneContext } : {}),
  } as SessionContext;

  // ✅ Baby Step 9.7 — minimal consume of recentMessages (parity with mobile/web payload)
  // Clients send: sessionContext.recentMessages = [{ role, content }]
  // Orchestrator currently reads: sessionContext.recent
  if (
    !Array.isArray((ctx as any).recent) &&
    Array.isArray((ctx as any).recentMessages)
  ) {
    (ctx as any).recent = (ctx as any).recentMessages;
  }

  // ✅ Continuity: keep a slightly wider window so follow-ups don't feel "reset"
  if (Array.isArray((ctx as any).recent)) {
    (ctx as any).recent = (ctx as any).recent.slice(-16);
  }

  // ✅ Baby Step 11.9 — preserve pinnedRecall passed from API, but ONLY if explicitly marked relevant
  // This prevents "random old jumps" while allowing safe memory usage when we have high confidence.
  const pr = (ctx as any).pinnedRecall;
  const prRelevant = (ctx as any).pinnedRecallRelevant === true;

  if (prRelevant && Array.isArray(pr)) {
    (ctx as any).pinnedRecall = pr.slice(0, 3);
  } else {
    (ctx as any).pinnedRecall = [];
    (ctx as any).pinnedRecallRelevant = false;
  }

  // ✅ Baby Step 11.9.1 — identity memory only (safe): hydrate missing user name
  // We only use identity:* keys and ONLY when pinnedRecallRelevant === true.
  try {
    const pinned: string[] = (ctx as any).pinnedRecall ?? [];
    const identity = pinned
      .filter((s) => typeof s === "string" && s.startsWith("identity:"))
      .slice(0, 3);

    const getValue = (k: string): string | null => {
      const hit = identity.find((s) => s.startsWith(`identity:${k}=`));
      if (!hit) return null;
      const v = hit.split("=", 2)[1] ?? "";
      const clean = String(v).replace(/\s+/g, " ").trim();
      return clean.length ? clean : null;
    };

    const nameFromMemory =
      getValue("preferred_name") ?? getValue("name") ?? getValue("nickname");

    // Only set if not already present, and only if user didn’t opt out of name usage.
    const useName = (ctx as any)?.toneContext?.user?.useName !== false;

    if (useName && nameFromMemory) {
      const existing = (ctx as any)?.toneContext?.user?.name;
      if (!existing) {
        (ctx as any).toneContext = (ctx as any).toneContext ?? {};
        (ctx as any).toneContext.user = (ctx as any).toneContext.user ?? {};
        (ctx as any).toneContext.user.name = nameFromMemory;
      }
    }
  } catch {
    // never fail the request due to memory hydration
  }

  if (!userMessage) {
    const useName = (ctx as any)?.toneContext?.user?.useName !== false;

    const userName =
      useName &&
        (ctx as any)?.toneContext?.user?.name &&
        typeof (ctx as any).toneContext.user.name === "string"
        ? String((ctx as any).toneContext.user.name).trim()
        : "";

    const prefix = userName ? `${userName}, ` : "";

    return {
      message: `${prefix}${pickFrom(
        `emptyAck:${userName}`,
        [
          "I’m here.",
          "Go on.",
          "Tell me a little.",
        ] as const,
      )}`,
      followUp: "",

      meta: {
        styleContract: "1.0",
        blueprint: "1.0",
        blueprintUsed: getResponseBlueprint({
          tone: inferBlueprintTone(userMessage),
        }),
      },
    };
  }

  const response = await draftResponseForLanguage(userMessage, ctx);

  const useName = (ctx as any)?.toneContext?.user?.useName !== false;

  const userName =
    useName &&
      (ctx as any)?.toneContext?.user?.name &&
      typeof (ctx as any).toneContext.user.name === "string"
      ? String((ctx as any).toneContext.user.name).trim()
      : "";

  // ✅ Baby Step 11.7.18 — if user prefers no name, strip it from drafted text
  if (!useName && response?.message && (ctx as any)?.toneContext?.user?.name) {
    const rawName = String((ctx as any).toneContext.user.name).trim();
    const nameRegex = new RegExp(`\\b${rawName}\\b\\s*,?\\s*`, "gi");

    response.message = String(response.message)
      .replace(nameRegex, "")
      // Clean up leftovers like "I hear you, ." or double spaces
      .replace(/\s+,/g, ",")
      .replace(/,\s*\./g, ".")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+\./g, ".")
      .trim();
  }

  // ── Micro-story injection (~1 in 4 emotional turns, all languages) ───────────
  // Combinatorial: framing × situation × insight → 64 unique combinations per signal/lang.
  // Skipped for crisis replies, greetings, and direct questions.
  {
    const storySignal = (() => {
      const s = userMessage.toLowerCase();
      if (/\b(sad|down|cry|crying|lonely|alone|hurt|heartbroken|hopeless|empty|numb|meaningless|miss|grief|devastated)\b/.test(s)) return "sad";
      if (/\b(anxious|anxiety|worry|worried|overwhelm|overwhelmed|panic|stress|stressed|pressure|dread|nervous|spinning)\b/.test(s)) return "anxious";
      if (/\b(angry|mad|furious|irritated|annoyed|frustrated|resentment|rage|hate this|so frustrated)\b/.test(s)) return "angry";
      if (/\b(tired|exhausted|drained|burnout|burnt out|no energy|worn out|depleted|running on empty)\b/.test(s)) return "tired";
      // Indic keywords
      if (/\b(udaas|dukhi|dukho|kosto|mon kharap|sogam|kashtam|baadha)\b/.test(s)) return "sad";
      if (/\b(pareshan|ghabra|chinta|tension|bhoy|bayam|anxiety)\b/.test(s)) return "anxious";
      if (/\b(gussa|rosh|rag|kopam|kopita|kovam|frustrat)\b/.test(s)) return "angry";
      if (/\b(thak|klanto|thakelo|thakked|shokti nahi|shakti nahi|alasata)\b/.test(s)) return "tired";
      return null;
    })();

    const isCrisisMsg = CRISIS_HINT_REGEX.test(userMessage);
    const isGreeting = isGreetingOnly(userMessage);
    const isQuestion = /[?？؟]$/.test(userMessage.trim());
    const storySeed = userMessage.length + userMessage.charCodeAt(0);
    const shouldInsertStory =
      storySignal !== null &&
      !isCrisisMsg &&
      !isGreeting &&
      !isQuestion &&
      storySeed % 4 === 0 &&
      response?.message;

    if (shouldInsertStory && storySignal) {
      const detectedLang = getPreferredLanguage(ctx, userMessage);
      const story = buildMicroStory(storySignal, detectedLang, storySeed);
      if (story) {
        const baseMsg = String(response.message).trimEnd();
        // Skip injection if response is in any Indian/Arabic native script
        // but the story is in Roman transliteration — avoids mixed-script output.
        const NATIVE_SCRIPT_RE = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u4E00-\u9FFF\u0400-\u04FF]|[。！？]$/;
        const responseHasNativeScript = NATIVE_SCRIPT_RE.test(baseMsg);
        const storyHasNativeScript = NATIVE_SCRIPT_RE.test(story);
        if (responseHasNativeScript && !storyHasNativeScript) {
          // skip — would produce mixed Devanagari + Roman text
        } else {
          const endsWithPunct = /[.!?।]$/.test(baseMsg);
          response.message = endsWithPunct ? `${baseMsg} ${story}` : `${baseMsg}. ${story}`;
        }
      }
    }
  }

  // ── Mythology story injection (~1 in 6 emotional turns, English only) ────────
  // Uses a different seed bit-window (>>>9) than micro-story (>>>7) to avoid same-turn collision.
  // For multilingual users, the LLM chat-reply path handles mythology via system prompt.
  {
    const mythSignal = (() => {
      const s = userMessage.toLowerCase();
      if (/\b(sad|down|cry|crying|lonely|alone|hurt|heartbroken|hopeless|empty|grief|devastated|loss|lost someone)\b/.test(s)) return "sad";
      if (/\b(anxious|anxiety|worry|worried|overwhelm|panic|stress|stressed|dread|nervous|scared|fear)\b/.test(s)) return "anxious";
      if (/\b(angry|mad|furious|irritated|annoyed|frustrated|resentment|rage|unfair|injustice)\b/.test(s)) return "angry";
      if (/\b(tired|exhausted|drained|burnout|burnt out|worn out|depleted|no energy|running on empty)\b/.test(s)) return "tired";
      return null;
    })();

    const isCrisisMsg = CRISIS_HINT_REGEX.test(userMessage);
    const isGreeting = isGreetingOnly(userMessage);
    const isQuestion = /[?？؟]$/.test(userMessage.trim());
    const mythSeed = userMessage.length + (userMessage.charCodeAt(1) || 0);
    const detectedLangForMyth = getPreferredLanguage(ctx, userMessage);
    const isEnglish = !detectedLangForMyth || detectedLangForMyth === "en";

    const shouldInsertMyth =
      mythSignal !== null &&
      isEnglish &&
      !isCrisisMsg &&
      !isGreeting &&
      !isQuestion &&
      (mythSeed >>> 9) % 6 === 0 &&
      response?.message;

    if (shouldInsertMyth && mythSignal) {
      const myth = buildMythologyStory(mythSignal, detectedLangForMyth ?? "en", mythSeed);
      if (myth) {
        const baseMsg = String(response.message).trimEnd();
        const endsWithPunct = /[.!?।]$/.test(baseMsg);
        response.message = endsWithPunct ? `${baseMsg} ${myth}` : `${baseMsg}. ${myth}`;
      }
    }
  }

  // ── Offline quote injection (~1 in 5 emotional turns, English only) ──────────
  // Seed bit-window >>>11 avoids collision with story (>>>7) and myth (>>>9).
  // Skips if a mythology story was already inserted on this turn (checked via seed windows).
  // Online paths get LLM-generated multilingual quotes via the respond route.
  {
    const quoteSignal = (() => {
      const s = userMessage.toLowerCase();
      if (/\b(sad|down|cry|crying|lonely|alone|hurt|heartbroken|hopeless|empty|grief)\b/.test(s)) return "sad";
      if (/\b(anxious|anxiety|worry|worried|overwhelm|panic|stress|stressed|dread|nervous|fear)\b/.test(s)) return "anxious";
      if (/\b(angry|mad|furious|irritated|annoyed|frustrated|resentment|rage|unfair)\b/.test(s)) return "angry";
      if (/\b(tired|exhausted|drained|burnout|burnt out|worn out|depleted|no energy)\b/.test(s)) return "tired";
      return null;
    })();

    const isCrisisMsg = CRISIS_HINT_REGEX.test(userMessage);
    const isGreeting = isGreetingOnly(userMessage);
    const isQuestion = /[?？؟]$/.test(userMessage.trim());
    const quoteSeed = userMessage.length + (userMessage.charCodeAt(2) || 0);
    const detectedLangForQuote = getPreferredLanguage(ctx, userMessage);
    const isEnglishForQuote = !detectedLangForQuote || detectedLangForQuote === "en";
    // Only inject if myth didn't fire on this message (myth uses charCodeAt(1), quote uses charCodeAt(2))
    const mythAlreadyFired = (userMessage.length + (userMessage.charCodeAt(1) || 0) >>> 9) % 6 === 0;

    const shouldInsertQuote =
      quoteSignal !== null &&
      isEnglishForQuote &&
      !isCrisisMsg &&
      !isGreeting &&
      !isQuestion &&
      !mythAlreadyFired &&
      (quoteSeed >>> 11) % 5 === 0 &&
      response?.message;

    if (shouldInsertQuote && quoteSignal) {
      const quote = buildOfflineQuote(quoteSignal, quoteSeed);
      if (quote) {
        const baseMsg = String(response.message).trimEnd();
        const endsWithPunct = /[.!?।]$/.test(baseMsg);
        response.message = endsWithPunct ? `${baseMsg} ${quote}` : `${baseMsg}. ${quote}`;
      }
    }
  }

    // Relationship-tone soft opener (no identity simulation; just style)
  // ✅ Goal: keep the user's chosen style, but prevent incoherent mixes by adjusting ONLY the opener phrasing.
  let relationshipStyle =
    (ctx as any)?.toneContext?.companion?.relationship ?? null;

  // Fallback to stored persona relationshipTone when companion settings aren't present
  if (!relationshipStyle || relationshipStyle === "prefer_not") {
    const fallback = pickRelationshipTone(ctx);
    relationshipStyle = fallback === "prefer_not" ? null : fallback;
  }

  // Read age from user first (most relevant), then companion as fallback
  const effectiveAge =
    (ctx as any)?.toneContext?.user?.ageTone ??
    (ctx as any)?.toneContext?.user?.ageRange ??
    (ctx as any)?.toneContext?.companion?.ageTone ??
    (ctx as any)?.toneContext?.companion?.ageRange ??
    null;

  // companion gender (only meaningful when companion persona is on)
  const effectiveCompanionGender =
    (ctx as any)?.toneContext?.companion?.enabled === true
      ? ((ctx as any)?.toneContext?.companion?.gender ?? "prefer_not")
      : "prefer_not";

  // user gender for second-person agreement
  const effectiveUserGender =
    String((ctx as any)?.toneContext?.user?.gender ?? "prefer_not").toLowerCase();

  // ── emotionMemory: parse the history summary sent by client ─────────────────
  // Format: "Dominant emotions over last N days: stressed (5×), sad (3×)…\nOverall intensity trend: high"
  const emotionMemoryRaw = String((ctx as any)?.emotionMemory ?? "").trim();

  const memoryHighIntensity = /overall intensity[^:]*:\s*(high|moderate-high)/i.test(emotionMemoryRaw);
  const memoryHeavyLoad = /(?:stressed|sad|anxious|lonely|overwhelmed)[^×]*×\s*[3-9]/i.test(emotionMemoryRaw);

  // Extract dominant emotion from memory summary for contextual opener calibration
  const memoryDominantMatch = emotionMemoryRaw.match(/Dominant emotions[^:]*:\s*(\w+)/i);
  const memoryDominantEmotion = memoryDominantMatch?.[1]?.toLowerCase() ?? null;

  let softOpener = "";

  // ── Age-specific tone adjustments ──────────────────────────────────────────
  if (effectiveAge === "under_13") {
    if (!relationshipStyle) relationshipStyle = "friend";
    if (relationshipStyle === "mentor") {
      softOpener = "Okay — let’s take one small step at a time. ";
    } else if (relationshipStyle === "coach") {
      softOpener = "Alright — here’s one simple thing to try. ";
    } else if (relationshipStyle === "partner_like") {
      softOpener = "Hey — I’m here with you. Let’s do one small step. ";
    } else {
      softOpener = "Hey — let’s make this simple. ";
    }
  } else if (effectiveAge === "13_17") {
    // Peer-supportive, no adult authority tone
    if (relationshipStyle === "mentor" || relationshipStyle === "coach") {
      // Soften directive tone for teens — they respond better to solidarity
      softOpener = "Hey — I hear you. ";
    }
    // No softOpener for friend/sibling/prefer_not — response already flows naturally
  } else if (effectiveAge === "65_plus") {
    // Unhurried, respectful — don’t rush them
    if (!relationshipStyle || relationshipStyle === "prefer_not" || relationshipStyle === "friend") {
      softOpener = "Take your time — I’m right here with you. ";
    } else if (relationshipStyle === "mentor") {
      softOpener = "There’s no rush. Let’s look at this together. ";
    }
  } else {
    // Default mentor opener (non-special age)
    if (relationshipStyle === "mentor") {
      softOpener = "Let’s slow this down and find one clear next step. ";
    }
  }

  const isCrisisReply = CRISIS_HINT_REGEX.test(userMessage);

  // ── emotionMemory: warm up opener when history shows sustained heavy load ───
  // Only override when we don’t already have a more specific opener above.
  if (!softOpener && (memoryHighIntensity || memoryHeavyLoad) && !isCrisisReply) {
    const heavyOpeners = [
      "I know it’s been a lot lately. I’m right here with you. ",
      "You’ve been carrying a lot — I’m here. ",
      "It sounds like things have been heavy for a while. I’m with you. ",
    ];
    // Simple deterministic index from message length + dominant emotion length
    const seed = userMessage.length + (memoryDominantEmotion?.length ?? 0);
    softOpener = heavyOpeners[seed % heavyOpeners.length] ?? "";
  }

  // Personalized greeting (natural, non-creepy, no invented memory)
  // - Uses name only when allowed
  // - Avoids repeating if draft already addressed them
  // - Keeps softOpener as tone guidance
  // - But DO NOT add soft opener/greeting to crisis replies
  if (!isCrisisReply && response?.message) {
    const firstLine = String(response.message).split("\n")[0] ?? "";
    const firstLineLower = firstLine.toLowerCase().trim();

    const alreadyAddressedNaturally =
      (userName && firstLineLower.includes(userName.toLowerCase())) ||
      firstLineLower.startsWith("hey ") ||
      firstLineLower.startsWith("hi ") ||
      firstLineLower.startsWith("hello ") ||
      firstLineLower.startsWith("i’m ") ||
      firstLineLower.startsWith("i'm ") ||
      firstLineLower.startsWith("okay") ||
      firstLineLower.startsWith("alright") ||
      firstLineLower.startsWith("got it") ||
      firstLineLower.startsWith("right") ||
      firstLineLower.startsWith("makes sense");

    if (userName && !alreadyAddressedNaturally) {
      response.message = `Hey ${userName} —\n\n${response.message}`;
    } else if (softOpener && !alreadyAddressedNaturally) {
      response.message = `${softOpener}${response.message}`;
    }
  }

  const companionName =
    (ctx as any)?.toneContext?.companion?.enabled === true
      ? ((ctx as any)?.toneContext?.companion?.name ?? null)
      : null;

  const existingMeta = (response as any).meta ?? {};
  const carriedEmotion = carryForwardEmotion(
    existingMeta.emotion,
    (ctx as any)?.recent,
  );

  // Pass companion gender + user gender to softEnforcement via userPrefs
  // (supplements the persona.genderTone already set by mobile client)
  const globalUserPrefs = {
    companionTone: relationshipStyle ?? undefined,
    ageTone: effectiveAge ?? undefined,
    genderTone: effectiveCompanionGender !== "prefer_not" ? effectiveCompanionGender : (effectiveUserGender !== "prefer_not" ? effectiveUserGender : undefined),
  };
  if (response?.message) {
    const reEnforced = applySoftEnforcement({ text: response.message, userPrefs: globalUserPrefs });
    if (reEnforced.adjustedText !== response.message) {
      response.message = reEnforced.adjustedText;
    }
  }

  (response as any).meta = {
    ...existingMeta,
    emotion: carriedEmotion,
    toneEcho: {
      ...(existingMeta.toneEcho ?? {}),
      relationshipTone: relationshipStyle,
      ageTone: effectiveAge,
      companionGender: effectiveCompanionGender !== "prefer_not" ? effectiveCompanionGender : null,
      userGender: effectiveUserGender !== "prefer_not" ? effectiveUserGender : null,
      companionName,
      emotionMemory: emotionMemoryRaw ? { highIntensity: memoryHighIntensity, heavyLoad: memoryHeavyLoad, dominant: memoryDominantEmotion } : null,
    },
  };

  function carryForwardEmotion(current: any, recent: any[] | undefined) {
    if (!recent || !recent.length) return current;

    // Only intervene if emotion is neutral or missing
    if (current?.primary && current.primary !== "neutral") {
      return current;
    }

    // Find last assistant emotion
    for (let i = recent.length - 1; i >= 0; i--) {
      const m = recent[i];
      if (m?.role === "assistant" && m?.meta?.emotion?.primary) {
        return {
          ...(m.meta.emotion ?? {}),
          primary: m.meta.emotion.primary,
          intensity: m.meta.emotion.intensity ?? "low",
          confidence:
            typeof m.meta.emotion.confidence === "number"
              ? m.meta.emotion.confidence
              : 0.4,
          carried: true,
        };
      }
    }

    return current;
  }

  // ✅ Baby Step 11.7.16 — if under_13, keep wording extra simple (no identity simulation)
  if (effectiveAge === "under_13" && response?.message) {
    response.message = String(response.message)
      .replace(/\bI hear you\b/gi, "I get it")
      .replace(
        /\bWhat would help most right now\b/gi,
        "What would help right now",
      );
  }

  // ✅ Baby Step 11.7.21 — optional companion sign-off (safe, not identity simulation)
  const companionEnabled =
    (ctx as any)?.toneContext?.companion?.enabled === true &&
    (ctx as any)?.toneContext?.companion?.signatureEnabled === true;

  const companionNameForSignoff =
    companionEnabled &&
      typeof (ctx as any)?.toneContext?.companion?.name === "string"
      ? String((ctx as any).toneContext.companion.name).trim()
      : "";

  if (companionNameForSignoff && response?.message) {
    // Avoid duplicating if already present
    if (
      !response.message
        .toLowerCase()
        .includes(companionNameForSignoff.toLowerCase())
    ) {
      response.message = `${response.message}\n— ${companionNameForSignoff}`;
    }
  }

  if (isCrisisReply) {
    return response;
  }

  return applyFinalResponseGate({
    response,
    userMessage,
    ctx,
  });
}
