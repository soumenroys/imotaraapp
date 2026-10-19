// src/lib/social/retimeQueue.ts
// Moving the posts a schedule has already written, when its clock changes.
//
// 🔴 THE DEFECT, PROVED BY TRIPPING OVER IT 19 Oct. `slotKey` is
// `scheduleId|platform|EXACT TIMESTAMP` ⇒ horizon.ts. So the instant a
// schedule's time changes, every already-queued day looks MISSING at the new
// time and the horizon writes a second post for it.
//
// ⛔ 10-day horizon × 2 channels = up to TWENTY duplicates, each one a model
// call and each one a post that would really publish — two a day, at two
// different hours, on a feed that is meant to post once.
//
// ⚠️ AND THE ADMIN'S "Change the time" BUTTON DID EXACTLY THIS. The route
// updated the schedule row and touched no post
// ⇒ trap_a_frozen_decision_outlives_its_rule, built into a shipped feature.
//
// 🔑 THE FIX IS NOT "SHIFT BY THE DIFFERENCE". A schedule can change its
// timezone, its days, or one channel's override, and an offset cannot express
// any of those. ⇒ Each post's slot is RECOMPUTED from the new schedule for
// the day it was already written for.

import { instantOf, timesFor, type ScheduleTimes } from "@/lib/social/horizon";

export type QueuedPost = {
  id: string;
  platform: string;
  status: string;
  scheduled_for: string | null;
};

export type Retimed =
  /** Move it: the schedule still runs on that day. */
  | { id: string; kind: "move"; from: string; to: string; platform: string }
  /**
   * 🔑 ITS DAY IS GONE. The schedule no longer runs on that weekday, so there
   * is no hour to move it to.
   *
   * ⛔ REPORTED, NOT DELETED. These are written, gate-checked words, and some
   * have been approved. Throwing them away because a day was unticked is a
   * decision for a person ⇒ the caller decides; this only names them.
   */
  | { id: string; kind: "orphan"; from: string; platform: string };

/** The weekday a wall-clock day falls on, 0 = Sunday, in the schedule's zone. */
function weekdayIn(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(at);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** The y/m/d a moment falls on, in the schedule's zone. */
function dateIn(at: Date, timeZone: string): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Where each of this schedule's unpublished posts should now sit.
 *
 * ⛔ PUBLISHED AND SKIPPED POSTS ARE NEVER TOUCHED. Their `scheduled_for` is a
 * record of what happened, not an instruction about what will.
 *
 * ⚠️ PURE, AND IT TAKES `now`. Posts whose new slot is already in the past are
 * still returned as moves — a post that was due at 17:00 and is now due at
 * 19:00 has not stopped being tonight's post just because it is 18:00. It is
 * the CALLER's business whether a late slot still publishes ⇒ social-publish
 * takes anything approved whose time has come.
 */
export function retimeFor(
  schedule: ScheduleTimes & { timezone: string },
  posts: QueuedPost[],
): Retimed[] {
  const out: Retimed[] = [];

  for (const p of posts) {
    if (!p.scheduled_for) continue;
    if (p.status !== "needs_review" && p.status !== "approved") continue;

    const at = new Date(p.scheduled_for);
    if (!Number.isFinite(at.getTime())) continue;

    const { post_at, days } = timesFor(schedule, p.platform);
    const tz = schedule.timezone;

    /**
     * ⚠️ THE DAY IS TAKEN FROM THE POST'S OWN SLOT, in the schedule's zone —
     * not from UTC. A post at 19:30 IST is 14:00Z, and reading the UTC date of
     * a 23:00 IST post would land on the day before.
     */
    const { y, m, d } = dateIn(at, tz);
    const weekday = weekdayIn(at, tz);

    if (!days.includes(weekday)) {
      out.push({ id: p.id, kind: "orphan", from: p.scheduled_for, platform: p.platform });
      continue;
    }

    const [hh, mm] = post_at.split(":").map(Number);
    const to = instantOf(y, m, d, hh, mm, tz).toISOString();
    // ⛔ Unchanged posts are not reported as moves. A change log full of
    // no-ops is a change log nobody reads.
    if (new Date(to).getTime() === at.getTime()) continue;

    out.push({ id: p.id, kind: "move", from: p.scheduled_for, to, platform: p.platform });
  }

  return out;
}

/** Does this patch change WHEN the schedule fires? */
export function touchesTheClock(patch: Record<string, unknown>): boolean {
  /**
   * 🔑 FOUR FIELDS, and missing one is the whole bug returning. `days` and
   * `timezone` move a post as surely as `post_at` does, and `platform_times`
   * moves one channel's.
   */
  return (
    "post_at" in patch || "days" in patch || "timezone" in patch || "platform_times" in patch
  );
}
