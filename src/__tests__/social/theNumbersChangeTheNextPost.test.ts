/**
 * 🔴 THE OWNER, 19 Oct: "Ensure the statistics ... are collected properly,
 * stored, analysed and actions are taken for the next post automatically."
 *
 * Collection and storage existed. Nothing read them — the figures reached a
 * chart and stopped, which is a report, not a loop.
 *
 * ⛔ AND THE TWO WAYS A LOOP LIKE THIS GOES WRONG, which is most of what this
 * file is about:
 *
 *   1. ACTING ON NOISE. Today the whole system has ONE measured post, with
 *      four impressions. Anything that changed behaviour on that would be
 *      superstition with a database behind it.
 *   2. COLLAPSING TO A MONOCULTURE. "Do more of what works" run to its
 *      conclusion picks one angle and never leaves — the exact failure the
 *      round-robin was built to prevent
 *      ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
 */

import { describe, it, expect } from "vitest";
import {
  engagementRate,
  angleScores,
  turnsFor,
  weightedCycle,
  angleReport,
  CHANNEL_METRIC,
  MIN_POSTS_PER_ANGLE,
  MAX_TURNS,
  type PostOutcome,
} from "@/lib/social/learning";

const POOLS = ["privacy", "quiet-hours", "the-unsaid"];

const post = (over: Partial<PostOutcome> = {}): PostOutcome => ({
  platform: "instagram",
  pool: "privacy",
  saves: 0,
  shares: null,
  reactions: 0,
  comments: 0,
  reach: 100,
  impressions: 120,
  ...over,
});

/** n posts for one angle, each with the same measured outcome. */
const many = (n: number, over: Partial<PostOutcome>) => Array.from({ length: n }, () => post(over));

describe("which number a channel is judged on", () => {
  it("Instagram on saves, Facebook on shares — not likes everywhere", () => {
    /**
     * 🔑 A like is the cheapest possible response and the one least related
     * to whether a post was worth making ⇒ social_platform_rules_reviewed.
     */
    expect(CHANNEL_METRIC.instagram.primary).toBe("saves");
    expect(CHANNEL_METRIC.facebook.primary).toBe("shares");
    expect(CHANNEL_METRIC.instagram.primary).not.toBe("reactions");
  });

  it("falls back only when the metric is MISSING, never when it is zero", () => {
    /**
     * 🔴 Zero saves is a measurement; a null is a missing one. Treating them
     * alike is how an absent metric quietly becomes a bad score — or, worse,
     * how a zero gets replaced by a flattering number of likes.
     */
    const measuredZero = engagementRate(post({ saves: 0, reactions: 50, reach: 100 }));
    expect(measuredZero).toBe(0);

    const missing = engagementRate(post({ saves: null, reactions: 50, reach: 100 }));
    expect(missing).toBe(0.5);
  });
});

describe("a rate, not a count", () => {
  it("a small post that landed beats a big one that did not", () => {
    /**
     * 🔴 WITH COUNTS, ANGLES WOULD RANK BY WHEN THEY WERE POSTED. As the
     * account grows every angle's raw numbers rise together, so the oldest
     * posts would look worst forever, whatever they said.
     */
    const small = engagementRate(post({ saves: 2, reach: 40 }))!;
    const big = engagementRate(post({ saves: 3, reach: 4000 }))!;
    expect(small).toBeGreaterThan(big);
  });

  it("uses reach — people — before impressions, which counts one twice", () => {
    expect(engagementRate(post({ saves: 10, reach: 100, impressions: 1000 }))).toBe(0.1);
    expect(engagementRate(post({ saves: 10, reach: null, impressions: 1000 }))).toBe(0.01);
  });

  it("⛔ an unmeasured post is null, never zero", () => {
    // "No audience recorded" and "nobody responded" must not average together.
    expect(engagementRate(post({ reach: null, impressions: null }))).toBeNull();
    expect(engagementRate(post({ reach: 0, impressions: 0 }))).toBeNull();
    expect(engagementRate(post({ platform: "youtube" }))).toBeNull();
  });

  it("and an unmeasured post does not count towards the sample either", () => {
    // ⛔ Otherwise an angle reaches "trusted" on posts nobody can measure.
    const rows = many(MIN_POSTS_PER_ANGLE, { pool: "privacy", reach: null, impressions: null });
    expect(angleScores(rows)).toEqual([]);
  });
});

