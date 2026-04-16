// src/components/imotara/MoodSummaryCard.tsx
"use client";

import { memo, useState } from "react";
import { useAnalysis, type AppMessage } from "@/lib/imotara/useAnalysis";
import type { AnalyzeMode } from "@/lib/imotara/useAnalysis";
import { Sparkles, Activity, AlertTriangle, ChevronDown } from "lucide-react";

type Props = {
  messages: AppMessage[];
  windowSize?: number;
  mode?: AnalyzeMode; // "local" | "api"
  className?: string;
};

/**
 * Emoji + label maps are intentionally a bit broader than the
 * strict Emotion union so we gracefully handle both:
 * - classic emotions: joy, sadness, anger, fear, disgust, surprise, neutral
 * - AI-enhanced snapshot keys: sad, anxious, stressed, happy, lonely, mixed
 */
const EMOJI: Record<string, string> = {
  joy: "😊",
  happiness: "😊",
  happy: "😊",
  sadness: "😔",
  sad: "😔",
  anger: "😠",
  angry: "😠",
  fear: "😟",
  anxious: "😟",
  anxiety: "😟",
  stress: "😣",
  stressed: "😣",
  disgust: "😣",
  surprise: "😲",
  lonely: "🥺",
  isolation: "🥺",
  mixed: "😶‍🌫️",
  neutral: "😐",
};

