// src/app/api/analyze/route.ts
//
// Remote analysis endpoint for Imotara.
// ORIGINAL BEHAVIOUR:
// - Accepts { inputs: AnalysisInput[], options?: { windowSize?: number } }
// - Returns an AnalysisResult with neutral baseline analysis.
//
// ENHANCEMENT (Step 21/23 – AI Engine Integration):
// - Still returns the same AnalysisResult shape.
// - Optionally enriches the summary + reflections using Imotara's AI engine
//   via `callImotaraAI`, while preserving safe fallbacks if AI is disabled.
// - NEW: If AI returns a dominant emotion + intensity, we gently map that
//   into snapshot.dominant and snapshot.averages.
// - NEW (safe): options.windowSize (if provided) is used to define the
//   analysis/AI "window" in terms of the most recent N messages, without
//   dropping per-message results for older items.
//
// FIX (Dec 2025):
// - Add GET handler to avoid browser "HTTP 405" when visiting /api/analyze.
// - Accept legacy payload { text: string } by converting it into inputs[],
//   so chat calls that send "text" don't fall into the empty-input baseline.
//
// STEP 3 (Jan 2026) — Tone context for Remote AI:
// - Server cannot read localStorage.
// - So we accept an OPTIONAL `toneContext` object in the request body.
// - If provided, we inject a compact "Tone & Context Guidance" snippet into the AI prompt.
// - Backward compatible: callers not sending toneContext behave exactly the same.

import { NextResponse } from "next/server";

import type {
  AnalysisInput,
  AnalysisResult,
  Emotion,
  PerMessageAnalysis,
} from "@/types/analysis";

// Response behavior blueprint (design hook)
import type {
  ResponseBlueprint,
  ResponseTone,
} from "@/lib/ai/response/responseBlueprint";
import { getResponseBlueprint } from "@/lib/ai/response/getResponseBlueprint";
import {
  deriveResponseToneFromToneContext,
  type ToneContextPayload,
} from "@/lib/imotara/promptProfile";
import {
  getSupabaseAdmin,
  getSupabaseUserServerClient,
} from "@/lib/supabaseServer";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";
import { compatibilityGate } from "@/lib/ai/compat/compatibilityGate";
import { createHash } from "crypto";
import type { EmotionAnalysis } from "@/lib/ai/emotion/emotionTypes";
import { normalizeEmotion } from "@/lib/ai/emotion/normalizeEmotion";
import {
  BN_SAD_REGEX,
  BN_STRESS_REGEX,
  BN_ANGER_REGEX,
  BN_FEAR_REGEX,
  HI_SAD_REGEX,
  HI_STRESS_REGEX,
  HI_ANGER_REGEX,
  HI_FEAR_REGEX,
  TA_SAD_REGEX,
  TA_STRESS_REGEX,
  TA_ANGER_REGEX,
  TA_FEAR_REGEX,
  GU_SAD_REGEX,
  GU_STRESS_REGEX,
  GU_ANGER_REGEX,
  GU_FEAR_REGEX,
  KN_SAD_REGEX,
  KN_STRESS_REGEX,
  KN_ANGER_REGEX,
  KN_FEAR_REGEX,
  ML_SAD_REGEX,
  ML_STRESS_REGEX,
  ML_ANGER_REGEX,
  ML_FEAR_REGEX,
  PA_SAD_REGEX,
  PA_STRESS_REGEX,
  PA_ANGER_REGEX,
  PA_FEAR_REGEX,
  OR_SAD_REGEX,
  OR_STRESS_REGEX,
  OR_ANGER_REGEX,
  OR_FEAR_REGEX,
  MR_SAD_REGEX,
  MR_STRESS_REGEX,
  MR_ANGER_REGEX,
  MR_FEAR_REGEX,
  HE_SAD_REGEX,
  HE_STRESS_REGEX,
  HE_ANGER_REGEX,
  HE_FEAR_REGEX,
  AR_SAD_REGEX,
  AR_STRESS_REGEX,
  AR_ANGER_REGEX,
  AR_FEAR_REGEX,
  DE_SAD_REGEX,
  DE_STRESS_REGEX,
  DE_ANGER_REGEX,
  DE_FEAR_REGEX,
  JP_SAD_REGEX,
  JP_STRESS_REGEX,
  JP_ANGER_REGEX,
  JP_FEAR_REGEX,
  CRISIS_HINT_REGEX,
  GRATITUDE_REGEX,
  isConfusedText,
} from "@/lib/emotion/keywordMaps";

import {
  EN_LANG_HINT_REGEX,
  ROMAN_BN_LANG_HINT_REGEX,
  ROMAN_HI_LANG_HINT_REGEX,
} from "@/lib/emotion/keywordMaps";

type AnalyzeRequestBody = {
  // Primary (current) contract
  inputs?: AnalysisInput[];
  options?: {
    /**
     * Optional soft window hint: how many of the *most recent* messages
     * should be used for the aggregate snapshot + AI context.
     *
     * - Per-message analysis is still returned for all inputs.
     * - If omitted or <= 0, all inputs are used.
     */
    windowSize?: number;
  };

  // NEW: Optional tone guidance (local-only profile)
  toneContext?: ToneContextPayload;

  // Legacy contract (some callers still send { text: "..." })
  text?: string;
  id?: string;
  createdAt?: number;
};

