// src/lib/ai/orchestrator/runImotara.ts

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

function recentlyAsked(ctx: SessionContext, needle: string): boolean {
  const recent = ctx?.recent ?? [];
  const assistantText = recent
    .filter((m) => m.role === "assistant")
    .map((m) => (m.content || "").toLowerCase())
    .join(" | ");
  return assistantText.includes(needle.toLowerCase());
}

function getPreviousUserTurn(
  ctx: SessionContext,
  currentMsg: string,
): string | null {
  const recent = Array.isArray(ctx?.recent) ? ctx.recent : [];
  const cur = oneLine(currentMsg).toLowerCase();

  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m?.role !== "user") continue;

    const prev = oneLine(m.content ?? "");
    if (!prev) continue;

    // Avoid echoing the same message (common in your language-switch test)
    if (prev.toLowerCase() === cur) continue;

    return cap(prev, 80);
  }
  return null;
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
  const clean = (s: string) =>
    oneLine(s)
      .toLowerCase()
      .replace(
        /[^a-z0-9\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B80-\u0BFF\u0C00-\u0CFF\u0D00-\u0D7F\s]/g,
        " ",
      )
      .split(/\s+/)
      .filter((w) => w.length >= 4);

  const A = new Set(clean(a));
  const B = clean(b);

  // if either side has no meaningful tokens, don't anchor
  if (A.size === 0 || B.length === 0) return false;

  for (const w of B) {
    if (A.has(w)) return true;
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
  lang: "en" | "hi" | "bn",
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
    // keep it light; quote only if it's short
    return `${variants[idx]}${shortPrev.length <= 42 ? ` “${shortPrev}”` : ""} `;
  }

  if (lang === "bn") {
    const variants = [
      `ঠিক আছে — সেই কথাটাই ধরে,`,
      `বুঝলাম — ওই অংশটা ধরে,`,
      `আচ্ছা — ওই প্রসঙ্গেই,`,
      `হ্যাঁ — ওই point টা থেকে,`,
    ] as const;
    return `${variants[idx]}${shortPrev.length <= 42 ? ` “${shortPrev}”` : ""} `;
  }

  const variants = [
    `Got it — on that, `,
    `Okay — about that part, `,
    `Right — building on that, `,
    `Makes sense — on that note, `,
  ] as const;

  return `${variants[idx]}${shortPrev.length <= 42 ? `“${shortPrev}” ` : ""}`;
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
      "What’s the main thing you want from this chat—comfort, clarity, or a next step?",
  };
}

type SupportedLanguage = "en" | "hi" | "bn";

function getPreferredLanguage(ctx: SessionContext): SupportedLanguage {
  const raw = String((ctx as any)?.preferredLanguage ?? "")
    .trim()
    .toLowerCase();
  // Accept both base and BCP-47 tags
  if (raw === "hi" || raw.startsWith("hi-")) return "hi";
  if (raw === "bn" || raw.startsWith("bn-")) return "bn";
  return "en";
}

