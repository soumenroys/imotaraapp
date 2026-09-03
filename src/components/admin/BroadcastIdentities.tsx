"use client";

// src/components/admin/BroadcastIdentities.tsx
// Who broadcasts are sent as — name and address, edited together.
//
// They are edited together because separating them is what produced
// "Soumen Roy <suchismita.sen@imotara.com>": one person's name beside another
// person's address, which a recipient reasonably reads as that person owning
// the address. A display name is part of an identity, not a property of
// whoever happened to be signed in.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";

type Identity = { name: string; email: string };

export default function BroadcastIdentities({ token }: { token: string }) {
  const [rows, setRows] = useState<Identity[]>([]);
  const [available, setAvailable] = useState<Identity[]>([]);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast/identities", adminFetchOpts(token));
      if (!res.ok) { setError(`Could not load the sender settings (HTTP ${res.status}).`); return; }
      const j = await res.json();
      setRows(j.stored?.length ? j.stored : (j.available ?? []).map((i: Identity) => ({ ...i })));
      setAvailable(j.available ?? []);
      setDomain(j.domain ?? "");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function set(i: number, patch: Partial<Identity>) {
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    try {
      const res = await fetch("/api/admin/broadcast/identities", adminFetchOpts(token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identities: rows.filter((r) => r.email.trim()) }),
      }));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? `Could not save (HTTP ${res.status}).`); return; }
      setRows(j.stored ?? rows);
      setSaved(true);
      await load();
    } catch { setError("Network error."); }
    finally { setBusy(false); }
  }

  if (loading) {
    return <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-xs text-zinc-500">Loading…</div>;
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sent as</p>
        <span className="text-[10px] text-zinc-600">
          Addresses must be on {domain || "the verified domain"}
        </span>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-zinc-500">
        The first one is used for new broadcasts. The name shown here is what
        appears in the recipient&apos;s inbox beside the address, so the two are
        set together rather than one being taken from whoever is signed in.
      </p>

      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="w-5 shrink-0 text-right font-mono text-[10px] text-zinc-600">{i + 1}.</span>
            <input
              value={r.name}
              onChange={(e) => set(i, { name: e.target.value.replace(/["\\]/g, "") })}
              placeholder="Imotara"
              maxLength={80}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40"
            />
            <input
              value={r.email}
              onChange={(e) => set(i, { email: e.target.value.trim().toLowerCase() })}
              placeholder={`hello@${domain || "imotara.com"}`}
              className="min-w-0 flex-[1.4] rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40"
            />
            <button
              onClick={() => { setRows((rs) => rs.filter((_, n) => n !== i)); setSaved(false); }}
              title="Remove"
              className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] leading-none text-zinc-600 transition hover:text-rose-300"
            >×</button>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => { setRows((rs) => [...rs, { name: "", email: "" }]); setSaved(false); }}
          className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-400 transition hover:text-zinc-200"
        >+ Another address</button>

        <div className="flex items-center gap-2">
          {saved && <span className="text-[11px] text-emerald-400">Saved</span>}
          <button
            onClick={() => void save()}
            disabled={busy || rows.every((r) => !r.email.trim())}
            className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-40"
          >{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-500/8 px-2.5 py-1.5 text-[11px] text-rose-300">{error}</p>
      )}

      <p className="mt-2.5 border-t border-white/6 pt-2.5 text-[10px] leading-relaxed text-zinc-600">
        A draft can be sent as{" "}
        {available.length === 0
          ? "nothing yet — add an address above."
          : available.map((i) => (i.name ? `${i.name} <${i.email}>` : i.email)).join(" · ")}
        . Replies always come back to the admin who wrote the broadcast,
        whichever address carries it.
      </p>
    </div>
  );
}
