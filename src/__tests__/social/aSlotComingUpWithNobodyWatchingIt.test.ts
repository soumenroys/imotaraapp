/**
 * ⛔ THE QUEUE READ FORWARDS — the half `missedSlots` cannot do.
 *
 * 🔴 WHY THIS EXISTS. `missedSlots` is a post-mortem by construction: its own
 * guard is `if (at > cutoff) continue`, so it speaks only once the hour is
 * gone. Riding the 03:30Z cron that means the mail describes a slot already
 * lost. The day is gone, then announced.
 *
 * 🔑 MEASURED, NOT IMAGINED. On 20 Oct 2026 the queue held three posts for
 * 30 Oct and one for 31 Oct in `needs_review`, with `auto_publish` false on
 * all three schedules and every channel healthy. Nothing in the system would
 * have said a word until 03:30 on the 31st — about the 30th.
 *
 * ⚠️ AND THE GATE IS NOT THE BUG. "This schedule does not publish without
 * being read" is deliberate, and reading is what caught the card that drew
 * অভিমান as অভমিান and the storyboard whose first frame was blank — both of
 * which passed every test in this repo. ⇒ keep the gate, end the silence.
 */

import { describe, it, expect } from "vitest";
import {
  missedSlots,
  unapprovedSoon,
  unapprovedSoonSummary,
  GRACE_MINUTES,
  LOOKAHEAD_HOURS,
  type QueueRow,
} from "@/lib/social/queueHealth";

const NOW = new Date("2026-10-20T03:30:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const mins = (m: number) => at(m * 60_000);
const hrs = (h: number) => at(h * 3_600_000);

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "p1",
  platform: "facebook",
  subject: "What it is for",
  status: "needs_review",
  scheduled_for: hrs(9),
  attempts: 0,
  last_error: null,
  ...over,
});

