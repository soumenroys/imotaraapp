// src/app/history/page.tsx
"use client";

import EmotionHistory from "@/components/imotara/EmotionHistory";
import { useAnalysisConsent } from "@/lib/imotara/analysisConsent";

export default function HistoryPage() {
  const { mode } = useAnalysisConsent();

  const modeLabel =
    mode === "remote-allowed" ? "Remote allowed" : "On-device only";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Emotion History
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Auto-sync pulls remote updates periodically. Use the button to force
            a sync.
          </p>
        </div>

        {/* Read-only analysis mode chip, aligned with Chat header */}
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
            mode === "remote-allowed"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/60 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
          ].join(" ")}
          title="Current emotion analysis mode"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${mode === "remote-allowed" ? "bg-emerald-500" : "bg-zinc-400"
              }`}
          />
          {modeLabel}
        </span>
      </header>

      <EmotionHistory />
    </main>
  );
}
