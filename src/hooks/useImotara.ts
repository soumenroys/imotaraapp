"use client";
import { analyzeMessage } from "@/lib/imotara/analyze";  // ← named import
import { generateReflection } from "@/lib/imotara/simulate"; // ← correct path
import type { MessageMeta } from "@/types/chat";

export function useImotaraEngine() {
  function enrich(text: string): MessageMeta {
    const analysis = analyzeMessage(text);
    const reflection = generateReflection(analysis);
    return {
      sentiment: analysis.sentiment,
      emotions: analysis.emotions,
      tones: analysis.tones,
      confidence: analysis.confidence,
      reflection,
    };
  }
  return { enrich };
}
