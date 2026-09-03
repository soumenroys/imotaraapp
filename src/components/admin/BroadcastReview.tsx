"use client";

// src/components/admin/BroadcastReview.tsx
// The last screen before mail leaves the building (BC-20).
//
// Everything here is arithmetic the admin can check: who is on the list, who
// is being skipped and why, how many will actually receive it, and how long
// the warm-up ceiling will take to drain it. The preview endpoint computes all
// of it and writes nothing.
//
// The confirmation is typed, and it is the recipient count rather than a word
// like SEND. Typing "412" requires having read the number, and the API refuses
// the send if the queue no longer matches it — so a list that changed while
// this screen was open cannot be mailed on the strength of an approval given
// for a different set of people.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";

type Preview = {
  broadcast: { id: string; subject: string; status: string; messageType: string; from: string };
  counts: {
    total: number; queued: number; skipped: number;
    skippedByReason: { unsubscribed: number; hard_bounce: number; complaint: number };
  };
  budget: { week: number; cap: number; sentToday: number; remaining: number };
  exceedsTodaysBudget: boolean;
  daysNeeded: number | null;
  blockers: string[];
  canSend: boolean;
};

const REASON_LABEL: Record<string, string> = {
  unsubscribed: "unsubscribed",
  hard_bounce: "address does not exist",
  complaint: "marked us as spam",
};

