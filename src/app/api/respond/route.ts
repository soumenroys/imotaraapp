import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { runImotara } from "@/lib/ai/orchestrator/runImotara";
import type { EmotionAnalysis } from "@/lib/ai/emotion/emotionTypes";
import { normalizeEmotion } from "@/lib/ai/emotion/normalizeEmotion";

import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";
import { selectPinnedRecall } from "@/lib/memory/memoryRelevance";
import { buildLocalReply } from "@/lib/ai/local/localReplyEngine";
import { formatImotaraReply } from "@/lib/imotara/response/responseFormatter";

import type { ResponseTone } from "@/lib/ai/response/responseBlueprint";
import { buildBridgeDirectiveForTone } from "@/lib/imotara/promptProfile";

type LanguageCode =
  | "en"
  | "hi" // Hindi
  | "mr" // Marathi
  | "ur" // Urdu
  | "or" // Odia (Oriya)
  | "zh" // Mandarin Chinese
  | "es" // Spanish
  | "ar" // Standard Arabic
  | "fr" // French
  | "pt" // Portuguese
  | "ru" // Russian
  | "id" // Indonesian
  | "bn" // Bengali
  | "ta"
  | "te"
  | "gu"
  | "pa"
  | "kn"
  | "ml";

const LANGUAGE_NAME: Record<LanguageCode, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  ur: "Urdu",
  or: "Odia",
  zh: "Mandarin Chinese",
  es: "Spanish",
  ar: "Standard Arabic",
  fr: "French",
  pt: "Portuguese",
  ru: "Russian",
  id: "Indonesian",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  gu: "Gujarati",
  pa: "Punjabi",
  kn: "Kannada",
  ml: "Malayalam",
};

function getRequestIdFromBody(body: Record<string, unknown>): string {
  const fromBody = (body as any)?.requestId;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();

  // Prefer crypto.randomUUID when available (Node 18+ / modern runtimes)
  const c = (globalThis as any)?.crypto;
  if (c?.randomUUID && typeof c.randomUUID === "function")
    return c.randomUUID();

  // Fallback (still unique enough for request-scoped salt)
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stableVariantFromId(id: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return mod <= 0 ? 0 : h % mod;
}

function coerceLanguageCode(raw: unknown): LanguageCode | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;

  // Accept "en-US" style
  const base = s.split(/[-_]/)[0];

  // Direct matches
  const allowed = new Set<LanguageCode>([
    "en",
    "hi",
    "mr",
    "ur",
    "or",
    "zh",
    "es",
    "ar",
    "fr",
    "pt",
    "ru",
    "id",
    "bn",
    "ta",
    "te",
    "gu",
    "pa",
    "kn",
    "ml",
  ]);
  if (allowed.has(base as LanguageCode)) return base as LanguageCode;

  return undefined;
}

function derivePreferredLanguage(
  baseCtx: Record<string, unknown>,
  message: string,
): { preferredLanguage?: LanguageCode; languageDirective: string } {
  // 1) Explicit (if any client already sends it)
  const explicit =
    coerceLanguageCode((baseCtx as any)?.preferredLanguage) ||
    coerceLanguageCode((baseCtx as any)?.language) ||
    coerceLanguageCode((baseCtx as any)?.languageCode) ||
    coerceLanguageCode((baseCtx as any)?.targetLanguage);

  // 2) Hints from page.tsx (new)
  const hints = ((baseCtx as any)?.languageHints ?? {}) as Record<
    string,
    unknown
  >;
  const guess =
    coerceLanguageCode((hints as any)?.languageGuess) ||
    coerceLanguageCode((hints as any)?.navigatorLanguage);

  // 3) Script fallback (server-side safe)
  const t = String(message ?? "").trim();
  const hasDevanagari = /[\u0900-\u097F]/.test(t); // Hindi/Marathi often
  const hasBengali = /[\u0980-\u09FF]/.test(t);
  const hasTamil = /[\u0B80-\u0BFF]/.test(t);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(t);
  const hasGujarati = /[\u0A80-\u0AFF]/.test(t);
  const hasGurmukhi = /[\u0A00-\u0A7F]/.test(t);
  const hasKannada = /[\u0C80-\u0CFF]/.test(t);
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(t);

  const scriptDerived: LanguageCode | undefined = hasDevanagari
    ? "hi"
    : hasBengali
      ? "bn"
      : hasTamil
        ? "ta"
        : hasTelugu
          ? "te"
          : hasGujarati
            ? "gu"
            : hasGurmukhi
              ? "pa"
              : hasKannada
                ? "kn"
                : hasMalayalam
                  ? "ml"
                  : undefined;

  const preferredLanguage = explicit ?? guess ?? scriptDerived;

  // If the client explicitly set a preferred language (Settings/mobile), enforce it strictly.
  // Otherwise, keep the softer "reply in user's language when clear" behavior.
  const languageDirective = explicit
    ? `Language policy (strict): Reply ONLY in ${LANGUAGE_NAME[explicit]} (${explicit}). Do not mix languages. Do not switch languages mid-reply. Do not transliterate unless the user asks.`
    : preferredLanguage
      ? `Language policy: Reply in the user's language when clear. If unclear or mixed, prefer ${LANGUAGE_NAME[preferredLanguage]} (${preferredLanguage}).`
      : `Language policy: Reply in the user's language when clear. If unclear, default to English.`;
  return { preferredLanguage, languageDirective };
}

