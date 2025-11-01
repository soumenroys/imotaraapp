// src/lib/imotara/useLocalAnalysis.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeLocal } from "./analyzeLocal";
import type {
  AnalysisInput,
  AnalysisResult,
} from "@/types/analysis";

/**
 * Helper: map your app's Message shape -> AnalysisInput.
 * Adjust the field names below to match your actual message model.
 */
export type AppMessage = {
  id: string;
  content: string;        // ← rename if your field is 'text'
  createdAt: number;      // epoch ms
  role: "user" | "assistant";
};

export function toAnalysisInputs(msgs: AppMessage[]): AnalysisInput[] {
  return msgs.map((m) => ({
    id: m.id,
    text: m.content,       // ← change if your field is different
    createdAt: m.createdAt,
    role: m.role,
  }));
}

/**
 * useLocalAnalysis
 * - Runs analyzeLocal() whenever messages change.
 * - No UI changes; you can console.log for now.
 */
export function useLocalAnalysis(messages: AppMessage[], windowSize = 10) {
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
        const out = await analyzeLocal(inputs, { windowSize });
        if (!cancelled) {
          setResult(out);
          // Dev-only: inspect in console (safe, no UI change)
          if (process.env.NODE_ENV !== "production") {
            // You can comment these out later
            console.log("[imotara] local AnalysisResult:", out);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (inputs.length) run();
    else setResult(null);

    return () => { cancelled = true; };
  }, [inputs, windowSize]);

  return { result, loading, error };
}
