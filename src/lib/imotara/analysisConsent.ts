// src/lib/imotara/analysisConsent.ts

export type AnalysisConsentMode = "local-only" | "allow-remote";

const STORAGE_KEY = "imotara.analysisConsent.v1";
const LEGACY_STORAGE_KEY = "imotara:analysisConsent";

function parseStoredMode(raw: string | null): AnalysisConsentMode | null {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as { mode?: AnalysisConsentMode } | null;
        if (parsed && (parsed.mode === "local-only" || parsed.mode === "allow-remote")) {
            return parsed.mode;
        }
    } catch {
        // plain string fallback handled below
    }

    if (raw === "local-only" || raw === "allow-remote") {
        return raw;
    }

    return null;
}

function readMode(key: string): AnalysisConsentMode | null {
    try {
        return parseStoredMode(window.localStorage.getItem(key));
    } catch {
        return null;
    }
}

/**
 * Read the stored consent mode from localStorage.
 * Falls back safely to "local-only" if anything goes wrong.
 */
export function loadConsentMode(): AnalysisConsentMode {
    if (typeof window === "undefined") {
        return "local-only";
    }

    // Prefer the current key, but gracefully fall back to the legacy one
    // so existing users keep their choice without having to toggle again.
    return (
        readMode(STORAGE_KEY) ??
        readMode(LEGACY_STORAGE_KEY) ??
        "local-only"
    );
}

/**
 * Persist the consent mode to localStorage.
 */
export function saveConsentMode(mode: AnalysisConsentMode): void {
    if (typeof window === "undefined") return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode }));
        // keep legacy key in sync for older code paths
        window.localStorage.setItem(LEGACY_STORAGE_KEY, mode);
    } catch {
        // ignore quota / storage errors
    }
}
