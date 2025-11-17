// src/lib/imotara/consent.ts
//
// Backwards-compatible wrapper around the shared analysisConsent helpers.
// Kept for older imports; all logic now lives in analysisConsent.ts so
// there is a single source of truth (including legacy storage keys).

import {
    loadConsentMode,
    saveConsentMode,
    type AnalysisConsentMode,
} from "./analysisConsent";

export type { AnalysisConsentMode };

export function getAnalysisConsentMode(): AnalysisConsentMode {
    return loadConsentMode();
}

export function setAnalysisConsentMode(mode: AnalysisConsentMode) {
    saveConsentMode(mode);
}

export function hasAllowedRemoteAnalysis(): boolean {
    return loadConsentMode() === "allow-remote";
}
