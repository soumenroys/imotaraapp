"use client";

// /admin/crisis-events — read-only dashboard of recent crisis-detection
// events (metadata only: who, when, which platform/language — never the
// message text; owner decision 2026-08-14, see docs/sql/crisis_events_v1.sql).
//
// No standalone login form here — auth is the same httpOnly admin session
// cookie set by logging in at /admin, sent automatically on this same-origin
// fetch. If it's missing/expired, the fetch 401s and this page just links
// back to /admin to log in there, rather than duplicating that whole flow.

import { useEffect, useMemo, useState } from "react";
import { AdminShell, Tile, useAdminRole } from "@/app/admin/_components/ui";
import { PageTutorial } from "@/app/admin/_components/PageTutorial";
import { ADMIN_TUTORIALS } from "@/app/admin/_components/adminTutorials";

type CrisisEvent = {
  id: string;
  user_id: string | null;
  email: string | null;
  platform: "web" | "mobile";
  preferred_lang: string | null;
  created_at: string;
};

export default function CrisisEventsPage() {
  const [events, setEvents]   = useState<CrisisEvent[] | null>(null);
  const [error, setError]     = useState<"unauthorized" | "other" | null>(null);
  const role = useAdminRole();

  // ⚠️ The data-theme / data-fontsize override that used to sit here has moved
  // to src/app/admin/layout.tsx, which applies it to EVERY admin route.

  useEffect(() => {
    fetch("/api/admin/crisis-events", { credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) { setError("unauthorized"); return; }
        if (!res.ok) { setError("other"); return; }
        const d = await res.json();
        setEvents(d.events ?? []);
      })
      .catch(() => setError("other"));
  }, []);

  /**
   * ⚠️ Counted here rather than asked of the server: the rows are already in
   * the browser, and a second endpoint that could disagree with the table
   * underneath it is a bug waiting to be filed.
   */
  const summary = useMemo(() => {
    if (!events) return null;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = events.filter((e) => new Date(e.created_at).getTime() >= weekAgo).length;
    const mobile = events.filter((e) => e.platform === "mobile").length;
    const languages = new Set(events.map((e) => e.preferred_lang).filter(Boolean)).size;
    return { total: events.length, recent, mobile, web: events.length - mobile, languages };
  }, [events]);

  return (
    <AdminShell
      title="Crisis Events"
      lede="A metadata-only log of detected crisis-adjacent messages. No message text is stored — one row per roughly 60-minute episode per person."
      current="crisis"
      role={role}
    >
      <PageTutorial id="admin-crisis" {...ADMIN_TUTORIALS.crisis} />

      <div className="mt-6 space-y-6">
        {error === "unauthorized" && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Your admin session isn&apos;t active here.{" "}
            <a href="/admin" className="font-semibold underline underline-offset-2">Log in at /admin</a> first, then return to this page.
          </div>
        )}
        {error === "other" && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            Failed to load crisis events. Try refreshing.
          </div>
        )}

        {!error && events === null && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}
          </div>
        )}

        {!error && summary && summary.total > 0 && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Episodes logged" value={summary.total} tone="rose" sub="most recent 200" />
            <Tile label="Last 7 days" value={summary.recent} tone="amber" />
            <Tile label="On the app" value={summary.mobile} tone="sky" sub={`${summary.web} on the web`} />
            <Tile label="Languages" value={summary.languages} tone="indigo"
              href="/admin/analytics" goesTo="Compare with Activity" />
          </section>
        )}

        {!error && events !== null && events.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center text-sm text-zinc-500">
            No crisis events recorded.
          </p>
        )}

        {!error && events !== null && events.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/8 bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Language</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-300">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {e.email ?? <span className="text-zinc-500">{e.user_id ?? "unknown"}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${e.platform === "mobile" ? "bg-sky-500/15 text-sky-300" : "bg-violet-500/15 text-violet-300"}`}>
                        {e.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{e.preferred_lang || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && events !== null && events.length >= 200 && (
          <p className="text-xs text-zinc-500">Showing the most recent 200 events.</p>
        )}
      </div>
    </AdminShell>
  );
}
