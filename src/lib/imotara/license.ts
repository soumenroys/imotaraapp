// src/lib/imotara/license.ts
//
// Lightweight license helper.
// This does NOT enforce anything yet.
// It simply exposes the license mode safely across the app.

export type LicenseMode = "off" | "log" | "enforce";

/**
 * Read licensing mode from environment.
 * Default = "off" → current behavior (no licensing).
 */
export function getLicenseMode(): LicenseMode {
    if (typeof window !== "undefined") {
        // Client side: read NEXT_PUBLIC env
        const mode =
            (process.env.NEXT_PUBLIC_IMOTARA_LICENSE_MODE as LicenseMode) || "off";
        return normalize(mode);
    }

    // Server side: also safe
    const mode =
        (process.env.NEXT_PUBLIC_IMOTARA_LICENSE_MODE as LicenseMode) || "off";
    return normalize(mode);
}

function normalize(mode: string): LicenseMode {
    if (mode === "log") return "log";
    if (mode === "enforce") return "enforce";
    return "off";
}

/**
 * For now, licensing always returns a "valid" status so
 * it cannot affect any existing functionality.
 */
export function getCurrentLicenseStatus() {
    return {
        status: "valid",
        tier: "pro",
        mode: getLicenseMode(),
    } as const;
}
