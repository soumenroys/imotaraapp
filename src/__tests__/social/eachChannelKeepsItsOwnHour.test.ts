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
 */

import { describe, it, expect } from "vitest";
import { isDue, isDueForPlatform, timeForPlatform, LEAD_MINUTES } from "@/lib/social/store";

/** The instant the cron must fire, given it writes LEAD_MINUTES ahead. */
const leadBefore = (iso: string) => new Date(new Date(iso).getTime() - LEAD_MINUTES * 60_000);

const base = {
  post_at: "17:30:00",
  timezone: "Asia/Kolkata",
  days: [0, 1, 2, 3, 4, 5, 6],
  active: true,
  platform_times: { instagram: { post_at: "17:00:00" } },
};

// 17:30 and 17:00 IST = 12:00 and 11:30 UTC.
const FACEBOOK_SLOT = "2026-10-19T12:00:00Z";
const INSTAGRAM_SLOT = "2026-10-19T11:30:00Z";

describe("two channels, two hours, one schedule", () => {
  it("Instagram is due at its own time and Facebook is not", () => {
    expect(isDueForPlatform(base, "instagram", leadBefore(INSTAGRAM_SLOT))).toBe(true);
    /**
     * 🔴 THE BUG THIS REPLACES. The old code returned the schedule and the
     * caller wrote every platform on it — so Facebook would have posted at
     * Instagram's earlier hour, half an hour early, every day.
     */
    expect(isDueForPlatform(base, "facebook", leadBefore(INSTAGRAM_SLOT))).toBe(false);
  });

  it("Facebook is due at the schedule's own time and Instagram is not", () => {
    expect(isDueForPlatform(base, "facebook", leadBefore(FACEBOOK_SLOT))).toBe(true);
    expect(isDueForPlatform(base, "instagram", leadBefore(FACEBOOK_SLOT))).toBe(false);
  });

  it("is exactly thirty minutes earlier, which is what was asked for", () => {
    const gap = new Date(FACEBOOK_SLOT).getTime() - new Date(INSTAGRAM_SLOT).getTime();
    expect(gap).toBe(30 * 60_000);
  });
});

describe("an override is an override, not a replacement", () => {
  it("a platform with no entry keeps the schedule's own time and days", () => {
    const when = timeForPlatform(base, "facebook");
    expect(when.post_at).toBe("17:30:00");
    expect(when.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(when.overridden).toBe(false);
  });

  it("an entry with only a time keeps the schedule's days", () => {
    // 🔑 "Same days, different hour" — this first case — must not have to
    // restate the week.
    const when = timeForPlatform(base, "instagram");
    expect(when.post_at).toBe("17:00:00");
    expect(when.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("an entry may narrow the days as well", () => {
    const weekdays = { ...base, platform_times: { instagram: { post_at: "17:00:00", days: [1, 2, 3, 4, 5] } } };
    // 19 Oct 2026 is a Monday in IST at this slot.
    expect(isDueForPlatform(weekdays, "instagram", leadBefore(INSTAGRAM_SLOT))).toBe(true);
    const sunday = new Date(new Date(INSTAGRAM_SLOT).getTime() - 86_400_000).toISOString();
    expect(isDueForPlatform(weekdays, "instagram", leadBefore(sunday))).toBe(false);
  });
});

describe("a bad value falls back rather than silencing a channel", () => {
  /**
   * ⛔ THE FAILURE THIS FORBIDS. `platform_times` is hand-editable json. The
   * cost of a bad value must be "this channel posts at the normal time",
   * never "this channel silently stops" — the failure nobody sees
   * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
   */
  const bad = (value: unknown) =>
    ({ ...base, platform_times: { instagram: value } }) as unknown as typeof base;

  it("ignores a malformed time and uses the schedule's", () => {
    for (const value of [{ post_at: "5pm" }, { post_at: "17" }, { post_at: "" }, { post_at: 1700 }, {}]) {
      const when = timeForPlatform(bad(value), "instagram");
      expect(when.post_at, `${JSON.stringify(value)} should have fallen back`).toBe("17:30:00");
    }
  });

  it("ignores malformed days and uses the schedule's", () => {
    for (const value of [{ days: "mon" }, { days: [1.5] }, { days: null }]) {
      expect(timeForPlatform(bad(value), "instagram").days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it("accepts HH:MM as well as HH:MM:SS, because a person types the short one", () => {
    expect(timeForPlatform(bad({ post_at: "17:00" }), "instagram").post_at).toBe("17:00");
    expect(isDueForPlatform(bad({ post_at: "17:00" }), "instagram", leadBefore(INSTAGRAM_SLOT))).toBe(true);
  });

  it("a null column behaves as no overrides at all", () => {
    const plain = { ...base, platform_times: null };
    expect(timeForPlatform(plain, "instagram").post_at).toBe("17:30:00");
    expect(isDueForPlatform(plain, "instagram", leadBefore(FACEBOOK_SLOT))).toBe(true);
  });
});

describe("the old entry point still answers the old question", () => {
  it("isDue ignores overrides and reads the schedule's own time", () => {
    // ⚠️ Kept so the timezone arithmetic stays testable on its own, and so a
    // caller that has no platform in hand cannot accidentally get one
    // channel's hour.
    expect(isDue(base, leadBefore(FACEBOOK_SLOT))).toBe(true);
    expect(isDue(base, leadBefore(INSTAGRAM_SLOT))).toBe(false);
  });

  it("an inactive schedule is due for nothing", () => {
    const off = { ...base, active: false };
    expect(isDueForPlatform(off, "instagram", leadBefore(INSTAGRAM_SLOT))).toBe(false);
    expect(isDueForPlatform(off, "facebook", leadBefore(FACEBOOK_SLOT))).toBe(false);
  });
});
