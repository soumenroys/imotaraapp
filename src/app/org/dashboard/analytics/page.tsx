"use client";
// src/app/org/dashboard/analytics/page.tsx
// Aggregate anonymized engagement stats — EDU/NGO billing_type only.

import { useEffect, useState } from "react";

interface Summary { totalEvents: number; uniqueDays: number; avgWAU: number; avgSessionMins: number }
interface DailyStat { statDate: string; activeUsers: number; totalEvents: number; avgSessionMins: number }
interface AnalyticsData { orgName: string; days: number; summary: Summary; daily: DailyStat[] }

function StatCard({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4 text-center">
      <p className="text-2xl font-bold text-indigo-300">{value}<span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span></p>
      <p className="mt-0.5 text-xs text-zinc-400">{label}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData]     = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [days, setDays]     = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/org/dashboard/analytics?days=${days}`, { credentials: "same-origin" })
      .then((r) => {
        if (r.status === 403) throw new Error("Analytics is available for EDU and NGO organisations only.");
        if (!r.ok)            throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  const maxEvents = data ? Math.max(...data.daily.map((d) => d.totalEvents), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-100">Analytics</h1>
        <div className="flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
          {[30, 90, 180].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1 text-xs transition ${days === d ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-600">
        All data is aggregated and anonymised — no individual user activity is shown.
      </p>

      {loading && <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}</div>}
      {error   && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}

      {data && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total interactions" value={data.summary.totalEvents} />
            <StatCard label="Active days"         value={data.summary.uniqueDays} unit={`/ ${data.days}`} />
            <StatCard label="Avg weekly active"   value={data.summary.avgWAU}     unit="users" />
            <StatCard label="Avg session"         value={data.summary.avgSessionMins} unit="min" />
          </div>

          {/* Bar chart — daily events */}
          <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4">
            <p className="mb-4 text-sm font-medium text-zinc-300">Daily interactions (last {data.days} days)</p>
            {data.daily.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No activity in this period.</p>
            ) : (
              <div className="flex h-32 items-end gap-0.5 overflow-hidden">
                {data.daily.slice().reverse().map((d) => {
                  const height = Math.max(2, Math.round((d.totalEvents / maxEvents) * 100));
                  return (
                    <div key={d.statDate} className="group relative flex-1" title={`${d.statDate}: ${d.totalEvents} interactions`}>
                      <div className="w-full rounded-t bg-indigo-500/60 transition-all hover:bg-indigo-400/80"
                           style={{ height: `${height}%` }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active users table */}
          {data.daily.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">
              <p className="px-5 py-3 text-sm font-medium text-zinc-300 border-b border-white/8">Recent daily breakdown</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8 text-zinc-500">
                    <th className="px-5 py-2 text-left font-medium">Date</th>
                    <th className="px-5 py-2 text-right font-medium">Active users</th>
                    <th className="px-5 py-2 text-right font-medium">Interactions</th>
                    <th className="px-5 py-2 text-right font-medium">Avg session</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.slice(0, 14).map((d) => (
                    <tr key={d.statDate} className="border-b border-white/5 hover:bg-white/3">
                      <td className="px-5 py-2 text-zinc-400">{new Date(d.statDate).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}</td>
                      <td className="px-5 py-2 text-right text-zinc-200">{d.activeUsers}</td>
                      <td className="px-5 py-2 text-right text-zinc-200">{d.totalEvents}</td>
                      <td className="px-5 py-2 text-right text-zinc-400">{d.avgSessionMins}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
