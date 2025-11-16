// src/components/imotara/AnalysisConsentToggle.tsx
"use client";

import React from "react";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

/**
 * Small inline toggle for emotion-analysis consent.
 *
 * - "Local only" (default, safest) → analysis stays in the browser
 * - "Allow remote"                → text may be sent to the backend/API
 *
 * You can drop this into /chat or /settings.
 */
export default function AnalysisConsentToggle() {
    const { mode, setMode, ready, isLocalOnly, isRemoteAllowed } =
        useAnalysisConsent();

    // While loading from localStorage, avoid flicker
    if (!ready) {
        return (
            <div className="inline-flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 dark:border-zinc-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-300 dark:bg-zinc-600" />
                    Loading privacy preferences…
                </span>
            </div>
        );
    }

    return (
        <div className="inline-flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-700 dark:bg-zinc-900">
                <span className="whitespace-nowrap font-medium text-zinc-700 dark:text-zinc-200">
                    Emotion analysis:
                </span>

                <button
                    type="button"
                    onClick={() => setMode("local-only")}
                    className={[
                        "rounded-full px-2 py-0.5 text-[11px] border",
                        isLocalOnly
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400/80 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "border-transparent text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
                    ].join(" ")}
                    title="Keep all emotion analysis local to this device"
                >
                    Local only
                </button>

                <button
                    type="button"
                    onClick={() => setMode("allow-remote")}
                    className={[
                        "rounded-full px-2 py-0.5 text-[11px] border",
                        isRemoteAllowed
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400/80 dark:bg-indigo-900/30 dark:text-indigo-200"
                            : "border-transparent text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
                    ].join(" ")}
                    title="Allow sending your text to the backend/API for richer analysis"
                >
                    Allow remote
                </button>
            </div>

            <p className="max-w-xs text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
                Your choice is stored only on this device.{" "}
                {mode === "local-only"
                    ? "Right now, Imotara analyzes emotions locally in your browser."
                    : "Right now, Imotara may send text to the backend/API for emotion analysis."}
            </p>
        </div>
    );
}
