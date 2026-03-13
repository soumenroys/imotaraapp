// src/app/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Download, Clock, Search, X as XIcon } from "lucide-react";
import EmotionHistory from "@/components/imotara/EmotionHistory";
import MoodHeatmap from "@/components/imotara/MoodHeatmap";
import SkeletonLoader from "@/components/imotara/SkeletonLoader";
import OnThisDay from "@/components/imotara/OnThisDay";
import EmotionRadarChart from "@/components/imotara/EmotionRadarChart";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import { getHistory } from "@/lib/imotara/history";
import TopBar from "@/components/imotara/TopBar";
import Toast, { type ToastType } from "@/components/imotara/Toast";

// #1: Weekly trend summary computed from localStorage emotion history
const EMOTION_EMOJI: Record<string, string> = {
  joy: "😊", happy: "😊", happiness: "😊",
  sad: "😔", sadness: "😔", lonely: "🌧️",
  angry: "😤", anger: "😤",
  stressed: "😰", stress: "😰",
  anxious: "😟", anxiety: "😟", fear: "😟",
  neutral: "😐", surprise: "😮",
};

type WeeklySummary = {
  topEmotion: string;
  topCount: number;
  total: number;
  trend: "up" | "down" | "steady" | null;
};

function computeWeeklySummary(): WeeklySummary | null {
  try {
    const raw = window.localStorage.getItem("imotara:history:v1");
    if (!raw) return null;
    const all = JSON.parse(raw) as any[];
    if (!Array.isArray(all)) return null;
    const now = Date.now();
    const weekMs = 7 * 86_400_000;
    const thisWeek = all.filter(
      (r) => !r.deleted && r.createdAt >= now - weekMs && r.emotion && r.emotion !== "neutral",
    );
    if (thisWeek.length < 3) return null;

    const freq: Record<string, number> = {};
    const intensities: number[] = [];
    for (const r of thisWeek) {
      freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
      if (typeof r.intensity === "number") intensities.push(r.intensity);
    }
    const topEmotion = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

    const avgThis =
      intensities.length ? intensities.reduce((a, b) => a + b, 0) / intensities.length : 0.5;
    const prevWeek = all.filter(
      (r) =>
        !r.deleted &&
        r.createdAt >= now - 2 * weekMs &&
        r.createdAt < now - weekMs &&
        typeof r.intensity === "number",
    );
    let trend: WeeklySummary["trend"] = null;
    if (prevWeek.length >= 2) {
      const avgPrev = prevWeek.reduce((s: number, r: any) => s + r.intensity, 0) / prevWeek.length;
      const diff = avgThis - avgPrev;
      trend = diff > 0.08 ? "up" : diff < -0.08 ? "down" : "steady";
    }
    return { topEmotion, topCount: freq[topEmotion] ?? 1, total: thisWeek.length, trend };
  } catch {
    return null;
  }
}

