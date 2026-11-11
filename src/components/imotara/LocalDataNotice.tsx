// src/components/imotara/LocalDataNotice.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "imotara.localNotice.v1";
// "/chat": both banners are pinned to the bottom of the screen — exactly where
// the message box is. Seen live 7 Nov 2026 (#91): a first-time visitor arriving
// in Chat could not see where to type. They still show on every other page.
const SUPPRESS_PATHS = ["/admin", "/help", "/chat"];

export default function LocalDataNotice() {
    const [visible, setVisible] = useState(false);
    const pathname = usePathname();

    // Show banner only on client, only if not dismissed, never on admin paths
    useEffect(() => {
        if (typeof window === "undefined") return;
        // Hide (not just "do not show"): it may already be up from the page before.
        if (SUPPRESS_PATHS.some((p) => pathname.startsWith(p))) { setVisible(false); return; }
        try {
            const val = window.localStorage.getItem(STORAGE_KEY);
            if (val !== "dismissed") setVisible(true);
        } catch {
            setVisible(true); // fail-open
        }
    }, [pathname]);

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
                    {/* #94 (owner, 7 Nov 2026): this used to say nothing is sent to
                        our servers unless you allow it — but new visitors get cloud
                        replies by default. The words now match what happens. */}
                    <p className="font-medium text-zinc-50">
                        How Imotara handles your words
                    </p>

                    <p className="leading-snug text-zinc-300">
                        {/* #127 (11 Nov 2026): history is saved with us by default — never say "on this device" only. */}
                        Your chat history is <b>saved securely with us</b>, with a copy in this
                        browser. To reply, your messages are sent to our secure servers. You can
                        switch to on-device only in Settings.
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
