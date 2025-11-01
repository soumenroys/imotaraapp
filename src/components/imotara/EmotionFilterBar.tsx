// src/components/emotion/EmotionFilterBar.tsx
"use client";

import { useMemo } from "react";
import { CalendarRange, Filter, RefreshCcw } from "lucide-react";
import type { Emotion } from "@/types/analysis";

type Props = {
  emotions: Emotion[];
  selectedEmotion: Emotion | "all";
  onEmotionChange: (e: Emotion | "all") => void;
  from?: string; // ISO yyyy-mm-dd
  to?: string;   // ISO yyyy-mm-dd
  onFromChange: (iso?: string) => void;
  onToChange: (iso?: string) => void;
  source: "all" | "local" | "remote";
  onSourceChange: (s: "all" | "local" | "remote") => void;
  onReset: () => void;
};

export default function EmotionFilterBar({
  emotions,
  selectedEmotion,
  onEmotionChange,
  from,
  to,
  onFromChange,
  onToChange,
  source,
  onSourceChange,
  onReset,
}: Props) {
  const emotionOptions = useMemo(() => ["all", ...emotions], [emotions]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <Filter className="h-4 w-4" />
        Filters
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Emotion</span>
          <select
            className="rounded-xl border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={selectedEmotion}
            onChange={(e) => onEmotionChange(e.target.value as Emotion | "all")}
          >
            {emotionOptions.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Source</span>
          <select
            className="rounded-xl border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={source}
            onChange={(e) => onSourceChange(e.target.value as "all" | "local" | "remote")}
          >
            <option value="all">all</option>
            <option value="local">local</option>
            <option value="remote">remote</option>
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <CalendarRange className="h-4 w-4" />
            Date range
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="rounded-xl border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={from ?? ""}
              onChange={(e) => onFromChange(e.target.value || undefined)}
            />
            <input
              type="date"
              className="rounded-xl border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={to ?? ""}
              onChange={(e) => onToChange(e.target.value || undefined)}
            />
          </div>
        </div>
      </div>

      <button
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        onClick={onReset}
      >
        <RefreshCcw className="h-4 w-4" />
        Reset filters
      </button>
    </div>
  );
}
