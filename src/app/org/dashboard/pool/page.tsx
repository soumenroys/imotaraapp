"use client";
// src/app/org/dashboard/pool/page.tsx
// Corporate/NGO admin: manage license pool — assign, withdraw, reassign licenses.

import { useEffect, useState, useCallback } from "react";

interface Pool {
  id: string; tier: string;
  quantity_total: number; quantity_used: number;
  label: string | null; expires_at: string | null; issued_by: string;
}
interface Assignment {
  id: string; pool_id: string; user_id: string; email: string;
  tier: string; assigned_at: string;
}
interface OrgMember { userId: string; email: string; role: string }

const TIER_COLORS: Record<string,string> = {
  free: "text-zinc-400 bg-zinc-500/10", plus: "text-sky-300 bg-sky-500/15",
  pro: "text-indigo-300 bg-indigo-500/15", edu: "text-teal-300 bg-teal-500/15",
  enterprise: "text-orange-300 bg-orange-500/15",
};

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

export default function PoolPage() {
  const [pools, setPools]             = useState<Pool[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers]         = useState<OrgMember[]>([]);
  const [summary, setSummary]         = useState({ totalLicenses:0, usedLicenses:0, availableLicenses:0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [msg, setMsg]                 = useState("");
  const [saving, setSaving]           = useState(false);

  // Assign form
  const [selPool, setSelPool]         = useState("");
  const [selUser, setSelUser]         = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [poolsR, membersR] = await Promise.all([
        fetch("/api/org/dashboard/pools", { credentials: "same-origin" }),
        fetch("/api/org/dashboard/members", { credentials: "same-origin" }),
      ]);
      if (!poolsR.ok) throw new Error(`Pools: HTTP ${poolsR.status}`);
      const pj = await poolsR.json();
      setPools(pj.pools ?? []);
      setAssignments(pj.assignments ?? []);
      setSummary(pj.summary ?? { totalLicenses:0, usedLicenses:0, availableLicenses:0 });
      if (membersR.ok) {
        const mj = await membersR.json();
        setMembers((mj.members ?? []).filter((m: OrgMember) => m.role !== "owner"));
      }
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selPool || !selUser) return;
    setSaving(true); setMsg(""); setError("");
    const r = await fetch("/api/org/dashboard/pools", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId: selPool, userId: selUser }),
    });
    setSaving(false);
    if (r.ok) { setMsg("License assigned ✓"); setSelPool(""); setSelUser(""); void fetchAll(); }
    else { const j = await r.json().catch(() => ({})); setError(j.error ?? "Assignment failed"); }
  }

  async function handleWithdraw(assignmentId: string, email: string) {
    if (!confirm(`Withdraw license from ${email}?\nThe license returns to the pool and can be reassigned.`)) return;
    setSaving(true);
    const r = await fetch(`/api/org/dashboard/pools?assignmentId=${assignmentId}`, { method: "DELETE", credentials: "same-origin" });
    setSaving(false);
    if (r.ok) { setMsg("License withdrawn ✓"); void fetchAll(); }
    else { setError("Withdrawal failed"); }
  }

  async function handleReassign(assignmentId: string, userId: string, email: string) {
    const newUser = members.find((m) => m.userId !== userId);
    if (!newUser) { setError("No other members to reassign to."); return; }

    // Find the pool for this assignment
    const asgn = assignments.find((a) => a.id === assignmentId);
    if (!asgn) return;

    if (!confirm(`Reassign ${asgn.tier} license from ${email}?`)) return;
    setSaving(true); setMsg(""); setError("");

    // Withdraw then reassign via assign (DB function handles this atomically)
    const r = await fetch("/api/org/dashboard/pools", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId: asgn.pool_id, userId: selUser || newUser.userId }),
    });
    setSaving(false);
    if (r.ok) { setMsg("License reassigned ✓"); void fetchAll(); }
    else { const j = await r.json().catch(() => ({})); setError(j.error ?? "Reassignment failed"); }
  }

  // Users who don't yet have a pool assignment
  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const unassignedMembers = members.filter((m) => !assignedUserIds.has(m.userId));

  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5"/>)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">License Pool</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Distribute, assign, withdraw, and reassign licenses issued by Imotara to your members.</p>
      </div>

      {error && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
      {msg   && <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{msg}</p>}

      {/* Pool summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total issued",   value: summary.totalLicenses,     color: "text-zinc-200" },
          { label: "Assigned",       value: summary.usedLicenses,      color: "text-amber-300" },
          { label: "Available",      value: summary.availableLicenses, color: summary.availableLicenses === 0 ? "text-rose-400" : "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pool breakdown */}
      {pools.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
          <p className="text-2xl">🎫</p>
          <p className="mt-2 text-sm text-zinc-500">No license pools issued yet. Contact Imotara (info@imotara.com) to request a license pool for your organisation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-300">Available Pools</p>
          {pools.map((p) => {
            const avail = p.quantity_total - p.quantity_used;
            const pct   = Math.round(p.quantity_used / Math.max(p.quantity_total, 1) * 100);
            return (
              <div key={p.id} className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize mr-2 ${TIER_COLORS[p.tier] ?? "text-zinc-400 bg-zinc-500/10"}`}>{p.tier}</span>
                    <span className="text-sm text-zinc-200">{p.label ?? "License pool"}</span>
                  </div>
                  <span className={`text-xs font-medium ${avail === 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {avail} of {p.quantity_total} available
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8 mb-2">
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-zinc-600">Issued by: {p.issued_by}{p.expires_at ? ` · expires ${new Date(p.expires_at).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"})}` : ""}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign form */}
      {pools.length > 0 && unassignedMembers.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-3">
          <p className="text-sm font-medium text-zinc-300">Assign license to member</p>
          <form onSubmit={handleAssign} className="flex flex-wrap gap-2">
            <select value={selPool} onChange={(e) => setSelPool(e.target.value)} required
              className="flex-1 min-w-[180px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none">
              <option value="">Select pool…</option>
              {pools.filter((p) => p.quantity_used < p.quantity_total).map((p) => (
                <option key={p.id} value={p.id}>{p.tier.toUpperCase()} — {p.quantity_total - p.quantity_used} available {p.label ? `(${p.label})` : ""}</option>
              ))}
            </select>
            <select value={selUser} onChange={(e) => setSelUser(e.target.value)} required
              className="flex-1 min-w-[180px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none">
              <option value="">Select member…</option>
              {unassignedMembers.map((m) => <option key={m.userId} value={m.userId}>{m.email}</option>)}
            </select>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
              {saving ? "Assigning…" : "Assign"}
            </button>
          </form>
        </div>
      )}

      {/* Current assignments */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-300">Current assignments ({assignments.length})</p>
          <div className="overflow-hidden rounded-2xl border border-white/8">
            <table className="w-full text-xs">
              <thead className="border-b border-white/8 bg-white/4">
                <tr className="text-zinc-500">
                  <th className="px-4 py-2.5 text-left font-medium">Member</th>
                  <th className="px-4 py-2.5 text-left font-medium">License tier</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Assigned</th>
                  <th className="px-4 py-2.5 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="px-4 py-3 text-zinc-200 truncate max-w-[180px]">{a.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TIER_COLORS[a.tier] ?? "text-zinc-400 bg-zinc-500/10"}`}>{a.tier}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">{timeAgo(a.assigned_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {/* Reassign: opens user selector */}
                        <select defaultValue="" onChange={async (e) => {
                          if (!e.target.value) return;
                          const newUserId = e.target.value;
                          e.target.value = "";
                          if (!confirm(`Reassign ${a.tier} license from ${a.email}?`)) return;
                          setSaving(true);
                          const r = await fetch("/api/org/dashboard/pools", {
                            method: "POST", credentials: "same-origin",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ poolId: a.pool_id, userId: newUserId }),
                          });
                          setSaving(false);
                          if (r.ok) { setMsg("License reassigned ✓"); void fetchAll(); }
                          else { const j = await r.json().catch(()=>({})); setError(j.error ?? "Reassign failed"); }
                        }} className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-300 outline-none cursor-pointer">
                          <option value="">Reassign to…</option>
                          {members.filter((m) => m.userId !== a.user_id && !assignedUserIds.has(m.userId)).map((m) => (
                            <option key={m.userId} value={m.userId}>{m.email}</option>
                          ))}
                        </select>
                        <button onClick={() => handleWithdraw(a.id, a.email)} disabled={saving}
                          className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40">
                          Withdraw
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
