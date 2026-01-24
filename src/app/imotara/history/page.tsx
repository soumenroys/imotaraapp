// src/app/imotara/history/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import EmotionFilterBar from "@/components/imotara/EmotionFilterBar";
import EmotionHistoryChart from "@/components/imotara/EmotionHistoryChart";
import EmotionTimeline from "@/components/imotara/EmotionTimeline";
import {
  clearHistory,
  getEmotionsSet,
  getHistory,
  toChartSeries,
} from "@/lib/imotara/history";
import type { Emotion, EmotionRecord } from "@/types/history";
import { Trash2 } from "lucide-react";

export default function EmotionHistoryPage() {
  // All history records – explicitly EmotionRecord[]
  const [all, setAll] = useState<EmotionRecord[]>([]);

  // filters
  const [emotion, setEmotion] = useState<Emotion | "all">("all");
  const [source, setSource] = useState<"all" | "local" | "remote">("all");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  // auto-refresh when storage changes (basic focus poll + initial load)
  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const data = await getHistory();
        if (!cancelled) setAll(data);
      } catch {
        if (!cancelled) setAll([]);
      }
    };

    const onFocus = () => {
      void loadHistory();
    };

    window.addEventListener("focus", onFocus);
    void loadHistory(); // initial load

    const iv = setInterval(() => {
      void loadHistory();
    }, 3000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(iv);
    };
  }, []);

  const emotions = useMemo(() => getEmotionsSet(all), [all]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).setHours(0, 0, 0, 0) : undefined;
    const toTs = to ? new Date(to).setHours(23, 59, 59, 999) : undefined;

    return all.filter((s) => {
      if (source !== "all" && s.source !== source) return false;

      const t = s.createdAt ?? s.updatedAt ?? 0;
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;

      if (emotion === "all") return true;
      return s.emotion === emotion;
    });
  }, [all, source, from, to, emotion]);

  // Chart focus must match the Emotion union used by EmotionRecord/emotion history.
  // If some UI state ever provides "anxiety", map it to "fear" for chart filtering.
  const chartFocus: "all" | Emotion | undefined =
    (emotion as any) === "anxiety"
      ? "fear"
      : (emotion as "all" | Emotion | undefined);

  const chartData = useMemo(
    () => toChartSeries(filtered, chartFocus),
    [filtered, chartFocus]
  );

  const onReset = () => {
    setEmotion("all");
    setSource("all");
    setFrom(undefined);
    setTo(undefined);
  };

  const onClearAll = () => {
    if (confirm("Delete ALL saved emotion history on this device?")) {
      void clearHistory();
      setAll([]);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Emotion History
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Review past messages, filter by emotion or date, and track intensity
            trends.
          </p>
        </div>

        <button
          onClick={onClearAll}
          className="mt-3 inline-flex items-center gap-2 self-start rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-4 w-4" />
          Clear all history
        </button>
      </header>

      <section className="mt-6">
        <EmotionFilterBar
          emotions={emotions}
          selectedEmotion={emotion}
          onEmotionChange={(e) => setEmotion((e === "anxiety" ? "fear" : e) as Emotion | "all")}
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          source={source}
          onSourceChange={setSource}
          onReset={onReset}
        />
      </section>

      <section className="mt-6">
        <EmotionHistoryChart data={chartData} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Timeline ({filtered.length})
        </h2>
        <EmotionTimeline items={filtered} />
      </section>
    </main>
  );
}
