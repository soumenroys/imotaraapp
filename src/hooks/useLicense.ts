// src/hooks/useLicense.ts
"use client";

import { useEffect, useState } from "react";
import {
    getCurrentLicenseStatus,
    type LicenseMode,
} from "@/lib/imotara/license";
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
 * `refreshLicense()` lets the checkout handler pull the new tier the moment the
 * server confirms the grant. Any mounted useLicense() re-fetches.
 */
const licenseSubscribers = new Set<() => void>();

/** Ask every mounted useLicense() to re-fetch. Safe to call from anywhere. */
export function refreshLicense(): void {
    licenseSubscribers.forEach((fn) => { try { fn(); } catch { /* never let one listener break the rest */ } });
}

/**
 * Minimum gap between AUTOMATIC re-fetches (focus / tab-visible). Manual
 * refreshLicense() calls ignore it — those follow a real event we caused.
 * Without a floor, alt-tabbing would hammer the endpoint once per switch.
 */
const AUTO_REFETCH_MIN_MS = 30_000;

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
        // Manual: the checkout handler calls refreshLicense() once the server
        // confirms the grant, so the badge updates without a reload.
        licenseSubscribers.add(fetchLicense);

        // Automatic: coming back to the tab. This is what makes a purchase made
        // on ANOTHER device (phone app, second browser) show up here — without
        // it, this tab would keep showing a stale tier until reloaded.
        let lastAuto = Date.now();
        const onMaybeVisible = () => {
            if (document.visibilityState !== "visible") return;
            if (Date.now() - lastAuto < AUTO_REFETCH_MIN_MS) return;
            lastAuto = Date.now();
            void fetchLicense();
        };
        document.addEventListener("visibilitychange", onMaybeVisible);
        window.addEventListener("focus", onMaybeVisible);

        return () => {
            cancelled = true;
            licenseSubscribers.delete(fetchLicense);
            document.removeEventListener("visibilitychange", onMaybeVisible);
            window.removeEventListener("focus", onMaybeVisible);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return status;
}
