// src/lib/imotara/runAnalysisWithConsent.ts
//
// Single entry-point for chat emotion analysis that respects the
// user's consent choice:
//
//   - "local-only"   → keep everything on-device
//   - "allow-remote" → later we may call the backend/API
//
// For now, both modes still run the same local analysis, but the
// consent check is centralized here so wiring remote will be trivial.

import type { AnalysisResult } from "@/types/analysis";
import { runLocalAnalysis } from "@/lib/imotara/runLocalAnalysis";
import { hasAllowedRemoteAnalysis } from "@/lib/imotara/consent";
// In a later step we may use this:
// import { analyzeRemote } from "@/lib/imotara/analyzeRemote";

// We intentionally keep the inputs as `any[]` so both Message[] and
// AppMessage[] can be passed without fighting TS in older code paths.
export async function runAnalysisWithConsent(
    inputs: any[],
    windowSize = 10
): Promise<AnalysisResult> {
    // Always compute a local baseline first (safest + offline-friendly).
    const localResult = await runLocalAnalysis(inputs as any, windowSize);

    // Check whether the user has allowed remote analysis.
    const remoteAllowed =
        typeof window !== "undefined" && hasAllowedRemoteAnalysis();

    if (!remoteAllowed) {
        // Strict local-only mode.
        return localResult;
    }

    // 🔜 In a later step, we may:
    //  - call analyzeRemote(inputs, { windowSize })
    //  - blend/fallback with `localResult`
    //
    // For Step 18, we still keep behavior identical and return local.
    return localResult;
}
