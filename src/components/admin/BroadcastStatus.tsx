"use client";

// src/components/admin/BroadcastStatus.tsx
// A run in progress, and the record of one that finished (BC-21, BC-23).
//
// One component for both, because they are the same question asked at
// different times: what happened to each of these messages? While the cron is
// draining, the answer changes on its own, so this polls. Once it stops
// moving, it stops polling — a results page that keeps hitting the database
// forever is how a background tab becomes a load problem.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";

type Tallies = Record<string, number>;

type Timing = {
  counted: number; capped: boolean;
  firstSentAt: string | null; lastSentAt: string | null;
  sendWindowSeconds: number | null;
  medianSecondsToSend: number | null;
  medianSecondsToDeliver: number | null;
  slowestSecondsToDeliver: number | null;
  deliveryConfirmed: number;
};

type Send = {
  id: string; email: string; status: string;
  skip_reason: string | null; error: string | null; resend_id: string | null;
  created_at: string; sent_at: string | null; delivered_at: string | null;
};
type Broadcast = {
  id: string; subject: string; status: string; message_type: string;
  from_email: string; from_name: string | null;
  created_at: string; started_at: string | null; finished_at: string | null;
};

const CARDS: { key: string; label: string; tone: string; hint: string }[] = [
  { key: "queued",     label: "Waiting",    tone: "text-zinc-300",    hint: "not sent yet — the daily ceiling releases these in batches" },
  { key: "sent",       label: "Sent",       tone: "text-indigo-300",  hint: "accepted by Resend; delivery is confirmed separately" },
  { key: "delivered",  label: "Delivered",  tone: "text-emerald-400", hint: "the receiving server accepted it" },
  { key: "bounced",    label: "Bounced",    tone: "text-amber-400",   hint: "rejected — a hard bounce also suppresses the address" },
  { key: "complained", label: "Complaints", tone: "text-rose-400",    hint: "marked as spam; the address is suppressed" },
  { key: "failed",     label: "Failed",     tone: "text-rose-300",    hint: "could not be handed over after retries" },
  { key: "skipped",    label: "Skipped",    tone: "text-zinc-500",    hint: "suppressed before sending — never attempted" },
];

/** Human duration. Seconds below a minute, because that is the resolution
 *  that matters here — a send either happens straight away or it does not. */
function dur(secs: number | null): string {
  if (secs === null) return "—";
  if (secs < 1) return "under a second";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  const h = Math.floor(secs / 3600);
  return `${h}h ${Math.round((secs % 3600) / 60)}m`;
}

