// src/hooks/useLicense.ts
"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
    getCurrentLicenseStatus,
    type LicenseMode,
} from "@/lib/imotara/license";
import { onLicenseRefresh } from "@/lib/imotara/licenseRefresh";
import {
    fetchLicense,
    subscribeLicenseStore,
    getLicenseSnapshot,
    getLicenseServerSnapshot,
} from "@/lib/imotara/licenseStore";
import type { LicenseTier, LicenseStatusCode } from "@/types/license";

export type LicenseStatus = {
    status: LicenseStatusCode | "free";
    tier: LicenseTier;
    mode: LicenseMode;
    /** ISO string when the trial / subscription expires; null if not applicable */
    expiresAt: string | null;
    /** true while the server fetch is in flight */
    loading: boolean;
    /** source of the current value */
    source: "internal" | "supabase" | "error";
};

/**
 * React hook that returns the current license status.
 *
 * - Starts with the env-var snapshot (instant, no flash).
 * - Then fetches /api/license/status to get the Supabase-backed tier
 *   (relevant when the user is signed in and has a real license record).
 * - Falls back gracefully on network error.
 */
/**
 * 🔴 WHY THIS EXISTS. The hook fetched /api/license/status ONCE on mount with
 * `useEffect(..., [])` and never again. So after a successful payment the badge
 * still read "Current plan: Free" until the user manually reloaded — proven live
 * on 2026-09-26 with the first real Razorpay payment on the firm account.
 *
 * That is worse than cosmetic: someone who has just paid and still sees "Free"
 * reasonably concludes it failed, and may pay a second time.
 *
 * 🔑 2026-09-30: the re-fetch TRIGGERS moved out to `@/lib/imotara/licenseRefresh`.
 * This hook had focus/visibility/manual but NOT auth-change, so a user who signed
 * in on a slow OAuth round-trip and then stayed on the page kept seeing `free`
 * forever. `settings/page.tsx` had its own copy with no triggers at all, and the
 * two drifted. One owner of "when", many owners of "what". See that file for the
 * full root cause.
 */
export { refreshLicense } from "@/lib/imotara/licenseRefresh";

export default function useLicense(): LicenseStatus {
    const base = getCurrentLicenseStatus();

    // 🔴 READS THE SHARED STORE — no per-instance copy.
    //
    // This hook used to own a `useState` and fire its own request. With six
    // call sites plus Settings' private eighth fetch, that meant eight caches
    // resolving at eight different moments — and on 2026-10-01 the header
    // showed "Plus" while Settings showed "Free", on screen, at the same time.
    // Refreshing eight caches in lockstep cannot fix that; there has to be one.
    const snap = useSyncExternalStore(
        subscribeLicenseStore,
        getLicenseSnapshot,
        getLicenseServerSnapshot,
    );

    useEffect(() => {
        // Concurrent callers share one request — see fetchLicense().
        void fetchLicense();
        // Auth change, tab focus, or a completed purchase. Every consumer asks
        // the same store, so they cannot diverge.
        return onLicenseRefresh(() => { void fetchLicense(); });
    }, []);

    const lic = snap.data?.license;

    return {
        // 🔑 `license.tier`, never `data.tier`. See trap_tier_lives_at_license_tier.
        status: (lic?.status ?? base.status) as LicenseStatus["status"],
        tier: (lic?.tier ?? base.tier) as LicenseTier,
        mode: (lic?.mode ?? base.mode) as LicenseMode,
        expiresAt: (lic?.expiresAt ?? null) as string | null,
        loading: snap.loading,
        source: (lic?.source ?? (snap.error ? "error" : "internal")) as LicenseStatus["source"],
    };
}
