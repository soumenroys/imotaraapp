// src/components/analytics/AnalyticsConsentBanner.tsx
//
// Asks before any analytics runs. Shown to EVERY visitor, not only ones we
// guess are in the EU — see the note in lib/analytics/consent.ts for why
// geo-guessing is the wrong trade here.
//
// It renders nothing at all when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset, so on
// a site without analytics configured there is no banner to annoy anyone.
"use client";

import { useEffect, useState } from "react";
import {
    readAnalyticsConsent,
    setAnalyticsConsent,
    shouldAskForAnalyticsConsent,
    type AnalyticsConsent,
} from "@/lib/analytics/consent";

export default function AnalyticsConsentBanner() {
    // Starts "granted" so the banner never flashes during hydration for someone
    // who has already answered — the real value is read on mount.
    const [consent, setConsent] = useState<AnalyticsConsent>("granted");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setConsent(readAnalyticsConsent());
        setMounted(true);
    }, []);

    if (!mounted || !shouldAskForAnalyticsConsent(consent)) return null;

    const choose = (value: "granted" | "denied") => {
        setAnalyticsConsent(value);
        setConsent(value);
    };

    return (
        <div
            role="dialog"
            aria-live="polite"
            aria-label="Analytics consent"
            className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur sm:px-6"
        >
            <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-6 text-zinc-300">
                    We&apos;d like to use Google Analytics to understand how people find and use this
                    site. It is switched off unless you say yes, it never sees your conversations,
                    and we do not use it for advertising.{" "}
                    <a
                        href="/privacy"
                        className="font-medium text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
                    >
                        Privacy policy
                    </a>
                </p>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={() => choose("denied")}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-900"
                    >
                        No thanks
                    </button>
                    <button
                        type="button"
                        onClick={() => choose("granted")}
                        className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
                    >
                        Allow
                    </button>
                </div>
            </div>
        </div>
    );
}
