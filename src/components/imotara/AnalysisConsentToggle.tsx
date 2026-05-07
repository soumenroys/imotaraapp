// src/components/imotara/AnalysisConsentToggle.tsx
"use client";

import React from "react";
import { type AnalysisConsentMode } from "@/lib/imotara/analysisConsent";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

const MODES: { value: AnalysisConsentMode; label: string; title: string }[] = [
    { value: "local-only", label: "Local", title: "On-device only — no data leaves your browser" },
    { value: "auto", label: "Auto", title: "Imotara decides whether local or cloud is best for each message" },
    { value: "allow-remote", label: "Cloud", title: "Cloud AI — richer responses, text sent to Imotara servers" },
];

export default function AnalysisConsentToggle({
    showHelp = true,
}: {
    showHelp?: boolean;
}) {
    const { mode, setMode, ready } = useAnalysisConsent();

    return (
        <div className="flex flex-col gap-1">
            <div
                role="group"
                aria-label="Emotion analysis mode"
                className={[
                    "relative inline-flex h-7 w-full rounded-full border border-white/15",
                    "bg-black/50 p-0.5 text-xs font-medium text-zinc-300",
                    "shadow-sm backdrop-blur-sm",
                    !ready ? "opacity-60 pointer-events-none" : "",
                ].join(" ")}
            >
                {/* Sliding active pill */}
                <span
                    aria-hidden
                    className={[
                        "absolute inset-y-0.5 rounded-full",
                        "bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400",
                        "shadow-md transition-all duration-200",
                        "w-1/3",
                        mode === "local-only" ? "left-0.5" : mode === "auto" ? "left-1/3" : "left-2/3",
                    ].join(" ")}
                />

                {MODES.map(({ value, label, title }) => (
                    <button
                        key={value}
                        type="button"
                        title={title}
                        disabled={!ready}
                        onClick={() => setMode(value)}
                        aria-pressed={mode === value}
                        className={[
                            "relative flex-1 rounded-full text-center transition-colors duration-150 select-none",
                            mode === value ? "text-white" : "text-zinc-400 hover:text-zinc-200",
                        ].join(" ")}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}
