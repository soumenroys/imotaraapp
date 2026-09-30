// src/hooks/useLicense.ts
"use client";

import { useEffect, useState } from "react";
import {
    getCurrentLicenseStatus,
    type LicenseMode,
} from "@/lib/imotara/license";
import { onLicenseRefresh } from "@/lib/imotara/licenseRefresh";
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

    const [status, setStatus] = useState<LicenseStatus>({
        status: base.status as LicenseStatus["status"],
        tier: base.tier as LicenseTier,
        mode: base.mode,
        expiresAt: base.expiresAt ?? null,
        loading: true,
        source: "internal",
    });

    useEffect(() => {
        let cancelled = false;

        async function fetchLicense() {
            try {
                const res = await fetch("/api/license/status", {
                    method: "GET",
                    credentials: "same-origin",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (cancelled) return;

                const lic = json?.license;
                if (lic) {
                    setStatus({
                        status: (lic.status ?? "valid") as LicenseStatus["status"],
                        tier: (lic.tier ?? base.tier) as LicenseTier,
                        mode: (lic.mode ?? base.mode) as LicenseMode,
                        expiresAt: (lic.expiresAt ?? null) as string | null,
                        loading: false,
                        source: (lic.source ?? "supabase") as LicenseStatus["source"],
                    });
                } else {
                    setStatus((prev) => ({ ...prev, loading: false, expiresAt: prev.expiresAt }));
                }
            } catch {
                if (cancelled) return;
                // Keep the env-var snapshot on error
                setStatus((prev) => ({ ...prev, loading: false, source: "error" }));
            }
        }

        void fetchLicense();

        // ── Re-fetch triggers ────────────────────────────────────────────────
        // 🔑 ALL of them now live in one place: auth change (the one that was
        // missing), tab focus/visibility, and the manual refreshLicense() the
        // checkout handler fires once the server confirms a grant.
        //
        // Auth change is what rescues the sign-in race: the page mounts before
        // the session exists, this fetch returns the anonymous `free`, and then
        // SIGNED_IN arrives and we ask again with a real cookie.
        const unsubscribe = onLicenseRefresh(() => { void fetchLicense(); });

        return () => {
            cancelled = true;
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return status;
}
