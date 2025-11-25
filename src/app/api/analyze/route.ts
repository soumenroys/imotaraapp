// src/app/api/analyze/route.ts
//
// Remote analysis endpoint for Imotara.
// ORIGINAL BEHAVIOUR:
// - Accepts { inputs: AnalysisInput[], options?: { windowSize?: number } }
// - Returns an AnalysisResult with neutral baseline analysis.
//
// ENHANCEMENT (Step 21 – AI Engine Integration):
// - Still returns the same AnalysisResult shape.
// - Optionally enriches the summary + reflections using Imotara's AI engine
//   via `callImotaraAI`, while preserving safe fallbacks if AI is disabled.

import { NextResponse } from "next/server";
import type {
  AnalysisInput,
  AnalysisResult,
  Emotion,
  PerMessageAnalysis,
} from "@/types/analysis";
import { callImotaraAI } from "@/lib/imotara/aiClient";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      inputs: AnalysisInput[];
      options?: { windowSize?: number };
    };

    const now = Date.now();
    const inputs = Array.isArray(body?.inputs) ? body.inputs : [];
    const neutralEmotion: Emotion = "neutral";

    const neutralTag = {
      emotion: neutralEmotion,
      intensity: 0.2,
      source: "model" as const,
    };

    const perMessage: PerMessageAnalysis[] = inputs.map((m) => ({
      id: m.id,
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

    // ---------------------------------------------------------
    // Optional AI enrichment: only if an AI key is configured.
    // If AI is disabled or fails, the above stub texts remain.
    // ---------------------------------------------------------
    try {
      // Combine recent user-visible text into one prompt string
      const combinedText = inputs
        .map((m) => {
          const t = (m as any).text ?? (m as any).content ?? "";
          return typeof t === "string" ? t.trim() : "";
        })
        .filter(Boolean)
        .join("\n");

      if (combinedText) {
        const ai = await callImotaraAI(
          [
            "You are Imotara, a calm, supportive emotional companion.",
            "The following are recent messages from the user.",
            "",
            combinedText,
            "",
            "1) Give a brief 1-line emotional summary (no more than 18 words).",
            "2) Then in a new line, give a gentle reflection or suggestion in 1–2 sentences.",
          ].join("\n"),
          {
            maxTokens: 260,
            temperature: 0.7,
          }
        );

        if (ai?.meta?.from === "openai") {
          // Use the AI response primarily for reflections.
          reflectionText = ai.text || reflectionText;

          // Keep headline simple but mark that AI was involved.
          summaryHeadline = "AI emotional insight";
          summaryDetails =
            "This summary and reflection were enriched by Imotara's AI engine.";
        }
        // If ai.meta.from is "disabled", "error", or "fallback",
        // we keep the original stub text to avoid surprises.
      }
    } catch (aiErr) {
      // We log errors, but never break the original behaviour.
      console.error("[/api/analyze] AI enrichment error:", aiErr);
    }

    const result: AnalysisResult = {
      perMessage,
      snapshot: {
        window: {
          from: inputs[0]?.createdAt ?? now,
          to: inputs[inputs.length - 1]?.createdAt ?? now,
        },
        averages: { neutral: 0.2 },
        dominant: neutralEmotion,
      },
      summary: {
        headline: summaryHeadline,
        details: summaryDetails,
      },
      reflections: [
        {
          text: reflectionText,
          createdAt: now,
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
