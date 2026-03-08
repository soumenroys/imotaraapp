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

import {
  EN_LANG_HINT_REGEX,
  ROMAN_BN_LANG_HINT_REGEX,
  ROMAN_HI_LANG_HINT_REGEX,
  ROMAN_TA_LANG_HINT_REGEX,
  ROMAN_TE_LANG_HINT_REGEX,
} from "@/lib/emotion/keywordMaps";

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
): {
  preferredLanguage?: LanguageCode;
  strictLanguage?: LanguageCode;
  languageDirective: string;
} {
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

  // ✅ "guess" is low-trust; never let it override real script evidence.
  const guess =
    coerceLanguageCode((hints as any)?.languageGuess) ||
    coerceLanguageCode((hints as any)?.navigatorLanguage);

  // 3) Script fallback (server-side safe)
  const t = String(message ?? "").trim();

  // ✅ IMPORTANT: Don't treat punctuation like "।" (U+0964) as "Hindi".
  // Many Bengali users type "।", which lives in the Devanagari block.
  // So we detect Devanagari LETTERS only (exclude danda + digits).
  const hasDevanagariLetters = /[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(
    t,
  );

  const hasBengali = /[\u0980-\u09FF]/.test(t);
  const hasTamil = /[\u0B80-\u0BFF]/.test(t);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(t);
  const hasGujarati = /[\u0A80-\u0AFF]/.test(t);
  const hasGurmukhi = /[\u0A00-\u0A7F]/.test(t);
  const hasKannada = /[\u0C80-\u0CFF]/.test(t);
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(t);

  // ✅ English override (prevents continuity from breaking English messages)
  // If the message is clearly English (Latin letters + common English words),
  // and has no Bengali/Devanagari letters, treat it as English for this turn.
  const hasBn = /[\u0980-\u09FF]/.test(t);
  const hasHiLetters = /[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(t);

  const latinLetters = (t.match(/[A-Za-z]/g) ?? []).length;
  const totalLetters = (
    t.match(/[A-Za-z\u0980-\u09FF\u0904-\u0939\u0958-\u0963\u0971-\u097F]/g) ??
    []
  ).length;

  // ✅ Centralized language hint regex (single source of truth)
  const countHits = (re: RegExp) =>
    (t.match(new RegExp(re.source, "gi")) ?? []).length;

  const englishWordHits = countHits(EN_LANG_HINT_REGEX);

  // --- Romanized local-language detectors (from keywordMaps.ts)
  const romanHiHits = countHits(ROMAN_HI_LANG_HINT_REGEX);
  const romanBnHits = countHits(ROMAN_BN_LANG_HINT_REGEX);
  const romanTaHits = countHits(ROMAN_TA_LANG_HINT_REGEX);
  const romanTeHits = countHits(ROMAN_TE_LANG_HINT_REGEX);

  const latinOnly = !hasBn && !hasHiLetters && totalLetters > 0;
  const latinHeavy = latinOnly && latinLetters / totalLetters >= 0.8;

  // ✅ Romanized Indian-language detection → force that language's native script output
  if (latinOnly) {
    if (
      romanHiHits >= 2 &&
      romanHiHits > romanBnHits &&
      romanHiHits > romanTaHits &&
      romanHiHits > romanTeHits
    ) {
      return {
        preferredLanguage: "hi",
        strictLanguage: "hi",
        languageDirective:
          "Language policy (strict): Reply ONLY in Hindi (hi). Use Devanagari script. Do not mix languages.",
      };
    }
    if (
      romanBnHits >= 2 &&
      romanBnHits > romanHiHits &&
      romanBnHits > romanTaHits &&
      romanBnHits > romanTeHits
    ) {
      return {
        preferredLanguage: "bn",
        strictLanguage: "bn",
        languageDirective:
          "Language policy (strict): Reply ONLY in Bengali (bn). Use Bengali script. Do not mix languages.",
      };
    }
    if (
      romanTaHits >= 2 &&
      romanTaHits > romanHiHits &&
      romanTaHits > romanBnHits &&
      romanTaHits >= romanTeHits
    ) {
      return {
        preferredLanguage: "ta",
        strictLanguage: "ta",
        languageDirective:
          "Language policy (strict): Reply ONLY in Tamil (ta). Use Tamil script. Do not mix languages.",
      };
    }
    if (
      romanTeHits >= 2 &&
      romanTeHits > romanHiHits &&
      romanTeHits > romanBnHits &&
      romanTeHits >= romanTaHits
    ) {
      return {
        preferredLanguage: "te",
        strictLanguage: "te",
        languageDirective:
          "Language policy (strict): Reply ONLY in Telugu (te). Use Telugu script. Do not mix languages.",
      };
    }

    if (romanHiHits >= 2) {
      return {
        preferredLanguage: "hi",
        strictLanguage: "hi",
        languageDirective:
          "Language policy (strict): Reply ONLY in Hindi (hi). Use Devanagari script. Do not mix languages.",
      };
    }
    if (romanBnHits >= 2) {
      return {
        preferredLanguage: "bn",
        strictLanguage: "bn",
        languageDirective:
          "Language policy (strict): Reply ONLY in Bengali (bn). Use Bengali script. Do not mix languages.",
      };
    }
    if (romanTaHits >= 2) {
      return {
        preferredLanguage: "ta",
        strictLanguage: "ta",
        languageDirective:
          "Language policy (strict): Reply ONLY in Tamil (ta). Use Tamil script. Do not mix languages.",
      };
    }
    if (romanTeHits >= 2) {
      return {
        preferredLanguage: "te",
        strictLanguage: "te",
        languageDirective:
          "Language policy (strict): Reply ONLY in Telugu (te). Use Telugu script. Do not mix languages.",
      };
    }
  }

  // ✅ Clear English signal → strict English
  const looksEnglish =
    latinHeavy &&
    englishWordHits >= 2 &&
    romanHiHits < 2 &&
    romanBnHits < 2 &&
    romanTaHits < 2 &&
    romanTeHits < 2;

  if (looksEnglish) {
    return {
      preferredLanguage: "en",
      strictLanguage: "en",
      languageDirective:
        "Language policy (strict): Reply ONLY in English (en). Do not mix languages.",
    };
  }

  // ✅ SAFETY LOCK:
  // If it's Latin-heavy and NOT romanized hi/bn, default to English anyway.
  // This prevents continuity from dragging English prompts into Hindi.
  if (
    latinHeavy &&
    romanHiHits === 0 &&
    romanBnHits === 0 &&
    romanTaHits === 0 &&
    romanTeHits === 0
  ) {
    return {
      preferredLanguage: "en",
      strictLanguage: "en",
      languageDirective:
        "Language policy (strict): Reply ONLY in English (en). Do not mix languages.",
    };
  }

  const scriptDerived: LanguageCode | undefined = hasBengali
    ? "bn"
    : hasDevanagariLetters
      ? "hi"
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

  // ✅ Priority: explicit > script > guess
  // This permanently stops Bengali-script messages from being answered in Hindi
  // just because navigatorLanguage is hi-IN.
  const preferredLanguage = explicit ?? scriptDerived ?? guess;

  console.log("[EXPLICIT]", explicit);

  // ✅ Conversation continuity lock:
  // If last assistant was clearly Bengali, keep Bengali unless user explicitly asks to switch.
  const recent = ((baseCtx as any)?.recentMessages ?? []) as Array<any>;
  let lastAssistantText = "";
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m && String(m.role ?? "").toLowerCase() === "assistant") {
      const t = String(m.content ?? m.text ?? "").trim();
      if (t) {
        lastAssistantText = t;
        break;
      }
    }
  }

  const lastWasBn = /[\u0980-\u09FF]/.test(lastAssistantText);
  const lastWasHi = /[\u0900-\u097F]/.test(lastAssistantText);

  const userAskedSwitch =
    /\b(english|in english|switch to english|বাংলা|bangla|bengali|hindi|हिंदी|in hindi|switch to hindi)\b/i.test(
      String(message ?? ""),
    );

  // ✅ STRICT language
  // lock priority:
  // 1) current message script (highest confidence)
  // 2) message-level English safety lock (Latin-heavy, not romanized hi/bn)
  // 3) conversation continuity (if no switch intent)
  // 4) explicit preference (settings)
  // 5) none
  // If the current message clearly looks English (Latin heavy),
  // prioritize English before conversation continuity.
  const strictLangBase =
    scriptDerived ??
    (latinHeavy && romanHiHits < 2 && romanBnHits < 2
      ? "en"
      : (!userAskedSwitch
        ? lastWasBn
          ? "bn"
          : lastWasHi
            ? "hi"
            : undefined
        : undefined)) ??
    explicit;

  // ✅ Belt-and-suspenders:
  // If the CURRENT message is clearly Latin-heavy and NOT romanized Hindi/Bengali,
  // never let continuity drag it into bn/hi.
  const strictLang =
    latinHeavy &&
      romanHiHits < 2 &&
      romanBnHits < 2 &&
      romanTaHits < 2 &&
      romanTeHits < 2
      ? "en"
      : strictLangBase;

  // ✅ If we already decided a strict language (continuity/script), never leave preferredLanguage undefined.
  // This keeps formatting + downstream behavior aligned and prevents en+hi mixing.
  const effectivePreferred = preferredLanguage ?? strictLang;

  const languageDirective = strictLang
    ? `Language policy (strict): Reply ONLY in ${LANGUAGE_NAME[strictLang]} (${strictLang}). Do not mix languages. Do not switch languages mid-reply. Do not transliterate unless the user asks.`
    : effectivePreferred
      ? `Language policy: Reply in the user's language when clear. If unclear or mixed, prefer ${LANGUAGE_NAME[effectivePreferred]} (${effectivePreferred}).`
      : `Language policy: Reply in the user's language when clear. If unclear, default to English.`;

  return {
    preferredLanguage: effectivePreferred,
    strictLanguage: strictLang,
    languageDirective,
  };
}

