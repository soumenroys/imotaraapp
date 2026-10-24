"use client";

// src/components/admin/BroadcastAuto.tsx
// Broadcast mail → Automatic: the monthly newsletter, written and scheduled by
// itself, sent only after approval ⇒ lib/broadcast/autoBroadcast.ts.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";
import type { ListRow } from "./BroadcastLists";

type Run = { month: string; theme: string; sendAt: string; broadcastIds: string[]; sent: string[] };
type Auto = {
  settings: { enabled: boolean; dayOfMonth: number; hourIst: number; listIds: string[] };
  runs: Record<string, Run>;
  next: { month: string; theme: string; sendAt: string; draftsAt: string };
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function BroadcastAuto({ token, lists }: { token: string; lists: ListRow[] }) {
  const [a, setA] = useState<Auto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [day, setDay] = useState("5");
  const [hour, setHour] = useState("11");
  const [chosen, setChosen] = useState<string[]>([]);
  const [sample, setSample] = useState<{ subject: string; body: string; findings: string[]; theme: string } | null>(null);
  const [writing, setWriting] = useState(false);
  const writeSample = async () => {
    setWriting(true); setError(null);
    const res = await fetch("/api/admin/broadcast/auto/sample", adminFetchOpts(token, { method: "POST" }));
    const j = await res.json().catch(() => ({}));
    setWriting(false);
    if (!res.ok) { setError(j.error ?? "Could not write a sample."); return; }
    setSample(j);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/broadcast/auto", adminFetchOpts(token));
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? `HTTP ${res.status}`); return; }
    setA(j); setDay(String(j.settings.dayOfMonth)); setHour(String(j.settings.hourIst)); setChosen(j.settings.listIds);
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const save = async (body: Record<string, unknown>) => {
    setError(null); setMessage(null);
    const res = await fetch("/api/admin/broadcast/auto", adminFetchOpts(token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? "Could not save."); return; }
    setMessage("Saved."); await load();
  };

  // Outreach lists are filled by the outreach mailer; the newsletter is for people who asked for updates.
  const usable = lists.filter((l) => !l.name.startsWith("Outreach —"));
  if (!a) return <p className="p-4 text-sm text-zinc-500">{error ?? "Loading…"}</p>;

  return (
    <div className="space-y-4 text-xs">
      <div className={`rounded-xl border p-4 ${a.settings.enabled ? "border-emerald-400/30 bg-emerald-500/8" : "border-white/10 bg-white/3"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-100">Monthly newsletter — {a.settings.enabled ? "ON" : "OFF"}</p>
            <p className="mt-1 text-zinc-400">
              Written by itself {3} days before the send day, on one theme a month, from Imotara&apos;s checked facts. It waits on your
              <b> To do</b> for approval; on the day, approved drafts go out by themselves. Nothing is sent unapproved.
            </p>
          </div>
          <button onClick={() => void save({ enabled: !a.settings.enabled, listIds: chosen })}
            className={`rounded-full px-4 py-1.5 font-bold ${a.settings.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-zinc-300"}`}>
            {a.settings.enabled ? "ON" : "OFF"}
          </button>
        </div>
        <p className="mt-3 text-zinc-300">
          Next: <b>{when(a.next.sendAt)}</b> (India time) · drafts appear {when(a.next.draftsAt)} · theme: {a.next.theme}
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-zinc-400">Day of the month (1–28)
            <input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} className="block w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-zinc-100" />
          </label>
          <label className="text-zinc-400">Hour, India time (8–20)
            <input type="number" min={8} max={20} value={hour} onChange={(e) => setHour(e.target.value)} className="block w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-zinc-100" />
          </label>
        </div>
        <div>
          <p className="mb-1 text-zinc-400">Send to these lists</p>
          {usable.length === 0 && <p className="text-zinc-500">No list yet — make one under Recipient lists.</p>}
          <div className="flex flex-wrap gap-2">
            {usable.map((l) => (
              <label key={l.id} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${chosen.includes(l.id) ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-200" : "border-white/10 text-zinc-400"}`}>
                <input type="checkbox" checked={chosen.includes(l.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, l.id] : chosen.filter((x) => x !== l.id))} />
                {l.name}
              </label>
            ))}
          </div>
        </div>
        <button onClick={() => void save({ dayOfMonth: Number(day), hourIst: Number(hour), listIds: chosen })}
          className="rounded-lg border border-white/15 px-4 py-1.5 font-semibold text-zinc-200">Save</button>
        {message && <span className="ml-2 text-emerald-300">{message}</span>}
        {error && <p className="text-rose-300">{error}</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-zinc-300">Read a sample of next month&apos;s newsletter — nothing is saved or sent.</p>
          <button disabled={writing} onClick={() => void writeSample()} className="rounded-lg border border-white/15 px-3 py-1.5 font-semibold text-zinc-200 disabled:opacity-40">
            {writing ? "Writing… (about 20 s)" : "See what it would write"}
          </button>
        </div>
        {sample && (
          <div className="space-y-1.5">
            <p className="text-zinc-500">Theme: {sample.theme}</p>
            <p className="text-sm font-semibold text-zinc-100">{sample.subject}</p>
            <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-sans text-[12px] leading-relaxed text-zinc-200">{sample.body}</pre>
            {sample.findings.length > 0 && <p className="text-amber-300">Checks would ask for changes: {sample.findings.join(" ")}</p>}
          </div>
        )}
      </div>

      {Object.values(a.runs).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
          <p className="mb-2 font-semibold text-zinc-300">Past months</p>
          {Object.values(a.runs).sort((x, y) => y.month.localeCompare(x.month)).map((r) => (
            <p key={r.month} className="text-zinc-400">{r.month} · {r.theme} · {r.sent.length} of {r.broadcastIds.length} sent · due {when(r.sendAt)}</p>
          ))}
        </div>
      )}
    </div>
  );
}
