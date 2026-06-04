"use client";
// src/app/org/dashboard/overview/page.tsx

import { useEffect, useState } from "react";
import Link from "next/link";

interface OrgOverview {
  org: {
    name: string; slug: string; billing_type: string; tier: string;
    status: string; seats_purchased: number; seats_used: number; expires_at: string | null;
  };
  members:        { total: number; owner: number; admin: number; member: number };
  pendingInvites: number;
  wau:            number;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
      <p className={`text-2xl font-bold ${color ?? "text-zinc-100"}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-zinc-400">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p>}
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  enterprise: "text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/20",
  edu:        "text-teal-300 bg-teal-500/15 ring-1 ring-teal-500/20",
};
const TYPE_LABELS: Record<string, string> = {
  commercial: "Company", ngo: "NGO / NPO", edu: "Educational", govt: "Government",
};

export default function OverviewPage() {
  const [data, setData]     = useState<OrgOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    fetch("/api/org/dashboard", { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}</div>;
  if (error)   return <p className="text-sm text-rose-400">{error}</p>;
  if (!data)   return null;

  const { org, members, pendingInvites, wau } = data;
  const seatPct = org.seats_purchased > 0 ? Math.round((org.seats_used / org.seats_purchased) * 100) : 0;
  const expiryLabel = org.expires_at
    ? new Date(org.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "No expiry";

  return (
    <div className="space-y-6">
      {/* Org identity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{org.name}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{TYPE_LABELS[org.billing_type] ?? org.billing_type} · /{org.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${TIER_COLORS[org.tier] ?? "text-zinc-400 bg-zinc-500/10"}`}>
            {org.tier.charAt(0).toUpperCase() + org.tier.slice(1)} plan
          </span>
          {org.status !== "active" && (
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-500/20">
              {org.status}
            </span>
          )}
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total members"    value={members.total}    color="text-indigo-300" />
        <StatCard label="Seats used"       value={`${org.seats_used} / ${org.seats_purchased}`}
                  sub={`${seatPct}% capacity`} color={seatPct >= 90 ? "text-rose-300" : "text-emerald-300"} />
        <StatCard label="Pending invites"  value={pendingInvites}   color="text-amber-300" />
        <StatCard label="Weekly active"    value={wau}              sub="unique users last 7d" color="text-sky-300" />
      </div>

      {/* Seats progress bar */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-300">Seat capacity</p>
          <p className="text-sm text-zinc-400">{org.seats_used} / {org.seats_purchased} used</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/8">
          <div className={`h-full rounded-full transition-all duration-500 ${seatPct >= 90 ? "bg-rose-500" : seatPct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
               style={{ width: `${Math.min(seatPct, 100)}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Renews: {expiryLabel} · {org.seats_purchased - org.seats_used} seats available
          {org.seats_used >= org.seats_purchased && " — contact Imotara to add more seats"}
        </p>
      </div>

      {/* Role breakdown */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
        <p className="mb-3 text-sm font-medium text-zinc-300">Members by role</p>
        <div className="flex flex-wrap gap-4">
          {[
            { label: "Owners",  count: members.owner,  color: "text-orange-300" },
            { label: "Admins",  count: members.admin,  color: "text-indigo-300" },
            { label: "Members", count: members.member, color: "text-zinc-200"  },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className={`text-xl font-bold ${r.color}`}>{r.count}</span>
              <span className="text-sm text-zinc-500">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/org/dashboard/members"
          className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20">
          👥 Manage members
        </Link>
        <Link href="/org/dashboard/settings"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10">
          ⚙️ Settings
        </Link>
        {["ngo","edu"].includes(org.billing_type) && (
          <Link href="/org/dashboard/analytics"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10">
            📈 View analytics
          </Link>
        )}
      </div>
    </div>
  );
}
