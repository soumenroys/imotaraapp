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
    | "ADMIN_DASHBOARD"
    // Plus+ features
    | "TTS_ADVANCED"       // TTS voice selection, rate/pitch control, Azure Neural
    | "SEARCH_MODE"        // Exact / semantic search mode toggle in history
    | "REPLY_CADENCE"      // Arc & companion-letter cadence controls
    // Pro+ features
    | "COMPANION_LETTER"   // Monthly AI-written letter from the companion
    | "GROWTH_ARC";        // Long-term emotional growth arc narrative

export type FeatureGateResult =
    | { enabled: false; reason: string }
    | { enabled: true; params?: Record<string, unknown> };

// History days per tier — matches upgrade page copy
const HISTORY_DAYS: Record<LicenseTier, number> = {
    free:       7,
    plus:       90,
    pro:        Infinity,
    family:     Infinity,
    edu:        Infinity,
    enterprise: Infinity,
};

// Per-tier feature sets — only list what each tier unlocks
const TIER_FEATURES: Record<LicenseTier, Set<FeatureKey>> = {
    free: new Set<FeatureKey>([
        "CLOUD_SYNC",
        // Server enforces 10 replies/day quota. History capped at 7 days.
    ]),
    plus: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "EXPORT_DATA",
        "TTS_ADVANCED",  // Azure Neural TTS, voice selection, rate/pitch control
        "SEARCH_MODE",   // Exact / semantic history search toggle
        "REPLY_CADENCE", // Arc & companion-letter cadence pickers
        // 90-day history; HISTORY_UNLIMITED intentionally absent.
        // TRENDS_INSIGHTS / COMPANION_LETTER / GROWTH_ARC available on Pro and above.
    ]),
    pro: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "EXPORT_DATA",
        "TTS_ADVANCED",
        "SEARCH_MODE",
        "REPLY_CADENCE",
        "COMPANION_LETTER", // Monthly AI-written letter
        "GROWTH_ARC",       // Long-term emotional growth arc narrative
    ]),
    family: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "MULTI_PROFILE",
        "CHILD_SAFE_MODE",
        "TTS_ADVANCED",
        "SEARCH_MODE",
        "REPLY_CADENCE",
        "COMPANION_LETTER",
        "GROWTH_ARC",
        // Export intentionally off for Family (privacy boundary — shared device)
    ]),
    edu: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",  // Aggregated/anonymised for admins; individual analytics off
        "ADMIN_DASHBOARD",
        "CHILD_SAFE_MODE",
        "TTS_ADVANCED",
        "SEARCH_MODE",
        "REPLY_CADENCE",
        // Individual export off; bulk anonymised export via admin panel only.
        // COMPANION_LETTER / GROWTH_ARC off — individual narrative features not suited to EDU.
    ]),
    enterprise: new Set<FeatureKey>([
        "CLOUD_SYNC",
        "HISTORY_UNLIMITED",
        "TRENDS_INSIGHTS",
        "EXPORT_DATA",
        "ADMIN_DASHBOARD",
        "CHILD_SAFE_MODE",
        "MULTI_PROFILE",
        "TTS_ADVANCED",
        "SEARCH_MODE",
        "REPLY_CADENCE",
        "COMPANION_LETTER",
        "GROWTH_ARC",
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
        case "EXPORT_DATA":       return "Data export is available on Plus and above.";
        case "MULTI_PROFILE":     return "Multiple profiles are available with the Family plan.";
        case "CHILD_SAFE_MODE":   return "Child-safe mode is available on Family, EDU, and Enterprise plans.";
        case "ADMIN_DASHBOARD":   return "Admin tools are available on institutional plans.";
        case "TTS_ADVANCED":      return "Advanced TTS voice selection and rate/pitch control are available on Plus and above.";
        case "SEARCH_MODE":       return "Exact/semantic search mode is available on Plus and above.";
        case "REPLY_CADENCE":     return "Cadence controls for arc and companion letter are available on Plus and above.";
        case "COMPANION_LETTER":  return "Monthly companion letters are available on Pro and above.";
        case "GROWTH_ARC":        return "Emotional growth arc narrative is available on Pro and above.";
        default:                  return "This feature is not available on your current plan.";
    }
}
