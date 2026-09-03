"use client";

// src/components/admin/BroadcastSection.tsx
// The 📣 Broadcast tab in /admin (BC-16, BC-17).
//
// Owner role only. The tab is hidden for other roles, and every route behind
// it enforces the same rule server-side — the hidden tab is convenience, not
// security.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";

type View = { name: "list" } | { name: "detail"; id: string };

type Tallies = {
  queued: number; sent: number; delivered: number; bounced: number;
  complained: number; skipped: number; failed: number; attempted: number;
};

type Row = {
  id: string;
  subject: string;
  messageType: "broadcast" | "operational";
  status: "draft" | "sending" | "sent" | "failed" | "paused";
  from: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  tallies: Tallies;
};

type Summary = {
  broadcasts: number; attempted: number; delivered: number;
  bounced: number; complained: number; failed: number; skipped: number;
  deliveredPct: number | null;
};

const STATUS_STYLE: Record<Row["status"], string> = {
  draft:    "border-white/10 bg-white/5 text-zinc-300",
  sending:  "border-indigo-400/30 bg-indigo-500/10 text-indigo-300",
  sent:     "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  paused:   "border-amber-400/30 bg-amber-500/10 text-amber-300",
  failed:   "border-rose-400/30 bg-rose-500/10 text-rose-300",
};

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function BroadcastSection({ token }: { token: string }) {
  const [view, setView] = useState<View>({ name: "list" });
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/broadcast/history?limit=100", adminFetchOpts(token));
      if (res.status === 403) {
        setError("Broadcast is restricted to the owner role.");
        return;
      }
      if (!res.ok) {
        // The history route depends on a database function. Say so, rather
        // than "failed to load" — the difference decides whether this is a
        // migration that was missed or a real fault.
        setError(`Could not load broadcasts (HTTP ${res.status}).`);
        return;
      }
      const j = await res.json();
      setRows(j.broadcasts ?? []);
      setSummary(j.summary ?? null);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // A run in flight changes on its own as the cron drains it, so poll while
  // one is active — and stop as soon as nothing is moving, rather than
  // polling this screen forever in the background.
  useEffect(() => {
    if (!rows.some((r) => r.status === "sending")) return;
    const t = setInterval(() => { void load(); }, 10_000);
    return () => clearInterval(t);
  }, [rows, load]);

  if (view.name === "detail") {
    return (
      <div>
        <button
          onClick={() => setView({ name: "list" })}
          className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
        >
          ← All broadcasts
        </button>
        <div className="rounded-xl border border-white/8 bg-white/3 p-6 text-sm text-zinc-400">
          Detail view for <span className="font-mono text-zinc-300">{view.id}</span> is not built yet.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary strip */}
      {summary && summary.broadcasts > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          {[
            { label: "Broadcasts", value: summary.broadcasts, tone: "text-zinc-100" },
            { label: "Messages sent", value: summary.attempted, tone: "text-zinc-100" },
            {
              label: "Delivered",
              // null, not 0, when nothing has been attempted — "0%" reads as
              // total failure rather than "nothing sent yet".
              value: summary.deliveredPct === null ? "—" : `${summary.deliveredPct}%`,
              tone: "text-emerald-400",
            },
            { label: "Bounced", value: summary.bounced, tone: "text-amber-400" },
            { label: "Complaints", value: summary.complained, tone: "text-rose-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{s.label}</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${s.tone}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">Your broadcasts</h2>
          {!loading && <span className="text-[11px] text-zinc-600">{rows.length}</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-white/8 bg-white/3" />
          ))}
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="rounded-xl border border-white/8 bg-white/3 px-5 py-10 text-center">
          <p className="text-sm text-zinc-300">No broadcasts yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
            A broadcast goes out from your own address to a recipient list you
            build. Sending is deliberately paced during the first weeks so the
            domain&apos;s reputation is not damaged — password resets and
            session notices share it.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
          <div className="hidden grid-cols-[3fr_1fr_1.1fr_1.4fr] gap-3 border-b border-white/6 px-4 py-2.5 sm:grid">
            {["Subject", "Recipients", "Status", "Activity"].map((h) => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</span>
            ))}
          </div>

          {rows.map((r) => {
            const t = r.tallies;
            const done = t.delivered + t.sent;
            return (
              <button
                key={r.id}
                onClick={() => setView({ name: "detail", id: r.id })}
                className="grid w-full grid-cols-1 gap-2 border-b border-white/5 px-4 py-3 text-left transition last:border-b-0 hover:bg-white/4 sm:grid-cols-[3fr_1fr_1.1fr_1.4fr] sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-zinc-200">{r.subject}</p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                    {r.from}
                    {r.messageType === "operational" && " · operational notice"}
                  </p>
                </div>

                <span className="text-xs tabular-nums text-zinc-400">
                  {t.attempted > 0 ? `${done} / ${t.attempted}` : "—"}
                </span>

                <div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                  {t.skipped > 0 && (
                    <span className="ml-1.5 text-[10px] text-zinc-600">{t.skipped} skipped</span>
                  )}
                </div>

                <span className="text-[11px] text-zinc-500">
                  {when(r.finishedAt ?? r.startedAt ?? r.createdAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">
        Sent broadcasts are permanent and cannot be edited or deleted — the
        record has to keep saying what people actually received. Duplicate one
        to send a revised version.
      </p>
    </div>
  );
}