const LABEL: Record<string, string> = {
  joy: "Joy",
  happiness: "Happiness",
  happy: "Happy",
  sadness: "Sadness",
  sad: "Sad",
  anger: "Anger",
  angry: "Anger",
  fear: "Fear",
  anxious: "Anxious",
  anxiety: "Anxious",
  stress: "Stress",
  stressed: "Stressed",
  disgust: "Disgust",
  surprise: "Surprise",
  lonely: "Lonely",
  isolation: "Lonely",
  mixed: "Mixed",
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
  const [expanded, setExpanded] = useState(false);

  const engineLabel = mode === "api" ? "Local + Cloud AI" : "Local-only";

  // Derive display values (safe to call even before result is ready)
  const domRaw = result?.snapshot?.dominant || "neutral";
  const domKey = String(domRaw).toLowerCase();
  const domEmoji = EMOJI[domKey] ?? EMOJI["neutral"];
  const domLabel = LABEL[domKey] ?? LABEL["neutral"];

  const averages = result?.snapshot?.averages || {};
  const averagesByKey: Record<string, number | undefined> = { ...(averages as Record<string, number | undefined>) };
  const dominantIntensityRaw = averagesByKey[domKey] ?? averagesByKey[domLabel.toLowerCase()] ?? undefined;
  const dominantIntensity =
    typeof dominantIntensityRaw === "number" && Number.isFinite(dominantIntensityRaw)
      ? Math.max(0, Math.min(1, dominantIntensityRaw))
      : undefined;
  const intensityPct = dominantIntensity != null ? Math.round(dominantIntensity * 100) : null;

  const meta = (result as any)?.meta ?? {};
  const rawSafetyNote = typeof meta.safetyNote === "string" ? meta.safetyNote : "";
  const safetyNote = rawSafetyNote.trim().length > 0 ? rawSafetyNote.trim() : undefined;

  const avgEntries = Object.entries(averages as Record<string, number>)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 4);

  // ── Collapsed row (always rendered) ──────────────────────────────────────
  const collapsedRow = (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      className={`flex w-full items-center gap-2 rounded-2xl border border-white/12 bg-slate-950/70 px-3 py-2 text-left shadow-[0_8px_24px_rgba(15,23,42,0.7)] backdrop-blur-md transition hover:border-white/20 ${className}`}
    >
      {/* Icon */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/80 via-sky-500/80 to-emerald-400/80 text-white">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
      </div>

      {/* Label */}
      <span className="text-[11px] font-medium text-zinc-400">Mood Summary</span>

      {/* Mood capsule */}
      <div className="flex flex-1 items-center gap-2">
        {error ? (
          <span className="rounded-full border border-red-500/30 bg-red-950/40 px-2 py-0.5 text-[10px] text-red-300">
            Analysis failed
          </span>
        ) : loading && !result ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-zinc-400">
            <Activity className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
            Analyzing…
          </span>
        ) : !result ? (
          <span className="rounded-full border border-dashed border-white/15 bg-black/30 px-2 py-0.5 text-[10px] text-zinc-500">
            Waiting for messages…
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-[11px] text-zinc-100">
            <span aria-hidden="true">{domEmoji}</span>
            <span className="font-medium">{domLabel}</span>
            {intensityPct != null && (
              <>
                <span className="h-1 w-10 overflow-hidden rounded-full bg-zinc-800">
                  <span
                    className="block h-1 rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400"
                    style={{ width: `${Math.max(12, Math.min(100, intensityPct))}%`, transition: "width 0.7s ease-out" }}
                  />
                </span>
                <span className="tabular-nums text-[10px] text-zinc-400">{intensityPct}%</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Expand chevron */}
      <ChevronDown
        className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  );

  if (!expanded) return collapsedRow;

  // ── Expanded full card ────────────────────────────────────────────────────
  return (
    <section className={`rounded-2xl border border-white/12 bg-slate-950/70 text-xs text-zinc-200 shadow-[0_18px_40px_rgba(15,23,42,0.85)] backdrop-blur-md ${className}`}>
      {/* Collapsed row doubles as the header / collapse trigger */}
      <div className="px-1 pt-1">{collapsedRow}</div>

      {/* Expanded body */}
      <div className="px-4 pb-4 pt-3">
        {error ? (
          <p className="text-sm text-red-300">Mood analysis failed.</p>
        ) : loading && !result ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Activity className="h-4 w-4 animate-spin text-indigo-300" aria-hidden="true" />
            <span>Analyzing recent messages…</span>
          </div>
        ) : !result ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Activity className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <span>Waiting for messages…</span>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/80 text-2xl">
                <span aria-hidden="true">{domEmoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-zinc-50">
                  {result.summary.headline || "Mixed feelings overall"}
                </div>
                {result.summary.details && (
                  <div className="mt-1 text-[11px] leading-snug text-zinc-400">
                    {result.summary.details}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span>
                    Dominant feeling:{" "}
                    <span className="font-medium text-zinc-100">{domLabel}</span>
                  </span>
                  {intensityPct != null && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1 w-12 overflow-hidden rounded-full bg-zinc-800">
                        <span
                          className="block h-1 rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400"
                          style={{ width: `${Math.max(12, Math.min(100, intensityPct))}%`, transition: "width 0.7s ease-out" }}
                        />
                      </span>
                      <span className="tabular-nums text-[10px] text-zinc-400">{intensityPct}%</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {avgEntries.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-1.5">
                {avgEntries.map(([emotion, val]) => {
                  const key = String(emotion).toLowerCase();
                  const label = LABEL[key] ?? emotion;
                  const emoji = EMOJI[key] ?? "😐";
                  return (
                    <li
                      key={emotion}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-[11px] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-900"
                      title={`${label}: ${fmtPct(val)}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-base leading-none" aria-hidden="true">{emoji}</span>
                        <span className="text-zinc-100">{label}</span>
                      </span>
                      <span className="tabular-nums text-zinc-400">{fmtPct(val)}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {safetyNote && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-50">
                <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-amber-300" />
                <p className="leading-snug">
                  <span className="font-semibold">Gentle safety note:</span> {safetyNote}
                </p>
              </div>
            )}

            <div className="mt-2 text-[10px] text-zinc-600">
              Detected from keywords and patterns in your recent messages.{" "}
              {mode === "api" ? "Cloud AI analysis active." : "On-device analysis only — your words never leave your browser."}
            </div>

            <footer className="mt-1 text-[10px] text-zinc-500">
              Window:{" "}
              {new Date(result.snapshot.window.from).toLocaleString(undefined, { hour12: false })}{" "}
              —{" "}
              {new Date(result.snapshot.window.to).toLocaleString(undefined, { hour12: false })}
            </footer>
          </>
        )}
      </div>

      {/* tiny engine chip — bottom right */}
      <div className="flex justify-end px-4 pb-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
          <span className={`h-1.5 w-1.5 rounded-full ${mode === "api" ? "bg-emerald-400" : "bg-zinc-500"}`} />
          {engineLabel}
        </span>
      </div>
    </section>
  );
});
