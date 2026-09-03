"use client";

// src/components/admin/BroadcastRecipients.tsx
// Recipients inside one list: provenance capture and the five validation
// buckets (BC-18, part 2).
//
// The paste is always CHECKED before anything is written. Seeing what a paste
// contains — what is new, what is already there, what is suppressed, what is
// malformed — before committing is the difference between adding addresses and
// hoping.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";
import type { ListRow } from "./BroadcastLists";

// Kept in step with the CHECK constraint in broadcast_v1.sql. Every label
// names something the PERSON did — there is deliberately no "found online".
const SOURCES: { value: string; label: string }[] = [
  { value: "event",        label: "Gave it at a demonstration or event" },
  { value: "meeting",      label: "Gave it at a meeting or visit" },
  { value: "email",        label: "Emailed us" },
  { value: "whatsapp",     label: "Messaged us on WhatsApp" },
  { value: "social",       label: "Messaged or commented on our social media" },
  { value: "website_form", label: "Filled in the form on imotara.com" },
  { value: "phone",        label: "Called us" },
  { value: "app_signup",   label: "Signed up in the app" },
];

type Buckets = {
  toAdd: { original: string; email: string }[];
  alreadyOnList: { email: string; addedAt: string | null }[];
  repeatedInPaste: string[];
  invalid: { original: string; reason: string; suggestion?: string }[];
  suppressed: { email: string; reason: string }[];
};

