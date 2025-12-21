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

import { NextResponse } from "next/server";
import type {
  AnalysisInput,
  AnalysisResult,
  Emotion,
  PerMessageAnalysis,
} from "@/types/analysis";
import { callImotaraAI } from "@/lib/imotara/aiClient";

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

  // Legacy contract (some callers still send { text: "..." })
  text?: string;
  id?: string;
  createdAt?: number;
};

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
    },
    { status: 200 }
  );
}

// Limit how much context we send to the LLM
const MAX_MESSAGES_FOR_AI = 25;
const MAX_COMBINED_CHARS = 6000;

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

// Shape we *ask* the AI to return (JSON). Parsing is always defensive.
type ImotaraAIDeepInsight = {
  emotional_summary?: string;
  dominant_emotion?: string;
  intensity?: number; // 0–1
  secondary_emotions?: string[];
  reflection?: string;
  safety_note?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody | null;

    const now = Date.now();

    // -----------------------------
    // Inputs: support both contracts
    // -----------------------------
    const rawInputs = Array.isArray(body?.inputs) ? body!.inputs : [];
    let inputs: AnalysisInput[] = rawInputs.filter(Boolean);

    // Legacy: if inputs is empty but text exists, convert it to a single input
    if (inputs.length === 0) {
      const maybeText = typeof body?.text === "string" ? body.text.trim() : "";
      if (maybeText) {
        const legacyId =
          typeof body?.id === "string" && body.id.trim()
            ? body.id.trim()
            : `legacy-${now}`;
        const legacyCreatedAt =
          typeof body?.createdAt === "number" && Number.isFinite(body.createdAt)
            ? body.createdAt
            : now;

        // We keep this permissive to avoid breaking if AnalysisInput shape evolves.
        inputs = [
          {
            id: legacyId,
            // common field names used across the app
            text: maybeText,
            content: maybeText,
            createdAt: legacyCreatedAt,
          } as any as AnalysisInput,
        ];
      }
    }

    const neutralEmotion: Emotion = "neutral";

    const neutralTag = {
      emotion: neutralEmotion,
      intensity: 0.2,
      source: "model" as const,
    };

    // If there are no usable inputs at all, return a neutral baseline
    if (inputs.length === 0) {
      const result: AnalysisResult = {
        perMessage: [],
        snapshot: {
          window: { from: now, to: now },
          averages: { neutral: 0.2 },
          dominant: neutralEmotion,
        },
        summary: {
          headline: "Even and steady overall",
          details: "Remote analysis stub served by /api/analyze.",
        },
        reflections: [
          {
            text: "No messages were provided, so this is a neutral baseline.",
            createdAt: now,
            relatedIds: [],
          },
        ],
        computedAt: now,
      };

      return NextResponse.json(result, { status: 200 });
    }

    /**
     * windowInputs: the subset of inputs used for the aggregate snapshot
     * and AI context. If windowSize is provided (>0), we look at only the
     * most recent N; otherwise we use all inputs.
     *
     * Per-message analysis below still covers ALL inputs for backward
     * compatibility.
     */
    const rawWindowSize = body?.options?.windowSize;
    const windowSize =
      typeof rawWindowSize === "number" && Number.isFinite(rawWindowSize)
        ? Math.max(0, Math.floor(rawWindowSize))
        : 0;

    const windowInputs =
      windowSize > 0
        ? inputs.slice(-Math.min(windowSize, inputs.length))
        : inputs;

    const perMessage: PerMessageAnalysis[] = inputs.map((m) => ({
      id: (m as any).id,
      dominant: neutralTag,
      all: [neutralTag],
      heuristics: { polarity: 0 },
    }));

    // ------------------------------
    // Base (original) summary values
    // ------------------------------
    let summaryHeadline = "Even and steady overall";
    let summaryDetails = "Remote analysis stub served by /api/analyze.";
    let reflectionText =
      "Backend stub active. Replace logic here to run your real model.";

    // NEW: snapshot emotion fields, defaulting to neutral
    let snapshotDominant: Emotion = neutralEmotion;
    let snapshotAverages: Record<string, number> = { neutral: 0.2 };

    // ---------------------------------------------------------
    // Optional AI enrichment: only if an AI key is configured.
    // If AI is disabled or fails, the above stub texts remain.
    // ---------------------------------------------------------
    try {
      // Take only the most recent messages for AI context, within the
      // chosen window and capped by MAX_MESSAGES_FOR_AI.
      const recent = windowInputs.slice(-MAX_MESSAGES_FOR_AI);

      // Combine recent user-visible text into one prompt string,
      // while respecting a max character budget.
      let combinedText = recent
        .map((m) => {
          const maybeText =
            (m as any).text ?? (m as any).content ?? (m as any).message ?? "";
          const t = typeof maybeText === "string" ? maybeText.trim() : "";
          return t;
        })
        .filter(Boolean)
        .join("\n");

      if (combinedText.length > MAX_COMBINED_CHARS) {
        combinedText = combinedText.slice(-MAX_COMBINED_CHARS);
      }

      if (!combinedText) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[/api/analyze] No usable text from inputs; skipping AI enrichment."
          );
        }
      } else {
        // Ask the AI for a *structured* emotional profile.
        const prompt = [
          "You are Imotara, a calm, supportive emotional companion.",
          "You respond with warmth, validation, and gentle guidance.",
          "",
          "The following are recent messages from the user (most recent at the end):",
          "",
          combinedText,
          "",
          "Using ONLY the information above, analyse how the user is likely feeling.",
          "Return STRICT JSON with this shape (no extra keys, no comments, no markdown):",
          "",
          "{",
          '  "emotional_summary": string, // <= 18 words',
          '  "dominant_emotion": string, // e.g. "sad", "anxious", "hopeful", "angry", "mixed", "neutral"',
          '  "intensity": number,        // 0.0–1.0, how strong the feeling seems overall',
          '  "secondary_emotions": string[],',
          '  "reflection": string,       // 1–3 sentences, gentle supportive response',
          '  "safety_note": string       // empty string if no specific safety concern',
          "}",
          "",
          "Rules:",
          "- Do NOT include any text before or after the JSON.",
          "- Do NOT give medical or crisis advice.",
          "- Avoid clinical wording; sound like a kind, grounded friend.",
        ].join("\n");

        const ai = await callImotaraAI(prompt, {
          maxTokens: 260,
          temperature: 0.7,
        });

        if (process.env.NODE_ENV !== "production") {
          try {
            console.log("[/api/analyze] AI meta:", ai?.meta);
          } catch {
            // ignore logging issues
          }
        }

        if (ai?.meta?.from === "openai" && ai.text) {
          // Try to parse the JSON. If it fails, we gracefully fall back
          // to using the raw text as a reflection.
          let parsed: ImotaraAIDeepInsight | null = null;
          try {
            parsed = JSON.parse(ai.text) as ImotaraAIDeepInsight;
          } catch (e) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                "[/api/analyze] Failed to parse AI JSON; using raw text as reflection.",
                e
              );
            }
          }

          if (parsed) {
            const trimmedSummary =
              typeof parsed.emotional_summary === "string"
                ? parsed.emotional_summary.trim()
                : "";

            const trimmedReflection =
              typeof parsed.reflection === "string"
                ? parsed.reflection.trim()
                : "";

            const safetyNote =
              typeof parsed.safety_note === "string"
                ? parsed.safety_note.trim()
                : "";

            // Use AI summary if available; otherwise keep default headline.
            if (trimmedSummary) {
              summaryHeadline = trimmedSummary.slice(0, 140);
            } else {
              summaryHeadline = "AI emotional insight";
            }

            // Keep a concise details line; append safety note if present.
            summaryDetails =
              "This summary and reflection were enriched by Imotara's AI engine.";
            if (safetyNote) {
              summaryDetails += " Note: " + safetyNote;
            }

            // Use AI reflection if available; else fallback to raw AI text.
            if (trimmedReflection) {
              reflectionText = trimmedReflection;
            } else {
              reflectionText = ai.text;
            }

            // NEW: map dominant_emotion + intensity into snapshot.* if present
            const dominantRaw =
              typeof parsed.dominant_emotion === "string"
                ? parsed.dominant_emotion.trim().toLowerCase()
                : "";

            // Simple normalization map → Emotion
            const dominantMap: Record<string, Emotion> = {
              sad: "sad" as Emotion,
              sadness: "sad" as Emotion,
              anxious: "anxious" as Emotion,
              anxiety: "anxious" as Emotion,
              worried: "anxious" as Emotion,
              angry: "angry" as Emotion,
              anger: "angry" as Emotion,
              stressed: "stressed" as Emotion,
              overwhelm: "stressed" as Emotion,
              overwhelmed: "stressed" as Emotion,
              happy: "happy" as Emotion,
              joy: "happy" as Emotion,
              joyful: "happy" as Emotion,
              lonely: "lonely" as Emotion,
              isolation: "lonely" as Emotion,
              neutral: "neutral" as Emotion,
              mixed: "neutral" as Emotion,
              even: "neutral" as Emotion,
              balanced: "neutral" as Emotion,
            };

            const mappedDominant = dominantMap[dominantRaw] ?? neutralEmotion;
            snapshotDominant = mappedDominant;

            const rawIntensity = parsed.intensity;
            const intensity =
              typeof rawIntensity === "number"
                ? Math.min(1, Math.max(0, rawIntensity))
                : 0.4;

            // Build a simple averages map:
            // - main emotion gets "intensity"
            // - neutral gets the remaining "calm" space if dominant isn't neutral
            snapshotAverages = { [snapshotDominant]: intensity };
            if (snapshotDominant !== "neutral") {
              snapshotAverages.neutral = Math.max(0, 1 - intensity);
            }
          } else {
            // Parsed JSON missing -> treat AI text as a direct reflection.
            summaryHeadline = "AI emotional insight";
            summaryDetails =
              "This summary and reflection were enriched by Imotara's AI engine.";
            reflectionText = ai.text;
          }
        } else if (process.env.NODE_ENV !== "production") {
          try {
            console.warn(
              "[/api/analyze] AI not used, falling back to stub. from=",
              ai?.meta?.from,
              "reason=",
              ai?.meta?.reason
            );
          } catch {
            // ignore logging issues
          }
        }
      }
    } catch (aiErr) {
      // We log errors, but never break the original behaviour.
      console.error("[/api/analyze] AI enrichment error:", aiErr);
    }

    const firstCreated = (windowInputs[0] as any)?.createdAt;
    const lastCreated = (windowInputs[windowInputs.length - 1] as any)?.createdAt;

    const result: AnalysisResult = {
      perMessage,
      snapshot: {
        window: {
          from: safeNumber(firstCreated, now),
          to: safeNumber(lastCreated, now),
        },
        averages: snapshotAverages,
        dominant: snapshotDominant,
      },
      summary: {
        headline: summaryHeadline,
        details: summaryDetails,
      },
      reflections: [
        {
          text: reflectionText,
          createdAt: now,
          // last message in the *full* list, to keep behaviour consistent
          relatedIds: perMessage.slice(-1).map((x) => x.id),
        },
      ],
      computedAt: now,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[/api/analyze] error:", err);
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 }
    );
  }
}
