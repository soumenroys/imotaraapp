/**
 * 🔴 WHY A HORIZON AND NOT A LEAD TIME.
 *
 * The old queue asked "is a schedule due THIS MINUTE?" and wrote one post for
 * a slot two hours out. Three failures follow from that shape, and this file
 * pins the fix for each:
 *
 *   · a reviewer had two hours — the owner asked for ten days;
 *   · a missed minute was a missed day FOREVER, with no record that anything
 *     was meant to happen;
 *   · it could not fill a gap it did not cause. The Instagram time was saved
 *     at 20:45 on 18 Oct, after that day's 15:00 trigger. Nothing was broken
 *     and Instagram still had no queued post, because the only minute that
 *     could have made one had passed.
 *
 * ⚠️ Fixed instants throughout. "Due at 17:00 Asia/Kolkata" read off a UTC
 * clock is exactly the thing that works for eleven months.
 */

import { describe, it, expect } from "vitest";
import {
  slotsInHorizon,
  missingSlots,
  slotKey,
  instantOf,
  timesFor,
  backoffMinutes,
  inBackoff,
  HORIZON_DAYS,
  BACKOFF_MINUTES,
} from "@/lib/social/horizon";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const schedule = (over: Partial<Parameters<typeof slotsInHorizon>[0]> = {}) => ({
  id: "sched-1",
  post_at: "17:30:00",
  timezone: "Asia/Kolkata",
  days: EVERY_DAY,
  active: true,
  platforms: ["facebook", "instagram"],
  platform_times: { instagram: { post_at: "17:00" } },
  ...over,
});

/** 19 Oct 2026, 10:38 IST — the moment the owner asked. */
const NOW = new Date("2026-10-19T05:08:00Z");
const ist = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });

