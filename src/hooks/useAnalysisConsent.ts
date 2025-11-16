// src/hooks/useAnalysisConsent.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    type AnalysisConsentMode,
    loadConsentMode,
    saveConsentMode,
} from "@/lib/imotara/analysisConsent";

type UseAnalysisConsentResult = {
    mode: AnalysisConsentMode;
    setMode: (mode: AnalysisConsentMode) => void;
    ready: boolean;
    isLocalOnly: boolean;
    isRemoteAllowed: boolean;
};

export function useAnalysisConsent(): UseAnalysisConsentResult {
    const [mode, setModeState] = useState<AnalysisConsentMode>("local-only");
    const [ready, setReady] = useState(false);

    // Load from localStorage once on mount
    useEffect(() => {
        if (typeof window === "undefined") return;

        const initial = loadConsentMode();
        setModeState(initial);
        setReady(true);
    }, []);

    const setMode = useCallback((next: AnalysisConsentMode) => {
        setModeState(next);
        saveConsentMode(next);
    }, []);

    return {
        mode,
        setMode,
        ready,
        isLocalOnly: mode === "local-only",
        isRemoteAllowed: mode === "allow-remote",
    };
}