describe("⛔ it does nothing at all until there is enough evidence", () => {
  it("one spectacular post changes no turn", () => {
    /**
     * 🔴 THE STATE THE SYSTEM IS IN TODAY: one measured post, four
     * impressions. ⚠️ This test is the promise that today's data moves
     * nothing.
     */
    const rows = [post({ pool: "privacy", saves: 40, reach: 40 })];
    const turns = turnsFor(POOLS, angleScores(rows), "instagram");
    expect([...turns.values()]).toEqual([1, 1, 1]);
  });

  it(`needs ${MIN_POSTS_PER_ANGLE} posts behind an angle before it counts`, () => {
    const almost = [
      ...many(MIN_POSTS_PER_ANGLE - 1, { pool: "privacy", saves: 20, reach: 100 }),
      ...many(MIN_POSTS_PER_ANGLE, { pool: "the-unsaid", saves: 1, reach: 100 }),
    ];
    // Only one angle is trusted, so there is nothing to compare against.
    expect([...turnsFor(POOLS, angleScores(almost), "instagram").values()]).toEqual([1, 1, 1]);
  });

  it("and says 'not yet' out loud rather than looking broken", () => {
    // ⛔ A loop silently doing nothing looks exactly like one that is broken.
    expect(angleReport(angleScores([]), "instagram")).toMatch(/no post has been measured/i);
    const thin = angleScores(many(2, { pool: "privacy", saves: 1, reach: 100 }));
    expect(angleReport(thin, "instagram")).toMatch(/Not enough to rank/i);
  });
});

describe("once there is evidence, it tilts — and only tilts", () => {
  const rows = [
    ...many(6, { pool: "privacy", saves: 12, reach: 100 }), // best
    ...many(6, { pool: "quiet-hours", saves: 6, reach: 100 }), // middle
    ...many(6, { pool: "the-unsaid", saves: 1, reach: 100 }), // worst
  ];
  const scores = angleScores(rows);
  const turns = turnsFor(POOLS, scores, "instagram");

  it("the better angle gets more turns", () => {
    expect(turns.get("privacy")!).toBeGreaterThan(turns.get("the-unsaid")!);
  });

  it("⛔ but the worst angle NEVER loses its turn", () => {
    /**
     * 🔴 THE FLOOR, AND THE WHOLE DIFFERENCE between tilting a rotation and
     * abandoning it. An angle that is behind may be behind because of three
     * bad drafts or one post that landed on a holiday — and an angle dropped
     * entirely can never produce the evidence that would bring it back.
     */
    for (const p of POOLS) expect(turns.get(p)!).toBeGreaterThanOrEqual(1);
    expect(weightedCycle(POOLS, turns)).toContain("the-unsaid");
  });

  it("⛔ and the ceiling is low, so the feed cannot become one angle", () => {
    // ⚠️ Three turns to one, not thirty. A feed that is three-quarters one
    // angle is a monoculture even when that angle is the best one.
    for (const p of POOLS) expect(turns.get(p)!).toBeLessThanOrEqual(MAX_TURNS);
    const cycle = weightedCycle(POOLS, turns);
    const share = cycle.filter((p) => p === "privacy").length / cycle.length;
    expect(share).toBeLessThan(0.6);
  });

  it("the cycle interleaves rather than running the same angle three days", () => {
    // ⛔ AAA BBB CCC is a rut however good A is.
    const cycle = weightedCycle(POOLS, new Map([["privacy", 3], ["quiet-hours", 1], ["the-unsaid", 1]]));
    expect(cycle.slice(0, 3)).toEqual(POOLS);
    expect(cycle.filter((p) => p === "privacy")).toHaveLength(3);
  });

  it("is deterministic, so a gate retry cannot change the angle", () => {
    const cycle = weightedCycle(POOLS, turns);
    expect(cycle[7 % cycle.length]).toBe(cycle[7 % cycle.length]);
    expect(weightedCycle(POOLS, turns)).toEqual(cycle);
  });

  it("⛔ judges each channel on its own numbers", () => {
    /**
     * 🔴 An angle that earns saves on Instagram is not thereby good on
     * Facebook — different readers, different metric, and the whole reason
     * each channel now has its own schedule.
     */
    const mixed = [
      ...many(6, { platform: "instagram", pool: "privacy", saves: 12, reach: 100 }),
      ...many(6, { platform: "facebook", pool: "privacy", shares: 0, reactions: 0, saves: null, reach: 100 }),
      ...many(6, { platform: "facebook", pool: "the-unsaid", shares: 9, saves: null, reach: 100 }),
    ];
    const s = angleScores(mixed);
    const fb = turnsFor(POOLS, s, "facebook");
    expect(fb.get("the-unsaid")!).toBeGreaterThan(fb.get("privacy")!);
    // ...while Instagram's view of `privacy` is untouched by Facebook's.
    expect(s.find((x) => x.platform === "instagram" && x.pool === "privacy")!.rate).toBeCloseTo(0.12);
  });
});
