// src/app/history/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import EmotionHistory from "@/components/imotara/EmotionHistory";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import { getHistory } from "@/lib/imotara/history";

export default function HistoryPage() {
  const { mode } = useAnalysisConsent();
  const [exporting, setExporting] = useState(false);

  const consentLabel =
    mode === "allow-remote"
      ? "Remote analysis ON (local + remote)"
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
    <main className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl px-4 py-6 text-zinc-50 sm:px-6">
      <div className="flex flex-1 flex-col">
        {/* ---------------------------------------------------- */}
        {/* HEADER – Aurora glass, aligned with Chat UI          */}
        {/* ---------------------------------------------------- */}
        <header className="sticky top-0 z-20">
          <div className="imotara-glass-card flex flex-col gap-2 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {/* LEFT: Icon + Title */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-50 shadow-sm">
                <MessageSquare className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-zinc-50">
                  Emotion History
                </p>
                <p className="text-xs text-zinc-300">
                  Timeline of how your conversations felt over time.
                </p>
              </div>
            </div>

            {/* RIGHT: Consent status + Actions */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:justify-end">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-100">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-400"
                    }`}
                />
                {consentLabel}
              </span>

              <span className="hidden max-w-xs text-[11px] text-zinc-400 sm:inline">
                Emotion analysis mode is shared between Chat and History.
              </span>

              {/* Export JSON */}
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 transition hover:bg-white/10 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{exporting ? "Exporting…" : "Export JSON"}</span>
              </button>

              {/* Back to Chat */}
              <Link
                href="/chat"
                className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 transition hover:bg-white/10 hover:text-zinc-50"
              >
                <MessageSquare className="h-3 w-3" />
                <span>Back to Chat</span>
              </Link>
            </div>
          </div>
        </header>

        {/* ---------------------------------------------------- */}
        {/* BODY                                                 */}
        {/* ---------------------------------------------------- */}
        <section className="flex-1 overflow-auto pt-4">
          <div className="mx-auto max-w-5xl space-y-2">
            {/* Small helper text about export */}
            <p className="px-1 text-[11px] text-zinc-400">
              Tip: Use “Export JSON” to download a copy of your emotion history
              as a file you can keep or back up.
            </p>

            <div className="imotara-glass-card rounded-2xl px-3 py-3 sm:px-4 sm:py-4">
              <EmotionHistory />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