function deriveFormatterTone(
  toneContext: unknown,
): "close_friend" | "calm_companion" | "coach" | "mentor" {
  // 1) Direct string tone (back-compat)
  if (typeof toneContext === "string") {
    const v = toneContext.trim().toLowerCase();
    if (v === "calm_companion" || v === "calm" || v === "companion")
      return "calm_companion";
    if (v === "coach") return "coach";
    if (v === "mentor") return "mentor";
    if (v === "friend" || v === "close_friend") return "close_friend";
    return "close_friend";
  }

  // 2) Settings object shape: { user: {...}, companion: {...} }
  if (toneContext && typeof toneContext === "object") {
    const obj = toneContext as any;
    const c = obj?.companion;

    // If companion is already a string (rare, but keep safe)
    if (typeof c === "string") {
      const v = c.trim().toLowerCase();
      if (v === "calm_companion" || v === "calm" || v === "companion")
        return "calm_companion";
      if (v === "coach") return "coach";
      if (v === "mentor") return "mentor";
      return "close_friend";
    }

    // If companion is the settings object
    if (c && typeof c === "object") {
      const enabled = c?.enabled === true;

      // ✅ Your rule: toggle OFF => calm + comforting (gentle therapist-ish)
      if (!enabled) return "calm_companion";

      // toggle ON => map relationship vibe into the formatter’s tone buckets
      const rel = String(c?.relationship ?? "").toLowerCase();

      if (rel === "coach") return "coach";

      // mentor-ish bucket
      if (rel === "mentor" || rel === "elder" || rel === "parent_like")
        return "mentor";

      // friend-ish bucket (these still matter in prompt hints elsewhere,
      // but formatter needs a smaller set of banks)
      // friend / sibling / junior_buddy / partner_like / prefer_not
      return "close_friend";
    }
  }

  // default fallback
  return "close_friend";
}

function inferBridgeTone(message: string, toneContext: unknown): ResponseTone {
  // 1) Companion/profile tone (if user selected it)
  const formatterTone = deriveFormatterTone(toneContext);
  let base: ResponseTone =
    formatterTone === "coach"
      ? "coach"
      : formatterTone === "mentor"
        ? "practical"
        : formatterTone === "calm_companion"
          ? "calm"
          : "supportive";

  // 2) Message context bias (your D: work vs burnout vs practical)
  const t = String(message ?? "")
    .toLowerCase()
    .trim();

  // Work / study stress → coach
  if (
    /\b(work|office|boss|manager|client|deadline|meeting|shift|project|job|salary|performance|interview|exam|study|college|school|assignment)\b/.test(
      t,
    )
  ) {
    return "coach";
  }

  // Burnout / shutdown → supportive (presence > progress)
  if (
    /\b(burn(ed)?\s*out|burnout|exhausted|drained|empty|numb|done with|can’t take|can't take|what’s the point|what is the point|tired of everything)\b/.test(
      t,
    )
  ) {
    return "supportive";
  }

  // Direct “how/steps/help” → practical
  if (/\b(what should i do|help me|how do i|how to|steps?|plan)\b/.test(t)) {
    return "practical";
  }

  return base;
}

