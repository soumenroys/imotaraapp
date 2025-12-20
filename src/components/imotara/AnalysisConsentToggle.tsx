// src/components/imotara/AnalysisConsentToggle.tsx
"use client";

import React from "react";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

/**
 * Compact sliding toggle for emotion-analysis consent.
 *
 * - "local-only"   → analysis stays in the browser
 * - "allow-remote" → text may be sent to the backend/API
 *
 * The Chat page shows the longer labels (“Remote analysis allowed” etc.).
 */
export default function AnalysisConsentToggle({
    showHelp = true,
}: {
    showHelp?: boolean;
}) {
    const {
        mode,
        setMode,
        ready,
        isLocalOnly,
        isRemoteAllowed,
    } = useAnalysisConsent();

    const handleToggle = () => {
        if (!ready) return;
        setMode(isLocalOnly ? "allow-remote" : "local-only");
    };

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={handleToggle}
                disabled={!ready}
                aria-pressed={isRemoteAllowed}
                aria-label="Toggle emotion analysis between local-only and remote"
                className={[
                    "relative inline-flex h-7 w-full items-center rounded-full border border-white/15",
                    "bg-black/50 px-1 text-xs font-medium text-zinc-300",
                    "shadow-sm backdrop-blur-sm transition",
                    "hover:bg-white/5",
                    "disabled:opacity-60",
                ].join(" ")}
            >
                {/* Sliding pill */}
                <span
                    className={[
                        "absolute inset-y-0.5 left-0.5 w-1/2 rounded-full",
                        "bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400",
                        "shadow-md transition-transform duration-200",
                        isRemoteAllowed ? "translate-x-full" : "translate-x-0",
                    ].join(" ")}
                />

                <span
                    className={`relative flex-1 text-center ${isLocalOnly ? "text-white" : "text-zinc-300"}`}
                >
                    Local
                </span>
                <span
                    className={`relative flex-1 text-center ${isRemoteAllowed ? "text-white" : "text-zinc-300"}`}
                >
                    Cloud
                </span>
            </button>

            {/* Tiny helper line */}
            {showHelp && (
                <p className="mt-2 text-xs text-zinc-500">
                    {mode === "allow-remote"
                        ? "Imotara may send your message to the backend/API for emotion analysis (as permitted by your consent settings)."
                        : "Your choice is stored only on this device. Right now, Imotara analyzes emotions locally in your browser."}
                </p>
            )}
        </div>
    );
}