export default function HistoryPage() {
  const { mode } = useAnalysisConsent();
  const [exporting, setExporting] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [hasHistory, setHasHistory] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    setWeeklySummary(computeWeeklySummary());
    try {
      const raw = window.localStorage.getItem("imotara:history:v1");
      const all = raw ? JSON.parse(raw) : [];
      setHasHistory(Array.isArray(all) && all.filter((r: any) => !r.deleted).length > 0);
    } catch {
      setHasHistory(true); // assume data exists on error
    }
    setLoading(false);
  }, []);

  // Align wording with Chat + Settings
  const consentLabel =
    mode === "allow-remote"
      ? "Remote analysis allowed"
      : "On-device only (local analysis)";

  async function handleExport() {
    try {
      setExporting(true);
      const data = await getHistory();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `imotara-history-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      setToast({ message: "History downloaded ✓" });
    } catch (err) {
      console.error("Failed to export history:", err);
      setToast({ message: "Export failed", type: "error" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
      {/* Global app top bar with nav + sync chip + conflicts */}
      <TopBar title="Emotion History" showSyncChip showConflictsButton />

      <main className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl px-3 pb-6 pt-4 text-zinc-100 sm:px-4">
        <div className="flex flex-1 flex-col">
          {/* ---------------------------------------------------- */}
          {/* HEADER – Aurora glass with subtle glow / depth       */}
          {/* ---------------------------------------------------- */}
          <header
            className="relative z-20"
            aria-label="Emotion history header"
          >
            <div className="relative">
              {/* Soft aurora glow behind the header card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-4 -top-4 h-10 rounded-full bg-[radial-gradient(circle_at_10%_0%,rgba(129,140,248,0.38),transparent_55%),radial-gradient(circle_at_90%_0%,rgba(52,211,153,0.34),transparent_55%)] opacity-80 blur-2 sm:inset-x-6 sm:h-11"
              />

              <div className="imotara-glass-card animate-fade-in flex flex-col gap-2 rounded-2xl px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
                {/* LEFT */}
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-white shadow-[0_10px_30px_rgba(15,23,42,0.8)]">
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-50">
                      Emotion History
                    </p>
                    <p className="text-xs text-zinc-400">
                      Timeline of how your conversations felt over time.
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Grouped by day (Today / Yesterday) to make patterns easier to spot.
                    </p>
                    {/* Data controls hint – mirrors Chat header tone */}
                    <p className="mt-1 text-[11px] text-zinc-500">
                      You can sync and review conflicts here, and{" "}
                      <Link
                        href="/privacy"
                        className="underline decoration-indigo-400/60 underline-offset-2 hover:text-indigo-300"
                      >
                        download or delete what’s stored on this device
                      </Link>{" "}
                      anytime.
                    </p>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] sm:justify-end">
                  {/* Consent badge */}
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] text-zinc-200 backdrop-blur-sm"
                    aria-label={`Current analysis mode: ${consentLabel}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote"
                        ? "bg-emerald-400"
                        : "bg-zinc-500"
                        }`}
                      aria-hidden="true"
                    />
                    {consentLabel}
                  </span>

                  <span className="hidden max-w-xs text-[11px] text-zinc-500 sm:inline">
                    Emotion analysis mode is shared between Chat, History, and
                    Settings.
                  </span>

                  {/* Search toggle */}
                  <button
                    type="button"
                    onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); }}
                    aria-label="Search emotion history"
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] shadow-sm transition ${
                      showSearch
                        ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-200"
                        : "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
                    }`}
                  >
                    <Search className="h-3 w-3" aria-hidden="true" />
                    <span>Search</span>
                  </button>

                  {/* Export */}
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting}
                    aria-busy={exporting}
                    aria-label="Export full emotion history as JSON"
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 shadow-sm transition hover:bg-white/10 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    <span>{exporting ? "Exporting…" : "Export JSON"}</span>
                  </button>

                  {/* Back to Chat */}
                  <Link
                    href="/chat"
                    aria-label="Back to chat"
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 shadow-sm transition hover:bg-white/10 hover:text-zinc-50"
                  >
                    <MessageSquare className="h-3 w-3" aria-hidden="true" />
                    <span>Back to Chat</span>
                  </Link>
                </div>
              </div>
            </div>
          </header>

          {/* ---------------------------------------------------- */}
          {/* BODY                                                 */}
          {/* ---------------------------------------------------- */}
          <section className="flex-1 overflow-auto pt-6">
            <div className="mx-auto max-w-5xl space-y-4">
              {/* Tip text + mini legend + guidance hint */}
              <div className="space-y-1 px-1">
                <p className="text-[11px] text-zinc-500">
                  Tip: Use “Export JSON” to download a backup of your emotion
                  history. You can keep this file or import it into your own
                  tools later.
                </p>
                <p className="text-[11px] text-zinc-600">
                  Legend:{" "}
                  <span className="text-emerald-300">●</span> synced entries ·{" "}
                  <span className="text-amber-300">●</span> entries with
                  conflicts you can review in the Conflicts panel.
                </p>
                {/* Guidance hint for teens – no functional change */}
                <p className="text-[11px] text-zinc-500">
                  Each entry below represents a moment from your conversations. You can open items to see more
                  detail or jump back into{" "}
                  <Link
                    href="/chat"
                    className="underline decoration-indigo-400/60 underline-offset-2 hover:text-indigo-300"
                  >
                    Chat
                  </Link>{" "}
                  from linked messages.
                </p>
              </div>

              {/* #1: Weekly trend summary */}
              {weeklySummary && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      This week
                    </p>
                    {weeklySummary.trend && (
                      <span className={`text-[10px] font-medium ${
                        weeklySummary.trend === "down" ? "text-emerald-400" :
                        weeklySummary.trend === "up"   ? "text-amber-400"   : "text-zinc-400"
                      }`}>
                        {weeklySummary.trend === "down" ? "Intensity easing ↓" :
                         weeklySummary.trend === "up"   ? "Intensity rising ↑" : "Steady week"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl">
                      {EMOTION_EMOJI[weeklySummary.topEmotion.toLowerCase()] ?? "💭"}
                    </span>
                    <div>
                      <p className="text-sm font-medium capitalize text-zinc-100">
                        Mostly {weeklySummary.topEmotion}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {weeklySummary.topCount} of {weeklySummary.total} logged moments this week
                      </p>
                    </div>
                    <Link
                      href="/grow"
                      className="ml-auto text-[11px] text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition"
                    >
                      Reflect on this →
                    </Link>
                  </div>
                </div>
              )}

              {/* Search bar */}
              {showSearch && (
                <div className="animate-fade-in flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 backdrop-blur-sm">
                  <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by emotion or message…"
                    className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery("")}
                      className="text-zinc-500 hover:text-zinc-300 transition"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* On This Day — memory flashback */}
              {!loading && <OnThisDay />}

              {/* Mood Heatmap — 12-week calendar */}
              {loading ? (
                <SkeletonLoader rows={2} variant="card" />
              ) : (
                <MoodHeatmap />
              )}

              {/* Emotion radar chart */}
              {!loading && <EmotionRadarChart />}

              {/* Main history card */}
              {loading ? (
                <SkeletonLoader rows={3} variant="list" />
              ) : !hasHistory ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/40 via-sky-500/40 to-emerald-400/40 text-2xl">
                    <Clock className="h-6 w-6 text-zinc-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Your emotion timeline is empty</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Start chatting or reflecting and your emotional moments will appear here, grouped by day.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Link
                      href="/chat"
                      className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-4 py-1.5 text-xs font-medium text-black shadow transition hover:brightness-110"
                    >
                      Start chatting →
                    </Link>
                    <Link
                      href="/grow"
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
                    >
                      Reflect today →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                  <EmotionHistory searchFilter={searchQuery} />
                </div>
              )}

              {/* bottom spacing for breathing room */}
              <div className="h-6" />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
