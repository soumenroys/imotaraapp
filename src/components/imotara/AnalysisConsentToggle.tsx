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
export default function AnalysisConsentToggle() {
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
                    "relative inline-flex h-7 w-24 items-center rounded-full border border-white/15",
                    "bg-black/50 px-1 text-[10px] font-medium text-zinc-300",
                    "shadow-sm backdrop-blur-sm transition",
                    "hover:bg-white/5 hover:-translate-y-0.5 hover:shadow-md",
                    "disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none",
                ].join(" ")}
            >
                {/* Sliding pill */}
                <span
                    className={[
                        "absolute top-0.5 bottom-0.5 w-[46%] rounded-full",
                        "bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400",
                        "shadow-md transition-transform duration-200",
                        isRemoteAllowed ? "translate-x-[44px]" : "translate-x-0",
                    ].join(" ")}
                />

                {/* Labels */}
                <span
                    className={[
                        "relative flex-1 text-center",
                        isLocalOnly ? "text-white" : "text-zinc-300",
                    ].join(" ")}
                >
                    Local
                </span>
                <span
                    className={[
                        "relative flex-1 text-center",
                        isRemoteAllowed ? "text-white" : "text-zinc-300",
                    ].join(" ")}
                >
                    Cloud
                </span>
            </button>

            {/* Tiny helper line */}
            <p className="max-w-xs text-[10px] leading-snug text-zinc-500">
                Your choice is stored only on this device.{" "}
                {isLocalOnly
                    ? "Right now, Imotara analyzes emotions locally in your browser."
                    : "Right now, Imotara may send text to the backend/API for emotion analysis."}
            </p>
        </div>
    );
}
