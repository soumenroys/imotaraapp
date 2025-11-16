// src/lib/imotara/analysisConsent.ts
"use client";

import * as React from "react";

export type AnalysisConsentMode = "local-only" | "remote-allowed";

const STORAGE_KEY = "imotara:analysisConsentMode";

function readInitialMode(): AnalysisConsentMode {
    if (typeof window === "undefined") return "local-only";
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === "remote-allowed" || raw === "local-only") {
            return raw;
        }
    } catch {
        // ignore
    }
    return "local-only";
}

/**
 * Global-ish consent hook backed by localStorage.
 * - mode: "local-only" | "remote-allowed"
 * - setMode: set explicitly
 * - toggleMode: convenience helper to flip between modes
 */
export function useAnalysisConsent() {
    const [mode, setModeState] = React.useState<AnalysisConsentMode>(() =>
        readInitialMode()
    );

    // keep localStorage in sync
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // ignore storage errors
        }
    }, [mode]);

    const setMode = React.useCallback((next: AnalysisConsentMode) => {
        setModeState(next);
    }, []);

    const toggleMode = React.useCallback(() => {
        setModeState((prev) =>
            prev === "local-only" ? "remote-allowed" : "local-only"
        );
    }, []);

    return { mode, setMode, toggleMode };
}