function gap(a: string | null, b: string | null): number | null {
  return a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 1000 : null;
}

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function BroadcastStatus({
  token, id, onBack, onDuplicate,
}: {
  token: string; id: string; onBack: () => void; onDuplicate: (newId: string) => void;
}) {
  const [b, setB] = useState<Broadcast | null>(null);
  const [t, setT] = useState<Tallies>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sends, setSends] = useState<Send[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingRows, setLoadingRows] = useState(true);
  const [timing, setTiming] = useState<Timing | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/broadcast/broadcasts/${id}`, adminFetchOpts(token));
      if (!res.ok) { setError(`Could not load this broadcast (HTTP ${res.status}).`); return; }
      const j = await res.json();
      setB(j.broadcast); setT(j.tallies ?? {});
    } catch { setError("Network error."); }
  }, [token, id]);

  useEffect(() => { void load(); }, [load]);

  const loadSends = useCallback(async () => {
    setLoadingRows(true);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (filter) qs.set("status", filter);
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/admin/broadcast/broadcasts/${id}/sends?${qs}`, adminFetchOpts(token));
      if (!res.ok) return;
      const j = await res.json();
      setSends(j.sends ?? []); setPages(j.pages ?? 0); setTotalRows(j.total ?? 0);
      setTiming(j.timing ?? null);
    } catch { /* the tallies above still tell the story; no second banner */ }
    finally { setLoadingRows(false); }
  }, [token, id, page, filter, q]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { void loadSends(); }, 250);
    return () => clearTimeout(t);
  }, [loadSends]);

  useEffect(() => {
    if (b?.status !== "sending") return;
    const iv = setInterval(() => { void load(); void loadSends(); }, 8_000);
    return () => clearInterval(iv);
  }, [b?.status, load, loadSends]);

  async function resume() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/broadcast/broadcasts/${id}/send`, adminFetchOpts(token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? `Could not resume (HTTP ${res.status}).`); return; }
      await load();
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }

  async function duplicate() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/broadcast/broadcasts/${id}/duplicate`, adminFetchOpts(token, { method: "POST" }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? `Could not duplicate (HTTP ${res.status}).`); return; }
      onDuplicate(j.broadcast.id);
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }

  if (!b) {
    return (
      <div>
        <button onClick={onBack} className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400">← All broadcasts</button>
        <div className="rounded-xl border border-white/8 bg-white/3 p-6 text-sm text-zinc-500">
          {error ?? "Loading…"}
        </div>
      </div>
    );
  }

  const attempted = ["sent", "delivered", "bounced", "complained", "failed"]
    .reduce((n, k) => n + (t[k] ?? 0), 0);
  const total = attempted + (t.queued ?? 0);
  const pct = total > 0 ? Math.round((attempted / total) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
        >← All broadcasts</button>

        <div className="flex flex-wrap gap-2">
          {/* A plain link, not a fetch: the export is a file download and the
              session cookie rides along on its own. Only owners reach this
              screen, and the route checks again anyway. */}
          <a
            href={`/api/admin/broadcast/broadcasts/${id}/export`}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
          >Download the audit CSV</a>
          <button
            onClick={() => void duplicate()}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
          >Duplicate</button>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-zinc-100">{b.subject}</h2>
      <p className="mt-1 text-[11px] text-zinc-500">
        From {b.from_name ? `${b.from_name} <${b.from_email}>` : b.from_email}
        {b.message_type === "operational" && " · operational notice"}
      </p>

      {b.status === "sending" && (
        <div className="mt-4 rounded-xl border border-indigo-400/25 bg-indigo-500/8 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-semibold text-indigo-200">Sending</p>
            <p className="text-[11px] tabular-nums text-indigo-300">{attempted} of {total}</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-indigo-400 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
            Batches go out every minute, up to the daily ceiling. You can close
            this page — it continues without you. Numbers refresh on their own.
          </p>
        </div>
      )}

      {b.status === "paused" && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/8 p-4">
          <p className="text-xs font-semibold text-amber-200">Paused after a send error</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-100/80">
            Something stopped the run outright — usually an expired API key or an
            unverified domain, not a bad address. The queue is intact and nobody
            will be mailed twice. Fix the cause, then resume; it picks up exactly
            where it stopped.
          </p>
          <button
            onClick={() => void resume()}
            disabled={busy}
            className="mt-2.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
          >{busy ? "Resuming…" : "Resume sending"}</button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-300">{error}</div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CARDS.filter((c) => (t[c.key] ?? 0) > 0 || c.key === "delivered").map((c) => (
          <button
            key={c.key}
            title={c.hint}
            onClick={() => { setFilter(filter === c.key ? "" : c.key); setPage(0); }}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${
              filter === c.key
                ? "border-indigo-400/40 bg-indigo-500/10"
                : "border-white/8 bg-white/3 hover:border-white/20"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{c.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${c.tone}`}>{t[c.key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* ── How long each step took ─────────────────────────────────────── */}
      {timing && timing.firstSentAt && (
        <div className="mt-4 rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            How long it took
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { l: "First message out", v: when(timing.firstSentAt) },
              { l: "Last message out", v: when(timing.lastSentAt) },
              { l: "Whole run", v: dur(timing.sendWindowSeconds) },
              { l: "Queued → handed over", v: dur(timing.medianSecondsToSend) },
            ].map((x) => (
              <div key={x.l}>
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">{x.l}</p>
                <p className="mt-0.5 text-xs text-zinc-200">{x.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 border-t border-white/6 pt-3 sm:grid-cols-3">
            {[
              { l: "Handed over → delivered", v: dur(timing.medianSecondsToDeliver) },
              { l: "Slowest delivery", v: dur(timing.slowestSecondsToDeliver) },
              { l: "Deliveries confirmed", v: `${timing.deliveryConfirmed} of ${timing.counted}` },
            ].map((x) => (
              <div key={x.l}>
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">{x.l}</p>
                <p className="mt-0.5 text-xs text-zinc-200">{x.v}</p>
              </div>
            ))}
          </div>

          <p className="mt-2.5 text-[10px] leading-relaxed text-zinc-600">
            Middle values, not averages — one message held behind a rate limit
            drags an average away from anything typical. &ldquo;Handed over&rdquo;
            is when Resend accepted it; &ldquo;delivered&rdquo; is when the
            receiving server did, which is the only one that means it arrived.
            {timing.capped && " Measured over the first 5000 recipients."}
          </p>
        </div>
      )}

      {/* ── Every recipient ─────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-white/3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Every recipient{filter ? ` · ${filter}` : ""}
            <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-600">
              {totalRows} row{totalRows === 1 ? "" : "s"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            {filter && (
              <button
                onClick={() => { setFilter(""); setPage(0); }}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400 transition hover:text-zinc-200"
              >Clear filter</button>
            )}
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Find an address…"
              className="w-44 rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40"
            />
          </div>
        </div>

        <div className="hidden grid-cols-[2.4fr_1fr_1.2fr_2fr] gap-3 border-b border-white/6 px-4 py-2 sm:grid">
          {["Address", "Status", "When", "What happened"].map((h) => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</span>
          ))}
        </div>

        {loadingRows ? (
          <div className="px-4 py-6 text-xs text-zinc-500">Loading…</div>
        ) : sends.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">
            {q || filter ? "Nothing matches that." : "No recipients recorded for this broadcast."}
          </div>
        ) : sends.map((r) => (
          <div key={r.id} className="grid grid-cols-1 gap-1 border-b border-white/5 px-4 py-2.5 last:border-b-0 sm:grid-cols-[2.4fr_1fr_1.2fr_2fr] sm:gap-3">
            <span className="truncate font-mono text-[11px] text-zinc-300">{r.email}</span>
            <span>
              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                r.status === "delivered" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                  : r.status === "bounced" || r.status === "complained" ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
                  : r.status === "failed" ? "border-rose-400/25 bg-rose-500/10 text-rose-300"
                  : r.status === "skipped" ? "border-white/10 bg-white/5 text-zinc-500"
                  : "border-indigo-400/25 bg-indigo-500/10 text-indigo-300"
              }`}>{r.status}</span>
            </span>
            <span className="text-[10px] leading-relaxed text-zinc-500">
              {when(r.delivered_at ?? r.sent_at ?? r.created_at)}
              {(() => {
                const a = gap(r.created_at, r.sent_at);
                const b = gap(r.sent_at, r.delivered_at);
                if (a === null && b === null) return null;
                return (
                  <span className="block text-zinc-600">
                    {a !== null && `out in ${dur(a)}`}
                    {a !== null && b !== null && " · "}
                    {b !== null && `delivered ${dur(b)} later`}
                  </span>
                );
              })()}
            </span>
            {/* The reason, verbatim. A bounce message is written by the
                receiving mail server and is the only thing that says whether
                an address is dead or the message was merely refused today. */}
            <span className="break-words text-[10px] leading-relaxed text-zinc-500">
              {r.error ?? (r.skip_reason ? `skipped — ${r.skip_reason}` : "—")}
            </span>
          </div>
        ))}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/6 px-4 py-2">
            <button
              onClick={() => setPage((n) => Math.max(0, n - 1))}
              disabled={page === 0}
              className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:text-zinc-200 disabled:opacity-30"
            >← Previous</button>
            <span className="text-[10px] tabular-nums text-zinc-600">Page {page + 1} of {pages}</span>
            <button
              onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}
              disabled={page >= pages - 1}
              className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:text-zinc-200 disabled:opacity-30"
            >Next →</button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-white/3">
        {[
          ["Created", when(b.created_at)],
          ["Started", when(b.started_at)],
          ["Finished", when(b.finished_at)],
          ["Status", b.status],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between border-b border-white/5 px-4 py-2.5 last:border-b-0">
            <span className="text-[11px] text-zinc-500">{k}</span>
            <span className="text-[11px] text-zinc-300">{v}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        Delivered and bounced counts arrive from Resend after sending, through
        the delivery webhook — a message can sit at &ldquo;sent&rdquo; for a
        minute or two before it moves. Press any figure above to filter the
        list to it. The CSV carries the same rows plus the consent record for
        each address, which is the version to keep for an audit.
      </p>
    </div>
  );
}
