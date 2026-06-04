"use client";
// src/app/org/dashboard/licenses/page.tsx
// Full license management for org admins:
//   - License inventory (seats, tier breakdown)
//   - Per-member tier override (assign different tiers to different users)
//   - Engagement stats (sessions/30d, last active) — NO emotional content
//   - Withdraw license (remove member) or change license tier per user

import { useEffect, useState, useCallback } from "react";

interface OrgInventory {
  tier:           string;
  seatsPurchased: number;
  seatsUsed:      number;
  seatsAvailable: number;
  expiresAt:      string | null;
  tierBreakdown:  Record<string, number>;
}

interface MemberLicense {
  userId:         string;
  email:          string;
  role:           string;
  joinedAt:       string;
  lastSignIn:     string | null;
  overrideTier:   string | null;
  effectiveTier:  string;
  sessionsLast30: number;
  lastActive:     string | null;
  licenseStatus:  string;
}

const TIER_COLORS: Record<string, string> = {
  free:       "text-zinc-400 bg-zinc-500/10",
  plus:       "text-sky-300 bg-sky-500/15",
  pro:        "text-indigo-300 bg-indigo-500/15",
  family:     "text-violet-300 bg-violet-500/15",
  edu:        "text-teal-300 bg-teal-500/15",
  enterprise: "text-orange-300 bg-orange-500/15",
};

const TIER_LABELS = ["free","plus","pro","edu","enterprise"];

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ActivityDots({ count }: { count: number }) {
  const level = count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : 3;
  const colors = ["bg-zinc-700","bg-emerald-900","bg-emerald-600","bg-emerald-400"];
  return (
    <div className="flex items-center gap-1" title={`${count} sessions in last 30 days`}>
      {[0,1,2].map((i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${i < level ? colors[level] : "bg-zinc-800"}`} />
      ))}
      <span className="ml-1 text-[10px] text-zinc-500">{count}</span>
    </div>
  );
}

export default function LicensesPage() {
  const [inventory, setInventory]   = useState<OrgInventory | null>(null);
  const [members, setMembers]       = useState<MemberLicense[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [saving, setSaving]         = useState<string | null>(null);
  const [msg, setMsg]               = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/org/dashboard/license-inventory", { credentials: "same-origin" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setInventory(j.inventory);
      setMembers(j.members ?? []);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleTierChange(userId: string, overrideTier: string | null) {
    setSaving(userId); setMsg("");
    const r = await fetch("/api/org/dashboard/members", {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, overrideTier }),
    });
    setSaving(null);
    if (r.ok) {
      setMsg("License updated ✓");
      setMembers((prev) => prev.map((m) =>
        m.userId === userId ? { ...m, overrideTier, effectiveTier: overrideTier ?? (inventory?.tier ?? "enterprise") } : m
      ));
      void fetchData();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Failed to update license");
    }
  }

  async function handleWithdraw(userId: string, email: string) {
    if (!confirm(`Withdraw Imotara license from ${email}?\n\nThey will be removed from the org and their license revoked.`)) return;
    setSaving(userId);
    await fetch(`/api/org/dashboard/members?userId=${userId}`, { method: "DELETE", credentials: "same-origin" });
    setSaving(null);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    void fetchData();
  }

  const filtered = members.filter((m) => {
    const matchSearch = !search || m.email.toLowerCase().includes(search.toLowerCase());
    const matchTier   = !tierFilter || m.effectiveTier === tierFilter;
    return matchSearch && matchTier;
  });

  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">License Management</h1>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {msg   && <p className="text-sm text-emerald-400">{msg}</p>}

      {/* ── Inventory summary ─────────────────────────────────────────────── */}
      {inventory && (
        <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
          <p className="text-sm font-medium text-zinc-300">License Inventory</p>

          {/* Seats progress */}
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-zinc-400">
              <span>Seats used</span>
              <span className={inventory.seatsAvailable === 0 ? "text-rose-400" : "text-emerald-400"}>
                {inventory.seatsUsed} / {inventory.seatsPurchased} — {inventory.seatsAvailable} available
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
              <div
                className={`h-full rounded-full transition-all ${
                  inventory.seatsAvailable === 0 ? "bg-rose-500" :
                  inventory.seatsUsed / inventory.seatsPurchased > 0.8 ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, Math.round(inventory.seatsUsed / Math.max(inventory.seatsPurchased, 1) * 100))}%` }}
              />
            </div>
          </div>

          {/* Tier breakdown */}
          {Object.keys(inventory.tierBreakdown).length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">By tier</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(inventory.tierBreakdown).map(([tier, count]) => (
                  <div key={tier} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${TIER_COLORS[tier] ?? "text-zinc-400 bg-zinc-500/10"}`}>
                    <span className="capitalize">{tier}</span>
                    <span className="opacity-70">·</span>
                    <span>{count} user{count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiry */}
          {inventory.expiresAt && (
            <p className="text-[11px] text-zinc-600">
              License renews: {new Date(inventory.expiresAt).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}
            </p>
          )}
        </div>
      )}

      {/* ── Member license table ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none" />
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 outline-none">
            <option value="">All tiers</option>
            {TIER_LABELS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="self-center text-xs text-zinc-500">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Privacy notice */}
        <p className="text-[11px] text-zinc-600">
          Activity shows session counts and last-seen dates only. No emotional content or conversation data is ever shown to admins.
        </p>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/8">
          <table className="w-full text-xs">
            <thead className="border-b border-white/8 bg-white/4">
              <tr className="text-zinc-500">
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">License tier</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Activity (30d)</th>
                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Last active</th>
                <th className="px-4 py-2.5 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No members match your filter.</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.userId} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200 truncate max-w-[180px]">{m.email}</p>
                    <p className="text-[10px] text-zinc-600">Joined {timeAgo(m.joinedAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      m.role === "owner" ? "bg-amber-500/15 text-amber-300" :
                      m.role === "admin" ? "bg-indigo-500/15 text-indigo-300" : "bg-zinc-500/10 text-zinc-400"
                    }`}>{m.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    {m.role === "owner" ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TIER_COLORS[m.effectiveTier] ?? "text-zinc-400 bg-zinc-500/10"}`}>
                        {m.effectiveTier} {m.overrideTier ? "(override)" : "(org default)"}
                      </span>
                    ) : (
                      <select
                        value={m.overrideTier ?? "__org__"}
                        disabled={saving === m.userId}
                        onChange={(e) => handleTierChange(m.userId, e.target.value === "__org__" ? null : e.target.value)}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-200 outline-none disabled:opacity-50"
                      >
                        <option value="__org__">Org default ({inventory?.tier ?? "enterprise"})</option>
                        {TIER_LABELS.filter((t) => t !== "free").map((t) => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                        <option value="free">Free (restricted)</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <ActivityDots count={m.sessionsLast30} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-500">
                    {timeAgo(m.lastActive ?? m.lastSignIn)}
                  </td>
                  <td className="px-4 py-3">
                    {m.role !== "owner" && (
                      <button
                        onClick={() => handleWithdraw(m.userId, m.email)}
                        disabled={saving === m.userId}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
                      >
                        {saving === m.userId ? "…" : "Withdraw"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
