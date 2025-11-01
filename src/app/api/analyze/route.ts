// src/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import type {
  AnalysisInput,
  AnalysisResult,
  Emotion,
  PerMessageAnalysis,
} from "@/types/analysis";

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
        headline: "Even and steady overall",
        details: "Remote analysis stub served by /api/analyze.",
      },
      reflections: [
        {
          text: "Backend stub active. Replace logic here to run your real model.",
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
