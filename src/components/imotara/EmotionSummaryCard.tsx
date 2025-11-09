'use client';

import React, { useState, useMemo } from "react";

export type EmotionSummary = {
  total: number;
  avgIntensity: number; // 0..1
  dominantEmotion: string | null;
  frequency: Record<string, number>;
  last7dAvgIntensity: number; // 0..1
  last7dSeries: number[]; // length 7, oldest -> newest
};

type Props = {
  summary: EmotionSummary | null; // allow null while loading
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

function topK(freq: Record<string, number>, k: number, total: number) {
  if (!freq || !total) return [];
  return Object.entries(freq)
    .filter(([, c]) => (c ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, k)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      emoji: EMOJI[label] ?? "🙂",
    }));
}

// Tiny inline sparkline (pure SVG, no deps)
function Sparkline({
  series,
  mode = "absolute",
}: {
  series: number[];
  mode?: "absolute" | "relative";
}) {
  const w = 120;
  const h = 28;
  const pad = 3;
  const n = series?.length ?? 0;

  if (!n) {
    return (
      <svg width={w} height={h} role="img" aria-label="No data">
        <rect x="0" y="0" width={w} height={h} rx="4" ry="4" fill="none" />
      </svg>
    );
  }

  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Choose y-scaler based on mode
  const [minV, maxV] = useMemo(() => {
    const vals = series.map((v) => (Number.isFinite(v) ? v : 0));
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    return [mn, mx];
  }, [series]);

  const scale = (v: number) => {
    if (mode === "relative") {
      const span = maxV - minV || 1; // avoid /0
      return (v - minV) / span; // 0..1 within observed band
    }
    // absolute
    return clamp01(v);
  };

  const xs = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const ys = (v: number) => {
    const vv = clamp01(scale(v));
    return h - pad - vv * (h - 2 * pad);
  };

  const pts = series.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");

  // last point highlight
  const lastX = xs(n - 1);
  const lastY = ys(series[n - 1]);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`7-day intensity sparkline (${mode} scale)`}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.9}
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="currentColor" />
    </svg>
  );
}

export default function EmotionSummaryCard({ summary }: Props) {
  const [scaleMode, setScaleMode] = useState<"absolute" | "relative">("absolute");

  if (!summary) {
    return (
      <div className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <div className="animate-pulse">Computing emotion summary…</div>
      </div>
    );
  }

  const {
    total,
    avgIntensity,
    dominantEmotion,
    last7dAvgIntensity,
    last7dSeries,
    frequency,
  } = summary;

  // percentage helper with graceful fallback
  const pct = (n: number | null | undefined) =>
    typeof n === "number" && isFinite(n) ? `${Math.round(n * 100)}%` : "—";

  const last7dTip =
    "Average intensity of entries from the last 7 days. Shows recent mood pressure (0% = calm, 100% = intense).";
  const avgTip =
    "Average intensity across all saved entries. Higher = more intense feelings overall.";
  const domTip =
    "Most frequent emotion label in your saved history.";

  const top3 = topK(frequency, 3, total);

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Emotion Summary
        </h3>

        {/* Right block: last 7d % + sparkline + scale toggle */}
        <div className="flex flex-col items-end">
          <span
            className="text-xs text-zinc-500 dark:text-zinc-400"
            title={last7dTip}
          >
            Last 7 days avg intensity: <strong>{pct(last7dAvgIntensity)}</strong>
          </span>

          <div className="mt-1 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <div className="h-[28px]">
              <Sparkline
                series={Array.isArray(last7dSeries) ? last7dSeries : []}
                mode={scaleMode}
              />
            </div>
            <button
              className="rounded-lg border border-zinc-300 px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-900 dark:focus-visible:ring-zinc-600"
              onClick={() => setScaleMode((m) => (m === "absolute" ? "relative" : "absolute"))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setScaleMode((m) => (m === "absolute" ? "relative" : "absolute"));
                }
              }}
              aria-pressed={scaleMode === "relative"}
              aria-label={
                scaleMode === "absolute"
                  ? "Switch to relative scale (auto min–max)"
                  : "Switch to absolute scale (0 to 1)"
              }
              title={
                scaleMode === "absolute"
                  ? "Switch to relative scale (auto min–max)"
                  : "Switch to absolute scale (0–1)"
              }
              data-testid="sparkline-scale-toggle"
            >
              Scale: {scaleMode === "absolute" ? "Abs" : "Rel"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Entries" value={String(total)} />
        <Stat label="Avg Intensity" value={pct(avgIntensity)} title={avgTip} />
        <Stat
          label="Dominant Emotion"
          value={dominantEmotion ? titleCase(dominantEmotion) : "—"}
          title={domTip}
        />
      </div>

      {top3.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {top3.map((t) => (
            <li
              key={t.label}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              title={`${t.label}: ${t.pct}% of ${total} entries`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="text-zinc-800 dark:text-zinc-100">
                  {t.label.replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              </span>
              <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                {t.pct}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {total === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No history yet — add your first entry to see trends here.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div
      className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
      title={title}
    >
      <div className="text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
