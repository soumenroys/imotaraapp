/**
 * The Activity page's insights.
 *
 * 🔑 THE THRESHOLDS ARE JUDGEMENT CALLS, which is exactly why they are in a
 * module with tests rather than inline in JSX. Anybody who disagrees with
 * "under 25% returning is worth acting on" can argue with it here.
 *
 * ⛔ AND THE LIMIT IS TESTED TOO. This data cannot say WHY somebody did not
 * come back — there is no message text, no screen, no referrer in
 * usage_events. An insight that claimed a cause would be inventing one, so the
 * last block below pins that none of them does.
 */

import { describe, it, expect } from "vitest";
import { insightsFor, pooledRetention, trend, type AnalyticsShape } from "@/lib/admin/insights";

const base = (over: Partial<AnalyticsShape> = {}): AnalyticsShape => ({
  range: { days: 30 },
  totals: { events: 400, activeUsers: 37, newUsers: 29, returningUsers: 8 },
  rolling: { dau: 5, wau: 18, mau: 37 },
  series: Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, events: 10, activeUsers: 3 })),
  byEventType: [{ key: "chat_reply", events: 300, users: 30 }],
  byPlatform: [{ key: "web", events: 300, users: 30 }, { key: "ios", events: 100, users: 7 }],
  emotions: [],
  retention: [],
  meta: { platformReady: true, truncated: false },
  ...over,
});

const find = (d: AnalyticsShape, id: string) => insightsFor(d).find((i) => i.id === id);

describe("the owner's actual numbers", () => {
  it("🔴 37 people, 8 returning — says so, and says it is worth acting on", () => {
    // The example from the brief, verbatim: "out of 37 people only 8 are returning".
    const i = find(base(), "returning-share");
    expect(i).toBeTruthy();
    expect(i!.severity).toBe("act");
    expect(i!.headline).toContain("21.6%");
    expect(i!.evidence).toContain("8 returning");
    expect(i!.evidence).toContain("29 new");
  });

  it("⛔ does not claim to know why", () => {
    const i = find(base(), "returning-share")!;
    expect(i.action).toMatch(/cannot say why/i);
    // 🔑 And points at the narrower question that IS answerable.
    expect(i.action).toMatch(/day 1|next day/i);
  });
});

describe("where the thresholds sit", () => {
  const withShare = (returning: number, newU: number) =>
    find(base({ totals: { events: 1, activeUsers: returning + newU, newUsers: newU, returningUsers: returning } }), "returning-share")!;

  it("under a quarter returning is worth acting on", () => expect(withShare(2, 8).severity).toBe("act"));
  it("between a quarter and not-quite-half is worth watching", () => expect(withShare(3, 7).severity).toBe("watch"));
  it("about half is working", () => expect(withShare(5, 5).severity).toBe("good"));

  it("⚠️ the good case does not tell you to fix anything", () => {
    expect(withShare(5, 5).action).not.toMatch(/cannot say why/i);
  });
});

describe("pooled retention counts each person once", () => {
  it("🔴 does not let a cohort of two outweigh a cohort of eighty", () => {
    /**
     * Averaging the percentages gives (50 + 15) / 2 = 32.5%, which would read
     * as healthy. Eighty-two people, thirteen of whom returned, is 15.9%.
     */
    const cohorts = [
      { cohortDate: "a", size: 2, d1: 1, d7: null, d30: null },
      { cohortDate: "b", size: 80, d1: 12, d7: null, d30: null },
    ];
    expect(pooledRetention(cohorts, "d1")).toEqual({ returned: 13, of: 82, pct: 15.9 });
  });

  it("⛔ a cohort too young to answer is skipped, never counted as zero", () => {
    const cohorts = [
      { cohortDate: "a", size: 10, d7: 3, d1: null, d30: null },
      { cohortDate: "b", size: 10, d7: null, d1: null, d30: null },
    ];
    // 3 of 10, not 3 of 20. Counting the young cohort as zero would halve it.
    expect(pooledRetention(cohorts, "d7")).toEqual({ returned: 3, of: 10, pct: 30 });
  });

  it("is nothing at all when no cohort can answer", () => {
    expect(pooledRetention([{ cohortDate: "a", size: 5, d1: null, d7: null, d30: null }], "d1")).toBeNull();
  });
});

describe("the trend compares a typical day, not endpoints and not totals", () => {
  const days = (events: number[]) => events.map((e, i) => ({ date: `d${i}`, events: e }));

  it("⛔ one quiet last day is not a decline", () => {
    // Endpoint to endpoint this is −90%. Summing the halves called it −18%,
    // which is why that version was replaced. It is a flat fortnight with one
    // slow Sunday in it.
    expect(trend(days([10, 10, 10, 10, 10, 10, 10, 10, 10, 1]))!.direction).toBe("flat");
  });

  it("⛔ nor is one exceptional day a rise", () => {
    expect(trend(days([10, 10, 10, 10, 10, 10, 10, 10, 10, 99]))!.direction).toBe("flat");
  });

  it("sees a real fall", () => {
    const t = trend(days([20, 20, 20, 20, 20, 4, 4, 4, 4, 4]))!;
    expect(t.direction).toBe("down");
    expect(t.changePct).toBeLessThan(-50);
  });

  it("sees a real rise", () => expect(trend(days([2, 2, 2, 2, 2, 20, 20, 20, 20, 20]))!.direction).toBe("up"));

  it("says nothing on too little data", () => expect(trend(days([1, 2, 3]))).toBeNull());
});

