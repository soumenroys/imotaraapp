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
  const raw =
    typeof toneContext === "string"
      ? toneContext
      : toneContext &&
          typeof toneContext === "object" &&
          "companion" in (toneContext as any)
        ? String((toneContext as any).companion ?? "")
        : "";

  const v = raw.trim().toLowerCase();

  if (v === "calm_companion" || v === "calm" || v === "companion")
    return "calm_companion";
  if (v === "coach") return "coach";
  if (v === "mentor") return "mentor";

  // default
  return "close_friend";
}

function detectReplyIntent(message: string): "emotional" | "practical" {
  const t = String(message ?? "")
    .toLowerCase()
    .trim();

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

  const PROD = process.env.NODE_ENV === "production";
  const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

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

  // Add a generationSalt field for downstream (safe even if ignored)
  const generationSalt = `rid:${requestId}`;

  const result = await runImotara({
    userMessage: message,
    sessionContext: {
      ...baseCtx,

      // ✅ language fields (safe even if downstream ignores)
      preferredLanguage,
      languageDirective: `${languageDirective}\n${antiRepeatDirective}`,

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

    const bank: Record<"en" | "hi" | "bn", readonly string[]> = {
      en: [
        "I hear you. I’m right here with you. What’s the biggest worry behind that anxiety right now?",
        "Thank you for telling me. Let’s slow it down together—where do you feel the anxiety most (chest, stomach, thoughts)?",
        "That sounds heavy. If we take one small step: what happened just before you started feeling anxious today?",
        "I’m with you. Do you want comfort first, or a practical step to feel a little steadier right now?",
      ],
      hi: [
        "मैं समझ रहा/रही हूँ। मैं आपके साथ हूँ। इस चिंता के पीछे सबसे बड़ा डर क्या लग रहा है अभी?",
        "बताने के लिए धन्यवाद। धीरे-धीरे चलते हैं—ये बेचैनी आपको शरीर में कहाँ सबसे ज़्यादा महसूस हो रही है?",
        "ये सच में भारी लग रहा है। एक छोटा कदम: आज बेचैनी शुरू होने से ठीक पहले क्या हुआ था?",
        "मैं आपके साथ हूँ। अभी आपको क्या ज़्यादा चाहिए—थोड़ा सुकून या कोई छोटा-सा practical step?",
      ],
      bn: [
        "আমি বুঝতে পারছি—আমি আপনার পাশে আছি। এই দুশ্চিন্তার ভেতরে সবচেয়ে বড় ভয়টা কী মনে হচ্ছে এখন?",
        "বলেছেন বলে ধন্যবাদ। ধীরে ধীরে নিই—এই অস্থিরতা আপনি শরীরে কোথায় সবচেয়ে বেশি টের পাচ্ছেন?",
        "শুনে মনে হচ্ছে বিষয়টা ভারী। ছোট করে শুরু করি: আজ অস্থির লাগা শুরু হওয়ার ঠিক আগে কী হয়েছিল?",
        "আমি আপনার সাথে আছি। এখন আপনার জন্য কী বেশি দরকার—একটু সান্ত্বনা, নাকি ছোট একটা পরের পদক্ষেপ?",
      ],
    };

    const current = currentReplyText;
    const isTooGeneric =
      current.length < 70 &&
      /(got you|i['’]m with you|i hear you|tense or worried)/i.test(current);

    const shouldHumanize = isDuplicate || looksLikeTemplate || isTooGeneric;

    if (shouldHumanize) {
      const seed = [
        langBase,
        message,
        String((body as any)?.requestId ?? ""),
        lastAssistantText,
      ].join("|");

      let idx = stableIndex(seed, bank[langBase].length);

      let candidate = bank[langBase][idx] ?? bank.en[0];

      // If candidate would still repeat, rotate once.
      if (
        (lastAssistantText && candidate === lastAssistantText) ||
        (current && candidate === current)
      ) {
        idx = (idx + 1) % bank[langBase].length;
        candidate = bank[langBase][idx] ?? bank.en[0];
      }

      (result as any).replyText = candidate;
      (result as any).message = candidate;
      if (typeof (result as any).reply === "string") {
        (result as any).reply = candidate;
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

  // ✅ Mobile renders replyText. Ensure replyText is ALWAYS present (and consistent with message).
  const rawText = String(
    (result as any)?.replyText ??
      (result as any)?.message ??
      (result as any)?.reply ??
      "",
  ).trim();

  // Decide intent once (avoid drift between formatter + debug)
  const detectedIntent = detectReplyIntent(message);

  // ✅ PERMANENT ARCHITECTURE GATE:
  // Force EVERY cloud reply into the Three-Part Humanized Communication framework.
  // (Reaction → Insight → Bridge) + removes "As an AI" markers + deterministic variability.
  const formattedText = rawText
    ? formatImotaraReply({
        raw: rawText,
        userMessage: message,
        lang: preferredLanguage ?? "en",
        tone: deriveFormatterTone(toneContext),
        intent: detectedIntent,
        seed: `${requestId}|${userId}|${preferredLanguage ?? "en"}|${message.slice(0, 80)}`,
      })
    : "";

  const finalText = (formattedText || rawText).trim();

  if (finalText) {
    (result as any).replyText = finalText;
    (result as any).message = finalText;
    if (typeof (result as any).reply === "string") {
      (result as any).reply = finalText;
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
                rawText,
                formattedText,
                finalText,
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
