// src/components/imotara/AnalysisConsentToggle.tsx
"use client";

import React from "react";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

/**
 * Compact sliding toggle for emotion-analysis consent.
 *
 * - "local-only" (default, safest)   → analysis stays in the browser
 * - "allow-remote"                   → text may be sent to the backend/API
 *
 * The label "Emotion analysis mode" and longer description
 * are provided by the parent (e.g. /chat header).
 */
export default function AnalysisConsentToggle() {
    const {
        mode,
        setMode,
        ready,
        isLocalOnly,
        isRemoteAllowed,
    } = useAnalysisConsent();

    // While loading from localStorage, avoid flicker
    if (!ready) {
        return (
            <div className="inline-flex flex-col gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <div className="inline-flex h-5 w-9 items-center justify-center rounded-full border border-dashed border-zinc-500/40 bg-zinc-800/60">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-zinc-600" />
                </div>
            </div>
        );
    }

    function handleToggle() {
        // 🔧 IMPORTANT: matches AnalysisConsentMode = "local-only" | "allow-remote"
        setMode(isRemoteAllowed ? "local-only" : "allow-remote");
    }

    return (
        <div className="inline-flex flex-col gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {/* Slider switch */}
            <button
                type="button"
                onClick={handleToggle}
                aria-pressed={isRemoteAllowed}
                aria-label={
                    isRemoteAllowed
                        ? "Remote analysis enabled"
                        : "Remote analysis disabled, on-device only"
                }
                className={[
                    "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                    "focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                    isRemoteAllowed
                        ? "border-emerald-400 bg-emerald-500/80"
                        : "border-zinc-500 bg-zinc-700/70 dark:bg-zinc-800",
                ].join(" ")}
            >
                <span
                    className={[
                        "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        isRemoteAllowed ? "translate-x-4" : "translate-x-0.5",
                    ].join(" ")}
                />
            </button>

            {/* Tiny helper line (optional) */}
            <p className="max-w-xs text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
                Your choice is stored only on this device.{" "}
                {isLocalOnly
                    ? "Right now, Imotara analyzes emotions locally in your browser."
                    : "Right now, Imotara may send text to the backend/API for emotion analysis."}
            </p>
        </div>
    );
}
