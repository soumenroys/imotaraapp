/**
 * ⛔ A HEALTHY CHANNEL AND A FULL QUEUE CAN STILL POST NOTHING.
 *
 * 🔴 THE GAP, found 19 Oct by reading the queue rather than the code.
 * `social-health` states its own purpose in its header: the failure it exists
 * to prevent is "the queue fills, every screen looks healthy, and the first
 * symptom is somebody asking why nothing has been posted for three weeks".
 *
 * ⛔ And it read `social_accounts` only. It could see a broken token; it could
 * not see a perfectly good channel with a finished post nobody approved —
 * which produces the IDENTICAL symptom.
 *
 * ⚠️ Three roads to that silence, and only two were watched:
 *
 *   the channel broke       → social-health saw it
 *   the writing failed      → sendQueueAlert. Its words are "there is no post
 *                             waiting for that slot" — the OPPOSITE case
 *   nobody pressed approve  → nothing at all
 *
 * 🔑 It was happening while this was written: Instagram's 11:30Z slot passed
 * with a finished post in `needs_review`, half an hour late, silently.
 */

import { describe, it, expect } from "vitest";
import { missedSlots, missedSummary, GRACE_MINUTES, type QueueRow } from "@/lib/social/queueHealth";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "p1",
  platform: "instagram",
  subject: "Someone to talk to at 3:17 am",
  status: "needs_review",
  scheduled_for: minsAgo(60),
  attempts: 0,
  ...over,
});

describe("a slot that went by", () => {
  it("🔴 reports the finished post nobody approved — the real case", () => {
    const [m] = missedSlots([row()], NOW);
    expect(m.kind).toBe("unreviewed");
    expect(m.lateMinutes).toBe(60);
    expect(m.platform).toBe("instagram");
    // ⚠️ The reassurance belongs in the alert: the natural fear on reading
    // this is worse than the truth.
    expect(m.why).toMatch(/waiting for you/i);
    expect(m.why).toMatch(/nothing is broken/i);
  });

  it("⛔ tells an APPROVED post that never went out apart from an unreviewed one", () => {
    /**
     * 🔑 THEY NEED DIFFERENT PEOPLE. "Waiting for approval" is the owner's, in
     * one click. "Approved and still not sent" is OURS — and reporting both
     * as one number would send them to the wrong place.
     */
    const [m] = missedSlots([row({ status: "approved", attempts: 0 })], NOW);
    expect(m.kind).toBe("stuck");
    expect(m.why).toMatch(/not attempted it even once/i);
    expect(m.why, "points at the cron, which is where that symptom lives").toMatch(/cron/i);
  });

  it("⚠️ an approved post that keeps failing says so, with the error", () => {
    const [m] = missedSlots(
      [row({ status: "approved", attempts: 3, last_error: "Instagram rejected the image" })],
      NOW,
    );
    expect(m.kind).toBe("stuck");
    expect(m.why).toMatch(/attempted 3 times/);
    expect(m.why).toContain("Instagram rejected the image");
  });
});

describe("what is NOT late", () => {
  it("⛔ a post inside the grace window is in flight, not missed", () => {
    /**
     * 🔴 THE FALSE ALARM THIS PREVENTS. The publisher runs every minute, so a
     * post a few minutes past its hour is being sent right now. An alert that
     * fires on that would cry wolf once or twice a day forever, and then the
     * real one is not read either.
     */
    expect(missedSlots([row({ scheduled_for: minsAgo(GRACE_MINUTES - 1) })], NOW)).toEqual([]);
    expect(missedSlots([row({ scheduled_for: minsAgo(GRACE_MINUTES + 1) })], NOW)).toHaveLength(1);
  });

  it("⛔ a post with NO scheduled_for is not overdue since 1970", () => {
    /**
     * 🔴 Null means "as soon as it is approved" ⇒ the publisher's own query.
     * It has no hour, so it cannot miss one. Treating null as a date would
     * report every draft ever written, on the first run.
     */
    expect(missedSlots([row({ scheduled_for: null })], NOW)).toEqual([]);
  });

  it("⛔ an unparseable date is a different bug and is not reported here", () => {
    // ⚠️ Reporting it would bury the case this exists for under noise.
    expect(missedSlots([row({ scheduled_for: "not a date" })], NOW)).toEqual([]);
  });

  it("a post already published or skipped is not waiting for anything", () => {
    for (const status of ["published", "skipped", "failed", "draft"]) {
      expect(missedSlots([row({ status })], NOW), `${status} was reported`).toEqual([]);
    }
  });

  it("a slot still in the future is not late", () => {
    expect(missedSlots([row({ scheduled_for: new Date(NOW.getTime() + 3_600_000).toISOString() })], NOW)).toEqual([]);
  });

  it("⛔ reads the clock it is GIVEN, never the real one", () => {
    // 🔑 A lateness check that calls Date.now() itself can only be tested at
    // the moment it happens to be right.
    const future = new Date("2030-01-01T00:00:00.000Z");
    expect(missedSlots([row({ scheduled_for: "2029-12-31T00:00:00.000Z" })], future)).toHaveLength(1);
    expect(missedSlots([row({ scheduled_for: "2029-12-31T00:00:00.000Z" })], new Date("2029-01-01T00:00:00.000Z"))).toEqual([]);
  });
});

describe("the order and the summary", () => {
  it("puts the longest-waiting first, because it is the most forgotten", () => {
    const got = missedSlots(
      [
        row({ id: "a", scheduled_for: minsAgo(30) }),
        row({ id: "b", scheduled_for: minsAgo(3_000) }),
        row({ id: "c", scheduled_for: minsAgo(300) }),
      ],
      NOW,
    );
    expect(got.map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("⛔ the summary says WHOSE problem it is, not how many", () => {
    /**
     * 🔑 "2 posts missed their slot" does not tell somebody whether to open it
     * now or after lunch. "waiting for your approval" and "not going out" do.
     */
    expect(missedSummary(missedSlots([row()], NOW))).toMatch(/waiting for your approval/i);
    expect(missedSummary(missedSlots([row({ status: "approved" })], NOW))).toMatch(/not going out/i);
    const both = missedSummary(missedSlots([row({ id: "a" }), row({ id: "b", status: "approved" })], NOW));
    expect(both).toMatch(/awaiting approval/i);
    expect(both).toMatch(/stuck/i);
  });

  it("says nothing at all when nothing is late", () => {
    expect(missedSummary([])).toBe("");
    expect(missedSlots([], NOW)).toEqual([]);
  });
});
