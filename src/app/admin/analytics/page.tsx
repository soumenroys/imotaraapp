"use client";

// /admin/analytics — product activity, from our own usage_events table.
//
// Same auth as the other admin sub-pages: the httpOnly session cookie set by
// logging in at /admin, sent on this same-origin fetch. No login form here.
//
// Deliberately has NO charting dependency. Everything is inline SVG and CSS
// widths. A dashboard that only a handful of people open is not worth 80 KB of
// library on the bundle, and these shapes are path arithmetic.
//
// ⚠️ The charts moved to _components/charts.tsx when the rest of the panel
// needed them too. The local Sparkline and Stat they replaced are gone — the
// same pictures, drawn by shared components with axes and legends.

import { useEffect, useMemo, useState } from "react";
import { AdminShell, Card, Tile, useAdminRole } from "@/app/admin/_components/ui";
import { PageTutorial } from "@/app/admin/_components/PageTutorial";
import { ADMIN_TUTORIALS } from "@/app/admin/_components/adminTutorials";
import { Insights } from "@/app/admin/_components/Insights";
import { LineChart, Donut, SplitBar, RetentionCurve } from "@/app/admin/_components/charts";
import { insightsFor, pooledRetention } from "@/lib/admin/insights";

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
  // ⚠️ Only so the shared nav can hide what this admin may not open.
  const role = useAdminRole();

  // ⚠️ The data-theme / data-fontsize override that used to sit here has moved
  // to src/app/admin/layout.tsx, which applies it to EVERY admin route. Three
  // pages had their own copy and five social screens had none.

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

  const insights = useMemo(() => (data ? insightsFor(data) : []), [data]);

  const retentionCurve = useMemo(() => {
    if (!data) return [];
    return ([["Day 1", "d1"], ["Day 7", "d7"], ["Day 30", "d30"]] as const).map(([day, key]) => ({
      day,
      pct: pooledRetention(data.retention, key)?.pct ?? null,
    }));
  }, [data]);

  return (
    <AdminShell
      title="Activity"
      lede="Computed from Imotara's own usage_events table. No third-party analytics service is involved — nothing here leaves our database, and the “no analytics SDK” position in the store declarations stays accurate."
      current="analytics"
      role={role}
    >
      <PageTutorial id="admin-analytics" {...ADMIN_TUTORIALS.analytics} />

      <div className="mb-6 mt-4 flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            aria-pressed={days === d}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              days === d
                ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/40"
                : "border border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {d} days
          </button>
        ))}
      </div>

      {error === "unauthorized" && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Your admin session isn&apos;t active here.{" "}
          <a href="/admin" className="font-semibold underline underline-offset-2">Log in at /admin</a> first, then return.
        </div>
      )}
      {error === "other" && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Could not load activity.
        </div>
      )}
      {loading && !data && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />)}
        </div>
      )}

      {data && !error && (
        <div className="space-y-8">
          {/* \u26a0\ufe0f The platform-not-ready and truncated banners that used to sit
              here are now the first two insight cards. Same words, same SQL
              filename \u2014 but beside the action, instead of above a wall of
              numbers the reader has to work out are affected. */}
          <Insights insights={insights} />

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Active today"     value={data.rolling.dau} tone="indigo" />
            <Tile label="Active this week" value={data.rolling.wau} tone="sky" />
            <Tile label="Active 30 days"   value={data.rolling.mau} tone="emerald" />
            <Tile label="Events"           value={data.totals.events.toLocaleString()} sub={`over ${data.range.days} days`} />
          </section>

          <Card title="New and returning" hint="Everyone active in this window, split by whether we had seen them before.">
            <SplitBar
              parts={[
                { label: "New", value: data.totals.newUsers, color: "#38bdf8" },
                { label: "Returning", value: data.totals.returningUsers, color: "#818cf8" },
              ]}
            />
          </Card>

          <Card title="Daily activity" hint="Events against the number of people who caused them. The gap between the two lines is how much each person is doing.">
            <LineChart
              lines={[
                { label: "Events", color: "#818cf8", points: data.series.map((s) => s.events) },
                { label: "People", color: "#34d399", points: data.series.map((s) => s.activeUsers) },
              ]}
              xFirst={data.series[0]?.date}
              xLast={data.series[data.series.length - 1]?.date}
            />
          </Card>

          <section className="grid gap-4 md:grid-cols-2">
            <Card title="Where it happened">
              <Donut
                slices={data.byPlatform.map((p) => ({
                  label: PLATFORM_LABEL[p.key] ?? p.key,
                  value: p.events,
                  color: PLATFORM_COLOR[p.key] ?? "#52525b",
                }))}
                centreLabel="events"
                centreValue={totalPlatformEvents.toLocaleString()}
              />
              {totalPlatformEvents > 0 && data.byPlatform.some((p) => p.key === "unknown") && (
                <p className="mt-3 text-xs text-zinc-600">
                  &ldquo;Unattributed&rdquo; is mostly events recorded before this split existed, plus app
                  versions older than 1.4.1 that don&apos;t send the header yet.
                </p>
              )}
            </Card>
            <Card title="What people did">
              <Bars rows={data.byEventType} labels={EVENT_LABEL} />
            </Card>
          </section>

          <Card
            title="Do they come back?"
            hint="Of everyone whose very first activity fell in this window, the share still active later. Pooled across every group old enough to answer, so one tiny day cannot swing it."
          >
            <RetentionCurve points={retentionCurve} />

            <details className="mt-4 group">
              <summary className="cursor-pointer list-none text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
                Day by day, with the group sizes
              </summary>
              <p className="mt-2 mb-3 text-xs text-zinc-500">
                Each row is the people whose very first activity was that day. A dash means that cohort
                isn&apos;t old enough to answer yet — not that nobody returned.
              </p>
              {data.retention.length === 0 ? (
                <p className="text-sm text-zinc-500">No new people in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr className="border-b border-white/8">
                        <th className="py-2 text-left font-medium">First seen</th>
                        <th className="py-2 text-right font-medium">People</th>
                        <th className="py-2 text-right font-medium">Day 1</th>
                        <th className="py-2 text-right font-medium">Day 7</th>
                        <th className="py-2 text-right font-medium">Day 30</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {data.retention.slice().reverse().map((c) => (
                        <tr key={c.cohortDate} className="border-b border-white/5">
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
            </details>
          </Card>

          {data.emotions.length > 0 && (
            <Card
              title="What people were feeling"
              hint="Aggregate counts of the emotion label attached to a cloud reply. Counts only — no message text is stored or shown here, ever."
            >
              <div className="flex flex-wrap gap-2">
                {data.emotions.map((e) => (
                  <span key={e.emotion} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300">
                    {e.emotion} <span className="text-zinc-500">{e.count}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}

          <p className="pb-6 text-xs leading-relaxed text-zinc-600">
            usage_events is written when something costly happens — a cloud reply, a spoken reply, a
            transcription, a settings search. It is not a clickstream: it can tell you who used what and
            whether they returned, not where they came from or what they tapped.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