function deriveFormatterTone(
  toneContext: unknown,
): "close_friend" | "calm_companion" | "coach" | "mentor" | "partner_like" {
  // 1) Direct string tone (back-compat)
  if (typeof toneContext === "string") {
    const v = toneContext.trim().toLowerCase();
    if (v === "calm_companion" || v === "calm" || v === "companion")
      return "calm_companion";
    if (v === "coach") return "coach";
    if (v === "mentor") return "mentor";
    if (v === "partner_like" || v === "partner") return "partner_like";
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
      if (v === "partner_like" || v === "partner") return "partner_like";
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

      if (rel === "partner_like") return "partner_like";

      // mentor-ish bucket
      if (rel === "mentor" || rel === "elder" || rel === "parent_like")
        return "mentor";

      // friend-ish bucket
      // friend / sibling / junior_buddy / prefer_not
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

    // ✅ Let server infer continuity from chat history (web/mobile parity)
    recentMessages: (baseCtx as any)?.recentMessages ?? (body as any)?.inputs,

    // ✅ IMPORTANT: request body must win over possibly-stale context
    languageHints:
      (body as any)?.languageHints ?? (baseCtx as any)?.languageHints,
  } as Record<string, unknown>;

  const toneContext = (body?.toneContext ??
    (baseCtx as any)?.toneContext ??
    undefined) as unknown;

  // ✅ /api/respond is the authoritative cloud reply route.
  // But the badge should reflect whether this request ran in a degraded fallback-like state.
  // Start as cloud, then downgrade meta only if critical remote dependencies fail.
  let analysisSource: "cloud" | "local" = "cloud";

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

    // Memory/persistence dependency failed, so report this response as degraded.
    // This changes only the returned meta badge source, not the reply generation pipeline.
    analysisSource = "local";

    if (qa) {
      pinnedRecallDebugTop = [
        { score: 0, type: "error", key: "fetchUserMemories_failed" },
      ];
    }
  }

  // /api/respond is cloud-only.
  // Local/offline reply generation should happen before this route is called.

  const requestId = getRequestIdFromBody(body);

  const { preferredLanguage, strictLanguage, languageDirective } =
    derivePreferredLanguage(langCtx, message);

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
    "Variation policy: Use fresh wording. Avoid generic therapy phrasing. Offer 1 concrete micro-step. Ask a short question ONLY if it truly helps (otherwise end with a friendly handoff statement).",
    "Variation policy: Do NOT reuse stock templates. Keep it human, specific, and slightly different in phrasing. Give 1 actionable step. A question is optional—max 1, and keep it casual (friend vibe).",
    "Variation policy: Avoid clichés. Change the opening line style. Provide 1 practical step the user can do in 30 seconds. If you ask, ask 1 small, natural question—not a clinical probe.",
    "Variation policy: Write naturally (not like a template). Give 1 grounding or planning step. Prefer a warm closing line over interrogating the user. Max 1 question.",
    "Variation policy: Keep it empathetic and specific. Avoid repeating the same coping-technique script. Give 1 tiny step, then a simple friendly bridge (question optional, max 1).",
  ] as const;

  const antiRepeatDirective =
    antiRepeatVariants[
    stableVariantFromId(requestId, antiRepeatVariants.length)
    ];

  // ✅ Reduce “anchor phrase” frequency (don’t ban—just avoid overuse)
  const anchorPhraseDirective = [
    "Avoid overusing the same signature phrases. It’s okay occasionally, but don’t repeat them often.",
    'If they appeared recently, rephrase instead of repeating them verbatim: "Got you", "I’m with you in this", "I hear you", "What’s one small detail", "What feels like the next move".',
    'Avoid therapist-style probes like: "Share the one part that’s bothering you most", "Tell me what’s going on right now", "Describe one small piece".',
    "Friend-default: keep it simple, real, and warm. Prefer a gentle closing line over asking a question unless the user explicitly asked one.",
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

  // ✅ Prevent language continuity from dragging English turns into Bengali/Hindi.
  // We do NOT delete chat history; we only prune what we feed into the model context.
  type RecentMsg = { role?: string; content?: string; text?: string };

  const hasBnOrHiLetters = (s: string) =>
    /[\u0980-\u09FF]/.test(s) || /[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(s);

  const originalRecentMessages = (baseCtx as any)?.recentMessages as
    | RecentMsg[]
    | undefined;

  const modelRecentMessages =
    strictLanguage === "en" && Array.isArray(originalRecentMessages)
      ? originalRecentMessages.filter((m) => {
        const c = String(m?.content ?? m?.text ?? "");
        return !hasBnOrHiLetters(c);
      })
      : originalRecentMessages;

  const result = await runImotara({
    userMessage: message,
    sessionContext: {
      ...baseCtx,
      ...(modelRecentMessages ? { recentMessages: modelRecentMessages } : {}),

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
  console.log("IMOTARA_RUN_RESULT:", result);

  const recentMessages = (baseCtx as any)?.recentMessages as
    | RecentMsg[]
    | undefined;

  const lastAssistantText = (() => {
    // 1) Prefer baseCtx.recentMessages (web usually)
    const arr = Array.isArray(recentMessages) ? recentMessages : [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const m = arr[i];
      if (m && String(m.role ?? "").toLowerCase() === "assistant") {
        const t = (m.content ?? m.text ?? "").toString().trim();
        if (t) return t;
      }
    }

    // 2) Fallback: body.inputs (mobile often)
    const inputs = Array.isArray((body as any)?.inputs)
      ? ((body as any).inputs as Array<any>)
      : [];

    for (let i = inputs.length - 1; i >= 0; i--) {
      const x = inputs[i];
      if (x && String(x.role ?? "").toLowerCase() === "assistant") {
        const t = String(x.text ?? x.content ?? "").trim();
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
    // Keep the full derived language when available.
    // This preserves broader multilingual support while keeping
    // existing Bengali-specific guardrails unchanged below.
    const langBase: LanguageCode = strictLanguage ?? preferredLanguage ?? "en";

    let current = currentReplyText;

    // --- Bengali-specific guards ---
    const bnAnchorRegex = /আমি আছি\s*[—–-]\s*সহজ করে এগোই[।.!]?\s*$/u;

    const bnAnchorRepeated =
      langBase === "bn" &&
      !!lastAssistantText &&
      bnAnchorRegex.test(lastAssistantText.trim()) &&
      bnAnchorRegex.test(current.trim());

    // Bengali expected, but model drifted into Devanagari (Hindi)
    const bnHindiMismatch =
      langBase === "bn" &&
      /[\u0900-\u097F]/.test(current) &&
      !/[\u0980-\u09FF]/.test(current);

    // ✅ Bengali: repeated micro-step line de-dup
    // "তাড়া নেই। এক ছোট পদক্ষেপ, তারপর আরেকটা।"
    const bnStepLineRegex =
      /তাড়া নেই[।.!]?\s*এক ছোট পদক্ষেপ, তারপর আরেকটা[।.!]?\s*$/u;

    const bnStepLineRepeated =
      langBase === "bn" &&
      !!lastAssistantText &&
      bnStepLineRegex.test(String(lastAssistantText).trim()) &&
      bnStepLineRegex.test(current.trim());

    // Detect “template / duplicate / too-generic” replies.
    const isTooGeneric =
      current.length < 70 &&
      /(got you|i[\'’]m with you|i hear you|tense or worried)/i.test(current);

    // ✅ Trigger humanize if Bengali drift or repeated Bengali anchor
    const shouldHumanize =
      isDuplicate ||
      looksLikeTemplate ||
      isTooGeneric ||
      bnAnchorRepeated ||
      bnStepLineRepeated ||
      bnHindiMismatch;

    // ✅ If ONLY the Bengali anchor is repeating (and rest is fine), just swap the ending locally
    if (
      !bnHindiMismatch &&
      bnAnchorRepeated &&
      !isDuplicate &&
      !looksLikeTemplate &&
      !isTooGeneric
    ) {
      const variants = [
        "আমি আছি—ধীরে ধীরে এগোই।",
        "আমি এখানেই আছি—একটা করে করি।",
        "আমি আছি—ছোট ছোট করে এগোই।",
        "আমি আছি—একটু থেমে তারপর চলি।",
      ] as const;

      const idx = stableIndex(
        `${requestId}|bn-anchor|${message}|${current}`,
        variants.length,
      );
      current = current.replace(bnAnchorRegex, variants[idx]);
      (result as any).replyText = current;
      (result as any).message = current;
      if (typeof (result as any).reply === "string")
        (result as any).reply = current;
    }

    // ✅ If ONLY the Bengali micro-step line is repeating, swap just that line locally
    if (
      !bnHindiMismatch &&
      bnStepLineRepeated &&
      !isDuplicate &&
      !looksLikeTemplate &&
      !isTooGeneric
    ) {
      const variants = [
        "তাড়া নেই—একটু করে এগোই।",
        "ধীরে ধীরে—একটা করে করি।",
        "চাপ নেই—আজ শুধু ছোট্ট একটা পদক্ষেপ।",
        "আমি আছি—এখন একদম ছোট করে শুরু করি।",
      ] as const;

      const idx = stableIndex(
        `${requestId}|bn-step|${message}|${current}`,
        variants.length,
      );

      current = current.replace(bnStepLineRegex, variants[idx]);
      (result as any).replyText = current;
      (result as any).message = current;
      if (typeof (result as any).reply === "string")
        (result as any).reply = current;
    }

    if (shouldHumanize) {
      const retryDirective =
        [
          "RETRY_REPHRASE:",
          "Rewrite your reply with fresh wording and a more human, spontaneous feel.",
          "Do NOT reuse any full sentence from your previous reply.",
          ...(langBase === "bn"
            ? [
              "Language fix (strict): Reply ONLY in Bengali (bn). Do not use Hindi/Devanagari. Do not mix languages.",
            ]
            : []),
          "Avoid template phrases like: 'Got you', 'I'm with you in this', 'We can go gentle'.",
          "Keep it soft, permission-based, and collaborative ('we' tone).",
          "Follow the 3-phase structure: (1) brief human reaction, (2) real insight, (3) gentle bridge.",
          "Max 1 question total.",
          `Language: ${LANGUAGE_NAME[langBase]} (${langBase}).`,
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

  // ✅ Provide previous assistant text so formatter can avoid repeating the same bridge line back-to-back.
  const prevAssistantText = (() => {
    const recent = Array.isArray((baseCtx as any)?.recentMessages)
      ? ((baseCtx as any).recentMessages as Array<any>)
      : [];

    for (let i = recent.length - 1; i >= 0; i--) {
      const m = recent[i];
      if (m && String(m.role ?? "").toLowerCase() === "assistant") {
        const t = String(m.content ?? m.text ?? "").trim();
        if (t) return t;
      }
    }

    const inputs = Array.isArray((body as any)?.inputs)
      ? ((body as any).inputs as Array<any>)
      : [];

    for (let i = inputs.length - 1; i >= 0; i--) {
      const x = inputs[i];
      if (x && String(x.role ?? "").toLowerCase() === "assistant") {
        const t = String(x.content ?? x.text ?? "").trim();
        if (t) return t;
      }
    }

    return "";
  })();

  const words = String(message ?? "")
    .trim()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

  const shortQuestion =
    /[?？؟]$/.test(String(message ?? "").trim()) &&
    words.length <= 8;

  const modelProducedSentence =
    rawText &&
    /[.!?।؟]$/.test(rawText.trim());

  const formattedText =
    rawText && !modelProducedSentence
      ? formatImotaraReply({
        raw: rawText,
        userMessage: message,
        prevAssistantText,

        // 🚫 If closure, do NOT allow formatter to add bridge
        externalBridge: isClosureIntent ? undefined : externalBridge,

        lang: strictLanguage ?? preferredLanguage ?? "en",
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

  // ✅ Bengali anchor/bridge de-dup (prevents repeating: "আমি আছি — সহজ করে এগোই।")
  let finalTextNoQ2 = finalTextNoQ;

  try {
    const isBn = preferredLanguage === "bn";

    if (isBn && Array.isArray((body as any)?.inputs)) {
      const inputs = (body as any).inputs as Array<Record<string, unknown>>;

      const lastAssistantText =
        [...inputs]
          .slice()
          .reverse()
          .find((x: any) => x?.role === "assistant")?.text ??
        [...inputs]
          .slice()
          .reverse()
          .find((x: any) => x?.role === "assistant")?.content ??
        "";

      // --- 1) Anchor line de-dup (only if the *same* anchor repeats back-to-back)
      const bnAnchorRegex = /আমি আছি\s*[—–-]\s*সহজ করে এগোই[।.!]?\s*$/u;

      const prevHadAnchor =
        typeof lastAssistantText === "string" &&
        bnAnchorRegex.test(lastAssistantText.trim());

      const nowHasAnchor =
        typeof finalTextNoQ2 === "string" &&
        bnAnchorRegex.test(finalTextNoQ2.trim());

      if (prevHadAnchor && nowHasAnchor) {
        const variants = [
          "আমি আছি—ধীরে ধীরে এগোই।",
          "আমি এখানেই আছি—একটা করে করি।",
          "আমি আছি—ছোট ছোট করে এগোই।",
          "আমি আছি—একটু থেমে তারপর চলি।",
        ] as const;

        let idx = stableVariantFromId(
          `${requestId}|bn-bridge`,
          variants.length,
        );

        const prevTrim = String(lastAssistantText).trim();
        if (prevTrim.endsWith(variants[idx])) {
          idx = (idx + 1) % variants.length;
        }

        finalTextNoQ2 = finalTextNoQ2.replace(bnAnchorRegex, variants[idx]);
      }

      // --- 2) Bengali micro-step line policy:
      // If the reply already contains a question, DON'T append any extra "micro-step" line.
      // This kills the robotic “tail line every time” feeling.
      const bnStepLineRegex =
        /(?:\n\s*\n)?তাড়া নেই[।.!]?\s*এক ছোট পদক্ষেপ, তারপর আরেকটা[।.!]?\s*$/u;

      const nowHasStepLine =
        typeof finalTextNoQ2 === "string" &&
        bnStepLineRegex.test(finalTextNoQ2.trim());

      const hasQuestion = /[?？]/.test(String(finalTextNoQ2));

      if (nowHasStepLine && hasQuestion) {
        // remove it completely (keep formatting clean)
        finalTextNoQ2 = String(finalTextNoQ2)
          .replace(bnStepLineRegex, "")
          .trim();
      }
    }
  } catch {
    // never fail the response because of de-dup logic
  }

  if (finalTextNoQ2) {
    (result as any).replyText = finalTextNoQ2;
    (result as any).message = finalTextNoQ2;
    if (typeof (result as any).reply === "string") {
      (result as any).reply = finalTextNoQ2;
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
