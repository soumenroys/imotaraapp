"use client";

// /admin/social/trends — this week's moments the writer may use, and what was
// refused and why ⇒ lib/social/trends.ts.
//
// 🔑 Owner, 24 Oct 2026: content driven by the latest trends, aligned with
// Imotara. Refreshed every morning by itself; an admin can remove any moment
// (it is never used again) or refresh now.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { SocialPage } from "@/app/admin/social/_components/ui";

type Note = { id: string; topic: string; why: string; angle: string; source: string; activeFrom: string; expiresAt: string; removed?: boolean };
type State = { notes: Note[]; rejected: { topic: string; why: string }[]; refreshedAt: string | null };

const SOURCE: Record<string, string> = { "awareness-day": "Awareness day", "google-trends-IN": "Trending in India", "google-trends-US": "Trending in the US" };
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function Trends() {
  const [s, setS] = useState<State | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social/trends", { credentials: "same-origin" });
    if (res.status === 401) { setAuthed(false); return; }
    setAuthed(true);
    setS(await res.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setBusy(true); setMessage("");
    const res = await fetch("/api/admin/social/trends", { method: "POST", credentials: "same-origin" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(j.error ?? "Could not refresh."); return; }
    setS(j); setMessage("Refreshed.");
  };
  const remove = async (n: Note) => {
    if (!window.confirm(`Never use “${n.topic}” in a post?`)) return;
    await fetch("/api/admin/social/trends", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: n.id }) });
    void load();
  };

  const now = Date.now();
  const live = (s?.notes ?? []).filter((n) => !n.removed && Date.parse(n.expiresAt) > now);

  return (
    <SocialPage here="/admin/social/trends" title="This week's moments"
      lede="What people are talking about, filtered for a wellbeing brand. One of the rotating angles uses them; the writer adds no facts of its own.">
      {authed === false && <SignedOut />}
      {authed && s && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-zinc-300">
              Refreshed {s.refreshedAt ? new Date(s.refreshedAt).toLocaleString() : "never"} · every morning at 07:00 IST by itself.
            </span>
            <button disabled={busy} onClick={() => void refresh()} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
              {busy ? "Refreshing… (about a minute)" : "Refresh now"}
            </button>
          </div>
          {message && <p className="text-xs text-indigo-200">{message}</p>}

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Usable ({live.length})</h2>
            {live.length === 0 && <p className="text-zinc-400">None this week — posts use the other angles. That is fine: nothing is better than a forced one.</p>}
            {live.map((n) => (
              <div key={n.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <b className="text-zinc-100">{n.topic}</b>
                  <span className="text-[11px] text-zinc-500">{SOURCE[n.source] ?? n.source} · for posts going out {day(n.activeFrom)} – {day(n.expiresAt)}</span>
                  <button onClick={() => void remove(n)} className="ml-auto text-xs text-rose-300 underline">Never use this</button>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Why now: {n.why}</p>
                <p className="mt-0.5 text-xs text-zinc-300">Imotara&apos;s angle: {n.angle}</p>
              </div>
            ))}
          </section>

          {s.rejected.length > 0 && (
            <details className="rounded-xl border border-white/10 bg-white/5 p-3">
              <summary className="cursor-pointer text-xs text-zinc-400">Refused this time ({s.rejected.length}) — and why</summary>
              <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                {s.rejected.map((r, i) => <li key={i}><span className="text-zinc-300">{r.topic}</span> — {r.why}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </SocialPage>
  );
}
