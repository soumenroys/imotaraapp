/**
 * 🔑 THE OWNER, 18 Oct: "I want every social media schedule can be customized
 * in different date and time. Create that and set the schedule 30 minutes
 * earlier than Facebook everyday."
 *
 * 🔴 A schedule carried a list of platforms and ONE `post_at`, so every
 * channel on it fired at the same minute. That is the scheduling half of the
 * mistake the content rules already forbid — one post pushed to five channels
 * — and channels differ in when their readers are there as much as in how
 * they read.
 *
 * ⛔ THIS FILE WAS KEEPING DEAD CODE ALIVE, which is why it has been rewritten
 * rather than deleted. On 19 Oct the lead-time model was replaced by a ten-day
 * horizon ⇒ src/lib/social/horizon.ts, and `isDue`, `isDueForPlatform`,
 * `timeForPlatform` and `LEAD_MINUTES` stopped being called by anything in
 * production. The tests still passed — so the suite looked healthy while
 * proving things about code no longer reachable from the running system, and
 * the RULE it was guarding was quietly unguarded.
 *
 * ⚠️ The rule did not change, so the test should not be deleted; only its
 * subject should move to whatever implements the rule today.
 */

import { describe, it, expect } from "vitest";
import { timesFor, slotsInHorizon } from "@/lib/social/horizon";

const base = {
  id: "s1",
  post_at: "17:30:00",
  timezone: "Asia/Kolkata",
  days: [0, 1, 2, 3, 4, 5, 6],
  active: true,
  platforms: ["facebook", "instagram"],
  platform_times: { instagram: { post_at: "17:00:00" } },
};

/** 19 Oct 2026, 10:38 IST — well before either channel's hour. */
const NOW = new Date("2026-10-19T05:08:00Z");

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const firstFor = (platform: string, schedule = base) =>
  slotsInHorizon(schedule, NOW).find((s) => s.platform === platform)!;

describe("two channels, two hours", () => {
  it("Instagram posts at its own time and Facebook at the schedule's", () => {
    expect(hhmm(firstFor("instagram").scheduledFor)).toBe("17:00");
    expect(hhmm(firstFor("facebook").scheduledFor)).toBe("17:30");
  });

  it("is exactly thirty minutes earlier, which is what was asked for", () => {
    const ig = new Date(firstFor("instagram").scheduledFor).getTime();
    const fb = new Date(firstFor("facebook").scheduledFor).getTime();
    expect(fb - ig).toBe(30 * 60_000);
  });

  it("⛔ and every day of the horizon keeps that gap, not just the first", () => {
    // 🔴 The original bug was one `post_at` for every channel. A fix that
    // only separated TODAY would look right in any single-day test.
    const slots = slotsInHorizon(base, NOW);
    const ig = slots.filter((s) => s.platform === "instagram").map((s) => hhmm(s.scheduledFor));
    const fb = slots.filter((s) => s.platform === "facebook").map((s) => hhmm(s.scheduledFor));
    expect(new Set(ig)).toEqual(new Set(["17:00"]));
    expect(new Set(fb)).toEqual(new Set(["17:30"]));
    expect(ig.length).toBe(fb.length);
  });
});

describe("an override is an override, not a replacement", () => {
  it("a platform with no entry keeps the schedule's own time and days", () => {
    const t = timesFor(base, "facebook");
    expect(t.post_at).toBe("17:30:00");
    expect(t.days).toEqual(base.days);
  });

  it("an entry with only a time keeps the schedule's days", () => {
    const t = timesFor(base, "instagram");
    expect(t.post_at).toBe("17:00:00");
    expect(t.days).toEqual(base.days);
  });

  it("an entry may narrow the days as well", () => {
    const t = timesFor(
      { ...base, platform_times: { instagram: { post_at: "17:00", days: [1, 3] } } },
      "instagram",
    );
    expect(t.post_at).toBe("17:00");
    expect(t.days).toEqual([1, 3]);
  });

  it("accepts HH:MM as well as HH:MM:SS, because a person types the short one", () => {
    expect(timesFor({ ...base, platform_times: { instagram: { post_at: "08:05" } } }, "instagram").post_at).toBe(
      "08:05",
    );
  });

  it("a null column behaves as no overrides at all", () => {
    const t = timesFor({ ...base, platform_times: null }, "instagram");
    expect(t.post_at).toBe("17:30:00");
    expect(t.days).toEqual(base.days);
  });
});

describe("a bad value falls back rather than silencing a channel", () => {
  /**
   * 🔴 The cost of a bad json value must be "this channel posts at the
   * schedule's normal time", NEVER "this channel silently stops" — the
   * failure nobody sees ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
   *
   * ⚠️ "25:99" is in this list because it is not merely malformed, it is
   * PLAUSIBLE: it satisfies /^\d{2}:\d{2}$/, and Date.UTC does not throw on
   * it — it rolls silently into the next day at 02:39.
   */
  const cases: [string, { post_at?: string; days?: number[] }][] = [
    ["a malformed time", { post_at: "nonsense" }],
    ["an out-of-range time", { post_at: "25:99" }],
    ["malformed days", { days: [9, 9] }],
    ["an empty entry", {}],
  ];
  for (const [what, bad] of cases) {
    it(`ignores ${what} and uses the schedule's`, () => {
      const t = timesFor({ ...base, platform_times: { instagram: bad } }, "instagram");
      expect(t.post_at).toBe("17:30:00");
      expect(t.days).toEqual(base.days);
    });
  }

  it("⛔ and the channel still gets its posts, which is the point", () => {
    const slots = slotsInHorizon({ ...base, platform_times: { instagram: { post_at: "25:99" } } }, NOW);
    expect(slots.filter((s) => s.platform === "instagram").length).toBeGreaterThan(0);
  });
});

describe("an inactive schedule is due for nothing", () => {
  it("writes no slots at all", () => {
    expect(slotsInHorizon({ ...base, active: false }, NOW)).toEqual([]);
  });
});
