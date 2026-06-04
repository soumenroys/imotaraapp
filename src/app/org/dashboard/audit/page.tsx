"use client";
// src/app/org/dashboard/audit/page.tsx
// Immutable org audit log — paginated table + CSV export.

import { useEffect, useState, useCallback } from "react";

interface AuditEntry {
  id:          string;
  action:      string;
  actor_email: string | null;
  actor_role:  string | null;
  target_email: string | null;
  changes:     Record<string, unknown>;
  notes:       string | null;
  created_at:  string;
}

const ACTION_COLORS: Record<string, string> = {
  member_joined:    "text-emerald-400",
  member_removed:   "text-rose-400",
  member_invited:   "text-sky-400",
  role_changed:     "text-indigo-400",
  tier_changed:     "text-orange-400",
  org_approved:     "text-emerald-400",
  org_suspended:    "text-rose-400",
  settings_changed: "text-zinc-400",
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatChanges(changes: Record<string, unknown>): string {
  if (!changes || Object.keys(changes).length === 0) return "";
  return Object.entries(changes)
    .map(([k, v]) => {
      if (typeof v === "object" && v !== null && "from" in v && "to" in v) {
        return `${k}: ${(v as any).from} → ${(v as any).to}`;
      }
      return `${k}: ${String(v)}`;
    })
    .join(", ");
}

export default function AuditPage() {
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const LIMIT = 25;

  const fetchAudit = useCallback(async (p: number) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/org/dashboard/audit?page=${p}&limit=${LIMIT}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setEntries(j.entries ?? []);
      setTotal(j.total ?? 0);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAudit(0); }, [fetchAudit]);

  function handleExport() {
    window.open("/api/org/dashboard/audit?export=csv", "_blank");
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Audit Log</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Immutable record of all admin actions in your organisation</p>
        </div>
        <button onClick={handleExport}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10">
          ↓ Export CSV
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
          <p className="text-2xl">📋</p>
          <p className="mt-2 text-sm text-zinc-500">No audit events yet. Events are recorded as members join, leave, or settings change.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/8">
            <table className="w-full text-xs">
              <thead className="border-b border-white/8 bg-white/4">
                <tr className="text-zinc-500">
                  <th className="px-4 py-2.5 text-left font-medium">When</th>
                  <th className="px-4 py-2.5 text-left font-medium">Action</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">By</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Target</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap" title={e.created_at}>
                      {timeAgo(e.created_at)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`font-medium ${ACTION_COLORS[e.action] ?? "text-zinc-300"}`}>
                        {e.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 hidden sm:table-cell">
                      <span className="truncate max-w-[140px] block">{e.actor_email ?? "system"}</span>
                      {e.actor_role && <span className="text-[10px] text-zinc-600">{e.actor_role}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 hidden sm:table-cell truncate max-w-[140px]">
                      {e.target_email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 hidden md:table-cell max-w-[200px] truncate">
                      {formatChanges(e.changes) || e.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => { const p = page - 1; setPage(p); void fetchAudit(p); }}
                  className="rounded-lg border border-white/10 px-3 py-1 transition hover:bg-white/5 disabled:opacity-40">
                  ← Prev
                </button>
                <button disabled={page >= totalPages - 1} onClick={() => { const p = page + 1; setPage(p); void fetchAudit(p); }}
                  className="rounded-lg border border-white/10 px-3 py-1 transition hover:bg-white/5 disabled:opacity-40">
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
