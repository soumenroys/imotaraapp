"use client";

// /admin/analytics — product activity, from our own usage_events table.
//
// Same auth as the other admin sub-pages: the httpOnly session cookie set by
// logging in at /admin, sent on this same-origin fetch. No login form here.
//
// Deliberately has NO charting dependency. Everything below is inline SVG and
// CSS widths. A dashboard that only the owner sees is not worth 80 KB of
// library on the bundle, and the shapes here (a daily line, a few stacked
// bars) are a few lines of path arithmetic.

import { useEffect, useMemo, useState } from "react";

type Series = { date: string; events: number; activeUsers: number; byPlatform: Record<string, number> };
type Bucket = { key: string; events: number; users: number };
type Cohort = { cohortDate: string; size: number; d1: number | null; d7: number | null; d30: number | null };

type Data = {
  range:   { days: number; from: string; to: string };
  totals:  { events: number; activeUsers: number; newUsers: number; returningUsers: number };
  rolling: { dau: number; wau: number; mau: number };
  series:  Series[];
  byEventType: Bucket[];
  byPlatform:  Bucket[];
  emotions:    { emotion: string; count: number }[];
  retention:   Cohort[];
  meta: { platformReady: boolean; truncated: boolean; note: string };
};

const PLATFORM_LABEL: Record<string, string> = {
  web: "Website", ios: "iPhone / iPad", android: "Android", unknown: "Unattributed",
};
const PLATFORM_COLOR: Record<string, string> = {
  web: "#38bdf8", ios: "#a78bfa", android: "#34d399", unknown: "#52525b",
};
const EVENT_LABEL: Record<string, string> = {
  chat_reply:      "Cloud replies",
  tts:             "Spoken replies",
  voice_transcribe:"Voice input",
  settings_search: "Settings search",
};

