// src/hooks/useAnalysisConsent.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    type AnalysisConsentMode,
    loadConsentMode,
    saveConsentMode,
} from "@/lib/imotara/analysisConsent";

/**
 * Global in-memory consent state + subscribers.
 * This keeps multiple components (Chat page, toggle, badges) in sync.
 */

let globalMode: AnalysisConsentMode = "local-only";
let initialized = false;
let initializingPromise: Promise<void> | null = null;
const listeners = new Set<(mode: AnalysisConsentMode) => void>();

async function ensureInitialized() {
    if (initialized) return;

    if (!initializingPromise) {
        initializingPromise = (async () => {
            try {
                const stored = await loadConsentMode();
                if (stored) {
                    globalMode = stored;
                }
            } catch (err) {
                console.warn(
                    "[imotara] failed to load analysis consent mode, defaulting to local-only",
                    err
                );
            } finally {
                initialized = true;
            }
        })();
    }

    await initializingPromise;
}

function broadcastMode(mode: AnalysisConsentMode) {
    for (const cb of listeners) {
        try {
            cb(mode);
        } catch (err) {
            console.warn("[imotara] consent listener error", err);
        }
    }
}

type UseAnalysisConsentResult = {
    mode: AnalysisConsentMode;
    setMode: (mode: AnalysisConsentMode) => void;
    ready: boolean;
    isLocalOnly: boolean;
    isRemoteAllowed: boolean;
};

export function useAnalysisConsent(): UseAnalysisConsentResult {
    const [mode, setModeState] = useState<AnalysisConsentMode>(globalMode);
    const [ready, setReady] = useState<boolean>(initialized);

    // On mount: ensure we’ve loaded from storage and subscribe to changes
    useEffect(() => {
        let cancelled = false;

        (async () => {
            await ensureInitialized();
            if (!cancelled) {
                setModeState(globalMode);
                setReady(true);
            }
        })();

        const listener = (next: AnalysisConsentMode) => {
            setModeState(next);
        };

        listeners.add(listener);

        return () => {
            cancelled = true;
            listeners.delete(listener);
        };
    }, []);

    const setMode = useCallback((next: AnalysisConsentMode) => {
        globalMode = next;
        setModeState(next);
        broadcastMode(next);

        try {
            void saveConsentMode(next);
        } catch (err) {
            console.warn("[imotara] failed to save analysis consent mode", err);
        }

    }, []);

    return {
        mode,
        setMode,
        ready,
        isLocalOnly: mode === "local-only",
        isRemoteAllowed: mode === "allow-remote",
    };
}
