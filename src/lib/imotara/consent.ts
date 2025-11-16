// src/lib/imotara/consent.ts
//
// Central helper for user's consent about emotion analysis:
// - "local-only"      → analyze emotions only on-device / locally
// - "allow-remote"    → allow sending text to the backend / API for analysis
//
// This is stored in localStorage so the choice survives reloads.

export type AnalysisConsentMode = "local-only" | "allow-remote";

const STORAGE_KEY = "imotara:analysisConsent";

export function getAnalysisConsentMode(): AnalysisConsentMode {
    if (typeof window === "undefined") return "local-only";
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === "allow-remote" || raw === "local-only") {
            return raw;
        }
    } catch {
        // ignore storage errors and fall back to safest option
    }
    return "local-only";
}

export function setAnalysisConsentMode(mode: AnalysisConsentMode) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
        // ignore storage errors
    }
}

export function hasAllowedRemoteAnalysis(): boolean {
    return getAnalysisConsentMode() === "allow-remote";
}
