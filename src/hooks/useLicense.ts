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
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return status;
}
