"use client";

// /admin/crisis-events — read-only dashboard of recent crisis-detection
// events (metadata only: who, when, which platform/language — never the
// message text; owner decision 2026-08-14, see docs/sql/crisis_events_v1.sql).
//
// No standalone login form here — auth is the same httpOnly admin session
// cookie set by logging in at /admin, sent automatically on this same-origin
// fetch. If it's missing/expired, the fetch 401s and this page just links
// back to /admin to log in there, rather than duplicating that whole flow.

import { useEffect, useState } from "react";

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

  // This admin panel is dark-only — same override as the main /admin page,
  // so a carried-over light data-theme doesn't collide into unreadable text.
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute("data-theme");
    html.removeAttribute("data-theme");
    return () => {
      if (prevTheme) html.setAttribute("data-theme", prevTheme);
    };
  }, []);

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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Crisis Events</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Metadata-only log of detected crisis-adjacent messages (suicidal ideation, self-harm, abuse).
              No message text is stored. One row per ~60-minute episode per user.
            </p>
          </div>
          <a href="/admin" className="text-sm text-violet-400 underline underline-offset-2 hover:text-violet-300">
            ← Back to Admin
          </a>
        </div>

        {error === "unauthorized" && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Your admin session isn&apos;t active here.{" "}
            <a href="/admin" className="font-semibold underline underline-offset-2">Log in at /admin</a> first, then return to this page.
          </div>
        )}
        {error === "other" && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            Failed to load crisis events. Try refreshing.
          </div>
        )}

        {!error && events === null && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}

        {!error && events !== null && events.length === 0 && (
          <p className="text-sm text-zinc-500">No crisis events recorded.</p>
        )}

        {!error && events !== null && events.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
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
          <p className="mt-3 text-xs text-zinc-500">Showing the most recent 200 events.</p>
        )}
      </div>
    </main>
  );
}
