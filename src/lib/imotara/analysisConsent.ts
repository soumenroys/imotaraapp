// src/lib/imotara/analysisConsent.ts

export type AnalysisConsentMode = "local-only" | "allow-remote";

const STORAGE_KEY = "imotara.analysisConsent.v1";

/**
 * Read the stored consent mode from localStorage.
 * Falls back safely to "local-only" if anything goes wrong.
 */
export function loadConsentMode(): AnalysisConsentMode {
    if (typeof window === "undefined") {
        return "local-only";
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return "local-only";

        const parsed = JSON.parse(raw) as { mode?: AnalysisConsentMode } | null;
        if (parsed && (parsed.mode === "local-only" || parsed.mode === "allow-remote")) {
            return parsed.mode;
        }

        // older format: raw string
        if (raw === "local-only" || raw === "allow-remote") {
            return raw;
        }

        return "local-only";
    } catch {
        return "local-only";
    }
}

/**
 * Persist the consent mode to localStorage.
 */
export function saveConsentMode(mode: AnalysisConsentMode): void {
    if (typeof window === "undefined") return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode }));
    } catch {
        // ignore quota / storage errors
    }
}
