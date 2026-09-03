"use client";

// src/components/admin/BroadcastHealth.tsx
// Can we send, and how much today? (BC-23)
//
// This screen exists because every one of these facts is invisible until it
// bites. A missing webhook secret does not stop mail going out — it stops the
// delivered and bounced numbers being real, which is worse, because the
// history report then looks fine while describing nothing.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";
import BroadcastIdentities from "./BroadcastIdentities";

type Identity = { name: string; email: string };

type Health = {
  sender: { email: string; name: string | null };
  identities: Identity[];
  sendingDomain: string;
  configured: { resend: boolean; unsubscribe: boolean; webhook: boolean };
  budget: { week: number; cap: number; sentToday: number; remaining: number };
  capOverride: string | null;
  suppressions: Record<string, number>;
  suppressedTotal: number;
  queuedNow: number;
  lastSentAt: string | null;
};

const CHECKS: {
  key: keyof Health["configured"];
  label: string;
  ok: string;
  bad: string;
  blocking: boolean;
}[] = [
  {
    key: "resend", label: "Sending", blocking: true,
    ok: "Connected to Resend.",
    bad: "RESEND_API_KEY is not set in this environment. Nothing can be sent.",
  },
  {
    key: "unsubscribe", label: "Unsubscribe links", blocking: true,
    ok: "Each recipient gets their own signed one-click link.",
    bad: "No signing secret, so unsubscribe links cannot be issued — and a broadcast must not go out without one.",
  },
  {
    key: "webhook", label: "Delivery reporting", blocking: false,
    ok: "Resend's callbacks are verified, so delivered and bounced counts are real.",
    bad: "RESEND_WEBHOOK_SECRET is not set. Mail still sends, but every message stays at “sent” — delivered, bounced and complaint counts will all read zero whatever actually happens.",
  },
];

export default function BroadcastHealth({ token }: { token: string }) {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast/health", adminFetchOpts(token));
      if (!res.ok) { setError(`Could not read sending status (HTTP ${res.status}).`); return; }
      setH(await res.json());
    } catch { setError("Network error."); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-300">{error}</div>;
  if (!h) return <div className="rounded-xl border border-white/8 bg-white/3 p-6 text-sm text-zinc-500">Loading…</div>;

  const used = h.budget.cap > 0 ? Math.min(100, Math.round((h.budget.sentToday / h.budget.cap) * 100)) : 0;
  const halted = h.budget.cap === 0;

  return (
    <div className="space-y-4">
      {/* ── Today's ceiling ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Today&apos;s allowance · warm-up week {h.budget.week}
          </p>
          <p className="text-[11px] tabular-nums text-zinc-400">
            {h.budget.sentToday} / {h.budget.cap} sent
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${used > 85 ? "bg-amber-400" : "bg-indigo-400"}`}
            style={{ width: `${used}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-300">
          {halted
            ? "Sending is halted — the daily cap is set to 0."
            : `${h.budget.remaining} more can go out today.`}
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
          The ceiling rises week by week on its own, counted from the first real
          send. It is derived from what was actually sent, never from a stored
          counter — a counter that drifts always drifts in the direction that
          lets too much out.
        </p>
        {h.capOverride !== null && (
          <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/8 px-2.5 py-1.5 text-[11px] text-amber-200">
            Overridden by BROADCAST_DAILY_CAP = {h.capOverride}. The warm-up
            schedule is being ignored while this is set.
          </p>
        )}
      </div>

      {/* ── Configuration ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
        <div className="border-b border-white/6 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Configuration</p>
        </div>
        {CHECKS.map((c) => {
          const ok = h.configured[c.key];
          return (
            <div key={c.key} className="flex gap-3 border-b border-white/5 px-4 py-3 last:border-b-0">
              <span className={`mt-0.5 text-xs ${ok ? "text-emerald-400" : c.blocking ? "text-rose-400" : "text-amber-400"}`}>
                {ok ? "●" : "○"}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-200">{c.label}</p>
                <p className={`mt-0.5 text-[11px] leading-relaxed ${ok ? "text-zinc-500" : c.blocking ? "text-rose-300" : "text-amber-300"}`}>
                  {ok ? c.ok : c.bad}
                </p>
              </div>
            </div>
          );
        })}
        <div className="border-t border-white/6 px-4 py-3">
          <p className="text-[11px] text-zinc-400">
            You can send as{" "}
            {(h.identities ?? []).length > 0 ? (
              <span className="font-mono text-zinc-200">
                {(h.identities ?? []).map((i) => (i.name ? `${i.name} <${i.email}>` : i.email)).join(", ")}
              </span>
            ) : (
              <span className="text-rose-300">nothing</span>
            )}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
            Mail can only leave from the verified domain ({h.sendingDomain}). Your
            login is <span className="text-zinc-400">{h.sender.email}</span>, and
            replies to anything you send come back to it whichever address carries
            the message — so an owner whose login is a personal address can still
            send, and still hears the answers.
          </p>
          {(h.identities ?? []).length === 0 && (
            <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-500/8 px-2.5 py-1.5 text-[11px] leading-relaxed text-rose-300">
              Nothing can be sent from this account. Your login is not on {h.sendingDomain}
              and no sending address is configured — add one below.
            </p>
          )}
        </div>
      </div>

      <BroadcastIdentities token={token} />

      {/* ── Suppressions and queue ────────────────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-4">
        {[
          { label: "Unsubscribed", v: h.suppressions.unsubscribed ?? 0, tone: "text-zinc-200" },
          { label: "Bad addresses", v: h.suppressions.hard_bounce ?? 0, tone: "text-amber-400" },
          { label: "Spam reports", v: h.suppressions.complaint ?? 0, tone: "text-rose-400" },
          { label: "Waiting to send", v: h.queuedNow, tone: "text-indigo-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{s.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${s.tone}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        {h.suppressedTotal} address{h.suppressedTotal === 1 ? "" : "es"} will never be
        mailed again, and every list is checked against that before a send —
        removing someone from a list does not undo it.
        {h.queuedNow > 0 && " Anything waiting goes out on the next minute's batch."}
        {h.lastSentAt && ` Last message sent ${new Date(h.lastSentAt).toLocaleString()}.`}
      </p>
    </div>
  );
}
