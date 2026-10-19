"use client";

// "Is every scheduled job still running?" — answered on the Dashboard.
//
// 🔴 WHY A PANEL AND NOT A LOG SEARCH. Vercel returned no runtime logs at all
// for a 45-minute window, including for two crons that fire every minute and
// demonstrably work. Log retention is a plan setting; it is not a monitor.
// This reads jobs declared in vercel.json against heartbeats the jobs
// themselves write, so it cannot be silenced by a retention window.
//
// ⚠️ A dead cron produces exactly as much output as a healthy one with nothing
// to do — none. This repo already shipped two crons that answered 405 for
// MONTHS. The whole point is that "never fired" is loud.

import { useCallback, useEffect, useState } from "react";
import { Card, Chip } from "@/app/admin/_components/ui";

type Job = {
  job: string;
  /** ⚠️ Null when nobody has written one ⇒ jobDescriptions.ts. */
  description: string | null;
  schedule: string;
  intervalMinutes: number | null;
  lastFiredAt: string | null;
  minutesAgo: number | null;
  fireCount: number;
  note: string | null;
  state: "ok" | "late" | "never" | "unknown-schedule";
};

const STATE: Record<Job["state"], { label: string; tone: "green" | "amber" | "rose" | "zinc" }> = {
  ok:                 { label: "Running",       tone: "green" },
  late:               { label: "Late",          tone: "rose"  },
  never:              { label: "Never fired",   tone: "rose"  },
  "unknown-schedule": { label: "Not judged",    tone: "zinc"  },
};

function ago(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

export function CronHealth() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cron-health", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not read the scheduled jobs."); return; }
      setError("");
      setJobs(json.jobs ?? []);
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unwell = (jobs ?? []).filter((j) => j.state === "late" || j.state === "never").length;

  return (
    <Card
      title="Scheduled jobs"
      hint="Each job records that it ran. This compares that against its schedule — it does not depend on log retention, so a job that stops is visible here even when the logs are empty."
    >
      {error && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
          {error}
        </p>
      )}

      {!error && jobs === null && <div className="h-20 animate-pulse rounded-xl bg-white/5" />}

      {!error && jobs !== null && (
        <>
          <p className="mb-3 text-xs text-zinc-400">
            {unwell === 0
              ? `All ${jobs.length} jobs have run recently.`
              : `⚠️ ${unwell} of ${jobs.length} ${unwell === 1 ? "job needs" : "jobs need"} attention.`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/8 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Job &amp; what it does</th>
                  <th className="py-2 pr-3 font-medium">Expected</th>
                  <th className="py-2 pr-3 font-medium">Last run</th>
                  <th className="py-2 pr-3 font-medium">Runs</th>
                  <th className="py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.job} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-mono text-[11px] text-zinc-300">{j.job.replace("/api/", "")}</div>
                      {/* 🔑 WHAT IT DOES, under the path ⇒ jobDescriptions.ts. A list of
                          names is not a list of jobs: "connect-orphans" showing LATE
                          cannot be judged until a reader knows whether that is an outage
                          or a tidy-up. ⛔ Blank when nobody has written one, rather than
                          a restatement of the path dressed up as information. */}
                      {j.description ? (
                        <div className="mt-0.5 max-w-[34rem] text-[11px] leading-snug text-zinc-500">
                          {j.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">
                      {j.intervalMinutes === null
                        ? j.schedule
                        : j.intervalMinutes < 60
                          ? `every ${j.intervalMinutes} min`
                          : j.intervalMinutes < 1440
                            ? `every ${j.intervalMinutes / 60} h`
                            : "daily"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-400">{ago(j.minutesAgo)}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums text-zinc-500">{j.fireCount || "—"}</td>
                    <td className="py-2">
                      <Chip tone={STATE[j.state].tone}>{STATE[j.state].label}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            ⛔ &ldquo;Never fired&rdquo; means no run has ever been recorded. On a job that has always
            worked, that means the heartbeat is new — it becomes meaningful once a full interval has
            passed. On any other job it means the schedule is not reaching the route.
          </p>
        </>
      )}
    </Card>
  );
}
