"use client";

// src/components/admin/BroadcastRequests.tsx
// People who asked, through the public form, to hear from us (BC-26).
//
// The point of this screen is that nothing here was typed by an admin. The
// address, the time and the connection all came from the person themselves,
// so adding them to a list carries better evidence of consent than any
// manually entered address ever can — and the provenance is copied across
// rather than retyped.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";
import type { ListRow } from "./BroadcastLists";

type Submission = {
  id: string; email: string; name: string | null; message: string | null;
  ip: string | null; status: string; created_at: string; suppressed: boolean;
};

export default function BroadcastRequests({ token, lists }: { token: string; lists: ListRow[] }) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [status, setStatus] = useState<"new" | "all">("new");
  const [listId, setListId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/broadcast/interest?status=${status}`, adminFetchOpts(token));
      if (!res.ok) { setError(`Could not load requests (HTTP ${res.status}).`); return; }
      setRows((await res.json()).submissions ?? []);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token, status]);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: "add" | "ignore") {
    setBusy(id); setError(null);
    try {
      const res = await fetch("/api/admin/broadcast/interest", adminFetchOpts(token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, listId }),
      }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? `Failed (HTTP ${res.status}).`); return; }
      await load();
    } catch { setError("Network error."); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          {(["new", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                status === s ? "bg-white/10 font-medium text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >{s === "new" ? "Waiting" : "Everything"}</button>
          ))}
        </div>

        <select
          value={listId}
          onChange={(e) => setListId(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-indigo-500/40"
        >
          <option value="">Add them to…</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-300">{error}</div>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl border border-white/8 bg-white/3" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/3 px-5 py-10 text-center">
          <p className="text-sm text-zinc-300">Nothing waiting</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
            Anyone who fills in the form at <span className="text-zinc-400">imotara.com/updates</span>{" "}
            appears here, with the time and connection their consent came from.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
          {rows.map((r) => (
            <div key={r.id} className="border-b border-white/5 px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-zinc-200">
                    {r.email}
                    {r.name && <span className="ml-2 text-[11px] text-zinc-500">{r.name}</span>}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {new Date(r.created_at).toLocaleString()} · {r.ip ?? "no address recorded"} ·{" "}
                    {r.status === "new" ? "waiting" : r.status.replace(/_/g, " ")}
                  </p>
                  {r.message && (
                    <p className="mt-1.5 max-w-prose text-[11px] leading-relaxed text-zinc-400">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  )}
                  {r.suppressed && (
                    <p className="mt-1.5 text-[10px] leading-relaxed text-amber-300">
                      This address is on the suppression list — they previously
                      unsubscribed, bounced or reported us. Adding them to a list will
                      not mail them: sending skips suppressed addresses. Clearing that
                      is a deliberate act, not a side effect of this button.
                    </p>
                  )}
                </div>

                {r.status === "new" && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => void act(r.id, "add")}
                      disabled={!listId || busy === r.id}
                      title={listId ? undefined : "Choose a list first"}
                      className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-40"
                    >Add to list</button>
                    <button
                      onClick={() => void act(r.id, "ignore")}
                      disabled={busy === r.id}
                      className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-500 transition hover:text-zinc-300 disabled:opacity-40"
                    >Set aside</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        Adding someone from here records the source as the website form, dated
        when they actually submitted it, with the connection it came from — copied
        across rather than retyped, so it cannot be transcribed wrong.
      </p>
    </div>
  );
}