type Recipient = {
  id: string; email: string; source: string;
  source_detail: string; collected_at: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function BroadcastRecipients({
  token, list, onBack,
}: { token: string; list: ListRow; onBack: () => void }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [raw, setRaw] = useState("");
  const [source, setSource] = useState("");
  const [detail, setDetail] = useState("");
  const [collected, setCollected] = useState(today());

  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/broadcast/lists/${list.id}/recipients`, adminFetchOpts(token));
      if (!res.ok) { setError(`Could not load recipients (HTTP ${res.status}).`); return; }
      const j = await res.json();
      setRecipients(j.recipients ?? []); setTotal(j.total ?? 0);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token, list.id]);

  useEffect(() => { void load(); }, [load]);

  async function post(dryRun: boolean) {
    if (!raw.trim() || busy) return;
    setBusy(true); setError(null); setAdded(null);
    try {
      const res = await fetch(`/api/admin/broadcast/lists/${list.id}/recipients`, adminFetchOpts(token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw, dryRun,
          source, source_detail: detail, collected_at: collected,
        }),
      }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? `Request failed (HTTP ${res.status}).`); return; }
      setBuckets(j.buckets ?? null);
      if (!dryRun) {
        setAdded(j.added ?? 0);
        setRaw("");
        await load();
      }
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }

  async function remove(email: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(
        `/api/admin/broadcast/lists/${list.id}/recipients?email=${encodeURIComponent(email)}`,
        adminFetchOpts(token, { method: "DELETE" }),
      );
      if (!res.ok) { setError(`Could not remove ${email} (HTTP ${res.status}).`); return; }
      setConfirmRemove(null);
      await load();
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }

  const provenanceComplete = Boolean(source && detail.trim() && collected);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
      >← Recipient lists</button>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">{list.name}</h2>
        <span className="text-[11px] text-zinc-600">{total} recipient{total === 1 ? "" : "s"}</span>
      </div>

      {/* ── Provenance ─────────────────────────────────────────────────── */}
      <div className="mb-3 rounded-xl border border-indigo-500/25 bg-indigo-500/6 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
            How did you get these? · required
          </p>
          <span className="text-[10px] text-zinc-600">Stored per address</span>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSource(s.value)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                source === s.value
                  ? "border-indigo-400/50 bg-indigo-500/20 font-medium text-indigo-200"
                  : "border-white/10 text-zinc-400 hover:text-zinc-200"
              }`}
            >{s.label}</button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr]">
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="e.g. NGO wellbeing day, Salt Lake — stall sign-up sheet"
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40"
          />
          <input
            type="date"
            value={collected}
            max={today()}
            onChange={(e) => setCollected(e.target.value)}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/40"
          />
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
          GDPR asks you to <span className="text-zinc-400">demonstrate</span> consent, not
          merely hold it. Source, detail, date and the admin who added it are stored
          against every address and appear in the audit export.
        </p>
      </div>

      {/* ── Paste ──────────────────────────────────────────────────────── */}
      <div className="mb-3 rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Addresses</p>
        <textarea
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setBuckets(null); setAdded(null); }}
          rows={5}
          placeholder={"One per line, or separated by commas.\npriya.n@childcare.org\nPriya N <priya.n@childcare.org>"}
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-zinc-600">
            Nothing is added until you confirm. Checking never stores anything.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void post(true)}
              disabled={!raw.trim() || busy}
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:text-zinc-100 disabled:opacity-40"
            >{busy ? "Checking…" : "Check"}</button>
            <button
              onClick={() => void post(false)}
              disabled={!raw.trim() || busy || !provenanceComplete || !buckets || buckets.toAdd.length === 0}
              title={!provenanceComplete ? "Record where these came from first" : undefined}
              className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-40"
            >
              {buckets ? `Add the ${buckets.toAdd.length} new` : "Add"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-300">{error}</div>
      )}
      {added !== null && (
        <div className="mb-3 rounded-xl border border-emerald-400/25 bg-emerald-500/8 px-4 py-3 text-xs text-emerald-300">
          Added {added} address{added === 1 ? "" : "es"}.
        </div>
      )}

      {/* ── The five buckets ───────────────────────────────────────────── */}
      {buckets && (
        <div className="mb-4 overflow-hidden rounded-xl border border-white/8 bg-white/3">
          <div className="border-b border-white/6 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Checked</p>
          </div>

          <Bucket tone="emerald" n={buckets.toAdd.length}
            title={`${buckets.toAdd.length} new`} note="will be added"
            detail={buckets.toAdd.map((a) => a.email).join(" · ")} />

          <Bucket tone="amber" n={buckets.alreadyOnList.length}
            title={`${buckets.alreadyOnList.length} already on this list`} note="skipped"
            detail={buckets.alreadyOnList.map((a) =>
              a.addedAt ? `${a.email} — added ${a.addedAt.slice(0, 10)}` : a.email).join(" · ")} />

          <Bucket tone="zinc" n={buckets.repeatedInPaste.length}
            title={`${buckets.repeatedInPaste.length} repeated in what you pasted`} note="counted once"
            detail={buckets.repeatedInPaste.join(" · ")} />

          <Bucket tone="rose" n={buckets.suppressed.length}
            title={`${buckets.suppressed.length} unsubscribed or bounced`} note="cannot be added"
            detail={buckets.suppressed.map((s) => `${s.email} — ${s.reason}`).join(" · ")} />

          <Bucket tone="rose" n={buckets.invalid.length}
            title={`${buckets.invalid.length} not a valid address`} note="fix or drop"
            detail={buckets.invalid.map((i) =>
              `${i.original} — ${i.reason}${i.suggestion ? `, did you mean ${i.suggestion}?` : ""}`).join(" · ")} />
        </div>
      )}

      {/* ── Current recipients ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
        <div className="border-b border-white/6 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            On this list{total > recipients.length ? ` — showing ${recipients.length} of ${total}` : ""}
          </p>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-xs text-zinc-500">Loading…</div>
        ) : recipients.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">Nobody on this list yet.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5 p-4">
            {recipients.map((r) => (
              <span key={r.id}
                title={`${r.source_detail} · collected ${r.collected_at}`}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <span className="text-[11px] text-zinc-300">{r.email}</span>
                <span className="border-l border-white/10 pl-1.5 text-[9px] text-zinc-600">
                  {r.source} · {r.collected_at?.slice(5)}
                </span>
                {/* Removing someone from a list is not an unsubscribe — the
                    API leaves broadcast_suppressions alone. Two clicks, because
                    an × next to an address is easy to hit by accident. */}
                {confirmRemove === r.email ? (
                  <button
                    onClick={() => void remove(r.email)}
                    disabled={busy}
                    className="border-l border-white/10 pl-1.5 text-[9px] font-semibold text-rose-300 disabled:opacity-40"
                  >remove?</button>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(r.email)}
                    className="border-l border-white/10 pl-1.5 text-[10px] leading-none text-zinc-600 transition hover:text-rose-300"
                    aria-label={`Remove ${r.email}`}
                  >×</button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bucket({ tone, n, title, note, detail }: {
  tone: "emerald" | "amber" | "rose" | "zinc";
  n: number; title: string; note: string; detail: string;
}) {
  // Zero-count buckets are hidden rather than shown as "0 suppressed" — an
  // empty bucket is noise, and the ones that appear are the ones needing a
  // decision.
  if (n === 0) return null;
  const colour = {
    emerald: "text-emerald-300", amber: "text-amber-300",
    rose: "text-rose-300", zinc: "text-zinc-400",
  }[tone];
  return (
    <div className="border-b border-white/5 px-4 py-3 last:border-b-0">
      <p className="text-xs text-zinc-200">
        <span className={`font-semibold ${colour}`}>{title}</span>
        <span className="text-zinc-500"> — {note}</span>
      </p>
      {detail && <p className="mt-1 break-words font-mono text-[10px] leading-relaxed text-zinc-600">{detail}</p>}
    </div>
  );
}
