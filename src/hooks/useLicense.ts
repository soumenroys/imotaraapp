// src/hooks/useLicense.ts
"use client";

import { useMemo } from "react";
import {
    getCurrentLicenseStatus,
    type LicenseMode,
} from "@/lib/imotara/license";
import type { LicenseTier, LicenseStatusCode } from "@/types/license";

export type LicenseStatus = {
    status: LicenseStatusCode | "free";
    tier: LicenseTier;
    mode: LicenseMode;
};

/**
 * React hook wrapper around the lightweight license helper.
 *
 * 🔹 Current behavior:
 *   - Always returns a "valid", "pro" license.
 *   - Reads the current mode ("off" | "log" | "enforce") from env.
 *
 * So this hook CANNOT break any existing behavior and is safe to
 * import anywhere in client components.
 */
export default function useLicense(): LicenseStatus {
    const base = useMemo(() => getCurrentLicenseStatus(), []);

    return useMemo(
        () => ({
            status: base.status as LicenseStatus["status"],
            tier: base.tier as LicenseStatus["tier"],
            mode: base.mode,
        }),
        [base.mode, base.status, base.tier]
    );
}
