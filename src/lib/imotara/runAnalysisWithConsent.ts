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

export type AnalysisEngineImpl = "local" | "api";

/**
 * Resolve engine implementation from environment.
 * Anything other than explicit "api" is treated as "local".
 *
 * This keeps behavior identical to before, but makes the intent explicit.
 */
function resolveEngineImplFromEnv(): AnalysisEngineImpl {
  const raw = process.env.NEXT_PUBLIC_IMOTARA_ANALYSIS;
  return raw === "api" ? "api" : "local";
}

// Build-time analysis implementation ("local" | "api")
const ENGINE_IMPL: AnalysisEngineImpl = resolveEngineImplFromEnv();

// 🔒 In-flight dedupe: prevents duplicate /api/analyze requests in dev
// (e.g., React dev replay / rapid state changes).
const inflightByKey = new Map<string, Promise<AnalysisResult>>();

// Tiny short-lived cache to avoid re-fetching when the same key resolves twice quickly.
const recentByKey = new Map<string, { at: number; result: AnalysisResult }>();
const RECENT_TTL_MS = 1500;

function buildAnalysisKey(inputs: GenericInput[], windowSize: number): string {
  const last = inputs?.[inputs.length - 1] ?? null;
  const id = String((last as any)?.id ?? "");
  const createdAt = String((last as any)?.createdAt ?? "");
  const role = String((last as any)?.role ?? "");
  const text = String((last as any)?.content ?? "").slice(0, 120);
  return [
    `len=${inputs?.length ?? 0}`,
    `w=${windowSize}`,
    role,
    id,
    createdAt,
    text,
  ].join("|");
}

export type RunAnalysisWithConsentOptions = {
  /**
   * Optional override for engine mode, useful for debugging or
   * feature flags. If not provided, we use the build-time engine.
   *
   * NOTE: This is not used anywhere yet in the app, so the
   * runtime behavior for existing callers remains unchanged.
   */
  forceEngine?: AnalysisEngineImpl;
};

// Inputs are loosely typed (AppMessage[] or Message[] or similar)
type GenericInput = any;

/**
 * Central analysis entrypoint used by the Chat page.
 * - Always computes a local baseline result.
 * - Optionally augments with remote AI if both:
 *     • user has allowed remote analysis, and
 *     • build-time engine mode is "api".
 */
export async function runAnalysisWithConsent(
  inputs: GenericInput[],
  windowSize = 10,
  options?: RunAnalysisWithConsentOptions,
): Promise<AnalysisResult> {
  // Build a stable key early so we can dedupe even before doing work.
  const key = buildAnalysisKey(inputs ?? [], windowSize);

  // 0) Very short-lived cache (prevents re-fetch if same key resolves twice quickly)
  const cached = recentByKey.get(key);
  if (cached && Date.now() - cached.at < RECENT_TTL_MS) {
    return cached.result;
  }

  // 0.1) In-flight dedupe: if same key already running, reuse it (no 2nd network call)
  const existing = inflightByKey.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<AnalysisResult> => {
    // 1) Always compute local baseline (safe and offline)
    const localResult = await runLocalAnalysis(inputs as any, windowSize);

    // Short-circuit: nothing to analyze → no need to hit remote
    if (!inputs || inputs.length === 0) {
      if (typeof window !== "undefined") {
        console.debug(
          "[imotara] runAnalysisWithConsent → no inputs; returning LOCAL baseline only.",
        );
      }
      return localResult;
    }

    // 2) Check if user allows remote AI (browser-only)
    const isBrowser = typeof window !== "undefined";
    const userAllowsRemote = isBrowser && hasAllowedRemoteAnalysis();

    // 3) Determine engine mode (build-time, optionally overridden for debug)
    const effectiveEngine: AnalysisEngineImpl =
      options?.forceEngine ?? ENGINE_IMPL;
    const apiEnabled = effectiveEngine === "api";

    // If either (user disallows) OR (engine is local-only) → return local
    if (!userAllowsRemote || !apiEnabled) {
      if (!userAllowsRemote) {
        console.debug(
          "[imotara] runAnalysisWithConsent → using LOCAL only (user did not allow remote).",
        );
      } else if (!apiEnabled) {
        console.debug(
          "[imotara] runAnalysisWithConsent → using LOCAL only (ENGINE_IMPL != 'api').",
        );
      }
      return localResult;
    }

    // 4) Attempt remote analysis (Cloud AI via /api/analyze)
    try {
      console.debug(
        "[imotara] runAnalysisWithConsent → attempting REMOTE analysis via analyzeRemote...",
      );

      const remoteResult = await analyzeRemote(inputs as any, { windowSize });

      if (!remoteResult) {
        console.warn(
          "[imotara] analyzeRemote returned null/undefined. Falling back to local result.",
        );
        return localResult;
      }

      return remoteResult as AnalysisResult;
    } catch (err) {
      console.error(
        "[imotara] Remote analysis failed, falling back to local:",
        err,
      );
      return localResult;
    }
  })();

  inflightByKey.set(key, promise);

  try {
    const result = await promise;
    recentByKey.set(key, { at: Date.now(), result });
    return result;
  } finally {
    inflightByKey.delete(key);
  }
}
