// src/components/imotara/MoodSummaryCard.tsx
"use client";

import { memo } from "react";
import { useAnalysis, type AppMessage } from "@/lib/imotara/useAnalysis";
import type { AnalyzeMode } from "@/lib/imotara/useAnalysis";
import { Sparkles, Activity } from "lucide-react";

type Props = {
  messages: AppMessage[];
  windowSize?: number;
  mode?: AnalyzeMode; // "local" | "api"
  className?: string;
};

const EMOJI: Record<string, string> = {
  joy: "😊",
  sadness: "😔",
  anger: "😠",
  fear: "😟",
  disgust: "😣",
  surprise: "😲",
  neutral: "😐",
};

const LABEL: Record<string, string> = {
  joy: "Joy",
  sadness: "Sadness",
  anger: "Anger",
  fear: "Fear",
  disgust: "Disgust",
  surprise: "Surprise",
  neutral: "Neutral",
};

function fmtPct(x: number | undefined) {
  if (x == null || Number.isNaN(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

export default memo(function MoodSummaryCard({
  messages,
  windowSize = 10,
  mode = "local",
  className = "",
}: Props) {
  const { result, loading, error } = useAnalysis(messages, windowSize, mode);

  // Error state
  if (error) {
    return (
      <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}>
        <div className="text-sm text-red-600 dark:text-red-400">Mood analysis failed.</div>
      </div>
    );
  }

  // Loading/empty states
  if (loading && !result) {
    return (
      <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Activity className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Analyzing recent messages…</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Activity className="h-4 w-4" aria-hidden="true" />
          <span>Waiting for messages…</span>
        </div>
      </div>
    );
  }

  const { summary, snapshot } = result;
  const dom = snapshot.dominant || "neutral";
  const domEmoji = EMOJI[dom] ?? "😐";
  const domLabel = LABEL[dom] ?? "Neutral";

  // Sort averages desc and take top 4
  const avgEntries = Object.entries(snapshot.averages || {})
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 4);

  return (
    <section className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white/70 dark:bg-zinc-900/40 backdrop-blur ${className}`}>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Mood Summary
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Last {windowSize}
        </span>
      </header>

      <div className="mt-3 flex items-start gap-3">
        <div className="text-2xl leading-none">{domEmoji}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {summary.headline || "Mixed feelings overall"}
          </div>
          {summary.details ? (
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {summary.details}
            </div>
          ) : null}
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Dominant: <span className="font-medium">{domLabel}</span>
          </div>
        </div>
      </div>

      {avgEntries.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {avgEntries.map(([emotion, val]) => (
            <li
              key={emotion}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              title={`${LABEL[emotion] ?? emotion}: ${fmtPct(val)}`}
            >
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="text-base leading-none">
                  {EMOJI[emotion] ?? "😐"}
                </span>
                <span className="text-zinc-800 dark:text-zinc-100">
                  {LABEL[emotion] ?? emotion}
                </span>
              </span>
              <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                {fmtPct(val)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="mt-4 text-[10px] text-zinc-500 dark:text-zinc-400">
        Window: {new Date(snapshot.window.from).toLocaleString()} —{" "}
        {new Date(snapshot.window.to).toLocaleString()}
      </footer>
    </section>
  );
});