describe("a slot coming up with nobody watching it", () => {
  it("🔴 reports tonight's unapproved post, with how long there is", () => {
    const [s] = unapprovedSoon([row()], NOW);
    expect(s.platform).toBe("facebook");
    expect(s.minutesAway).toBe(9 * 60);
    expect(s.why).toMatch(/within a minute of being approved/i);
  });

  it("⛔ says nothing about an APPROVED post — it is not waiting for anybody", () => {
    /**
     * 🔑 THE HALF THAT KEEPS THE MAIL WORTH READING. Including `approved`
     * would mail every morning about the posts that are working, and a daily
     * mail is a filtered mail ⇒ the false QR warning that cried wolf on
     * every post and taught the reader to scroll past.
     */
    expect(unapprovedSoon([row({ status: "approved" })], NOW)).toEqual([]);
  });

  it("⛔ and nothing about a status that is already finished or abandoned", () => {
    for (const status of ["published", "skipped", "failed", "draft"]) {
      expect(unapprovedSoon([row({ status })], NOW), `${status} was reported`).toEqual([]);
    }
  });

  it("⛔ a post beyond the horizon is not today's problem", () => {
    expect(unapprovedSoon([row({ scheduled_for: hrs(LOOKAHEAD_HOURS + 1) })], NOW)).toEqual([]);
    expect(unapprovedSoon([row({ scheduled_for: hrs(LOOKAHEAD_HOURS - 1) })], NOW)).toHaveLength(1);
  });

  it("⚠️ a post with no hour is not coming up — null means 'as soon as approved'", () => {
    // ⛔ Treating null as 0 would report every open draft, every morning.
    expect(unapprovedSoon([row({ scheduled_for: null })], NOW)).toEqual([]);
  });

  it("⚠️ an unparseable date is a different bug and must not be buried here", () => {
    expect(unapprovedSoon([row({ scheduled_for: "not a date" })], NOW)).toEqual([]);
  });

  it("🔑 soonest first — the opposite order to missedSlots, on purpose", () => {
    const got = unapprovedSoon(
      [
        row({ id: "late", scheduled_for: hrs(20) }),
        row({ id: "next", scheduled_for: hrs(2) }),
        row({ id: "mid", scheduled_for: hrs(9) }),
      ],
      NOW,
    );
    expect(got.map((g) => g.id)).toEqual(["next", "mid", "late"]);
  });

  it("⚠️ a post inside the grace window is 'due now', not lost", () => {
    const [s] = unapprovedSoon([row({ scheduled_for: mins(-(GRACE_MINUTES - 1)) })], NOW);
    expect(s, "a post minutes past its slot vanished from both checks").toBeTruthy();
    expect(s.minutesAway).toBeLessThan(0);
  });

  /**
   * 🔴 THE STRONGEST TEST IN THIS FILE, and the reason the two checks share a
   * grace constant rather than each picking one.
   *
   * ⛔ A row in BOTH lists mails the owner twice about one post. A row in
   * NEITHER is precisely the silence this whole mechanism exists to end — and
   * it is the failure that would never be noticed, because its symptom is
   * nothing happening.
   */
  it("⛔ every row with an hour lands in EXACTLY ONE of the two checks", () => {
    const offsets = [-72, -24, -6, -2, -1, -0.5, -0.26, -0.24, -0.1, 0, 0.1, 1, 9, 23, 23.9];
    for (const h of offsets) {
      const r = row({ scheduled_for: hrs(h) });
      const inMissed = missedSlots([r], NOW).length;
      const inSoon = unapprovedSoon([r], NOW).length;
      expect(
        inMissed + inSoon,
        `a slot ${h}h from now is in missed=${inMissed} and soon=${inSoon} — must be exactly one`,
      ).toBe(1);
    }
  });

  it("⛔ …and that stays true for an approved row: exactly one, or deliberately none", () => {
    /**
     * ⚠️ `approved` is asymmetric ON PURPOSE. Backwards it is OURS (the
     * publisher failed); forwards it needs nobody. So a future approved row
     * is in neither list, and that is correct rather than a hole.
     */
    const future = row({ status: "approved", scheduled_for: hrs(9) });
    expect(missedSlots([future], NOW)).toEqual([]);
    expect(unapprovedSoon([future], NOW)).toEqual([]);

    const past = row({ status: "approved", scheduled_for: hrs(-9) });
    expect(missedSlots([past], NOW)).toHaveLength(1);
    expect(unapprovedSoon([past], NOW)).toEqual([]);
  });

  it("⛔ pure: it takes `now` and never reads the clock", () => {
    // 🔑 Same reason as missedSlots. A check that reads the clock itself can
    // only be tested at the moment it happens to be right.
    const r = row({ scheduled_for: "2029-12-31T00:00:00.000Z" });
    expect(unapprovedSoon([r], new Date("2029-12-30T06:00:00.000Z"))).toHaveLength(1);
    expect(unapprovedSoon([r], new Date("2029-01-01T00:00:00.000Z"))).toEqual([]);
  });
});

describe("the one line that says how long there is", () => {
  it("🔑 names the hour, because that is the difference from a backlog", () => {
    const one = unapprovedSoonSummary(unapprovedSoon([row({ scheduled_for: hrs(9) })], NOW));
    expect(one).toMatch(/waiting for your approval/i);
    expect(one).toMatch(/\b9 hours\b/);
  });

  it("counts them and still names the nearest hour", () => {
    const many = unapprovedSoonSummary(
      unapprovedSoon([row({ id: "a", scheduled_for: hrs(9) }), row({ id: "b", scheduled_for: hrs(2) })], NOW),
    );
    expect(many).toMatch(/^3 posts|^2 posts/);
    expect(many).toMatch(/\b2 hours\b/);
  });

  it("⚠️ minutes when it is minutes — 'in 0 hours' would read as broken", () => {
    expect(unapprovedSoonSummary(unapprovedSoon([row({ scheduled_for: mins(40) })], NOW))).toMatch(/\b40 minutes\b/);
  });

  it("⛔ and nothing at all when there is nothing to say", () => {
    expect(unapprovedSoonSummary([])).toBe("");
  });
});
