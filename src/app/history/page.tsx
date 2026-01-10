// src/app/history/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Download } from "lucide-react";
import EmotionHistory from "@/components/imotara/EmotionHistory";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import { getHistory } from "@/lib/imotara/history";
import TopBar from "@/components/imotara/TopBar";

export default function HistoryPage() {
  const { mode } = useAnalysisConsent();
  const [exporting, setExporting] = useState(false);

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
    } catch (err) {
      console.error("Failed to export history:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
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

              {/* Main history card */}
              <div className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                <EmotionHistory />
              </div>

              {/* bottom spacing for breathing room */}
              <div className="h-6" />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
