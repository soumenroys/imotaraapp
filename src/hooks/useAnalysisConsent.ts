// src/hooks/useAnalysisConsent.ts
//
// Simple React hook around the analysis-consent helpers.
// UI can use this to show a toggle:
//   - "Local only"       (default, safest)
//   - "Allow remote"     (send text to backend/API for analysis)

import { useEffect, useState } from "react";
import {
    getAnalysisConsentMode,
    setAnalysisConsentMode,
    type AnalysisConsentMode,
} from "@/lib/imotara/consent";

export function useAnalysisConsent() {
    const [mode, setMode] = useState < AnalysisConsentMode > ("local-only");
    const [ready, setReady] = useState(false);

    // On mount, read from localStorage
    useEffect(() => {
        if (typeof window === "undefined") return;
        const current = getAnalysisConsentMode();
        setMode(current);
        setReady(true);
    }, []);

    const updateMode = (next: AnalysisConsentMode) => {
        setMode(next);
        setAnalysisConsentMode(next);
    };

    return {
        mode,          // "local-only" | "allow-remote"
        setMode: updateMode,
        ready,         // true once we've read the stored value
        isLocalOnly: mode === "local-only",
        isRemoteAllowed: mode === "allow-remote",
    };
}