function Sparkline({ points }: { points: number[] }) {
  const w = 720, h = 90, pad = 4;
  const max = Math.max(1, ...points);
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(pad + (points.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Daily activity">
      <path d={area} fill="url(#g)" opacity="0.35" />
      <path d={line} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function Bars({ rows, labels, colors }: {
  rows: Bucket[]; labels: Record<string, string>; colors?: Record<string, string>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.events));
  if (!rows.length) return <p className="text-sm text-zinc-500">Nothing in this period.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-300">{labels[r.key] ?? r.key}</span>
            <span className="tabular-nums text-zinc-400">
              {r.events.toLocaleString()} <span className="text-zinc-600">· {r.users} {r.users === 1 ? "person" : "people"}</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(r.events / max) * 100}%`, background: colors?.[r.key] ?? "#6366f1" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<"unauthorized" | "other" | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin panel is dark-only, same override as /admin and /admin/crisis-events.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.removeAttribute("data-theme");
    return () => { if (prev) html.setAttribute("data-theme", prev); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`/api/admin/analytics?days=${days}`, { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) { setError("unauthorized"); return; }
        if (!res.ok) { setError("other"); return; }
        setData(await res.json());
      })
      .catch(() => { if (!cancelled) setError("other"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const pct = (n: number | null, of: number) =>
    n === null ? <span className="text-zinc-600">—</span> : `${Math.round((n / Math.max(1, of)) * 100)}%`;

  const totalPlatformEvents = useMemo(
    () => (data?.byPlatform ?? []).reduce((s, r) => s + r.events, 0), [data],
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Activity</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Computed from Imotara&apos;s own <code className="text-zinc-300">usage_events</code> table.
              No third-party analytics service is involved — nothing here leaves our database,
              and the &ldquo;no analytics SDK&rdquo; position in the store declarations stays accurate.
            </p>
          </div>
          <a href="/admin" className="text-sm text-violet-400 underline underline-offset-2 hover:text-violet-300">
            ← Back to Admin
          </a>
        </div>

        <div className="mb-6 flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                days === d ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40"
                           : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>

        {error === "unauthorized" && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Your admin session isn&apos;t active here.{" "}
            <a href="/admin" className="font-semibold underline underline-offset-2">Log in at /admin</a> first, then return.
          </div>
        )}
        {error === "other" && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            Could not load activity.
          </div>
        )}
        {loading && !data && !error && <p className="text-sm text-zinc-500">Loading…</p>}

        {data && !error && (
          <div className="space-y-8">
            {!data.meta.platformReady && (
              <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 text-sm text-sky-200">
                Web and app can&apos;t be told apart yet — run{" "}
                <code className="text-sky-100">docs/sql/usage_events_platform.sql</code> in the Supabase SQL editor,
                then redeploy. Everything else on this page works now.
              </div>
            )}
            {data.meta.truncated && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Hit the row ceiling for this range — the numbers below are a floor, not a total. Use a shorter range.
              </div>
            )}

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Active today"    value={data.rolling.dau} />
              <Stat label="Active this week"value={data.rolling.wau} />
              <Stat label="Active 30 days"  value={data.rolling.mau} />
              <Stat label="Events"          value={data.totals.events.toLocaleString()} sub={`over ${data.range.days} days`} />
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Stat label="New people"       value={data.totals.newUsers}       sub="first ever activity in this window" />
              <Stat label="Returning people" value={data.totals.returningUsers} sub="active before this window too" />
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-2 text-sm font-medium text-zinc-300">Daily activity</h2>
              <Sparkline points={data.series.map((s) => s.events)} />
              <div className="mt-1 flex justify-between text-xs text-zinc-600">
                <span>{data.series[0]?.date}</span>
                <span>{data.series[data.series.length - 1]?.date}</span>
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h2 className="mb-3 text-sm font-medium text-zinc-300">Where it happened</h2>
                <Bars rows={data.byPlatform} labels={PLATFORM_LABEL} colors={PLATFORM_COLOR} />
                {totalPlatformEvents > 0 && data.byPlatform.some((p) => p.key === "unknown") && (
                  <p className="mt-3 text-xs text-zinc-600">
                    &ldquo;Unattributed&rdquo; is mostly events recorded before this split existed, plus app
                    versions older than 1.4.1 that don&apos;t send the header yet.
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h2 className="mb-3 text-sm font-medium text-zinc-300">What people did</h2>
                <Bars rows={data.byEventType} labels={EVENT_LABEL} />
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-1 text-sm font-medium text-zinc-300">Do they come back?</h2>
              <p className="mb-3 text-xs text-zinc-500">
                Each row is the people whose very first activity was that day. A dash means that cohort
                isn&apos;t old enough to answer yet — not that nobody returned.
              </p>
              {data.retention.length === 0 ? (
                <p className="text-sm text-zinc-500">No new people in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr className="border-b border-zinc-800">
                        <th className="py-2 text-left font-medium">First seen</th>
                        <th className="py-2 text-right font-medium">People</th>
                        <th className="py-2 text-right font-medium">Day 1</th>
                        <th className="py-2 text-right font-medium">Day 7</th>
                        <th className="py-2 text-right font-medium">Day 30</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {data.retention.slice().reverse().map((c) => (
                        <tr key={c.cohortDate} className="border-b border-zinc-900">
                          <td className="py-2 text-zinc-300">{c.cohortDate}</td>
                          <td className="py-2 text-right text-zinc-400">{c.size}</td>
                          <td className="py-2 text-right text-zinc-300">{pct(c.d1, c.size)}</td>
                          <td className="py-2 text-right text-zinc-300">{pct(c.d7, c.size)}</td>
                          <td className="py-2 text-right text-zinc-300">{pct(c.d30, c.size)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {data.emotions.length > 0 && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h2 className="mb-1 text-sm font-medium text-zinc-300">What people were feeling</h2>
                <p className="mb-3 text-xs text-zinc-500">
                  Aggregate counts of the emotion label attached to a cloud reply. Counts only —
                  no message text is stored or shown here, ever.
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.emotions.map((e) => (
                    <span key={e.emotion} className="rounded-full bg-zinc-800/80 px-3 py-1 text-sm text-zinc-300">
                      {e.emotion} <span className="text-zinc-500">{e.count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            <p className="pb-6 text-xs text-zinc-600">
              usage_events is written when something costly happens — a cloud reply, a spoken reply, a
              transcription, a settings search. It is not a clickstream: it can tell you who used what and
              whether they returned, not where they came from or what they tapped.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