export default function BroadcastReview({
  token, id, onBack, onEdit, onSent,
}: {
  token: string; id: string;
  onBack: () => void; onEdit: () => void; onSent: () => void;
}) {
  const [p, setP] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [typed, setTyped] = useState("");
  const [acceptMultiDay, setAccept] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/broadcast/broadcasts/${id}/preview`, adminFetchOpts(token));
      if (!res.ok) { setError(`Could not check this broadcast (HTTP ${res.status}).`); return; }
      setP(await res.json());
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token, id]);

  useEffect(() => { void load(); }, [load]);

  async function send() {
    if (!p || sending) return;
    setSending(true); setError(null);
    try {
      const res = await fetch(`/api/admin/broadcast/broadcasts/${id}/send`, adminFetchOpts(token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmCount: p.counts.queued,
          acceptMultiDay,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      }));
      const j = await res.json().catch(() => ({}));

      if (res.status === 409 && typeof j.expected === "number") {
        // The list changed underneath us. Reload rather than let the admin
        // retype the old number until it happens to work.
        setError(
          `The list changed while you were reviewing — it is now ${j.expected}, not ${p.counts.queued}. ` +
          `Nothing was sent. Check the numbers again.`,
        );
        setTyped("");
        await load();
        return;
      }
      if (!res.ok) {
        setError([j.error, j.hint, ...(j.blockers ?? [])].filter(Boolean).join(" — "));
        return;
      }
      onSent();
    } catch { setError("Network error — nothing was sent."); }
    finally { setSending(false); }
  }

  if (loading) return <div className="rounded-xl border border-white/8 bg-white/3 p-6 text-sm text-zinc-500">Checking…</div>;

  if (!p) {
    return (
      <div>
        <Back onBack={onBack} />
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-300">{error}</div>
      </div>
    );
  }

  const { counts, budget } = p;
  const multiDay = p.exceedsTodaysBudget;
  const confirmed = typed.trim() === String(counts.queued);
  const ready = p.canSend && confirmed && (!multiDay || acceptMultiDay) && !sending;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Back onBack={onBack} />
        <button
          onClick={onEdit}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
        >Edit the message</button>
      </div>

      <h2 className="mb-1 text-sm font-semibold text-zinc-100">{p.broadcast.subject}</h2>
      <p className="mb-5 text-[11px] text-zinc-500">
        From {p.broadcast.from}
        {p.broadcast.messageType === "operational" && " · operational notice, no unsubscribe link"}
      </p>

      {/* ── The arithmetic ────────────────────────────────────────────── */}
      <div className="mb-4 overflow-hidden rounded-xl border border-white/8 bg-white/3">
        <Line label="On the list" value={counts.total} />
        {counts.skipped > 0 && (
          <div className="border-b border-white/5 px-4 py-3">
            <p className="text-xs text-zinc-300">
              <span className="font-semibold text-amber-300">−{counts.skipped}</span> will not be sent to
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {Object.entries(counts.skippedByReason)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => `${n} ${REASON_LABEL[k] ?? k}`)
                .join(" · ")}
            </p>
          </div>
        )}
        <div className="flex items-baseline justify-between px-4 py-3.5">
          <span className="text-xs font-semibold text-zinc-200">Will receive it</span>
          <span className="text-xl font-semibold tabular-nums text-emerald-400">{counts.queued}</span>
        </div>
      </div>

      {/* ── Warm-up ───────────────────────────────────────────────────── */}
      <div className={`mb-4 rounded-xl border px-4 py-3 ${
        multiDay ? "border-amber-400/25 bg-amber-500/8" : "border-white/8 bg-white/3"
      }`}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Warm-up · week {budget.week}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
          {budget.sentToday} of {budget.cap} sent today, {budget.remaining} left.
          {multiDay ? (
            <> This queue is larger than that, so it will go out over about{" "}
              <span className="font-semibold text-amber-300">{p.daysNeeded} days</span> — a
              few hundred a day, automatically.</>
          ) : (
            <> This fits inside today&apos;s allowance.</>
          )}
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
          The ceiling exists because a new sending domain that suddenly emits
          thousands of messages gets filtered as a spammer — and this domain also
          carries password resets and session notices.
        </p>

        {multiDay && (
          <label className="mt-2.5 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={acceptMultiDay}
              onChange={(e) => setAccept(e.target.checked)}
              className="mt-0.5 accent-amber-400"
            />
            <span className="text-[11px] text-amber-200">
              I understand this will take about {p.daysNeeded} days to finish.
            </span>
          </label>
        )}
      </div>

      {/* ── Blockers ──────────────────────────────────────────────────── */}
      {p.blockers.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3">
          <p className="mb-1.5 text-[11px] font-semibold text-rose-300">
            {p.blockers.length === 1 ? "One thing" : `${p.blockers.length} things`} must be fixed first
          </p>
          <ul className="space-y-1">
            {p.blockers.map((b) => (
              <li key={b} className="text-[11px] text-rose-200">· {b}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs leading-relaxed text-rose-300">{error}</div>
      )}

      {/* ── Send ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="text-xs text-zinc-300">
          Type <span className="font-mono font-semibold text-zinc-100">{counts.queued}</span> to confirm
          you are sending to that many people.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!p.canSend}
            inputMode="numeric"
            autoFocus
            aria-label={`Type ${counts.queued} to confirm`}
            className="w-28 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-center font-mono text-sm text-zinc-100 outline-none focus:border-indigo-500/40 disabled:opacity-40"
          />
          <button
            onClick={() => void send()}
            disabled={!ready}
            title={
              !p.canSend ? "Something above still needs fixing"
                : !confirmed ? `Type ${counts.queued} in the box first`
                : multiDay && !acceptMultiDay ? "Tick the box above to accept the multi-day send"
                : undefined
            }
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {sending ? "Starting…" : scheduledAt ? `Schedule for ${counts.queued} people` : `Send to ${counts.queued} people`}
          </button>
        </div>
        {!confirmed && (
          <p className="mt-2 text-[10px] text-amber-300/80">
            The button stays locked until the box reads {counts.queued}.
          </p>
        )}
        <div className="mt-3 border-t border-white/6 pt-3">
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Send later
            </span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-indigo-500/40"
            />
            {scheduledAt && (
              <button
                onClick={() => setScheduledAt("")}
                className="text-[10px] text-zinc-500 underline"
              >send now instead</button>
            )}
          </label>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
            {scheduledAt
              ? "The recipient list is fixed now, not at that time — what goes out is who is on it today."
              : "Leave empty to start immediately."}
          </p>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          There is no undo, though a run can be stopped part-way from its own page. Sending starts within a minute and continues in the
          background — you do not need to keep this page open.
        </p>
      </div>
    </div>
  );
}

function Back({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
    >← All broadcasts</button>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 px-4 py-3">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-sm tabular-nums text-zinc-200">{value}</span>
    </div>
  );
}
