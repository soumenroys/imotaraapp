"use client";

// src/hooks/useFeatureGate.ts
// Combines useLicense() + gate() with mode awareness.
//
// Mode semantics:
//   off     → feature is always allowed, no nudge shown
//   log     → feature is allowed, nudge shown when tier lacks it (soft warning)
//   enforce → feature is blocked when tier lacks it, nudge shown

import useLicense from "@/hooks/useLicense";
import { gate, type FeatureKey, type FeatureGateResult } from "@/lib/imotara/featureGates";

export type FeatureGateHookResult = {
    /** True when the feature may be used. Always true in off/log mode. */
    allowed: boolean;
    /** True when the user's tier lacks the feature (show an upgrade prompt). */
    nudge: boolean;
    /** Human-readable reason why the feature is unavailable (present when nudge=true). */
    reason: string | undefined;
    /** True while the license status is loading from the server. */
    loading: boolean;
    /** Raw gate result for the current tier, useful for parameterized gates. */
    gateResult: FeatureGateResult;
};

export default function useFeatureGate(feature: FeatureKey): FeatureGateHookResult {
    const license = useLicense();
    const result = gate(feature, license.tier);
    const hasFeature = result.enabled;
    const reason = !hasFeature ? (result as Extract<FeatureGateResult, { enabled: false }>).reason : undefined;

    if (license.mode === "off") {
        return { allowed: true, nudge: false, reason: undefined, loading: license.loading, gateResult: result };
    }

    // log mode: let the user through but surface the nudge
    // enforce mode: block when the feature isn't in their tier
    const allowed = license.mode === "enforce" ? hasFeature : true;
    const nudge = !hasFeature;

    return { allowed, nudge, reason, loading: license.loading, gateResult: result };
}
