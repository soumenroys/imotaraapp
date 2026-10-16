// src/lib/imotara/analysisConsent.ts

export type AnalysisConsentMode = "local-only" | "auto" | "allow-remote";

const STORAGE_KEY = "imotara.analysisConsent.v1";
const LEGACY_STORAGE_KEY = "imotara:analysisConsent";

function parseStoredMode(raw: string | null): AnalysisConsentMode | null {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as { mode?: AnalysisConsentMode } | null;
        if (parsed && (parsed.mode === "local-only" || parsed.mode === "auto" || parsed.mode === "allow-remote")) {
            return parsed.mode;
        }
    } catch {
        // plain string fallback handled below
    }

    if (raw === "local-only" || raw === "auto" || raw === "allow-remote") {
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
 *
 * 🔴 THE FALLBACK IS `"allow-remote"`, NOT `"local-only"`.
 *
 * This docstring said "falls back safely to local-only" until 2026-10-16. It
 * had been wrong since the refactor that removed the old DEFAULT_CONSENT
 * constant, and it describes the OPPOSITE of what the code does — both on the
 * server (`window === undefined`) and for any user with nothing stored. A
 * reader checking the consent posture by reading the comment would have come
 * away believing the safest possible default was in place while the most
 * permissive one was. ⇒ [[feedback_check_the_record_before_asserting]]
 *
 * ⚠️ THE BEHAVIOUR IS DELIBERATE AND IS NOT TO BE "FIXED" HERE. Owner decision,
 * 2026-10-16, taken with the GDPR trade-off stated explicitly: changing the
 * default to local-only would degrade reply quality for every new user before
 * they ever find the setting, and that is the one thing this product does not
 * trade away. The gap it accepts — cloud analysis of emotional content
 * beginning without an explicit opt-in — is a known, accepted risk, recorded
 * alongside the no-cookie-banner decision in lib/analytics/ga.ts.
 *
 * 🔑 If it is ever revisited, the lever is the existing ConsentGate: make the
 * cloud-analysis choice explicit there, so nobody is defaulted either way.
 * ⛔ Mobile has no `allow-remote` mode at all — this is web-only.
 */
export function loadConsentMode(): AnalysisConsentMode {
    if (typeof window === "undefined") {
        return "allow-remote";
    }

    // Prefer the current key, but gracefully fall back to the legacy one
    // so existing users keep their choice without having to toggle again.
    return (
        readMode(STORAGE_KEY) ??
        readMode(LEGACY_STORAGE_KEY) ??
        "allow-remote"
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