function detectReplyIntent(message: string): "emotional" | "practical" {
  const t = String(message ?? "")
    .toLowerCase()
    .trim();

  // Capability / feature questions should not be treated as low-signal emotional.
  if (
    /\b(what can you do|what do you do|how can you help|how do you help|help me with|your features|what are you capable of)\b/.test(
      t,
    )
  ) {
    return "practical";
  }

  // Basic human needs belong to the companion lane (warm + continuous),
  // not "task/problem-solving" mode.
  if (
    /\b(hungry|hunger|tired|sleepy|sleep|headache|fever|sick|ill|thirsty|pain)\b/.test(
      t,
    )
  ) {
    return "emotional";
  }

  // Practical mode is for "help me do/fix something" (often technical).
  if (
    /\b(error|bug|issue|fix|debug|log|stack|trace|exception|crash|build|compile|tsc|npm|yarn|pnpm|expo|vercel|git|branch|commit|merge|pull|push|api|endpoint|request|response|status)\b/.test(
      t,
    )
  ) {
    return "practical";
  }

  return "emotional";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // QA request flag (accepts header or query param; "1" or "true")
  const qaHeader =
    req.headers.get("x-imotara-qa") ??
    req.headers.get("qa") ??
    req.headers.get("x-qa");

  const qaQuery = (() => {
    try {
      return new URL(req.url).searchParams.get("qa");
    } catch {
      return null;
    }
  })();

  const qa =
    qaHeader === "1" ||
    qaHeader?.toLowerCase() === "true" ||
    qaQuery === "1" ||
    qaQuery?.toLowerCase() === "true" ||
    process.env.NODE_ENV !== "production"; // local dev convenience

  // Support multiple payload shapes without adding any AI logic here:
  // Preferred: { message, context }
  // Legacy: { text }
  // Older: { inputs: [{ text: string, ... }], options?: ... }
  const rawMessage =
    body?.message ??
    body?.text ??
    (Array.isArray(body?.inputs) && (body.inputs as unknown[]).length
      ? (body.inputs as Array<Record<string, unknown>>)[
          (body.inputs as unknown[]).length - 1
        ]?.text
      : "") ??
    "";

  const message =
    typeof rawMessage === "string" ? rawMessage : String(rawMessage ?? "");

  // ✅ Conversation closure intent: user is pausing / ending the chat (walk / talk later / bye)
  const normalizedMsg = String(message ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // ✅ Strict closure detection: only trigger on clear pause/exit phrases (word-boundary safe)
  const closurePattern =
    /\b(bye|good\s*night|goodnight|gn|brb|ttyl|see\s+you|talk\s+later|chat\s+later|catch\s+you|going\s+for\s+a\s+walk|go\s+for\s+a\s+walk|going\s+out|i\s*(?:am|’m|'m)\s+going\s+for\s+a\s+walk|i\s*(?:am|’m|'m)\s+back\s+later|i\s+will\s+talk\s+later|i\s+will\s+chat\s+later)\b/;

  const isClosureIntent =
    normalizedMsg.length > 0 &&
    normalizedMsg.length <= 80 && // prevent accidental triggers on long messages
    closurePattern.test(normalizedMsg);

  // ✅ Return / Resume intent (user came back after a pause)
  const returnPattern =
    /\b(i\s*(?:am|’m|'m)\s+back|im\s+back|back\s+now|i\s*(?:am|’m|'m)\s+here\s+again|here\s+again|i\s+returned)\b/;

  const isReturnIntent =
    !isClosureIntent &&
    normalizedMsg.length > 0 &&
    normalizedMsg.length <= 80 &&
    returnPattern.test(normalizedMsg);

  const PROD = process.env.NODE_ENV === "production";
  const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

  if (qa && SHOULD_LOG) {
    console.warn("[CLOSURE_DEBUG]", {
      normalizedMsg,
      isClosureIntent,
      isReturnIntent,
      rawMessage: message.slice(0, 100),
    });
  }
  // QA-only (dev) log: never log full user content in production
  if (qa && SHOULD_LOG) {
    console.warn("[QA] /api/respond message:", message.slice(0, 200));
  }

  const baseCtx = (body?.context ?? body?.options ?? {}) as Record<
    string,
    unknown
  >;

  // Merge top-level language fields into the context used for language derivation.
  // This keeps backward compatibility (context-first) while supporting simple clients (top-level).
  const langCtx = {
    ...baseCtx,
    preferredLanguage:
      (body as any)?.preferredLanguage ?? (baseCtx as any)?.preferredLanguage,
    language: (body as any)?.language ?? (baseCtx as any)?.language,
    languageCode: (body as any)?.languageCode ?? (baseCtx as any)?.languageCode,
    targetLanguage:
      (body as any)?.targetLanguage ?? (baseCtx as any)?.targetLanguage,
    languageHints:
      (baseCtx as any)?.languageHints ?? (body as any)?.languageHints,
  } as Record<string, unknown>;

  const toneContext = (body?.toneContext ??
    (baseCtx as any)?.toneContext ??
    undefined) as unknown;

  // ✅ Baby Step 3.4.1 — derive analysis source (single truth)
  const analysisModeRaw =
    (baseCtx as any)?.analysisMode ??
    (baseCtx as any)?.analysis?.mode ??
    (body as any)?.analysisMode ??
    (body as any)?.analysis?.mode ??
    undefined;

  const analysisSource = analysisModeRaw === "local" ? "local" : "cloud";

  // ✅ Baby Step 11.7 — memory relevance guard (inject ONLY if relevant)
  // Prefer user-scoped Supabase (RLS) when cookies exist; fall back to service role.
  let supabase: any = supabaseServer;
  let authUserId: string | null = null;

  try {
    const s = await supabaseUserServer();
    supabase = s;

    const { data } = await s.auth.getUser();
    authUserId = data?.user?.id ?? null;
  } catch {
    supabase = supabaseServer;
    authUserId = null;
  }

  const userId =
    authUserId ??
    (baseCtx as any)?.user?.id ??
    (baseCtx as any)?.userId ??
    (body as any)?.user?.id ??
    "dev-user";

  // Normalize user id into context so downstream code has one place to look.
  // (Helps memory + personalization consistency across web/mobile.)
  (baseCtx as any).user = (baseCtx as any).user ?? {};
  (baseCtx as any).user.id = String(userId);

  let pinnedRecall: string[] = [];
  let pinnedRecallRelevant = false;

  // QA-only debug info (returned only when QA header is present)
  let pinnedRecallDebugTop:
    | Array<{ score: number; type: string; key: string }>
    | undefined;

  try {
    // fetchUserMemories signature: (supabaseClient, userId, limit)
    const memories = await fetchUserMemories(supabase, String(userId), 20);

    const selected = selectPinnedRecall(memories, message, {
      maxItems: 3,
      minScore: 0.18,
      minConfidence: 0.35,
    });

    pinnedRecall = selected.pinnedRecall;
    pinnedRecallRelevant = selected.pinnedRecallRelevant;

    if (qa) {
      pinnedRecallDebugTop = selected.scored.slice(0, 5).map((m) => ({
        score: m.score,
        type: m.type,
        key: m.key,
      }));
    }
  } catch {
    pinnedRecall = [];
    pinnedRecallRelevant = false;

    if (qa) {
      pinnedRecallDebugTop = [
        { score: 0, type: "error", key: "fetchUserMemories_failed" },
      ];
    }
  }

  if (analysisSource === "local") {
    const local = buildLocalReply(message, toneContext);

    // ✅ Contract normalization (additive):
    // Ensure meta.emotionLabel exists even in local analysis mode.
    // Prefer local.meta.emotionLabel if present, else derive from local.meta.emotion.primary if available.
    const localMeta = ((local as any)?.meta ?? {}) as Record<string, unknown>;
    const directLabel =
      typeof (localMeta as any)?.emotionLabel === "string"
        ? String((localMeta as any).emotionLabel)
            .trim()
            .toLowerCase()
        : "";

    const primary =
      typeof (localMeta as any)?.emotion?.primary === "string"
        ? String((localMeta as any).emotion.primary)
            .trim()
            .toLowerCase()
        : "";

    const derivedLabel =
      primary === "sadness"
        ? "sad"
        : primary === "fear" || primary === "anxiety"
          ? "anxious"
          : primary === "anger"
            ? "angry"
            : primary === "joy"
              ? "joy"
              : primary === "neutral"
                ? "neutral"
                : primary;

    const emotionLabel = directLabel || derivedLabel || undefined;

    return NextResponse.json(
      {
        ...local,
        meta: {
          ...localMeta,
          styleContract: "1.0",
          blueprint: "1.0",
          analysisSource: "local",
          ...(emotionLabel ? { emotionLabel } : {}),
        },
      },
      { status: 200 },
    );
  }

  const requestId = getRequestIdFromBody(body);

  const { preferredLanguage, languageDirective } = derivePreferredLanguage(
    langCtx,
    message,
  );

  // Keep debug logs out of production unless QA + dev
  if (qa && SHOULD_LOG) {
    console.warn("[LANG_DEBUG]", {
      requestId,
      explicitFromBody: (body as any)?.preferredLanguage,
      acceptLanguage: req.headers.get("accept-language"),
      derivedPreferredLanguage: preferredLanguage,
    });
  }

  // Anti-repeat directive: deterministic per requestId, so repeated prompts don't lock into one phrasing.
  const antiRepeatVariants = [
    "Variation policy: Use fresh wording. Avoid common generic advice phrases. Offer 1 concrete micro-step and 1 short reflective question. Do not repeat the same sentence structure across replies.",
    "Variation policy: Do NOT reuse stock templates. Keep it human, specific, and slightly different in phrasing. Give 1 actionable step and 1 gentle check-in question.",
    "Variation policy: Avoid clichés. Change the opening line style. Provide 1 practical step the user can do in 30 seconds and ask 1 follow-up question.",
    "Variation policy: Write naturally (not like a template). Give 1 grounding or planning step and 1 curiosity question. Do not repeat the same advice phrasing.",
    "Variation policy: Keep it empathetic and specific. Avoid repeating the same coping-technique script. Give 1 tiny step + 1 question to continue the conversation.",
  ] as const;

  const antiRepeatDirective =
    antiRepeatVariants[
      stableVariantFromId(requestId, antiRepeatVariants.length)
    ];

  // ✅ Reduce “anchor phrase” frequency (don’t ban—just avoid overuse)
  const anchorPhraseDirective = [
    "Avoid overusing the same signature phrases. It’s okay to use them occasionally, but don’t repeat them often.",
    'If they appeared recently, rephrase instead of repeating them verbatim: "Got you", "I’m with you in this", "I hear you", "What’s one small detail", "What feels like the next move".',
    "Sometimes use a simple presence statement instead of steering with another question.",
  ].join(" ");

  // ✅ Tone-aware closing line directive (coach != supportive)
  const bridgeTone = inferBridgeTone(message, toneContext);
  const bridgeDirective = buildBridgeDirectiveForTone(bridgeTone);

  // ✅ Return mode directive (user is back; do "welcome back + what now", not probing)
  const returnDirective = isReturnIntent
    ? [
        "RETURN MODE: The user is back after a pause.",
        "Reply like a close friend: quick welcome-back, then a simple 'what now?' orientation.",
        "Do NOT ask them to explain feelings or 'describe one small piece' unless they shared an issue.",
        "Ask at most ONE short question (e.g., 'What do you want to do right now?').",
        "Keep it natural and warm (2–4 lines).",
      ].join("\n")
    : "";

  // ✅ Closure directive: if user is pausing, do a warm send-off and DO NOT ask questions.
  const closureDirective = isClosureIntent
    ? [
        "🚫 CLOSURE MODE: User is leaving/pausing (e.g., going for a walk, will talk later, going out).",
        "ABSOLUTE RULE: Do NOT end with ANY question mark, question word, or open-ended prompt.",
        "ABSOLUTE RULE: Do NOT use phrases like 'what if', 'have you considered', 'let me know', 'feel free to', or any call-to-action.",
        "RESPONSE TEMPLATE: Acknowledge their message → add one warm/encouraging statement → gentle send-off ('I'll be here when you get back' or similar).",
        "TONE: Warm, supportive, brief. 1–2 sentences maximum. End with a period or exclamation mark.",
        "EXAMPLES OF WHAT NOT TO DO: 'Talk to you later! What will you do on your walk?' or 'See you soon—let me know how it goes!' or 'Enjoy your time—anything you want to talk about first?'",
        "EXAMPLES OF WHAT TO DO: 'Enjoy your walk! I'll be here whenever you're back.' or 'Take care—I'm right here for you.' or 'Have a great time out. See you soon!'",
      ].join("\n")
    : "";

  // Add a generationSalt field for downstream (safe even if ignored)
  const generationSalt = `rid:${requestId}`;

  const result = await runImotara({
    userMessage: message,
    sessionContext: {
      ...baseCtx,

      // ✅ context bias input (safe even if downstream ignores)
      contextText: message,

      // ✅ language fields (safe even if downstream ignores)
      preferredLanguage,
      languageDirective: `${languageDirective}\n${antiRepeatDirective}\n${anchorPhraseDirective}\n${bridgeDirective}\n${returnDirective ? `\n${returnDirective}` : ""}\n${closureDirective ? `\n${closureDirective}` : ""}`,

      // ✅ new: request-scoped variation helpers (safe if ignored)
      requestId,
      generationSalt,

      pinnedRecall,
      pinnedRecallRelevant,
      ...(qa ? { debug: true, pinnedRecallDebugTop } : {}),
    },
    toneContext, // ✅ enables companion tone + personal references consistently
  });

  // ✅ Anti-repeat + humanize guard (cloud): only touches replyText when we detect repetition.
  // Uses recentMessages when available (mobile/web parity) and keeps response schema unchanged.
  type RecentMsg = { role?: string; content?: string; text?: string };

  const recentMessages = (baseCtx as any)?.recentMessages as
    | RecentMsg[]
    | undefined;

  const lastAssistantText = (() => {
    const arr = Array.isArray(recentMessages) ? recentMessages : [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const m = arr[i];
      if (m && String(m.role ?? "").toLowerCase() === "assistant") {
        const t = (m.content ?? m.text ?? "").toString().trim();
        if (t) return t;
      }
    }
    return "";
  })();

  const currentReplyText = String(
    (result as any)?.replyText ?? (result as any)?.reply ?? "",
  ).trim();

  const looksLikeTemplate =
    /^got you\.\s*i['’]m with you in this\./i.test(currentReplyText) ||
    /it sounds like something is making you feel tense or worried\./i.test(
      currentReplyText,
    );

  const isDuplicate =
    !!lastAssistantText &&
    !!currentReplyText &&
    lastAssistantText === currentReplyText;

  const stableIndex = (seed: string, modulo: number) => {
    if (modulo <= 0) return 0;
    const hex = createHash("sha1").update(seed).digest("hex");
    const n = parseInt(hex.slice(0, 8), 16);
    return Number.isFinite(n) ? n % modulo : 0;
  };

  if ((result as any)?.ok === true) {
    // Only guarantee en/hi/bn here (matches current mobile language modes).
    // For other languages, fall back to English safely.
    const langBase: "en" | "hi" | "bn" =
      preferredLanguage === "hi"
        ? "hi"
        : preferredLanguage === "bn"
          ? "bn"
          : "en";

    const current = currentReplyText;

    // Detect “template / duplicate / too-generic” replies.
    // ✅ But instead of hardcoded replacement lines, we ask the model to regenerate with a strong rephrase directive.
    const isTooGeneric =
      current.length < 70 &&
      /(got you|i['’]m with you|i hear you|tense or worried)/i.test(current);

    const shouldHumanize = isDuplicate || looksLikeTemplate || isTooGeneric;

    if (shouldHumanize) {
      const retryDirective =
        [
          "RETRY_REPHRASE:",
          "Rewrite your reply with fresh wording and a more human, spontaneous feel.",
          "Do NOT reuse any full sentence from your previous reply.",
          "Avoid template phrases like: 'Got you', 'I'm with you in this', 'We can go gentle'.",
          "Keep it soft, permission-based, and collaborative ('we' tone).",
          "Follow the 3-phase structure: (1) brief human reaction, (2) real insight, (3) gentle bridge.",
          "Max 1 question total.",
          langBase === "hi"
            ? "Language: Hindi."
            : langBase === "bn"
              ? "Language: Bengali."
              : "Language: English.",
        ].join("\n") + "\n";

      const retry = await runImotara({
        userMessage: message,
        sessionContext: {
          ...baseCtx,

          // ✅ context bias input (safe even if downstream ignores)
          contextText: message,

          preferredLanguage,

          // keep existing directives + add retry directive
          languageDirective: `${languageDirective}\n${antiRepeatDirective}\n${retryDirective}\n${bridgeDirective}`,

          // request-scoped variation changes so the model doesn't “stick” to prior phrasing
          requestId,
          generationSalt: `${generationSalt}:retry1`,

          pinnedRecall,
          pinnedRecallRelevant,

          ...(qa ? { debug: true, pinnedRecallDebugTop } : {}),
        },
        toneContext,
      });

      const retryText = String(
        (retry as any)?.replyText ?? (retry as any)?.reply ?? "",
      ).trim();

      // Only apply if it actually changed and looks non-empty
      if (
        (retry as any)?.ok === true &&
        retryText &&
        retryText !== currentReplyText
      ) {
        (result as any).replyText = retryText;
        (result as any).message = retryText;
        if (typeof (result as any).reply === "string") {
          (result as any).reply = retryText;
        }

        // Optional debug-only note (won’t leak in public mode due to your safeMeta logic below)
        if (qa) {
          (result as any).meta = {
            ...((result as any).meta ?? {}),
            regeneration: { attempt: 1, reason: "duplicate/template/generic" },
          };
        }
      }
    }
  }

  // Public-release lock: never serialize QA-only metadata unless QA header is present
  const resultMeta = ((result as unknown as { meta?: unknown })?.meta ??
    {}) as Record<string, unknown>;

  const safeMeta = qa
    ? resultMeta
    : (() => {
        const m: Record<string, unknown> = { ...resultMeta };
        delete m.softEnforcement;
        // ✅ Keep emotion in public release (safe + non-sensitive)
        return m;
      })();

  // ✅ Baby Step 3.5 — emoji-only positive override (display/meta only)
  // Prevents cases like 😊❤️ showing "sadness/anger" in Cloud AI debug label.
  const deriveEmojiPositive = (raw: string): boolean => {
    const s = String(raw ?? "")
      .trim()
      .replace(/\uFE0F/g, ""); // ❤️ → ❤ consistently
    if (!s) return false;

    // emoji-only (allow ❤ U+2764 too, not always Extended_Pictographic)
    const emojiOnlyPattern = /^[\p{Extended_Pictographic}\u2764]+$/u;
    if (!emojiOnlyPattern.test(s)) return false;

    // positive/affectionate set
    return /[😊🙂☺😄😁😍🥰😘😻❤❤️🧡💛💚💙💜💕💞💖💗💓💘✨🎉🥳👍🙌👏]/u.test(s);
  };

  const currentPrimary = (safeMeta as any)?.emotion?.primary as
    | string
    | undefined;
  const negativePrimaries = new Set(["sadness", "anger", "fear", "anxiety"]);

  const shouldEmojiOverride =
    deriveEmojiPositive(message) &&
    !!currentPrimary &&
    negativePrimaries.has(currentPrimary);

  const emotionInput = shouldEmojiOverride
    ? {
        ...((safeMeta as any)?.emotion ?? {}),
        primary: "joy",
        overriddenBy: "emoji",
      }
    : (safeMeta as any)?.emotion;

  // ✅ Baby Step 11.6.1 — guarantee emotion exists at API boundary
  const emotion: EmotionAnalysis = normalizeEmotion(
    emotionInput,
    "Neutral or mixed feelings.",
  );

  // ✅ Contract normalization (additive):
  // Provide a stable, short emotionLabel for clients (mobile/web/dev QA).
  // We derive it from emotion.primary without changing any detection logic.
  const emotionPrimary = String((emotion as any)?.primary ?? "").toLowerCase();

  const emotionLabel =
    emotionPrimary === "sadness"
      ? "sad"
      : emotionPrimary === "fear" || emotionPrimary === "anxiety"
        ? "anxious"
        : emotionPrimary === "anger"
          ? "angry"
          : emotionPrimary === "joy"
            ? "joy"
            : emotionPrimary === "neutral"
              ? "neutral"
              : // fallback: keep primary if it is a non-empty string, else neutral
                emotionPrimary || "neutral";

  const metaWithEmotion: Record<string, unknown> = {
    ...safeMeta,
    emotion,

    // ✅ NEW: canonical emotion label at API boundary (non-breaking)
    emotionLabel,

    // ✅ exposed for UI parity
    analysisSource,

    // ✅ Mobile/Web language parity
    ...(preferredLanguage ? { languageUsed: preferredLanguage } : {}),
  };

  // 🔒 Contract guard: allow ONLY one ask channel
  if ((result as any)?.followUp && (result as any)?.reflectionSeed) {
    (result as any).reflectionSeed = null;
  }

  // ✅ Closure rule: if the user is pausing/ending, never send a follow-up question
  if (isClosureIntent) {
    (result as any).followUp = "";
    (result as any).reflectionSeed = null;
  }

  // ✅ Mobile renders replyText. Ensure replyText is ALWAYS present (and consistent with message).
  const rawText = String(
    (result as any)?.replyText ??
      (result as any)?.message ??
      (result as any)?.reply ??
      "",
  ).trim();

  // Decide intent once (avoid drift between formatter + debug)
  const detectedIntent = isReturnIntent
    ? "practical"
    : detectReplyIntent(message);

  const externalBridge =
    typeof (result as any)?.followUp === "string"
      ? ((result as any).followUp as string)
      : undefined;

  // ✅ PERMANENT ARCHITECTURE GATE:
  // Force EVERY cloud reply into the Three-Part Humanized Communication framework.
  // (Reaction → Insight → Bridge) + removes "As an AI" markers + deterministic variability.
  const formattedText = rawText
    ? formatImotaraReply({
        raw: rawText,
        userMessage: message,

        // 🚫 If closure, do NOT allow formatter to add bridge
        externalBridge: isClosureIntent ? undefined : externalBridge,

        lang: preferredLanguage ?? "en",
        tone: isReturnIntent
          ? "close_friend"
          : deriveFormatterTone(toneContext),
        intent: detectedIntent,

        seed: `${requestId}|${userId}|${preferredLanguage ?? "en"}|${message.slice(0, 80)}`,

        // 🔐 New flag for formatter (safe if ignored in older versions)
        disableBridge: isClosureIntent,
        mode: isReturnIntent ? "return" : undefined,
      })
    : "";

  const finalText = (formattedText || rawText).trim();

  // ✅ Final enforcement: closure replies must not contain questions (even after formatting).
  const stripQuestions = (t: string): string => {
    let cleaned = t;

    // Remove sentences that are questions (end with ?)
    cleaned = cleaned
      .split(/(?<=[.!?])\s+/)
      .filter((s) => !s.trim().endsWith("?"))
      .join(" ")
      .trim();

    // Remove sentences that start with question words
    cleaned = cleaned
      .split(/(?<=[.!?])\s+/)
      .filter(
        (s) =>
          !/^\s*(what|which|how|why|when|where|who|can you|could you|would you|do you|does|did|are you|is|have you|has)\b/i.test(
            s,
          ),
      )
      .join(" ")
      .trim();

    // If we end up with nothing or just punctuation, keep first sentence
    if (!cleaned || cleaned.length < 3) {
      const parts = t
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return (parts.length ? parts[0] : "").replace(/[?]+$/, ".").trim();
    }

    return cleaned;
  };

  const finalTextNoQ = isClosureIntent ? stripQuestions(finalText) : finalText;

  if (qa && SHOULD_LOG && isClosureIntent) {
    console.warn("[CLOSURE_REPLY_DEBUG]", {
      isClosureIntent,
      beforeStrip: finalText.slice(0, 150),
      afterStrip: finalTextNoQ.slice(0, 150),
      hasQuestion: /[?]/.test(finalTextNoQ),
    });
  }

  if (finalTextNoQ) {
    (result as any).replyText = finalTextNoQ;
    (result as any).message = finalTextNoQ;
    if (typeof (result as any).reply === "string") {
      (result as any).reply = finalTextNoQ;
    }
  }

  // ✅ FollowUp normalization:
  // - Closure: never followUp.
  // - Return: never followUp (the return reply already contains the single allowed question).
  // - Otherwise: if model provided a followUp but it doesn't match the final message, drop it.
  //   Then (only if empty) derive a followUp from finalTextNoQ.
  if (isClosureIntent || isReturnIntent) {
    (result as any).followUp = "";
    (result as any).reflectionSeed = null;
  } else {
    const finalHasQuestion = /[?؟？]/.test(finalTextNoQ);

    // If model followUp exists but it's not actually present in the final rendered text,
    // clear it to avoid stale/robotic carry-over lines.
    const existingFollowUp = String((result as any)?.followUp ?? "").trim();
    if (existingFollowUp && !finalTextNoQ.includes(existingFollowUp)) {
      (result as any).followUp = "";
    }

    // If still empty, derive it from the final formatted text.
    const nowFollowUp = String((result as any)?.followUp ?? "").trim();
    if (!nowFollowUp) {
      if (finalHasQuestion) {
        // pick the last question sentence (handles newlines too)
        const qs = finalTextNoQ.match(/[^?؟？]*[?؟？]/g);
        const lastQ = (qs && qs.length ? qs[qs.length - 1] : "")?.trim();
        if (lastQ) (result as any).followUp = lastQ;
      } else {
        // otherwise: last short paragraph/line as a gentle bridge (non-question)
        const parts = String(finalTextNoQ)
          .split(/\n\s*\n/)
          .map((s) => s.trim())
          .filter(Boolean);

        const last = parts.length ? parts[parts.length - 1] : "";

        // Only set if it's reasonably short and not the whole message
        if (last && last.length <= 160 && last !== finalTextNoQ) {
          (result as any).followUp = last;
        }
      }
    }
  }

  const buildSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    null;

  return NextResponse.json(
    {
      requestId,
      ...result,
      meta: {
        styleContract: "1.0",
        blueprint: "1.0",
        ...metaWithEmotion,
        // ✅ helps us confirm exactly which deployment mobile is hitting
        buildSha,

        // QA-only: lets us verify whether UI renders formatted vs raw
        ...(qa
          ? {
              debugText: {
                detectedIntent,
                userMessage: message,

                // closure proof
                normalizedMsg,
                isClosureIntent,

                // text proof
                rawText,
                formattedText,
                finalText,
                finalTextNoQ: isClosureIntent
                  ? stripQuestions(finalText)
                  : finalText,

                // what we actually returned in result fields
                returned: {
                  replyText: String((result as any)?.replyText ?? ""),
                  message: String((result as any)?.message ?? ""),
                  reply: String((result as any)?.reply ?? ""),
                },
              },
            }
          : {}),
      },
    },
    { status: 200 },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/respond",
      contract: "ImotaraResponse",
      note: "User (and mobile) response endpoint. Use this across Web/iOS/Android for parity.",
    },
    { status: 200 },
  );
}
