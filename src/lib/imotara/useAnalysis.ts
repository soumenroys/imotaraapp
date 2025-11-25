// src/lib/imotara/useAnalysis.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisInput, AnalysisResult } from "@/types/analysis";
import { analyzeLocal } from "./analyzeLocal";
import { analyzeRemote } from "./analyzeRemote";

// Matches NEXT_PUBLIC_ env var values
export type AnalyzeMode = "local" | "api";

// Default comes from env, falls back to 'local'
const DEFAULT_MODE: AnalyzeMode =
  (process.env.NEXT_PUBLIC_IMOTARA_ANALYSIS as AnalyzeMode) === "api"
    ? "api"
    : "local";

/**
 * AppMessage: align with your chat message shape
 */
export type AppMessage = {
  id: string;
  content: string;
  createdAt: number; // epoch ms
  role: "user" | "assistant";
};

/**
 * Convert chat messages into AnalysisInput[] for analyzer backends.
 */
export function toAnalysisInputs(msgs: AppMessage[]): AnalysisInput[] {
  return msgs.map((m) => ({
    id: m.id,
    text: m.content,
    createdAt: m.createdAt,
    role: m.role,
  }));
}

/**
 * useAnalysis
 * - Chooses local or api analyzer based on `mode` (or env default).
 * - When mode === "api", it goes through /api/analyze (which is now AI-aware).
 * - When mode === "local", it uses purely client-side heuristics.
 *
 * The hook API is unchanged so existing consumers continue to work:
 *   const { result, loading, error, mode } = useAnalysis(messages);
 */
export function useAnalysis(
  messages: AppMessage[],
  windowSize = 10,
  mode: AnalyzeMode = DEFAULT_MODE
) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const inputs: AnalysisInput[] = useMemo(
    () => toAnalysisInputs(messages),
    [messages]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const runAnalyze = mode === "api" ? analyzeRemote : analyzeLocal;
        const out = await runAnalyze(inputs, { windowSize });

        if (!cancelled) {
          setResult(out);
          if (process.env.NODE_ENV !== "production") {
            console.log(`[imotara] ${mode} AnalysisResult:`, out);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (inputs.length) {
      // We have messages → run selected analyzer
      run();
    } else {
      // No messages: ensure we reset state cleanly
      setResult(null);
      setLoading(false);
      setError(null);
    }

    return () => {
      cancelled = true;
    };
  }, [inputs, windowSize, mode]);

  return { result, loading, error, mode };
}
