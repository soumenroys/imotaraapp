// src/lib/imotara/featureGates.ts
// Web feature gate system — mirrors mobile src/licensing/featureGates.ts
// Uses web tier names (lowercase) from src/types/license.ts

import type { LicenseTier } from "@/types/license";

export type FeatureKey =
    | "CLOUD_SYNC"
    | "HISTORY_UNLIMITED"
    | "HISTORY_DAYS_LIMIT"
    | "TRENDS_INSIGHTS"
    | "EXPORT_DATA"
    | "MULTI_PROFILE"
    | "CHILD_SAFE_MODE"
    | "ADMIN_DASHBOARD";

export type FeatureGateResult =
    | { enabled: false; reason: string }
    | { enabled: true; params?: Record<string, unknown> };

// History days per tier — matches upgrade page copy
const HISTORY_DAYS: Record<LicenseTier, number> = {
    free:   7,
    plus:   90,
    pro:    Infinity,
    family: Infinity,
};

// Per-tier feature sets — only list what each tier unlocks
const TIER_FEATURES: Record<LicenseTier, Set<FeatureKey>> = {
    free: new Set<FeatureKey>([
        // Core functionality is ungated. Only truly premium things go here.
    ]),
    plus: new Set<FeatureKey>([
        "CLOUD_SYNC",
    ]),
    pro: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "EXPORT_DATA",
    ]),
    family: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "MULTI_PROFILE",
        "CHILD_SAFE_MODE",
        // Export intentionally off for Family (privacy boundary — shared device)
    ]),
};

/**
 * Central feature gate resolver.
 * Always call this rather than sprinkling `tier === ...` checks around the app.
 */
export function gate(
    feature: FeatureKey,
    tier: LicenseTier | undefined | null,
): FeatureGateResult {
    const t: LicenseTier = tier ?? "free";

    // Parameterized gate: history day limit
    if (feature === "HISTORY_DAYS_LIMIT") {
        return { enabled: true, params: { days: HISTORY_DAYS[t] } };
    }

    const enabled = TIER_FEATURES[t]?.has(feature) ?? false;
    if (!enabled) {
        return { enabled: false, reason: reasonFor(feature, t) };
    }
    return { enabled: true };
}

export function isEnabled(
    feature: FeatureKey,
    tier: LicenseTier | undefined | null,
): boolean {
    return gate(feature, tier).enabled;
}

export function getParam<T = unknown>(
    feature: FeatureKey,
    tier: LicenseTier | undefined | null,
    key: string,
): T | undefined {
    const g = gate(feature, tier);
    if (!g.enabled) return undefined;
    return (g.params?.[key] as T | undefined) ?? undefined;
}

function reasonFor(feature: FeatureKey, _tier: LicenseTier): string {
    switch (feature) {
        case "CLOUD_SYNC":        return "Cloud sync is available on Plus and above.";
        case "HISTORY_UNLIMITED": return "Unlimited history is available on Pro.";
        case "TRENDS_INSIGHTS":   return "Emotion insights are available on Pro.";
        case "EXPORT_DATA":       return "Data export is available on Pro.";
        case "MULTI_PROFILE":     return "Multiple profiles are available with the Family plan.";
        case "CHILD_SAFE_MODE":   return "Child-safe mode is available with the Family plan.";
        case "ADMIN_DASHBOARD":   return "Admin tools are available on institutional plans.";
        default:                  return "This feature is not available on your current plan.";
    }
}
