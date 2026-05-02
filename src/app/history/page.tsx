// src/app/history/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
import useFeatureGate from "@/hooks/useFeatureGate";
import {
  loadStoredYearReview,
  generateYearReview,
  reviewYear,
  type YearReview,
} from "@/lib/imotara/yearInReview";

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
  suggestion: string;
  peakDay: string | null;
  prevTotal: number;
};

const SUGGESTIONS: Record<string, string> = {
  sadness: "Sadness takes energy. Even a short walk or talking to someone you trust can help lighten it.",
  fear: "Anxiety often shrinks when you name what's worrying you. Try writing one sentence about it.",
  anger: "Anger is a signal. Ask yourself what need is going unmet — that's where the real answer lives.",
  joy: "You had a joyful week! Notice what made those moments happen so you can invite more of them.",
  gratitude: "Gratitude rewires the brain. Keep this going — even noticing one small thing each day helps.",
  neutral: "A calm week. Use this steadiness to reflect on something you'd like to shift or deepen.",
  surprise: "Surprises stir us. Some are gifts in disguise. What unexpected thing taught you something?",
  disgust: "Strong negative reactions often point to values that matter deeply to you.",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    const dayCount: Record<number, number> = {};
    for (const r of thisWeek) {
      freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
      if (typeof r.intensity === "number") intensities.push(r.intensity);
      const day = new Date(r.createdAt).getDay();
      dayCount[day] = (dayCount[day] ?? 0) + 1;
    }
    const topEmotion = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

    const peakDayNum = Object.entries(dayCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
    const peakDay = peakDayNum != null ? (DAYS[Number(peakDayNum)] ?? null) : null;

    const avgThis =
      intensities.length ? intensities.reduce((a, b) => a + b, 0) / intensities.length : 0.5;
    const prevWeekRecords = all.filter(
      (r) =>
        !r.deleted &&
        r.createdAt >= now - 2 * weekMs &&
        r.createdAt < now - weekMs &&
        typeof r.intensity === "number",
    );
    let trend: WeeklySummary["trend"] = null;
    if (prevWeekRecords.length >= 2) {
      const avgPrev = prevWeekRecords.reduce((s: number, r: any) => s + r.intensity, 0) / prevWeekRecords.length;
      const diff = avgThis - avgPrev;
      trend = diff > 0.08 ? "up" : diff < -0.08 ? "down" : "steady";
    }

    const suggestion = SUGGESTIONS[topEmotion] ?? SUGGESTIONS.neutral;
    return { topEmotion, topCount: freq[topEmotion] ?? 1, total: thisWeek.length, trend, suggestion, peakDay, prevTotal: prevWeekRecords.length };
  } catch {
    return null;
  }
}

