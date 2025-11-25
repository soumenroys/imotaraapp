// src/lib/imotara/runAnalysisWithConsent.ts
//
// Single entry point for chat emotion analysis that respects:
//   - Build-time engine mode (local vs api)
//   - User consent: "local-only" vs "allow-remote"
//
// Final behavior:
//   • Always compute a local baseline (offline-friendly, safe).
//   • If user allows remote AND the build is API-enabled,
//       attempt remote analysis via /api/analyze.
//   • If remote fails → fallback to localResult (no crash).
//
// 100% backward compatible.

import type { AnalysisResult } from "@/types/analysis";
import { runLocalAnalysis } from "@/lib/imotara/runLocalAnalysis";
import { hasAllowedRemoteAnalysis } from "@/lib/imotara/consent";
import { analyzeRemote } from "@/lib/imotara/analyzeRemote";

// Build-time analysis implementation ("local" | "api")
const ENGINE_IMPL: "local" | "api" =
    (process.env.NEXT_PUBLIC_IMOTARA_ANALYSIS as "local" | "api") === "api"
        ? "api"
        : "local";

// Inputs are loosely typed (AppMessage[] or Message[])
export async function runAnalysisWithConsent(
    inputs: any[],
    windowSize = 10
): Promise<AnalysisResult> {
    // 1) Always compute local baseline (safe and offline)
    const localResult = await runLocalAnalysis(inputs as any, windowSize);

    // 2) Check if user allows remote AI
    const userAllowsRemote =
        typeof window !== "undefined" && hasAllowedRemoteAnalysis();

    // 3) Check if engine build supports API
    const apiEnabled = ENGINE_IMPL === "api";

    // If either (user disallows) OR (engine is local-only) → return local
    if (!userAllowsRemote || !apiEnabled) {
        return localResult;
    }

    // 4) Attempt remote analysis (Cloud AI)
    try {
        const remoteResult = await analyzeRemote(inputs as any, { windowSize });

        // IMPORTANT:
        // remoteResult must match AnalysisResult. /api/analyze now always returns
        // a proper structure (AI-enriched summary + reflections), with graceful fallback.
        return remoteResult;
    } catch (err) {
        console.error("[imotara] Remote analysis failed, falling back to local:", err);
        // Fallback quietly to local
        return localResult;
    }
}
