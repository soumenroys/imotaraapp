"use client";

// src/components/admin/BroadcastLists.tsx
// Recipient list management (BC-18, part 1).

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";
import { defaultListName } from "@/lib/broadcast/listName";

export type ListRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  // null, not 0 — an unrecognised aggregate shape must read as "unknown"
  // rather than telling the admin a populated list is empty.
  recipientCount: number | null;
};

export default function BroadcastLists({
  token, onOpen,
}: {
  token: string;
  onOpen: (list: ListRow) => void;
}) {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filled in on mount rather than in the initial state: this component is
  // server-rendered first, and a clock-derived value would differ between the
  // server's render and the browser's, which React reports as a hydration
  // mismatch.
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/broadcast/lists", adminFetchOpts(token));
      if (!res.ok) { setError(`Could not load lists (HTTP ${res.status}).`); return; }
      setLists((await res.json()).lists ?? []);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => { setNewName(defaultListName()); }, []);

  async function create() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/broadcast/lists", adminFetchOpts(token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }));
      const j = await res.json().catch(() => ({}));
      // 409 means the name collides — the schema's unique index is on
      // lower(name), so "Staff" and "staff" are the same list.
      if (!res.ok) { setError(j.error ?? `Could not create the list (HTTP ${res.status}).`); return; }
      // A fresh timestamp, not a cleared box — the next list is usually
      // created moments later and would otherwise reuse a stale minute.
      setNewName(defaultListName());
      await load();
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/broadcast/lists/${id}`, adminFetchOpts(token, { method: "DELETE" }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The API refuses while a broadcast against this list is still
        // sending or paused — surface its reason rather than a generic error.
        setError(j.error ?? `Could not delete (HTTP ${res.status}).`);
        return;
      }
      setConfirmDelete(null);
      await load();
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">New list</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void create(); }}
            placeholder="e.g. Child Care — all staff"
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40"
          />
          <button
            onClick={() => void create()}
            disabled={!newName.trim() || busy}
            className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-40"
          >
            Create list
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-zinc-600">
          Named for the moment it was created — the digits lead so the lists
          sort in the order you made them. Type over it if the list deserves a
          better name; two cannot share one, and the check ignores case.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl border border-white/8 bg-white/3" />)}
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/3 px-5 py-10 text-center">
          <p className="text-sm text-zinc-300">No recipient lists yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
            A list holds the people who gave you their address. You record where
            each one came from as you add them, so consent can be shown later
            rather than asserted.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
          {lists.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0">
              <button onClick={() => onOpen(l)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] text-zinc-200 hover:text-zinc-50">{l.name}</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  {l.recipientCount === null ? "— recipients" : `${l.recipientCount} recipient${l.recipientCount === 1 ? "" : "s"}`}
                </p>
              </button>

              {confirmDelete === l.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-rose-300">Delete this list and its recipients?</span>
                  <button
                    onClick={() => void remove(l.id)}
                    disabled={busy}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                  >Delete</button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400"
                  >Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpen(l)}
                    className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:text-zinc-200"
                  >Open</button>
                  <button
                    onClick={() => setConfirmDelete(l.id)}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-500 transition hover:text-rose-300"
                  >Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
