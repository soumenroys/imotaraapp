// src/lib/imotara/analyzeRemote.ts
//
// Remote analyzer for Imotara.
// Sends AnalysisInput[] to /api/analyze and expects an AnalysisResult.
// Now with stronger error handling, timeouts, and safe fallbacks —
// but with NO change to existing behavior or return values.

import type { AnalysisInput, AnalysisResult } from "@/types/analysis";
import { useEmotionHistory } from "@/store/emotionHistory";

export type AnalyzeFn = (
  inputs: AnalysisInput[],
  options?: { windowSize?: number }
) => Promise<AnalysisResult>;

// Small helper: timeout wrapper for fetch to avoid hanging requests
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * analyzeRemote
 * Calls your Next.js API route at /api/analyze.
 * Fully backward-compatible with the previous version.
 */
export const analyzeRemote: AnalyzeFn = async (inputs, options) => {
  let res: Response;

  try {
    res = await fetchWithTimeout(
      "/api/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs,
          options: { windowSize: options?.windowSize },
        }),
      },
      15000
    );
  } catch (err: any) {
    // Network failure, server crash, timeout, etc.
    throw new Error(
      `Remote analyze failed (network/timeout): ${err?.message || "unknown"}`
    );
  }

  if (!res.ok) {
    // Try reading text from the response for debugging
    let errText = "";
    try {
      errText = await res.text();
    } catch {
      errText = "";
    }
    throw new Error(`Remote analyze failed: ${res.status} ${errText}`);
  }

  let data: AnalysisResult;

  try {
    data = (await res.json()) as AnalysisResult;

    // Validate basic structure – if anything is off, throw early
    if (!data || typeof data !== "object") {
      throw new Error("Invalid JSON response (not an object)");
    }
    if (!data.summary || typeof data.summary !== "object") {
      throw new Error("Invalid JSON response: missing summary");
    }
    if (!data.perMessage || !Array.isArray(data.perMessage)) {
      throw new Error("Invalid JSON response: missing perMessage[]");
    }
  } catch (err: any) {
    throw new Error(
      `Remote analyze returned invalid JSON: ${err?.message || "unknown"}`
    );
  }

  // ------------------------------
  // Emotion History logging (safe)
  // ------------------------------
  try {
    useEmotionHistory.getState().bulkAdd([data]);
  } catch {
    // Best-effort only — must not break analysis flow
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[imotara] Remote analysis result:", data);
  }

  return data;
};
