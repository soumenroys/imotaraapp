// src/app/history/page.tsx
"use client";

import { MessageSquare } from "lucide-react";
import EmotionHistory from "@/components/imotara/EmotionHistory";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

export default function HistoryPage() {
  const { mode } = useAnalysisConsent();
  const consentLabel =
    mode === "allow-remote"
      ? "Remote analysis ON (local + remote)"
      : "On-device only (local analysis)";

  return (
    <main className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="flex flex-1 flex-col">
        {/* HEADER – aligned with Chat header style */}
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: icon + title */}
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  Emotion History
                </p>
                <p className="text-xs text-zinc-500">
                  Timeline of how your conversations felt over time.
                </p>
              </div>
            </div>

            {/* Right: shared consent indicator */}
            <div className="flex flex-wrap items-center justify-start gap-2 text-[11px] sm:justify-end">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-500" : "bg-zinc-400"
                    }`}
                />
                {consentLabel}
              </span>
              <span className="hidden max-w-xs text-[11px] text-zinc-400 sm:inline">
                Emotion analysis mode is shared between Chat and History.
              </span>
            </div>
          </div>
        </header>

        {/* BODY */}
        <section className="flex-1 overflow-auto px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <EmotionHistory />
          </div>
        </section>
      </div>
    </main>
  );
}
