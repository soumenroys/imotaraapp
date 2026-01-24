// src/lib/imotara/license.ts
//
// Licensing/entitlements foundation (v1).
// - Keeps existing behavior safe by default.
// - No enforcement yet; only returns a structured snapshot.

export type LicenseMode = "off" | "log" | "enforce";
export type LicenseTier = "free" | "plus" | "pro" | "family";
export type LicenseStatusCode = "valid" | "invalid" | "expired" | "trial";

export type LicenseStatus = {
    status: LicenseStatusCode;
    tier: LicenseTier;
    mode: LicenseMode;
    source?: "manual" | "stripe" | "razorpay" | "promo" | "internal";
    expiresAt?: string | null; // ISO string if applicable
};

/**
 * Read licensing mode from environment.
 * Default = "off" → current behavior (no licensing).
 */
export function getLicenseMode(): LicenseMode {
    const raw =
        (process.env.NEXT_PUBLIC_IMOTARA_LICENSE_MODE as string | undefined) ?? "off";
    return normalizeMode(raw);
}

function normalizeMode(mode: string): LicenseMode {
    if (mode === "log") return "log";
    if (mode === "enforce") return "enforce";
    return "off";
}

/**
 * Temporary, safe default:
 * - Always returns "valid"
 * - Tier defaults to "free" unless explicitly overridden (env) for QA
 *
 * This avoids the current risky default ("pro") while keeping behavior non-blocking.
 */
export function getCurrentLicenseStatus(): LicenseStatus {
    const mode = getLicenseMode();

    // Optional QA override: allows testing UI without billing wiring.
    // Example: NEXT_PUBLIC_IMOTARA_LICENSE_TIER=pro
    const tierRaw =
        (process.env.NEXT_PUBLIC_IMOTARA_LICENSE_TIER as string | undefined) ?? "free";
    const tier = normalizeTier(tierRaw);

    return {
        status: "valid",
        tier,
        mode,
        source: "internal",
        expiresAt: null,
    };
}

function normalizeTier(t: string): LicenseTier {
    const v = String(t || "").toLowerCase();
    if (v === "plus") return "plus";
    if (v === "pro") return "pro";
    if (v === "family") return "family";
    return "free";
}