function draftResponseForLanguage(
  userMessage: string,
  ctx: SessionContext,
): ImotaraResponse {
  const lang = getPreferredLanguage(ctx);
  if (lang === "en") return draftResponse(userMessage, ctx);

  // Minimal localized fallback (keeps existing logic intact for English,
  // ensures non-English settings never get an English response).
  const msg = oneLine(userMessage);
  const name = getUserName(ctx);
  const rel = pickRelationshipTone(ctx);

  const opener =
    lang === "hi"
      ? rel === "friend"
        ? name
          ? `समझ गया, ${name}.`
          : "समझ गया."
        : rel === "mentor"
          ? name
            ? `मैं सुन रहा हूँ, ${name}.`
            : "मैं सुन रहा हूँ."
          : rel === "coach"
            ? name
              ? `ठीक है, ${name}.`
              : "ठीक है."
            : name
              ? `मैं समझ रहा हूँ, ${name}.`
              : "मैं समझ रहा हूँ."
      : // bn
        rel === "friend"
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
              : "আমি বুঝতে পারছি.";

  const prev = getPreviousUserTurn(ctx, msg);
  const useAnchor =
    !!prev && shouldUseContinuityAnchor(msg) && sharesKeyword(msg, prev);
  const openerWithContext = useAnchor
    ? `${opener} ${continuityAnchor(lang, prev!, msg)}`
    : opener;

  const message =
    lang === "hi"
      ? `${openerWithContext} मैं आपके साथ हूँ। अभी इस पल में सबसे भारी क्या लग रहा है?`
      : `${openerWithContext} আমি আপনার পাশে আছি। এই মুহূর্তে সবচেয়ে ভারী কী লাগছে?`;

  const followUp =
    lang === "hi"
      ? "अभी आपके लिए सबसे ज़्यादा मदद क्या होगी — सुकून, स्पष्टता, या एक छोटा अगला कदम?"
      : "এই মুহূর্তে আপনার সবচেয়ে দরকার কী — সান্ত্বনা, পরিষ্কার বোঝা, না একদম ছোট পরের পদক্ষেপ?";

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

  function pickFrom<T>(arr: readonly T[], h: number): T {
    return arr[h % arr.length];
  }

  function pickFromSeed<T>(seed: string, arr: readonly T[]): T {
    const h = hashLite(seed);
    return arr[h % arr.length];
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
      name ? `Hey love — I’m here, ${name}.` : "Hey — I’m here with you.",
      name ? `I’m right here, ${name}.` : "I’m right here.",
      name ? `Mm… come here. I’m with you, ${name}.` : "Mm. I’m with you.",
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

    const pickFromNoRepeat = <T extends string>(items: readonly T[]): T => {
      if (items.length === 0) return "" as T;
      const start = h % items.length;

      // Try to avoid repeating the same opener within a small recent window.
      for (let i = 0; i < items.length; i++) {
        const cand = items[(start + i) % items.length]!;
        if (!wasOpenerUsedRecently(cand)) return cand;
      }

      // If everything was recently used, fall back to deterministic pick.
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

  const opener = pickOpener(ctx, rel, name ?? undefined, msg);

  // ✅ Continuity: gently anchor to the last user turn (when available)
  const prev = getPreviousUserTurn(ctx, msg);
  const useAnchor =
    !!prev && shouldUseContinuityAnchor(msg) && sharesKeyword(msg, prev);
  const openerWithContext = useAnchor
    ? `${opener} ${continuityAnchor("en", prev!, msg)}`
    : opener;

  let message = "";
  let followUp = "";

  // ✅ Greeting-only: be human first, avoid template follow-ups like "comfort/clarity/next step"
  if (isGreetingOnly(msg)) {
    const v = pickVariant(`greet:${rel}:${name ?? ""}:${msg}`, 3);

    const greetLine =
      v === 0
        ? "Hey 👋 I’m right here with you."
        : v === 1
          ? "Hi 🙂 I’m here."
          : "Hello. I’m with you.";

    message = name ? `${greetLine.replace("Hi", `Hi, ${name}`)}` : greetLine;

    // Leave followUp empty so the formatter greeting-mode can decide:
    // - sometimes a gentle question
    // - sometimes presence-only (as per your preference)
    followUp = "";
  } else if (detectMetaComplaintIntent(msg)) {
    message = `${openerWithContext} I’m an AI, but I’m here with you — and you’re right: if it feels repetitive, that’s frustrating.`;
    followUp =
      "If you want, tell me what felt repetitive — or just tell me what’s going on, and I’ll respond more naturally from here.";
  } else if (
    lower.includes("stranger") ||
    lower.includes("stranger") ||
    lower.includes("met") ||
    lower.includes("someone")
  ) {
    message = `${openerWithContext} That sounds like one of those moments that can leave a little ripple — even if it was brief.`;
    // Keep followUp as a gentle prompt (not a second question) — formatter will handle the single bridge question.
    followUp =
      "Tell me what stood out most — what they said/did, how you felt, or the situation itself.";
  } else if (
    lower.includes("money") ||
    lower.includes("salary") ||
    lower.includes("bonus")
  ) {
    message = `${openerWithContext} Getting money from work can bring a mix of relief and momentum.`;
    followUp =
      "If you want, tell me which side feels stronger for you — relief, pride, or something else.";
  } else if (
    lower.includes("office") ||
    lower.includes("work") ||
    lower.includes("boss") ||
    lower.includes("manager") ||
    lower.includes("deadline")
  ) {
    message = `${openerWithContext} Office pressure can really sit on your mind, especially when it keeps repeating.`;
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
    message = `${openerWithContext} That sounds really uplifting — it’s lovely to hear that kind of energy from you.`;
    followUp =
      "If you feel like sharing, tell me what sparked it — a moment, a person, or just one of those rare good days.";
  } else if (
    lower.includes("hungry") ||
    lower.includes("tired") ||
    lower.includes("sleepy") ||
    lower.includes("bored") ||
    lower.includes("headache") ||
    lower.includes("sick")
  ) {
    message = `${openerWithContext} Sounds like your body is asking for something simple.`;
    followUp =
      "Want something quick and practical right now — food, rest, or just a short reset?";
  } else {
    message = `${openerWithContext} I’m with you in this.`;

    // ✅ Long-memory: avoid repeating the same fallback style too often (25 turns)
    const cooldownTurns = 25;

    // We store “keys” as tiny phrases and check recent history for those keys.
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

    // 🟢 Soft “just listen” variants (can be statement-only)
    const listenBank = [
      "You don’t have to make it tidy. Start anywhere — I’m listening.",
      "Take your time. I’m here with you.",
      "If it feels hard to explain, you can just describe one small piece of it.",
      "I’m right here. We can sit with it for a moment.",
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
    // This avoids the “therapist interview” feel and matches: reflect → pause.
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
      // Fallback if all were recently used: choose the least repetitive “listen” line
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

    return /\b(stress|stressed|anxious|anxiety|worried|panic|overwhelmed|burnt out|burned out)\b/.test(
      s,
    )
      ? "anxiety"
      : /\b(sad|down|depressed|heartbroken|lonely|cry|crying)\b/.test(s)
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

  const greetingOnly = isGreetingOnly(msg);

  return {
    // ✅ For "hi"/greetings: no structured reflection prompt (keeps it human)
    reflectionSeed: greetingOnly ? undefined : makeReflectionSeed(msg),
    message: cap(enforcedMessage.adjustedText, 240),
    followUp: cap(enforcedFollowUp.adjustedText, 200),
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
  // This prevents “random old jumps” while allowing safe memory usage when we have high confidence.
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
      message: `${prefix}tell me what’s on your mind—one line is enough.`,
      followUp: "What’s the main thing you want help with right now?",

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

  // Relationship-tone soft opener (no identity simulation; just style)
  // ✅ Goal: keep the user's chosen style, but prevent incoherent mixes by adjusting ONLY the opener phrasing.
  let relationshipStyle =
    (ctx as any)?.toneContext?.companion?.relationship ?? null;

  // Fallback to stored persona relationshipTone when companion settings aren't present
  if (!relationshipStyle || relationshipStyle === "prefer_not") {
    const fallback = pickRelationshipTone(ctx);
    relationshipStyle = fallback === "prefer_not" ? null : fallback;
  }

  const effectiveAge =
    (ctx as any)?.toneContext?.companion?.ageRange ??
    (ctx as any)?.toneContext?.user?.ageRange ??
    null;

  let softOpener = "";

  // ✅ Guard against incoherent mixes (e.g., "mentor" voice + under_13)
  // We DO NOT silently flatten everything to "friend".
  // Instead: keep the chosen relationship style, but use a kid-safe opener that matches it.
  if (effectiveAge === "under_13") {
    if (!relationshipStyle) relationshipStyle = "friend";

    if (relationshipStyle === "mentor") {
      softOpener = "Okay — let’s take one small step at a time. ";
    } else if (relationshipStyle === "coach") {
      softOpener = "Alright — here’s one simple thing to try. ";
    } else if (relationshipStyle === "partner_like") {
      softOpener = "Hey — I’m here with you. Let’s do one small step. ";
    } else if (relationshipStyle === "friend") {
      softOpener = "Hey — let’s make this simple. ";
    }
  } else {
    // Default mentor opener (non-under_13)
    if (relationshipStyle === "mentor") {
      softOpener = "Let’s slow this down and find one clear next step. ";
    }
  }

  // Personalized greeting (natural, non-creepy, no invented memory)
  // - Uses name only when allowed
  // - Avoids repeating if draft already addressed them
  // - Keeps softOpener as tone guidance
  if (userName && response?.message) {
    const firstLine = String(response.message).split("\n")[0] ?? "";
    const alreadyUsed =
      firstLine.toLowerCase().includes(userName.toLowerCase()) ||
      firstLine.toLowerCase().startsWith("hey ");

    if (!alreadyUsed) {
      response.message = `Hey ${userName} —\n\n${softOpener}${response.message}`;
    } else if (softOpener) {
      response.message = `${softOpener}${response.message}`;
    }
  } else if (softOpener && response?.message) {
    response.message = `${softOpener}${response.message}`;
  }

  // ✅ Baby Step 11.7.12 — echo tone settings for transparency/debug
  const ageTone =
    (ctx as any)?.toneContext?.companion?.ageRange ??
    (ctx as any)?.toneContext?.user?.ageRange ??
    null;

  const genderTone =
    (ctx as any)?.toneContext?.companion?.gender ??
    (ctx as any)?.toneContext?.user?.gender ??
    null;

  const companionName =
    (ctx as any)?.toneContext?.companion?.enabled === true
      ? ((ctx as any)?.toneContext?.companion?.name ?? null)
      : null;

  const existingMeta = (response as any).meta ?? {};
  const carriedEmotion = carryForwardEmotion(
    existingMeta.emotion,
    (ctx as any)?.recent,
  );

  (response as any).meta = {
    ...existingMeta,
    emotion: carriedEmotion,
    toneEcho: {
      ...(existingMeta.toneEcho ?? {}),
      relationshipTone: relationshipStyle,
      ageTone,
      genderTone,
      companionName,
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

  return applyFinalResponseGate({
    response,
    userMessage,
    ctx,
  });
}
