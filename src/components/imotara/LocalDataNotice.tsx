// src/components/imotara/LocalDataNotice.tsx
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "imotara.localNotice.v1";

export default function LocalDataNotice() {
    const [visible, setVisible] = useState(false);

    // Show banner only on client & only if user hasn't dismissed it
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const val = window.localStorage.getItem(STORAGE_KEY);
            if (val !== "dismissed") setVisible(true);
        } catch {
            setVisible(true); // fail-open
        }
    }, []);

    function handleDismiss() {
        setVisible(false);
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(STORAGE_KEY, "dismissed");
            } catch {
                /* ignore */
            }
        }
    }

    if (!visible) return null;

    return (
        <div
            className="
        pointer-events-none fixed inset-x-0 bottom-16 z-[60]
        flex justify-center px-4 sm:bottom-20 sm:px-6
      "
        >
            <div
                className="
          pointer-events-auto animate-fade-in flex max-w-xl
          items-start gap-3 rounded-2xl border border-white/15
          bg-black/70 px-3 py-2.5 text-[11px] text-zinc-100
          shadow-[0_18px_40px_rgba(15,23,42,0.9)]
          backdrop-blur-xl sm:px-4 sm:py-3
        "
                role="alert"
                aria-label="Local data storage notice"
            >
                {/* Info icon badge */}
                <div
                    className="
            mt-[3px] flex h-5 w-5 items-center justify-center
            rounded-full bg-gradient-to-br
            from-indigo-500 via-sky-500 to-emerald-400
            text-[10px] font-bold text-white
          "
                >
                    i
                </div>

                {/* Message block */}
                <div className="flex-1 space-y-1">
                    <p className="font-medium text-zinc-50">
                        Local-only storage by default
                    </p>

                    <p className="leading-snug text-zinc-300">
                        Imotara stores your chat and emotion history <b>only on this
                            device</b>. Nothing is sent to our servers unless you turn on sync
                        or allow remote analysis.
                    </p>
                </div>

                {/* Dismiss button */}
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dismiss notice"
                    className="
            ml-1 rounded-full border border-white/20 bg-white/5
            px-2.5 py-1 text-[11px] font-medium text-zinc-100
            transition hover:bg-white/10
          "
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