export default function HistoryPage() {
  const { mode } = useAnalysisConsent();
  const exportGate = useFeatureGate("EXPORT_DATA");
  const historyDaysGate = useFeatureGate("HISTORY_DAYS_LIMIT");
  // HISTORY_DAYS_LIMIT always returns enabled:true with params.days
  const historyDays = (historyDaysGate.gateResult.enabled
    ? ((historyDaysGate.gateResult.params?.days as number | undefined) ?? 7)
    : 7);
  const [exporting, setExporting] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [hasHistory, setHasHistory] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [yearReview, setYearReview] = useState<YearReview | null>(null);
  const [yearReviewLoading, setYearReviewLoading] = useState(false);
  const [yearReviewExpanded, setYearReviewExpanded] = useState(false);

  useEffect(() => {
    setWeeklySummary(computeWeeklySummary());
    // Start with loading=true; show timeline (hasHistory=true) so EmotionHistory
    // component can mount and trigger its own server seed if localStorage is empty.
    // After a short delay, recheck localStorage so the empty-state card reflects
    // the result of any auto-seed that happened inside EmotionHistory.
    const checkStorage = () => {
      try {
        const raw = window.localStorage.getItem("imotara:history:v1");
        const all = raw ? JSON.parse(raw) : [];
        const count = Array.isArray(all) ? all.filter((r: any) => !r.deleted).length : 0;
        setHasHistory(count > 0);
      } catch {
        setHasHistory(true); // assume data exists on error
      }
    };

    // Always render EmotionHistory (hasHistory=true) so auto-seed can run;
    // recheck after 2s to reflect any newly seeded data.
    setHasHistory(true);
    setLoading(false);
    const t = setTimeout(checkStorage, 2000);
    return () => clearTimeout(t);
  }, []);

  // Load or generate Year in Review
  useEffect(() => {
    const y = reviewYear();
    const stored = loadStoredYearReview(y);
    if (stored) { setYearReview(stored); return; }
    setYearReviewLoading(true);
    generateYearReview("you", y).then((review) => {
      if (review) setYearReview(review);
    }).finally(() => setYearReviewLoading(false));
  }, []);

  // Debounce search query before passing to EmotionHistory
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Align wording with Chat + Settings
  const consentLabel =
    mode === "allow-remote"
      ? "Remote analysis allowed"
      : "On-device only (local analysis)";

  async function handleExport() {
    if (!exportGate.allowed) {
      setToast({ message: exportGate.reason ?? "Export is available on Pro. Upgrade at /upgrade.", type: "error" });
      return;
    }
    // In log mode, show a soft nudge toast but still allow the export
    if (exportGate.nudge) {
      setToast({ message: "Export is a Pro feature. Upgrade at /upgrade for unlimited exports." });
    }
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

                  {/* Export — gated on Pro */}
                  {exportGate.allowed || exportGate.nudge ? (
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
                      {exportGate.nudge && !exportGate.loading && (
                        <span className="ml-0.5 rounded-full bg-indigo-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">Pro</span>
                      )}
                    </button>
                  ) : (
                    <Link
                      href="/upgrade"
                      aria-label="Upgrade to Pro to export history"
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-300 shadow-sm transition hover:bg-indigo-500/20"
                    >
                      <Download className="h-3 w-3" aria-hidden="true" />
                      <span>Export JSON</span>
                      <span className="ml-0.5 rounded-full bg-indigo-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">Pro</span>
                    </Link>
                  )}

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
              {/* History retention notice — shown only when tier has a day limit */}
              {!historyDaysGate.loading && isFinite(historyDays) && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-500/8 px-3 py-2">
                  <p className="text-[11px] text-amber-200/80">
                    <Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    Your plan shows the last{" "}
                    <strong>{historyDays} days</strong> of history.{" "}
                    {historyDays === 7 ? "Upgrade to Plus for 90 days or Pro for unlimited." : "Upgrade to Pro for unlimited history."}
                  </p>
                  <Link
                    href="/upgrade"
                    className="shrink-0 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/30"
                  >
                    Upgrade →
                  </Link>
                </div>
              )}

              {/* Tip text + mini legend + guidance hint */}
              <div className="space-y-1 px-1">
                <p className="text-[11px] text-zinc-500">
                  Tip: Use "Export JSON" to download a backup of your emotion
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

              {/* Weekly insight card */}
              {weeklySummary && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm backdrop-blur-md space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      This week
                    </p>
                    <div className="flex items-center gap-2">
                      {weeklySummary.peakDay && (
                        <span className="text-[10px] text-zinc-500">
                          Most active: <span className="text-zinc-300">{weeklySummary.peakDay}</span>
                        </span>
                      )}
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
                  </div>

                  {/* Emotion row */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {EMOTION_EMOJI[weeklySummary.topEmotion.toLowerCase()] ?? "💭"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize text-zinc-100">
                        Mostly {weeklySummary.topEmotion}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {weeklySummary.topCount} of {weeklySummary.total} logged moments
                        {weeklySummary.prevTotal > 0 && (
                          <> · {weeklySummary.total > weeklySummary.prevTotal ? "more" : weeklySummary.total < weeklySummary.prevTotal ? "fewer" : "same"} than last week</>
                        )}
                      </p>
                    </div>
                    <Link
                      href="/grow"
                      className="shrink-0 text-[11px] text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition"
                    >
                      Reflect →
                    </Link>
                  </div>

                  {/* Personalized suggestion */}
                  <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-white/8 pt-3">
                    💡 {weeklySummary.suggestion}
                  </p>
                </div>
              )}

              {/* Year in Review card */}
              {(yearReview || yearReviewLoading) && (
                <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/8 to-orange-500/6 px-4 py-4 shadow-sm backdrop-blur-md space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden="true">✦</span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">
                          Year in Review
                        </p>
                        <p className="text-xs font-semibold text-zinc-100">
                          Your {yearReview?.year ?? reviewYear()} emotional journey
                        </p>
                      </div>
                    </div>
                    {yearReview && (
                      <button
                        type="button"
                        aria-label={yearReviewExpanded ? "Collapse year review" : "Read your year review"}
                        onClick={() => setYearReviewExpanded((v) => !v)}
                        className="shrink-0 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/20"
                      >
                        {yearReviewExpanded ? "Collapse" : "Read →"}
                      </button>
                    )}
                  </div>

                  {/* Stats row */}
                  {yearReview && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400 border-t border-amber-400/15 pt-3">
                      <span>{yearReview.totalMessages} conversations</span>
                      <span className="capitalize">Dominant tone: <span className="text-zinc-200">{yearReview.dominantEmotion}</span></span>
                      <span>Most active: <span className="text-zinc-200">{yearReview.peakMonth}</span></span>
                    </div>
                  )}

                  {/* Narrative */}
                  {yearReviewLoading && !yearReview && (
                    <p className="text-[12px] text-zinc-500 animate-pulse">Composing your year in review…</p>
                  )}
                  {yearReview && yearReviewExpanded && (
                    <div className="space-y-3 border-t border-amber-400/15 pt-3">
                      {yearReview.narrative.split("\n\n").filter(Boolean).map((para, i) => (
                        <p key={i} className="text-[13px] leading-relaxed text-zinc-200">
                          {para.trim()}
                        </p>
                      ))}
                      <button
                        type="button"
                        aria-label="Copy year review to clipboard"
                        onClick={() => {
                          navigator.clipboard?.writeText(yearReview.narrative).then(() => {
                            setToast({ message: "Copied to clipboard ✓" });
                          });
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-300 transition hover:bg-amber-500/20"
                      >
                        Copy
                      </button>
                    </div>
                  )}
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
                  {searchQuery && searchResultCount >= 0 && (
                    <span className="shrink-0 text-[10px] text-zinc-500">
                      {searchResultCount === 0 ? "No results" : `${searchResultCount} result${searchResultCount !== 1 ? "s" : ""}`}
                    </span>
                  )}
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => { setSearchQuery(""); setDebouncedSearch(""); setSearchResultCount(-1); }}
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
                  <EmotionHistory searchFilter={debouncedSearch} onResultCount={setSearchResultCount} />
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