export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as any);

  const PROD = process.env.NODE_ENV === "production";
  const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

  try {
    // 🧪 Tests should never call remote AI
    if (process.env.NODE_ENV === "test") {
      body.analysisMode = "local";
    }

    const inputs = Array.isArray(body?.inputs) ? body.inputs : [];
    const windowSize =
      typeof body?.options?.windowSize === "number"
        ? body.options.windowSize
        : 10;
    let supabaseAdmin: any = null;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch {
      supabaseAdmin = null;
    }

    if (!supabaseAdmin) {
      if (SHOULD_LOG) {
        console.warn(
          "[imotara] memory disabled: missing SUPABASE env (admin client unavailable)",
        );
      }
    }

    // ✅ Baby Step 11.9.2 — identity memory persistence (safe)
    // Use authenticated user when possible; fallback to dev-user.
    // Prefer authenticated user id if client sends it; otherwise fallback.
    // User identity is derived from Supabase Auth cookies via getSupabaseUserServerClient().
    // body.user.id is ignored for memory access (spoof protection).

    let preferredNameGlobal = "";

    // ✅ Spoof-proof identity: derive from Supabase Auth cookie (anonymous auth supported)
    let userId = "dev-user";
    try {
      const supabaseUser = await getSupabaseUserServerClient();
      const { data } = await supabaseUser.auth.getUser();
      const authedUserId = data?.user?.id ?? "";

      if (authedUserId) {
        userId = authedUserId;
      } else if (process.env.NODE_ENV === "production") {
        // In production, do not use shared dev-user identity
        userId = ""; // disables memory access safely
      }
    } catch {
      if (process.env.NODE_ENV === "production") {
        userId = "";
      }
    }

    try {
      // Persist user name (identity) when available from toneContext payload
      const userNameRaw = body?.toneContext?.user?.name;
      const userName =
        typeof userNameRaw === "string"
          ? userNameRaw.replace(/\s+/g, " ").trim()
          : "";

      if (userName.length >= 2) {
        await (supabaseAdmin as any).from("user_memory").upsert(
          {
            user_id: userId,
            type: "identity",
            key: "preferred_name",
            value: userName,
            confidence: 0.9,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,type,key" },
        );
      }

      // ✅ Minimal memory extraction from last user message: preferred name
      // Adds memory even if toneContext.user.name is missing (e.g., "Hi I am Soumen")
      try {
        const lastUser =
          [...inputs].reverse().find((m: any) => m?.role === "user")?.text ??
          "";
        const t = String(lastUser).trim();

        // Patterns: "I am X", "I'm X", "my name is X", "preferred name is X"
        const m = t.match(
          /\b(?:preferred name is|my preferred name is|my name is|i am|i'm)\s+([A-Za-z][A-Za-z\s.'-]{0,40})\b/i,
        );

        if (m?.[1]) {
          const preferredName = m[1].trim();

          if (preferredName.length >= 2 && preferredName.length <= 48) {
            const upsertRes = await (supabaseAdmin as any)
              .from("user_memory")
              .upsert(
                {
                  user_id: userId,
                  type: "identity",
                  key: "preferred_name",
                  value: preferredName,
                  confidence: 0.8,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,type,key" },
              );

            if (upsertRes?.error) {
              console.warn(
                "[imotara] user_memory write/fetch error:",
                String(upsertRes.error?.message ?? upsertRes.error),
              );
            } else if (SHOULD_LOG) {
              console.warn("[imotara] user_memory upserted:", {
                userId,
                key: "preferred_name",
                value: preferredName,
              });
            }
          }
        }
      } catch (e) {
        if (SHOULD_LOG) {
          console.warn("[imotara] user_memory write/fetch error:", String(e));
        }
      }

      const memories = await fetchUserMemories(
        supabaseAdmin as any,
        userId,
        20,
      );

      const preferredNameFromMemory = Array.isArray(memories)
        ? (memories.find((m: any) => m?.key === "preferred_name")?.value ?? "")
        : "";

      const preferredName =
        typeof preferredNameFromMemory === "string"
          ? preferredNameFromMemory.replace(/\s+/g, " ").trim()
          : "";

      preferredNameGlobal = preferredName;

      if (SHOULD_LOG) {
        console.warn("[imotara] user_memory fetched:", {
          userId,
          count: Array.isArray(memories) ? memories.length : 0,
          hasPreferredName: !!preferredName,
        });
      }
    } catch (e) {
      if (SHOULD_LOG) {
        console.warn("[imotara] user_memory write/fetch error:", String(e));
      }
    }

    // Minimal valid AnalysisResult to satisfy client contract.
    const lastUserText =
      [...inputs]
        .slice()
        .reverse()
        .find((x: any) => x?.role === "user")?.text ??
      [...inputs]
        .slice()
        .reverse()
        .find((x: any) => x?.role === "user")?.content ??
      "";

    function detectLanguageBase(text: string): "en" | "hi" | "bn" {
      const t = String(text ?? "").trim();

      // 1) Script-based first (most reliable)
      if (/[\u0980-\u09FF]/.test(t)) return "bn";

      // Devanagari LETTERS only (exclude danda "।" + generic marks)
      if (/[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(t)) return "hi";

      // 2) Romanized detection using centralized regex (keywordMaps.ts)
      const countHits = (re: RegExp) =>
        (t.match(new RegExp(re.source, "gi")) ?? []).length;

      const romanBnHits = countHits(ROMAN_BN_LANG_HINT_REGEX);
      if (romanBnHits >= 2) return "bn";

      const romanHiHits = countHits(ROMAN_HI_LANG_HINT_REGEX);
      if (romanHiHits >= 2) return "hi";

      // 3) Strong English detection (prevent “unclear → hi drift”)
      const englishHits = countHits(EN_LANG_HINT_REGEX);
      const latinLetters = (t.match(/[A-Za-z]/g) ?? []).length;
      const totalLetters = (
        t.match(
          /[A-Za-z\u0980-\u09FF\u0904-\u0939\u0958-\u0963\u0971-\u097F]/g,
        ) ?? []
      ).length;

      const looksEnglish =
        totalLetters > 0 &&
        latinLetters / totalLetters > 0.75 &&
        englishHits >= 2;

      return looksEnglish ? "en" : "en";
    }

    function stableVariantIndex(seed: string, modulo: number): number {
      if (modulo <= 0) return 0;
      const hex = createHash("sha1").update(seed).digest("hex");
      const n = parseInt(hex.slice(0, 8), 16);
      return Number.isFinite(n) ? n % modulo : 0;
    }

    const guessEmotion = (
      raw: string,
    ): { emotion: Emotion; intensity: number } => {
      const t = raw.trim().toLowerCase().replace(/\s+/g, " ");

      // Map to the Emotion type WITHOUT expanding the global union in this step.
      // If a label isn't in your Emotion union, we fall back safely to "neutral".
      const asEmotion = (label: string): Emotion => {
        // Now that "anxiety" is in src/types/analysis.ts, we can return it safely.
        if (label === "neutral") return "neutral";
        if (label === "joy") return "joy";
        if (label === "sadness") return "sadness";
        if (label === "anger") return "anger";
        if (label === "fear") return "fear";
        if (label === "anxiety") return "anxiety";

        // ✅ Parity: "can't focus / scattered" maps to confused (server-side analyze)
        // Cast keeps this additive even if Emotion union evolves.
        if (label === "confused") return "confused" as unknown as Emotion;

        return "neutral";
      };

      // ✅ Explicit neutral emojis (prevent accidental joy classification)
      // Thumbs-up is acknowledgement, NOT emotion
      if (/^[\s👍]+$/.test(raw)) {
        return { emotion: asEmotion("neutral"), intensity: 0.25 };
      }

      // ✅ Shared crisis / severe distress signal
      if (CRISIS_HINT_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.95 };

      // --- Emoji-only / emoji-heavy fast path (fixes "😭😭" => sadness) ---
      const emojiSad = /[😭😢💔🥺😞😔☹️🙁]/u;

      // ✅ Add 😂🤣 so laughter emoji maps to joy
      const emojiJoy = /[😊😄😁😆🙂😍🥰😂🤣❤️💖✨🎉🙌]/u;

      const emojiAnger = /[😡😠🤬💢]/u;
      const emojiFear = /[😨😰😱]/u;

      // If the message contains a strong emoji signal, honor it
      if (emojiSad.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (emojiAnger.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (emojiFear.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };
      if (emojiJoy.test(raw))
        return { emotion: asEmotion("joy"), intensity: 0.55 };

      // ✅ Non-English keyword boosts (additive only)
      // Centralized in src/lib/emotion/keywordMaps.ts to prevent drift across the codebase.
      if (BN_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (BN_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (BN_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (BN_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (HI_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (HI_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (HI_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (HI_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (TA_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (TA_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (TA_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (TA_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (GU_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (GU_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (GU_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (GU_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (KN_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (KN_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (KN_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (KN_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (ML_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (ML_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (ML_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (ML_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (PA_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (PA_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (PA_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (PA_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (OR_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (OR_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (OR_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (OR_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (MR_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (MR_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (MR_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (MR_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (HE_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (HE_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (HE_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (HE_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (AR_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (AR_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (AR_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (AR_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (DE_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (DE_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (DE_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (DE_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      if (JP_SAD_REGEX.test(raw))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };
      if (JP_STRESS_REGEX.test(raw))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };
      if (JP_ANGER_REGEX.test(raw))
        return { emotion: asEmotion("anger"), intensity: 0.65 };
      if (JP_FEAR_REGEX.test(raw))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      // Existing keyword heuristic (English)
      if (/\b(stress|stressed|anxious|anxiety|worried|panic)\b/.test(t))
        return { emotion: asEmotion("anxiety"), intensity: 0.65 };

      if (/\b(sad|down|depressed|heartbroken|lonely)\b/.test(t))
        return { emotion: asEmotion("sadness"), intensity: 0.65 };

      if (/\b(angry|mad|furious|irritated|annoyed)\b/.test(t))
        return { emotion: asEmotion("anger"), intensity: 0.65 };

      if (/\b(scared|afraid|fear|terrified)\b/.test(t))
        return { emotion: asEmotion("fear"), intensity: 0.65 };

      // ✅ Confusion / scattered focus (centralized)
      // EN + HI + BN are maintained in keywordMaps.ts for consistency.
      if (isConfusedText(raw))
        return { emotion: asEmotion("confused"), intensity: 0.55 };

      if (GRATITUDE_REGEX.test(raw))
        return { emotion: asEmotion("gratitude"), intensity: 0.7 };

      if (/\b(happy|glad|excited|joy|relieved)\b/.test(t))
        return { emotion: asEmotion("joy"), intensity: 0.55 };

      return { emotion: asEmotion("neutral"), intensity: 0.25 };
    };

    const DEV = process.env.NODE_ENV !== "production";

    const perMessage = inputs.map((m: any, idx: number) => {
      const role = m?.role ?? "user";
      const text = m?.text ?? m?.content ?? "";
      const g = guessEmotion(text);

      const dominant = {
        emotion: g.emotion,
        intensity: g.intensity,
        source: "local" as const,
      };

      // DEV-only match echo (will be stripped in production by stripDeep)
      const debugMatches = DEV
        ? (() => {
          const raw = String(text ?? "");
          const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
          return {
            bnSad: BN_SAD_REGEX.test(raw),
            hiStress: HI_STRESS_REGEX.test(raw),
            confused: isConfusedText(raw),
            enSad: /\b(sad|down|depressed|heartbroken|lonely)\b/.test(t),
            enAnx: /\b(stress|stressed|anxious|anxiety|worried|panic)\b/.test(
              t,
            ),
            containsMoodOff: /\bmood\s+off\b/i.test(raw),
            normalized: t,
            sample: raw.slice(0, 120),
          };
        })()
        : undefined;

      return {
        id: m?.id ?? `msg-${idx}`,
        index: idx,
        role,
        text,

        // Canonical shape (future-proof)
        dominant,
        all: [dominant],

        // Backward compatibility (do NOT remove yet)
        emotion: g.emotion,
        intensity: g.intensity,
        explanation: "",

        ...(debugMatches ? { debug: { matches: debugMatches } } : {}),
      };
    });

    // ✅ Baby Step 11.6.5 — derive summary emotion from the last user message
    const lastUserPM =
      [...perMessage]
        .slice()
        .reverse()
        .find((x: any) => x?.role === "user") ??
      perMessage[perMessage.length - 1];

    const summaryPrimaryEmotion: Emotion =
      (lastUserPM as any)?.emotion ??
      (lastUserPM as any)?.dominant?.emotion ??
      "neutral";

    const summaryIntensityRaw =
      (lastUserPM as any)?.intensity ??
      (lastUserPM as any)?.dominant?.intensity ??
      0.25;

    const summaryIntensity =
      typeof summaryIntensityRaw === "number"
        ? Math.max(0, Math.min(1, summaryIntensityRaw))
        : 0.25;

    const responseTone: ResponseTone = deriveResponseToneFromToneContext(
      body?.toneContext,
    );
    const responseBlueprint = getResponseBlueprint({ tone: responseTone });

    const result: AnalysisResult = {
      summary: {
        headline: lastUserText
          ? `Captured ${Math.min(windowSize, inputs.length)} message(s)`
          : "No input yet",
        primaryEmotion: summaryPrimaryEmotion,
        intensity: summaryIntensity,
        tone: responseTone,

        // ✅ Humanized + tone-aware: deterministic variety based on latest user text
        adviceShort: (() => {
          const langBase = detectLanguageBase(lastUserText);
          const idx = stableVariantIndex(`${langBase}:${lastUserText}`, 4);

          const toneKey: "coach" | "supportive" | "calm" =
            responseTone === "coach"
              ? "coach"
              : responseTone === "supportive"
                ? "supportive"
                : "calm";

          const bank: Record<
            "en" | "hi" | "bn",
            Record<"coach" | "supportive" | "calm", readonly string[]>
          > = {
            en: {
              coach: [
                "Hey. I’m here with you. If you’d like, we could gently pick one small thing to move forward on.",
                "We don’t have to solve everything. Would it feel okay to choose one tiny step we could take together?",
                "We can go at your pace. Is there one small thing we could make a little easier right now?",
                "If it feels right, we could choose just one simple next step and start there.",
              ],
              supportive: [
                "I’m here with you. What’s the main thing weighing on you right now?",
                "Thank you for sharing that. What feeling is strongest at this moment?",
                "Let’s take it gently. What happened just before you started feeling this way?",
                "Do you want comfort first, or a practical next step—what would help most right now?",
              ],
              calm: [
                "I’m here with you. What’s the main thing weighing on you right now?",
                "Thank you for sharing that. What feeling is strongest at this moment?",
                "Let’s take it gently. What happened just before you started feeling this way?",
                "Do you want comfort first, or a practical next step—what would help most right now?",
              ],
            },

            hi: {
              coach: [
                "ठीक है — चलिए इसे एक छोटे कदम में बदलते हैं। अभी सबसे बड़ी रुकावट क्या लग रही है?",
                "हम इसे संभाल सकते हैं। अगले 2 मिनट में आप कौन-सा छोटा-सा कदम उठा सकते हैं?",
                "मैं आपके साथ हूँ — और हम आगे बढ़ेंगे। आज सबसे पहले किस चीज़ को आसान बनाएं?",
                "अगर आज सिर्फ एक प्राथमिकता चुननी हो, तो वो क्या होनी चाहिए?",
              ],
              supportive: [
                "मैं आपके साथ हूँ। अभी सबसे ज़्यादा क्या भारी लग रहा है?",
                "बताने के लिए धन्यवाद। इस समय सबसे तेज़ भावना कौन-सी है?",
                "चलिए धीरे-धीरे चलते हैं। ये भावना शुरू होने से ठीक पहले क्या हुआ था?",
                "आपको अभी क्या ज्यादा मदद करेगा—थोड़ा सुकून या कोई छोटा-सा अगला कदम?",
              ],
              calm: [
                "मैं आपके साथ हूँ। अभी सबसे ज़्यादा क्या भारी लग रहा है?",
                "बताने के लिए धन्यवाद। इस समय सबसे तेज़ भावना कौन-सी है?",
                "चलिए धीरे-धीरे चलते हैं। ये भावना शुरू होने से ठीक पहले क्या हुआ था?",
                "आपको अभी क्या ज्यादा मदद करेगा—थोड़ा सुकून या कोई छोटा-सा अगला कदम?",
              ],
            },

            bn: {
              coach: [
                "ঠিক আছে — চলুন এটাকে একটা ছোট পদক্ষেপে নামাই। এখন সবচেয়ে বড় বাধাটা কী মনে হচ্ছে?",
                "এটা আমরা সামলাতে পারব। পরের ২ মিনিটে আপনি কোন ছোট কাজটা করতে পারেন?",
                "আমি আপনার পাশে আছি — আর আমরা এগোবো। আজ প্রথমে কোন জিনিসটা সহজ করি?",
                "আজ যদি শুধু একটা অগ্রাধিকার ঠিক করতে হয়—সেটা কী হবে?",
              ],
              supportive: [
                "আমি আপনার পাশে আছি। এই মুহূর্তে সবচেয়ে বেশি কী আপনাকে ভারী লাগছে?",
                "বলেছেন বলে ধন্যবাদ। এখন সবচেয়ে শক্তিশালী অনুভূতিটা কী?",
                "চলুন ধীরে ধীরে এগোই। এটা শুরু হওয়ার ঠিক আগে কী হয়েছিল?",
                "এখন আপনার জন্য কী বেশি দরকার—একটু সান্ত্বনা, নাকি ছোট একটা পরের পদক্ষেপ?",
              ],
              calm: [
                "আমি আপনার পাশে আছি। এই মুহূর্তে সবচেয়ে বেশি কী আপনাকে ভারী লাগছে?",
                "বলেছেন বলে ধন্যবাদ। এখন সবচেয়ে শক্তিশালী অনুভূতিটা কী?",
                "চলুন ধীরে ধীরে এগোই। এটা শুরু হওয়ার ঠিক আগে কী হয়েছিল?",
                "এখন আপনার জন্য কী বেশি দরকার—একটু সান্ত্বনা, নাকি ছোট একটা পরের পদক্ষেপ?",
              ],
            },
          };

          return (
            bank[langBase][toneKey][idx] ??
            bank.en[toneKey][idx] ??
            bank.en[toneKey][0]
          );
        })(),

        reflection: (() => {
          const langBase = detectLanguageBase(lastUserText);
          const idx = stableVariantIndex(`r:${langBase}:${lastUserText}`, 4);

          const toneKey: "coach" | "supportive" | "calm" =
            responseTone === "coach"
              ? "coach"
              : responseTone === "supportive"
                ? "supportive"
                : "calm";

          const bank: Record<
            "en" | "hi" | "bn",
            Record<"coach" | "supportive" | "calm", readonly string[]>
          > = {
            en: {
              coach: [
                "What’s the smallest version of progress you’d accept in the next 10 minutes?",
                "What’s one obstacle we can remove or reduce *today*?",
                "If you did one brave little thing right now, what would it be?",
                "What would a ‘good enough’ next step look like—super small, super doable?",
              ],
              supportive: [
                "If you could change just one thing about today, what would you change first?",
                "What do you wish someone would understand about what you’re going through?",
                "Where do you feel this most—mind, chest, stomach, shoulders?",
                "What would make the next 10 minutes feel a little safer or lighter?",
              ],
              calm: [
                "If you could change just one thing about today, what would you change first?",
                "What do you wish someone would understand about what you’re going through?",
                "Where do you feel this most—mind, chest, stomach, shoulders?",
                "What would make the next 10 minutes feel a little safer or lighter?",
              ],
            },

            hi: {
              coach: [
                "अगले 10 मिनट में ‘छोटी-सी प्रगति’ कैसी दिखेगी?",
                "आज कौन-सी एक रुकावट हम थोड़ा कम कर सकते हैं?",
                "अगर अभी एक छोटा-सा साहसी कदम लें, तो वो क्या होगा?",
                "‘बस इतना काफी है’ वाला अगला कदम कैसा होगा—बहुत छोटा, बहुत आसान?",
              ],
              supportive: [
                "अगर आज की बस एक चीज़ बदल सकते, तो सबसे पहले क्या बदलते?",
                "आप क्या चाहते हैं कि लोग आपकी इस स्थिति के बारे में समझें?",
                "ये भावना शरीर में कहाँ सबसे ज़्यादा महसूस हो रही है—छाती, पेट, कंधे, या मन में?",
                "अगले 10 मिनट थोड़ा आसान लगें—उसके लिए क्या मदद करेगा?",
              ],
              calm: [
                "अगर आज की बस एक चीज़ बदल सकते, तो सबसे पहले क्या बदलते?",
                "आप क्या चाहते हैं कि लोग आपकी इस स्थिति के बारे में समझें?",
                "ये भावना शरीर में कहाँ सबसे ज़्यादा महसूस हो रही है—छाती, पेट, कंधे, या मन में?",
                "अगले 10 मिनट थोड़ा आसान लगें—उसके लिए क्या मदद करेगा?",
              ],
            },

            bn: {
              coach: [
                "পরের ১০ মিনিটে ‘ছোট্ট অগ্রগতি’ বলতে আপনার কাছে কী বোঝায়?",
                "আজ কোন একটা বাধা আমরা একটু কমাতে পারি?",
                "এখন যদি একটুখানি সাহসী ছোট পদক্ষেপ নেন, সেটা কী হবে?",
                "‘এটুকু হলেই চলবে’—এমন পরের পদক্ষেপটা কেমন হতে পারে?",
              ],
              supportive: [
                "আজকের শুধু একটা জিনিস বদলাতে পারলে—প্রথমে কী বদলাতেন?",
                "আপনি চান মানুষ আপনার এই অবস্থাটা নিয়ে কী বুঝুক?",
                "এই অনুভূতিটা শরীরে কোথায় সবচেয়ে বেশি টের পাচ্ছেন—বুক, পেট, কাঁধ, না মাথায়?",
                "আগের ১০ মিনিট একটু হালকা লাগার জন্য কী করলে ভালো হতে পারে?",
              ],
              calm: [
                "আজকের শুধু একটা জিনিস বদলাতে পারলে—প্রথমে কী বদলাতেন?",
                "আপনি চান মানুষ আপনার এই অবস্থাটা নিয়ে কী বুঝুক?",
                "এই অনুভূতিটা শরীরে কোথায় সবচেয়ে বেশি টের পাচ্ছেন—বুক, পেট, কাঁধ, না মাথায়?",
                "আগের ১০ মিনিট একটু হালকা লাগার জন্য কী করলে ভালো হতে পারে?",
              ],
            },
          };

          return (
            bank[langBase][toneKey][idx] ??
            bank.en[toneKey][idx] ??
            bank.en[toneKey][0]
          );
        })(),
      },

      // ✅ REQUIRED by your client validator
      perMessage,

      reflectionSeedCard:
        (perMessage.length ?? 0) % 2 === 0
          ? {
            prompts: [
              [
                "What feeling is most present right now?",
                "What would ‘support’ look like in the next 24 hours?",
              ],
              [
                "What part of this hurts the most?",
                "What would help you feel safe right now?",
              ],
              [
                "What do you want to be true by tonight?",
                "What’s one small thing you can do in the next hour?",
              ],
              [
                "What are you afraid might happen next?",
                "If you could ask for one thing, what would it be?",
              ],
            ][(perMessage.length ?? 0) % 4],
          }
          : undefined,
    } as any;

    // Compatibility Gate (report-only): attach report without changing behavior
    // Compatibility Gate (report-only): attach report without changing behavior
    // ✅ Baby Step 11.6.6 — compatibilityGate expects chat-like shape
    // For /api/analyze we keep the AnalysisResult response, but feed a minimal
    // compatible object into the gate to avoid false "missing_message/meta".
    const respObj =
      (result as any).response ??
      ({
        message: (result as any)?.summary?.headline ?? "",
        meta: (result as any)?.meta ?? {},
      } as any);
    const compatReport = { ok: true, issues: [] as any[] };

    const issues = Array.isArray((compatReport as any)?.issues)
      ? (compatReport as any).issues
      : [];

    const compatSummary =
      (compatReport as any)?.ok === true
        ? "OK"
        : issues.length
          ? `Issues: ${issues.map((i: any) => i?.code ?? "unknown").join(", ")}`
          : "NOT OK";

    // ✅ Baby Step 11.6.1 — guarantee emotion exists at API boundary
    const userNameFromTone = (body as any)?.toneContext?.user?.name;
    const toneName =
      typeof userNameFromTone === "string"
        ? userNameFromTone.replace(/\s+/g, " ").trim()
        : "";

    // Prefer toneContext name if present, else use stored preferred_name
    const finalName = toneName || preferredNameGlobal;

    const fallbackSummary = finalName
      ? `Feeling mostly ${summaryPrimaryEmotion} for ${finalName}.`
      : `Feeling mostly ${summaryPrimaryEmotion}.`;

    const emotion: EmotionAnalysis = normalizeEmotion(
      {
        primary: summaryPrimaryEmotion,
        intensity:
          summaryIntensity >= 0.7
            ? "high"
            : summaryIntensity >= 0.4
              ? "medium"
              : "low",
        confidence: 0.75,
        summary: fallbackSummary,
      },
      fallbackSummary,
    );

    (respObj as any).meta = {
      ...(respObj as any).meta,
      emotion,
      compatibility: {
        ...compatReport,
        summary: compatSummary,
      },
    };

    // Report-only server log (only when issues exist)
    // 🔇 Silence logs during tests + production
    if (SHOULD_LOG) {
      if (compatReport && (compatReport as any).ok === false) {
        // Report-only server log (only when issues exist) + request fingerprint (no message content)
        const fingerprintSource = `${req.headers.get("user-agent") || ""}|${req.headers.get("x-forwarded-for") || ""}|${Date.now()}`;

        const requestFingerprint = createHash("sha256")
          .update(fingerprintSource)
          .digest("hex")
          .slice(0, 12);

        console.warn("[compatibilityGate] NOT OK", {
          requestFingerprint,
          issues: (compatReport as any).issues,
        });
      } else if (
        compatReport &&
        Array.isArray((compatReport as any).issues) &&
        (compatReport as any).issues.length
      ) {
        console.warn("[compatibilityGate] Issues detected", {
          issues: (compatReport as any).issues,
        });
      }
    }

    // Public-release lock: never serialize debug/analysis extras in production unless QA header is present
    const qaHeader = req.headers.get("x-imotara-qa");
    const qa = qaHeader === "1" || qaHeader?.toLowerCase() === "true";
    const prod = process.env.NODE_ENV === "production";

    // Strip common debug keys deeply (defense-in-depth)
    const STRIP_KEYS = new Set([
      "debug",
      "trace",
      "traces",
      "raw",
      "prompt",
      "prompts",
      "systemPrompt",
      "messages",
      "inputMessages",
      "outputMessages",
      "tokens",
      "tokenUsage",
      "usage",
      "timings",
      "latencyMs",
      "model",
      "provider",
      "requestId",
      "internal",
    ]);

    function stripDeep(v: unknown): unknown {
      if (!v || typeof v !== "object") return v;
      if (Array.isArray(v)) return v.map(stripDeep);

      const obj = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(obj)) {
        if (STRIP_KEYS.has(k)) continue;
        if (k === "meta" && val && typeof val === "object") {
          // also ensure QA-only meta bits don't leak
          const m = { ...(val as Record<string, unknown>) };
          delete (m as Record<string, unknown>).softEnforcement;
          delete (m as Record<string, unknown>).debug;
          delete (m as Record<string, unknown>).trace;
          out[k] = stripDeep(m);
          continue;
        }
        out[k] = stripDeep(val);
      }
      return out;
    }

    // ✅ Baby Step 11.6.9 — merge analyze result + meta (do NOT replace analyze shape)

    // --- Debug-only: echo which response blueprint tone would be used ---
    const debugTone: ResponseTone = deriveResponseToneFromToneContext(
      body?.toneContext,
    );

    const debugBlueprint = getResponseBlueprint({ tone: debugTone });

    const metaMerged = {
      ...((respObj as any).meta ?? {}),
      // ✅ Debug echo (safe, additive)
      responseBlueprintTone: debugBlueprint.tone,
      responseBlueprintStructureLevel: debugBlueprint.structureLevel,
      responseBlueprintVersion: debugBlueprint.version,
    };

    const finalObj = {
      ...result, // ← keep full AnalysisResult
      meta: metaMerged,
    };

    const safeResult =
      prod && !qa ? (stripDeep(finalObj) as typeof finalObj) : finalObj;

    return NextResponse.json(safeResult, { status: 200 });
  } catch (err) {
    if (SHOULD_LOG) {
      console.warn("[imotara] /api/analyze POST failed:", String(err));
    }
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  // A friendly health/info response for browsers and simple checks.
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/analyze",
      methods: ["GET", "POST"],
      howToUse:
        'POST JSON: { "inputs": [{ "id": "m1", "text": "hello", "createdAt": 123 }], "options": { "windowSize": 25 } }',
      legacy:
        'Also accepts legacy POST JSON: { "text": "hello" } (will be converted to inputs[0]).',
      toneContext:
        'Optional: include "toneContext" to shape remote AI tone (localStorage is not accessible on server).',
    },
    { status: 200 },
  );
}

// Limit how much context we send to the LLM
const MAX_MESSAGES_FOR_AI = 25;
const MAX_COMBINED_CHARS = 6000;

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

// NEW: build server-safe prompt snippet from client-provided toneContext
function buildToneSnippetFromPayload(t?: ToneContextPayload): string {
  if (!t) return "";

  const userName = typeof t.user?.name === "string" ? t.user.name.trim() : "";
  const userAge = t.user?.ageRange;
  const userGender = t.user?.gender;

  const enabled = !!t.companion?.enabled;
  const compName =
    enabled && typeof t.companion?.name === "string"
      ? t.companion.name.trim()
      : "";
  const compAge = enabled ? t.companion?.ageRange : undefined;
  const compGender = enabled ? t.companion?.gender : undefined;
  const compRel = enabled ? t.companion?.relationship : undefined;

  const hasAny =
    !!userName ||
    (userAge && userAge !== "prefer_not") ||
    (userGender && userGender !== "prefer_not") ||
    (enabled &&
      (!!compName ||
        (compAge && compAge !== "prefer_not") ||
        (compGender && compGender !== "prefer_not") ||
        (compRel && compRel !== "prefer_not")));

  if (!hasAny) return "";

  const lines: string[] = [];
  lines.push(
    "Tone & Context Guidance (tone only; do NOT roleplay a real person):",
  );
  if (userName) lines.push(`- User name (optional): ${userName}`);
  if (userAge && userAge !== "prefer_not")
    lines.push(`- User age range: ${userAge}`);
  if (userGender && userGender !== "prefer_not")
    lines.push(`- User gender: ${userGender}`);

  if (enabled) {
    lines.push("- Preferred companion tone (wording guidance only):");
    if (compRel && compRel !== "prefer_not")
      lines.push(`  - Relationship vibe: ${compRel}`);
    if (compAge && compAge !== "prefer_not")
      lines.push(`  - Age tone: ${compAge}`);
    if (compGender && compGender !== "prefer_not")
      lines.push(`  - Gender tone: ${compGender}`);
    if (compName) lines.push(`  - Companion name (optional): ${compName}`);
    lines.push(
      "- Adjust warmth/directness/pacing accordingly, but avoid dependency cues.",
    );
  }

  lines.push(
    "- Never claim you are a parent/partner/friend/real person. You are Imotara: a reflective, privacy-first companion.",
  );

  // --- Anti-monotony variation (rotates by message count) ---
  const variation = [
    "Vary your openings. Avoid repeating the same follow-up question across turns.",
    "Be practical: give one concrete next step. Don’t ask multiple questions.",
    "Be reflective: mirror briefly, then ask one fresh, non-repeating question.",
    "Be direct and reassuring: answer first; ask only if needed.",
  ][Math.floor(Date.now() / 60000) % 4];

  lines.push(variation);
  lines.push(
    "Ask at most ONE question in this turn. If a question was already asked recently, answer directly without asking another.",
  );
  return lines.join("\n");
}

// --- Phase-2 (still v1): prompt + output humanization helpers (conservative) ---

function buildBlueprintGuidanceSnippet(bp: ResponseBlueprint): string {
  const lines: string[] = [];

  // Keep it short and safe—only the most relevant lines.
  if (bp.avoidHeadings) {
    lines.push("- Do not use headings or section labels.");
  }

  // If provided, include a compact subset of hard rules.
  if (Array.isArray(bp.hardRules) && bp.hardRules.length) {
    lines.push("- Response rules (follow closely):");
    for (const r of bp.hardRules.slice(0, 6)) lines.push(`  - ${r}`);
  }

  // Flow intent
  if (bp.flow) {
    lines.push(
      "- Flow intent: one flowing voice; weave empathy + meaning + one next move.",
    );
    lines.push(
      "- End with either one easy question OR one permission line (not both).",
    );
  }

  return lines.length ? lines.join("\n") : "";
}

function humanizeReflectionText(text: string, bp: ResponseBlueprint): string {
  // If no guidance, do nothing.
  if (!text || (!bp.avoidHeadings && !bp.flow && !bp.hardRules)) return text;

  let s = String(text).trim();
  if (!s) return s;

  // Normalize newlines
  s = s.replace(/\r\n/g, "\n");

  // Remove obvious heading-style lines (very conservative)
  // Examples: "Summary:", "Steps:", "Next steps:", "Reflection:"
  s = s
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (!bp.avoidHeadings) return true;
      return !/^(summary|steps?|next steps?|action steps?|reflection|analysis|takeaway|plan)\s*:/i.test(
        t,
      );
    })
    .join("\n")
    .trim();

  // Convert numbered/bulleted suggestions into ONE next move only.
  // If bullets exist, keep the first bullet content and rewrite lightly.
  const lines = s.split("\n").map((x) => x.trim());
  const bulletIdx = lines.findIndex((l) => /^([-*•]|(\d+[\).\]]))\s+/.test(l));
  if (bulletIdx !== -1) {
    const firstBullet = lines[bulletIdx]
      .replace(/^([-*•]|(\d+[\).\]]))\s+/, "")
      .trim();
    // Keep any text before bullets as context, but drop the rest of the bullet list.
    const before = lines.slice(0, bulletIdx).filter(Boolean).join(" ");
    const stitched = [before, firstBullet].filter(Boolean).join("\n\n").trim();
    s = stitched;
  }

  // Ensure the ending is either ONE question OR ONE permission line.
  // Strategy:
  // - If there are multiple questions, keep only the first question sentence.
  // - If there is a question AND a permission line at end, drop the permission line.
  // - If there is no question, allow one permission line; otherwise leave as-is.
  const sentenceSplit = s
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Extract all question sentences
  const allText = sentenceSplit.join(" ");
  const questionMatches: string[] = allText.match(/[^?]*\?/g) ?? [];
  const hasQuestion = questionMatches.length > 0;

  // Identify permission-ish closing line
  const permissionRegex =
    /\b(if you want|if you'd like|we can|we could|want me to|shall we)\b/i;

  if (hasQuestion) {
    const firstQ = questionMatches[0].trim();
    // Remove all question sentences from body, then append only firstQ
    let body = allText
      .replace(/[^?]*\?/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // If body ends with permission-like phrase, remove that trailing sentence fragment conservatively
    // (We only remove if it looks like a standalone permission sentence.)
    body = body
      .replace(
        /(?:\bif you want\b|\bif you'd like\b|\bwe can\b)[^.?!]*[.?!]\s*$/i,
        "",
      )
      .trim();

    s = [body, firstQ].filter(Boolean).join("\n\n").trim();
  } else {
    // No question: allow ONE permission line at the end if present; otherwise do nothing.
    // If multiple permission lines exist, keep only the last paragraph if it contains permission.
    if (sentenceSplit.length >= 2) {
      const last = sentenceSplit[sentenceSplit.length - 1];
      const prev = sentenceSplit[sentenceSplit.length - 2];
      const lastHasPermission = permissionRegex.test(last);
      const prevHasPermission = permissionRegex.test(prev);

      if (lastHasPermission && prevHasPermission) {
        // Drop the earlier permission paragraph
        const kept = sentenceSplit.slice(0, -2).concat(last);
        s = kept.join("\n\n").trim();
      }
    }
  }

  // Final tidy: avoid excessive length
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return s;
}

// Shape we *ask* the AI to return (JSON). Parsing is always defensive.
type ImotaraAIDeepInsight = {
  emotional_summary?: string;
  dominant_emotion?: string;
  intensity?: number; // 0–1
  secondary_emotions?: string[];
  reflection?: string;

  // NEW: reflection seed prompts for a separate UI card
  reflection_seeds?: string[]; // 0–2 short prompts

  safety_note?: string;
};

// NOTE (Option A): /api/analyze must return AnalysisResult (analysis/debug).
// The POST implementation for analysis is defined below.
