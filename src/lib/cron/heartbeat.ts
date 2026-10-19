// src/lib/cron/heartbeat.ts
// "Did that job actually run?" — answered from our own data.
//
// 🔴 WHY THIS EXISTS. Vercel's runtime logs returned nothing at all for a
// 45-minute window, including for two crons that run every minute and
// demonstrably work. Log retention is a plan setting; it is not a monitor. And
// this repo has already shipped two crons that answered 405 for months —
// a dead cron produces exactly as much output as a healthy one with nothing to
// do, which is none.
//
// ⇒ Each job records that it fired. The admin panel compares that against the
// schedule in vercel.json and says what is late.

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { describeJob } from "@/lib/cron/jobDescriptions";

/**
 * Record that a job just ran.
 *
 * ⛔ NEVER THROWS, AND NEVER BLOCKS THE WORK. A monitoring write that can fail
 * a cron turns an observability feature into an outage — the exact inversion
 * this is meant to prevent. A missed heartbeat shows up as "late", which is
 * the correct and visible failure.
 */
export async function markCronFired(job: string, note?: string): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    // ⚠️ fire_count climbs via the SQL expression rather than a read-then-write,
    // so two overlapping runs cannot lose a count between them.
    await db.rpc("bump_cron_heartbeat", { p_job: job, p_note: note ?? null });
  } catch {
    // Deliberately silent. See above.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// How late is late — pure, so the thresholds can be argued with in a test
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How often a schedule is expected to fire, in minutes.
 *
 * ⚠️ NOT A GENERAL CRON PARSER, and it says so by returning null rather than
 * guessing. It understands the shapes this project actually uses; anything
 * else is reported as "unknown schedule" in the panel, which is honest and
 * visible, instead of a confident wrong number.
 */
export function expectedIntervalMinutes(schedule: string): number | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dom, month, dow] = parts;

  // Anything that restricts the day is beyond what this needs to know.
  if (dom !== "*" || month !== "*" || dow !== "*") return null;

  if (minute === "*") return hour === "*" ? 1 : null;

  const everyN = minute.match(/^\*\/(\d+)$/);
  if (everyN) return hour === "*" ? Number(everyN[1]) : null;

  // A fixed minute: hourly if the hour is open, daily if it is pinned.
  if (/^\d+$/.test(minute)) {
    if (hour === "*") return 60;
    if (/^\d+$/.test(hour)) return 24 * 60;
  }
  return null;
}

/**
 * How long we wait before calling a job late.
 *
 * 🔑 One whole missed run, plus half an interval of slack — so a minute-cron
 * is late at eleven minutes and a daily one at thirty-six hours. ⛔ Not a flat
 * number: five minutes would cry wolf at every daily job, and two hours would
 * never notice a minute-cron had stopped.
 */
export function lateAfterMinutes(intervalMinutes: number): number {
  return intervalMinutes + Math.max(10, intervalMinutes * 0.5);
}

export type JobHealth = {
  job: string;
  /** 🔑 What it does, in one line ⇒ jobDescriptions.ts. Null if nobody has
   *  written one — which the panel shows as blank rather than as a guess. */
  description: string | null;
  schedule: string;
  intervalMinutes: number | null;
  lastFiredAt: string | null;
  minutesAgo: number | null;
  fireCount: number;
  note: string | null;
  state: "ok" | "late" | "never" | "unknown-schedule";
};

/**
 * Judge every declared job against its last heartbeat.
 *
 * ⚠️ Driven by the jobs DECLARED in vercel.json, not by the rows found. A job
 * that has never once fired has no row at all — and that is precisely the
 * case worth shouting about, so it must not be the case that disappears.
 */
export function judgeJobs(
  declared: { path: string; schedule: string }[],
  heartbeats: { job: string; last_fired_at: string; fire_count: number; last_note: string | null }[],
  now: Date = new Date(),
): JobHealth[] {
  const byJob = new Map(heartbeats.map((h) => [h.job, h]));

  return declared
    .map((d): JobHealth => {
      const interval = expectedIntervalMinutes(d.schedule);
      const hit = byJob.get(d.path);
      const minutesAgo = hit
        ? Math.round((now.getTime() - new Date(hit.last_fired_at).getTime()) / 60000)
        : null;

      let state: JobHealth["state"];
      if (!hit) state = "never";
      else if (interval === null) state = "unknown-schedule";
      else state = (minutesAgo ?? 0) > lateAfterMinutes(interval) ? "late" : "ok";

      return {
        job: d.path,
        description: describeJob(d.path),
        schedule: d.schedule,
        intervalMinutes: interval,
        lastFiredAt: hit?.last_fired_at ?? null,
        minutesAgo,
        fireCount: hit?.fire_count ?? 0,
        note: hit?.last_note ?? null,
        state,
      };
    })
    // ⚠️ Worst first. A panel that buries the dead job under nine healthy ones
    // is the same blind spot in a nicer typeface.
    .sort((a, b) => {
      const rank = { never: 0, late: 1, "unknown-schedule": 2, ok: 3 } as const;
      return rank[a.state] - rank[b.state] || a.job.localeCompare(b.job);
    });
}
