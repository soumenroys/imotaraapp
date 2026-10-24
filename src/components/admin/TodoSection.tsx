"use client";

// src/components/admin/TodoSection.tsx
// ✅ To do — the admin's landing page: everything waiting for a person, most urgent first.
//
// 🔑 Owner, 24 Oct 2026: "one main page where admin can login and see his/her
// immediate action points; once admin takes the action, that action point will
// be marked as done" ⇒ lib/admin/todo.ts.
//
// Items that the system can see finished (a draft approved, a post retried)
// leave the list by themselves. Items it cannot see (a call made, a meeting
// held) have a "Mark done" button, and the page then says who did it and when.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";

type Item = { id: string; area: string; urgency: "now" | "today" | "soon"; title: string; detail?: string; href: string; action: string; manual?: boolean };
type Done = { id: string; by: string; at: string; title: string };
type Data = { items: Item[]; problems: { area: string; error: string }[]; checked: string[]; recentlyDone: Done[]; asOf: string };

const GROUPS: { id: Item["urgency"]; label: string; tone: string }[] = [
  { id: "now", label: "Do now", tone: "border-rose-400/40 bg-rose-500/8" },
  { id: "today", label: "Today", tone: "border-amber-400/30 bg-amber-500/6" },
  { id: "soon", label: "When you can", tone: "border-white/10 bg-white/3" },
];

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function TodoSection({ token }: { token: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/todo", adminFetchOpts(token));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? `Could not load (HTTP ${res.status}).`); return; }
      setD(j);
    } catch { setError("Could not reach the server."); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const mark = async (item: { id: string; title: string }, done: boolean) => {
    setBusy(item.id);
    try {
      const res = await fetch("/api/admin/todo", adminFetchOpts(token, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, title: item.title, done }),
      }));
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not save that.");
      await load();
    } finally { setBusy(null); }
  };

  if (error) return <div className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-300">{error}</div>;
  if (!d) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-white/3" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-zinc-300">
          {d.items.length === 0
            ? <b className="text-emerald-300">✅ Nothing is waiting for you.</b>
            : <><b className="text-zinc-100">{d.items.length} thing{d.items.length === 1 ? "" : "s"} waiting for you.</b> Most urgent first.</>}
        </p>
        <button onClick={() => void load()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
          Refresh · checked {time(d.asOf)}
        </button>
      </div>

      {d.problems.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/8 px-4 py-3 text-xs text-amber-200">
          Could not check {d.problems.map((p) => p.area).join(", ")} just now — so those may have things waiting that are not shown. Press Refresh in a minute.
        </div>
      )}

      {GROUPS.map((g) => {
        const items = d.items.filter((i) => i.urgency === g.id);
        if (items.length === 0) return null;
        return (
          <section key={g.id} className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{g.label} · {items.length}</h3>
            {items.map((i) => (
              <div key={i.id} className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 ${g.tone}`}>
                <span className="mt-0.5 shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">{i.area}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-100">{i.title}</p>
                  {i.detail && <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{i.detail}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a href={i.href} className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20">{i.action} →</a>
                  {i.manual && (
                    <button disabled={busy === i.id} onClick={() => void mark(i, true)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40">
                      {busy === i.id ? "Saving…" : "✓ Mark done"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {d.recentlyDone.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Done in the last 24 hours</h3>
          {d.recentlyDone.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/6 px-3 py-2 text-xs text-zinc-400">
              <span className="text-emerald-400">✓</span>
              <span className="text-zinc-300 line-through decoration-zinc-600">{x.title}</span>
              <span>— {x.by}, {time(x.at)}</span>
              <button disabled={busy === x.id} onClick={() => void mark(x, false)} className="ml-auto text-[11px] text-zinc-500 underline hover:text-zinc-300">Undo</button>
            </div>
          ))}
        </section>
      )}

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Checked: {d.checked.join(" · ")}. Items clear themselves when the thing is done (a draft approved, a post retried);
        the ones the system cannot see — a call made, a meeting held — have a Mark done button.
      </p>
    </div>
  );
}
