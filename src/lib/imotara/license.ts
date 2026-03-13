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

// ── Launch offer ─────────────────────────────────────────────────────────────
//
// Set NEXT_PUBLIC_IMOTARA_LAUNCH_DATE to the ISO date of public launch
// (e.g. "2026-03-14"). All users will receive a "pro" trial for
// NEXT_PUBLIC_IMOTARA_FREE_DAYS days (default: 90) from that date.
//
// After the period expires the app falls back to the normal tier logic.
// Set NEXT_PUBLIC_IMOTARA_LAUNCH_DATE="" to disable the offer entirely.

export function getLaunchOfferEndsAt(): Date | null {
    const raw = process.env.NEXT_PUBLIC_IMOTARA_LAUNCH_DATE;
    if (!raw) return null;
    const launchMs = Date.parse(raw);
    if (isNaN(launchMs)) return null;
    const freeDays =
        parseInt(process.env.NEXT_PUBLIC_IMOTARA_FREE_DAYS ?? "90", 10) || 90;
    return new Date(launchMs + freeDays * 24 * 60 * 60 * 1000);
}

export function isWithinLaunchOffer(): boolean {
    const endsAt = getLaunchOfferEndsAt();
    if (!endsAt) return false;
    return Date.now() < endsAt.getTime();
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current license status for the requesting context.
 *
 * Priority:
 *  1. Launch offer active → "pro" trial (everyone gets full access)
 *  2. QA override via NEXT_PUBLIC_IMOTARA_LICENSE_TIER env var
 *  3. Default → "free"
 */
export function getCurrentLicenseStatus(): LicenseStatus {
    const mode = getLicenseMode();

    // 1) Launch offer — all users get "pro" for the trial period
    if (isWithinLaunchOffer()) {
        const endsAt = getLaunchOfferEndsAt();
        return {
            status: "trial",
            tier: "pro",
            mode,
            source: "internal",
            expiresAt: endsAt?.toISOString() ?? null,
        };
    }

    // 2) QA override
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