describe("the things that stop the page being readable at all", () => {
  it("a missing platform column is an action with the command in it", () => {
    const i = find(base({ meta: { platformReady: false, truncated: false } }), "platform-not-ready")!;
    expect(i.severity).toBe("act");
    expect(i.action).toContain("usage_events_platform.sql");
  });

  it("🔴 a truncated range says every number is a floor", () => {
    const i = find(base({ meta: { platformReady: true, truncated: true } }), "truncated")!;
    expect(i.headline).toMatch(/floor/i);
    expect(i.action).toMatch(/shorter range/i);
  });

  it("⚠️ the most urgent insight is first", () => {
    const list = insightsFor(base({ meta: { platformReady: false, truncated: true } }));
    expect(list[0].severity).toBe("act");
    // 🔑 And 'good' never outranks something that needs doing.
    const severities = list.map((i) => i.severity);
    expect(severities.indexOf("good") === -1 || severities.indexOf("good") > severities.lastIndexOf("act")).toBe(true);
  });

  it("an empty window says so instead of dividing by zero", () => {
    const list = insightsFor(base({ totals: { events: 0, activeUsers: 0, newUsers: 0, returningUsers: 0 } }));
    expect(list.find((i) => i.id === "no-people")).toBeTruthy();
    for (const i of list) expect(i.headline).not.toContain("NaN");
  });
});

describe("every insight is usable as an insight", () => {
  const all = [
    insightsFor(base()),
    insightsFor(base({ retention: [{ cohortDate: "a", size: 40, d1: 2, d7: 1, d30: 0 }] })),
    insightsFor(base({ retention: [{ cohortDate: "a", size: 40, d1: 20, d7: 14, d30: 9 }] })),
    insightsFor(base({ byPlatform: [{ key: "web", events: 9, users: 9 }, { key: "unknown", events: 90, users: 40 }] })),
    insightsFor(base({ series: Array.from({ length: 20 }, (_, i) => ({ date: `d${i}`, events: i < 10 ? 2 : 40, activeUsers: 1 })) })),
  ].flat();

  it("🔑 says what the number is, where it came from, and what to do", () => {
    expect(all.length).toBeGreaterThan(6);
    for (const i of all) {
      expect(i.headline.length, `${i.id} has no headline`).toBeGreaterThan(10);
      expect(i.evidence.length, `${i.id} shows no working`).toBeGreaterThan(10);
      expect(i.action.length, `${i.id} does not say what to do`).toBeGreaterThan(20);
    }
  });

  it("⛔ never invents a cause the data cannot support", () => {
    // 🔴 The whole risk of this feature. usage_events has no message text, no
    // screen and no referrer, so no insight may assert a reason.
    const forbidden = /\b(because they (?:found|felt|thought|did not like)|users? (?:hate|dislike|were bored)|the reason is)\b/i;
    for (const i of all) {
      expect(forbidden.test(i.headline), `${i.id} headline asserts a cause`).toBe(false);
      expect(forbidden.test(i.action), `${i.id} action asserts a cause`).toBe(false);
    }
  });

  it("carries no duplicate ids, so React keys stay stable", () => {
    const list = insightsFor(base({ meta: { platformReady: false, truncated: true } }));
    expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
  });
});

describe("🔴 the stickiness card was reading the clock", () => {
  /**
   * It said "People who use Imotara use it on 0% of days" in production one
   * morning, with "0 active today against 44 active in 30 days" underneath —
   * because rolling.dau is who has been active SO FAR TODAY. The number
   * started at zero every midnight and climbed all day, and the card offered a
   * theory about journals to explain the time of day.
   */
  const busy = (over: Partial<AnalyticsShape> = {}) =>
    base({
      rolling: { dau: 0, wau: 20, mau: 44 },
      series: Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, events: 12, activeUsers: 6 })),
      ...over,
    });

  it("⛔ does not report 0% just because today has barely started", () => {
    const i = insightsFor(busy()).find((x) => x.id === "stickiness")!;
    expect(i).toBeTruthy();
    // 6 people a day against 44 in the window ≈ 13.6%, not 0%.
    expect(i.headline).not.toMatch(/\b0%/);
    expect(i.headline).toContain("13.6%");
  });

  it("says out loud that it is an average, not today", () => {
    const i = insightsFor(busy()).find((x) => x.id === "stickiness")!;
    expect(i.evidence).toMatch(/average/i);
    expect(i.evidence).toMatch(/today is still happening/i);
  });

  it("⚠️ stays quiet when there is too little of the window to average", () => {
    // Three days of data cannot describe a typical day.
    const thin = busy({ series: Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, events: i < 3 ? 5 : 0, activeUsers: i < 3 ? 2 : 0 })) });
    expect(insightsFor(thin).find((x) => x.id === "stickiness")).toBeUndefined();
  });
});
