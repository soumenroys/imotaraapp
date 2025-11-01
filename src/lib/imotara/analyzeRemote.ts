// src/lib/imotara/analyzeRemote.ts
import type { AnalysisInput, AnalysisResult } from "@/types/analysis";
import { useEmotionHistory } from "@/store/emotionHistory";

// Reuse the same signature as the local analyzer
export type AnalyzeFn = (
  inputs: AnalysisInput[],
  options?: { windowSize?: number }
) => Promise<AnalysisResult>;

/**
 * analyzeRemote
 * Calls your Next.js API route at /api/analyze.
 * The API currently returns a neutral stub; later you’ll implement real logic there.
 */
export const analyzeRemote: AnalyzeFn = async (inputs, options) => {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // send both inputs and options (windowSize)
    body: JSON.stringify({ inputs, options }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Remote analyze failed: ${res.status} ${text}`);
  }

  // The API returns an AnalysisResult shape
  const data = (await res.json()) as AnalysisResult;

  // ✅ Log into Emotion History (store expects an array)
  try {
    useEmotionHistory.getState().bulkAdd([data]);
  } catch {
    // No-op: history is best-effort and should never break analysis flow
  }

  return data;
};