describe("a wall clock in a zone, as an instant", () => {
  it("17:00 in Kolkata is 11:30 UTC", () => {
    expect(instantOf(2026, 10, 19, 17, 0, "Asia/Kolkata").toISOString()).toBe("2026-10-19T11:30:00.000Z");
  });

  it("⛔ survives a DST boundary, where one correction lands on the wrong side", () => {
    /**
     * 🔴 THE SECOND PASS IS NOT BELT AND BRACES — MEASURED.
     *
     * My first version of this test used 24 and 26 October, either side of
     * London's change. Both are far enough from the transition that ONE
     * correction is already right, so a mutation cutting the second pass
     * survived. ⇒ I searched 8 zones × 366 days × 7 hours for instants where
     * one pass and two disagree, and there are many. These are real ones.
     *
     *   · London 29 Mar 01:00 — BST begins at 01:00 GMT, so 01:00 local is
     *     still GMT and is 01:00Z. One pass answers 00:00Z.
     *   · Santiago 6 Sep 01:00 — Chile springs to UTC−3, so it is 04:00Z.
     *     One pass answers 05:00Z.
     *
     * ⚠️ A once-a-year wrong hour is exactly the bug nobody connects to this
     * code, because it is right for the other 364 days.
     */
    expect(instantOf(2026, 3, 29, 1, 0, "Europe/London").toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(instantOf(2026, 9, 6, 1, 0, "America/Santiago").toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(instantOf(2026, 4, 5, 1, 0, "America/Santiago").toISOString()).toBe("2026-04-05T05:00:00.000Z");

    // And the easy cases either side of a change still hold.
    expect(instantOf(2026, 10, 24, 12, 0, "Europe/London").toISOString()).toBe("2026-10-24T11:00:00.000Z");
    expect(instantOf(2026, 10, 26, 12, 0, "Europe/London").toISOString()).toBe("2026-10-26T12:00:00.000Z");
  });

  it("handles a zone on a half-hour and one west of UTC", () => {
    expect(instantOf(2026, 10, 19, 9, 0, "Asia/Kathmandu").toISOString()).toBe("2026-10-19T03:15:00.000Z");
    expect(instantOf(2026, 10, 19, 9, 0, "America/New_York").toISOString()).toBe("2026-10-19T13:00:00.000Z");
  });
});

describe("ten days of slots, not two hours", () => {
  it("covers both channels, at their own times, for the whole horizon", () => {
    const slots = slotsInHorizon(schedule(), NOW);
    // Today's 17:00 and 17:30 are both still ahead at 10:38, so both appear.
    expect(slots.filter((s) => s.platform === "instagram")).toHaveLength(HORIZON_DAYS + 1);
    expect(slots.filter((s) => s.platform === "facebook")).toHaveLength(HORIZON_DAYS + 1);
  });

  it("⛔ gives the reviewer ten days, which is the whole point", () => {
    const slots = slotsInHorizon(schedule(), NOW);
    const furthest = new Date(slots[slots.length - 1].scheduledFor).getTime();
    const days = (furthest - NOW.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(9.5);
  });

  it("each channel keeps its own hour", () => {
    const slots = slotsInHorizon(schedule(), NOW);
    expect(ist(slots.find((s) => s.platform === "instagram")!.scheduledFor)).toContain("17:00");
    expect(ist(slots.find((s) => s.platform === "facebook")!.scheduledFor)).toContain("17:30");
  });

  it("earliest first, so the slot with least review time left is filled first", () => {
    const slots = slotsInHorizon(schedule(), NOW);
    const sorted = [...slots].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    expect(slots).toEqual(sorted);
    // ⚠️ Instagram's 17:00 comes before Facebook's 17:30 on the same day.
    expect(slots[0].platform).toBe("instagram");
  });

  it("⛔ never returns a slot that has already passed", () => {
    // 19 Oct 18:00 IST — both of today's times are behind us.
    const evening = new Date("2026-10-19T12:30:00Z");
    const slots = slotsInHorizon(schedule(), evening);
    expect(slots.every((s) => new Date(s.scheduledFor) > evening)).toBe(true);
    for (const s of slots) expect(ist(s.scheduledFor)).not.toContain("19/10/2026");
  });

  it("⛔ counts days in the SCHEDULE'S zone, across a DST change", () => {
    /**
     * 🔴 THE MUTATION THAT SURVIVED MY FIRST VERSION. Walking the horizon by
     * adding 86,400,000 ms is indistinguishable from walking calendar days —
     * in a zone with no DST. Our schedule is Asia/Kolkata, so the test proved
     * nothing and a mutation stepping by fixed milliseconds passed.
     *
     * ⚠️ In a zone that changes, a fixed-millisecond step drifts an hour and
     * near midnight lands back on the PREVIOUS DAY — one date written twice,
     * the next skipped entirely, once a year.
     */
    const london = schedule({
      timezone: "Europe/London",
      post_at: "00:30:00",
      platforms: ["facebook"],
      platform_times: null,
    });
    /**
     * ⚠️ 25 OCT 00:00 LONDON, the night the clocks go back — and the hour
     * matters as much as the date. My first attempt used 10:00, where an
     * hour of drift cannot change the calendar day, and the mutation
     * survived. Near midnight it lands on the PREVIOUS day: one date written
     * twice, the next skipped.
     */
    const slots = slotsInHorizon(london, new Date("2026-10-24T23:00:00Z"));
    const dates = slots.map((x) =>
      new Date(x.scheduledFor).toLocaleDateString("en-CA", { timeZone: "Europe/London" }),
    );
    // Every date distinct — nothing written twice.
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.length).toBeGreaterThanOrEqual(HORIZON_DAYS);
    // And CONSECUTIVE — nothing skipped. ⛔ Compared as calendar days, since
    // one of these "days" is 25 hours long.
    for (let i = 1; i < dates.length; i += 1) {
      const a = new Date(`${dates[i - 1]}T12:00:00Z`).getTime();
      const b = new Date(`${dates[i]}T12:00:00Z`).getTime();
      expect(b - a, `${dates[i - 1]} → ${dates[i]}`).toBe(86_400_000);
    }
    // And every one is really half past midnight, before AND after the change.
    for (const x of slots) {
      const hhmm = new Date(x.scheduledFor).toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      expect(hhmm).toBe("00:30");
    }
  });

  it("an inactive schedule has no slots at all", () => {
    expect(slotsInHorizon(schedule({ active: false }), NOW)).toEqual([]);
  });

  it("honours a per-channel day list", () => {
    // Instagram only on Mondays; Facebook every day.
    const s = schedule({ platform_times: { instagram: { post_at: "17:00", days: [1] } } });
    const slots = slotsInHorizon(s, NOW);
    const igDays = slots
      .filter((x) => x.platform === "instagram")
      .map((x) => new Date(x.scheduledFor).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", weekday: "short" }));
    expect(new Set(igDays)).toEqual(new Set(["Mon"]));
    expect(slots.filter((x) => x.platform === "facebook").length).toBeGreaterThan(igDays.length);
  });

  it("⛔ a malformed override falls back rather than stopping the channel", () => {
    // 🔴 The cost of a bad json value must be "posts at the normal time",
    // never the silence nobody notices.
    for (const bad of [{ post_at: "nonsense" }, { post_at: "25:99" }, { days: [9, 9] }, {}]) {
      const t = timesFor({ post_at: "17:30:00", days: EVERY_DAY, platform_times: { instagram: bad } }, "instagram");
      expect(t.post_at).toBe("17:30:00");
      expect(t.days).toEqual(EVERY_DAY);
    }
  });
});

describe("filling only what is missing", () => {
  const all = slotsInHorizon(schedule(), NOW);

  it("writes nothing when the horizon is already full", () => {
    expect(missingSlots([schedule()], all.map(slotKey), NOW)).toEqual([]);
  });

  it("fills a HOLE IN THE MIDDLE, which a lead time could never do", () => {
    /**
     * 🔴 THE INSTAGRAM CASE, GENERALISED. A slot whose moment has passed was
     * unreachable forever under the old model. Here it is simply missing.
     */
    const hole = all[4];
    const have = all.filter((s) => slotKey(s) !== slotKey(hole)).map(slotKey);
    expect(missingSlots([schedule()], have, NOW).map(slotKey)).toEqual([slotKey(hole)]);
  });

  it("⛔ is bounded, so one run cannot spend twenty generations", () => {
    const out = missingSlots([schedule()], [], NOW);
    expect(out).toHaveLength(2);
    // ⚠️ And they are the two nearest, not two at random.
    expect(out.map(slotKey)).toEqual([slotKey(all[0]), slotKey(all[1])]);
  });

  it("⛔ does not rewrite a slot whose post a human rejected", () => {
    /**
     * 🔴 A REJECTED POST IS A DECISION. Treating its slot as empty would hand
     * the reviewer the same rejected post again tomorrow, and the day after —
     * which is how a review queue becomes something people stop opening.
     */
    const have = all.map(slotKey);
    expect(missingSlots([schedule()], have, NOW)).toEqual([]);
  });

  it("a key means the same thing on both sides of the comparison", () => {
    // ⛔ If the stored row's key is spelled differently from the wanted slot's,
    // every slot looks missing and the whole horizon is rewritten every minute.
    expect(slotKey({ scheduleId: "s", platform: "facebook", scheduledFor: "2026-10-19T12:00:00+00:00" })).toBe(
      slotKey({ scheduleId: "s", platform: "facebook", scheduledFor: "2026-10-19T12:00:00.000Z" }),
    );
  });
});

/**
 * 🔴 THE FAILURE MODE I FOUND BEFORE DEPLOYING, NOT AFTER.
 *
 * Earliest-first + a bounded number per run + a slot that cannot be written
 * = head-of-line blocking. The bad slot is retried every minute forever —
 * about 2,880 model calls a day for a post nobody ever sees — and every slot
 * behind it stays empty. Ten days of queue blocked by one bad day, with an
 * empty review screen as the only symptom.
 */
describe("a slot that cannot be written does not block the ten days behind it", () => {
  const NOW_B = new Date("2026-10-19T05:08:00Z");
  const all = slotsInHorizon(schedule(), NOW_B);
  const attempt = (n: number, minutesAgo: number) => ({
    attempts: n,
    last_attempt_at: new Date(NOW_B.getTime() - minutesAgo * 60_000).toISOString(),
  });

  it("⛔ skips the stuck slot and fills the NEXT ones", () => {
    // The earliest slot failed a minute ago; the run must not simply stop.
    const out = missingSlots([schedule()], [], NOW_B, {
      attempts: new Map([[slotKey(all[0]), attempt(1, 1)]]),
    });
    expect(out.map(slotKey)).toEqual([slotKey(all[1]), slotKey(all[2])]);
  });

  it("tries it again once the wait is over", () => {
    const out = missingSlots([schedule()], [], NOW_B, {
      attempts: new Map([[slotKey(all[0]), attempt(1, 10)]]),
    });
    expect(out.map(slotKey)[0]).toBe(slotKey(all[0]));
  });

  it("the wait RISES, because a fifth failure is not a hiccup", () => {
    expect(backoffMinutes(1)).toBe(5);
    expect(backoffMinutes(2)).toBeGreaterThan(backoffMinutes(1));
    expect(backoffMinutes(5)).toBeGreaterThan(backoffMinutes(4));
    for (let n = 2; n <= 5; n += 1) expect(backoffMinutes(n)).toBeGreaterThan(backoffMinutes(n - 1));
  });

  it("⛔ and is CAPPED, so an outage that ends does not mean a day that never posts", () => {
    /**
     * 🔴 Abandoning a slot permanently is the silent failure this whole
     * feature keeps producing ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
     * ⚠️ Pinned as a real ceiling in hours, not as `BACKOFF_MINUTES.length`,
     * which would move with the array and prove nothing.
     */
    expect(backoffMinutes(99)).toBe(BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1]);
    expect(backoffMinutes(99)).toBeLessThanOrEqual(360);
    expect(inBackoff(attempt(99, 361), NOW_B)).toBe(false);
  });

  it("a slot never tried is not in back-off", () => {
    expect(inBackoff(undefined, NOW_B)).toBe(false);
    expect(backoffMinutes(0)).toBe(0);
  });
});
