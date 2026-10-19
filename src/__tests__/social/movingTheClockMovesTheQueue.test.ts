/**
 * ⛔ CHANGING A SCHEDULE'S TIME MUST MOVE THE POSTS ALREADY WRITTEN FOR IT.
 *
 * 🔴 THE DEFECT, PROVED BY TRIPPING OVER IT ON 19 Oct rather than by reading.
 * The owner asked to move Facebook to 19:30 and Instagram to 19:00. Doing it
 * exposed that `slotKey` is `scheduleId|platform|EXACT TIMESTAMP`
 * ⇒ horizon.ts — so the instant the time changes, every already-queued day
 * looks MISSING at the new hour and the horizon writes a second post for it.
 *
 * ⛔ 10-day horizon × 2 channels = up to TWENTY duplicates, each a model call,
 * each one that would really publish: two posts a day, at two different hours,
 * on a feed meant to post once.
 *
 * ⚠️ AND THE ADMIN'S "Change the time" BUTTON DID EXACTLY THIS — the route
 * updated the row and touched no post
 * ⇒ trap_a_frozen_decision_outlives_its_rule, shipped inside a feature.
 */

import { describe, it, expect } from "vitest";
import { retimeFor, touchesTheClock, type QueuedPost } from "@/lib/social/retimeQueue";

const KOLKATA = "Asia/Kolkata";

const sched = (over: Record<string, unknown> = {}) =>
  ({
    id: "s1",
    post_at: "19:30",
    days: [0, 1, 2, 3, 4, 5, 6],
    timezone: KOLKATA,
    platforms: ["facebook"],
    platform_times: null,
    ...over,
  }) as never;

const post = (over: Partial<QueuedPost> = {}): QueuedPost => ({
  id: "p1",
  platform: "facebook",
  status: "approved",
  // 2026-10-20 17:30 IST — the OLD slot, as 12:00Z.
  scheduled_for: "2026-10-20T12:00:00.000Z",
  ...over,
});

describe("a post moves with its schedule", () => {
  it("🔴 17:30 IST becomes 19:30 IST, which is the whole bug", () => {
    const [r] = retimeFor(sched(), [post()]);
    expect(r.kind).toBe("move");
    if (r.kind !== "move") return;
    // 19:30 IST = 14:00Z
    expect(r.to).toBe("2026-10-20T14:00:00.000Z");
  });

  it("⛔ RECOMPUTES rather than shifting by a difference", () => {
    /**
     * 🔑 A schedule can change its TIMEZONE, and an offset cannot express
     * that. The same wall-clock hour in a different zone is a different
     * instant, and "+2h" would be wrong by the zone difference.
     */
    const [r] = retimeFor(sched({ timezone: "Europe/London", post_at: "19:30" }), [post()]);
    expect(r.kind).toBe("move");
    if (r.kind !== "move") return;
    // 19:30 London on 20 Oct is BST (UTC+1) ⇒ 18:30Z, not 14:00Z.
    expect(r.to).toBe("2026-10-20T18:30:00.000Z");
  });

  it("⚠️ takes the DAY from the post's own zone, not from UTC", () => {
    /**
     * 🔴 A post at 23:00 IST is 17:30Z the same day, but one at 00:30 IST is
     * 19:00Z the PREVIOUS day. Reading the UTC date would move it to the
     * wrong day entirely.
     */
    const lateNight = post({ scheduled_for: "2026-10-20T18:45:00.000Z" }); // 21 Oct 00:15 IST
    const [r] = retimeFor(sched({ post_at: "00:30" }), [lateNight]);
    expect(r.kind).toBe("move");
    if (r.kind !== "move") return;
    // Must land on 21 Oct 00:30 IST = 20 Oct 19:00Z — the same IST day it was on.
    expect(r.to).toBe("2026-10-20T19:00:00.000Z");
  });

  it("follows a per-channel override rather than the schedule's own time", () => {
    // 🔑 `platform_times` moves ONE channel ⇒ timesFor.
    const s = sched({ platform_times: { facebook: { post_at: "08:00" } } });
    const [r] = retimeFor(s, [post()]);
    expect(r.kind).toBe("move");
    if (r.kind !== "move") return;
    expect(r.to).toBe("2026-10-20T02:30:00.000Z"); // 08:00 IST
  });

  it("⛔ says nothing about a post that is already right", () => {
    // ⚠️ A change log full of no-ops is a change log nobody reads.
    expect(retimeFor(sched(), [post({ scheduled_for: "2026-10-20T14:00:00.000Z" })])).toEqual([]);
  });
});

describe("what is NOT moved", () => {
  it("⛔ a published post is a record of what happened", () => {
    for (const status of ["published", "skipped", "failed"]) {
      expect(retimeFor(sched(), [post({ status })]), status).toEqual([]);
    }
  });

  it("a post with no slot has no hour to move", () => {
    expect(retimeFor(sched(), [post({ scheduled_for: null })])).toEqual([]);
  });

  it("an unparseable date is a different bug and is left alone", () => {
    expect(retimeFor(sched(), [post({ scheduled_for: "whenever" })])).toEqual([]);
  });
});

describe("a post whose day no longer runs", () => {
  it("🔑 is REPORTED, never silently deleted or left at the old hour", () => {
    /**
     * ⛔ These are written, gate-checked words, and some have been approved.
     * Throwing them away because a weekday was unticked is a person's
     * decision — this names them and stops there.
     */
    // 20 Oct 2026 is a Tuesday (weekday 2). Run only on Sundays.
    const [r] = retimeFor(sched({ days: [0] }), [post()]);
    expect(r.kind).toBe("orphan");
    if (r.kind !== "orphan") return;
    expect(r.from).toBe("2026-10-20T12:00:00.000Z");
    expect(r.platform).toBe("facebook");
  });
});

describe("⛔ which edits count as moving the clock", () => {
  it("🔑 all FOUR, and missing one is the whole bug returning", () => {
    /**
     * ⚠️ `days` and `timezone` move a post as surely as `post_at` does, and
     * `platform_times` moves one channel's. A check that only looked at
     * post_at would leave three doors open.
     */
    expect(touchesTheClock({ post_at: "19:30" })).toBe(true);
    expect(touchesTheClock({ days: [1, 2] })).toBe(true);
    expect(touchesTheClock({ timezone: "UTC" })).toBe(true);
    expect(touchesTheClock({ platform_times: {} })).toBe(true);
  });

  it("and an edit that does not touch the clock does not disturb the queue", () => {
    expect(touchesTheClock({ tone: "gentle_plain" })).toBe(false);
    expect(touchesTheClock({ topic_pool: ["privacy"] })).toBe(false);
    expect(touchesTheClock({ content_mix: ["text_graphic"] })).toBe(false);
    expect(touchesTheClock({})).toBe(false);
  });
});
