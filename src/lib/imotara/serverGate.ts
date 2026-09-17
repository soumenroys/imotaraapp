// src/lib/imotara/serverGate.ts
// Server-side feature gate enforcement utility.
// Only enforces when NEXT_PUBLIC_IMOTARA_LICENSE_MODE=enforce.
// In "off" or "log" mode, all checks pass (soft launch behaviour preserved).

import { NextRequest, NextResponse } from "next/server";
import { getLicenseMode } from "@/lib/imotara/license";
import { gate, type FeatureKey } from "@/lib/imotara/featureGates";
import { resolveUserTier } from "@/lib/imotara/org";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { TIER_RANK, isLicenseTier, normaliseTier, type LicenseTier } from "@/types/license";

export type ServerGateResult =
  | { ok: true;  tier: LicenseTier; userId: string | null }
  | { ok: false; response: NextResponse };

// History retention days per tier (must mirror featureGates.ts HISTORY_DAYS)
export const HISTORY_RETENTION_DAYS: Record<string, number> = {
  free: 7, plus: Infinity, family: Infinity, edu: Infinity, enterprise: Infinity,
};

/**
 * Resolves the current user's effective tier from the request.
 * Accepts Bearer token (mobile) or cookie session (web).
 * Returns null userId for unauthenticated requests.
 */
export async function resolveRequestTier(req: NextRequest): Promise<{
  userId: string | null;
  tier:   LicenseTier;
}> {
  let userId: string | null = null;

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await getSupabaseAdmin().auth.getUser(bearer);
    userId = data?.user?.id ?? null;
  }

  if (!userId) {
    try {
      const supabase = await getSupabaseUserServerClient();
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch { /* cookie not available in some contexts */ }
  }

  if (!userId) return { userId: null, tier: "free" };

  const tierResult = await resolveUserTier(userId);
  // normaliseTier, not a cast: the RPC returns a plain string and a legacy
  // `pro` cast to LicenseTier would type-check and then gate nothing.
  const tier = normaliseTier(tierResult.ok ? tierResult.data.effectiveTier : "free");
  return { userId, tier };
}

/**
 * Gate check for a specific feature.
 * - In "off" or "log" mode: always passes, no 403.
 * - In "enforce" mode: returns 403 response if tier lacks the feature.
 *
 * Usage in an API route:
 *   const gate = await requireFeature(req, "EXPORT_DATA");
 *   if (!gate.ok) return gate.response;
 */
export async function requireFeature(
  req:     NextRequest,
  feature: FeatureKey,
): Promise<ServerGateResult> {
  const mode = getLicenseMode();
  const { userId, tier } = await resolveRequestTier(req);

  if (mode !== "enforce") {
    // Off / log mode — pass through, never block
    return { ok: true, tier, userId };
  }

  const result = gate(feature, tier);
  if (!result.enabled) {
    return {
      ok:       false,
      response: NextResponse.json(
        { error: result.reason, feature, tier, required: "upgrade" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, tier, userId };
}

/**
 * Returns the history cutoff Date for a given tier.
 * Free → 7 days ago, Plus → 90 days ago, Pro+ → epoch (no cutoff).
 */
export function historyRetentionCutoff(tier: LicenseTier): Date | null {
  const days = HISTORY_RETENTION_DAYS[tier] ?? 7;
  if (!isFinite(days)) return null; // no cutoff
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Returns true if tierA is at least as high as tierB in the licensing hierarchy.
 */
export function tierAtLeast(tierA: string, tierB: string): boolean {
  // Unknown tiers rank 0, exactly as the previous `?? 0` did.
  const rank = (t: string) => (isLicenseTier(t) ? TIER_RANK[t] : 0);
  return rank(tierA) >= rank(tierB);
}
