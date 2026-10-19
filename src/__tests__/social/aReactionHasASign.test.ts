/**
 * 🔴 A REACTION HAS A SIGN, AND A LOOP THAT IGNORES IT LEARNS THE WRONG THING.
 *
 * `social_post_stats.reactions` is a total. Forty reactions reads as a post
 * that did well — and forty ANGRY reactions on a mental-health post means
 * something has gone wrong. Until 19 Oct those were the same number, because
 * only the total was ever fetched.
 *
 * ⛔ THE FAILURE THIS PREVENTS IS THE BEST-DOCUMENTED ONE IN RECOMMENDER
 * SYSTEMS: a loop that rewards engagement without reading its sign discovers
 * that posts people are upset by perform well, and asks for more of them.
 * Anger travels further than agreement. On this brand that is not a bad
 * quarter, it is harm.
 *
 * ⚠️ AND THE CORRECTION IS DELIBERATELY NOT AUTOMATIC. The post leaves the
 * learning signal and goes to a person. A machine rewriting the brand's voice
 * because eleven people were annoyed is the wrong correction; somebody reading
 * the comments is the right one.
 */

import { describe, it, expect } from "vitest";
import {
  upsetSignal,
  angleScores,
  turnsFor,
  postsNeedingAPerson,
  upsetCoverage,
  ANGRY_SHARE_ALARM,
  ANGRY_MIN_COUNT,
  type PostOutcome,
} from "@/lib/social/learning";

const post = (over: Partial<PostOutcome> = {}): PostOutcome => ({
  platform: "facebook",
  pool: "privacy",
  saves: null,
  shares: 2,
  reactions: 20,
  comments: 1,
  reach: 100,
  impressions: 120,
  angry: 0,
  sad: 0,
  love: 5,
  ...over,
});

describe("not measured is not calm, and the code has to SAY so", () => {
  /**
   * 🔴 I GOT THIS WRONG FIRST TIME, AND A MUTATION FOUND IT.
   *
   * The comment said "not measured is not calm" and the code returned
   * `{upset: false}` for both — identical to every caller. Replacing
   * `o.angry ?? null` with `o.angry ?? 0` survived the tests, correctly: the
   * rule was in the prose and not in the behaviour.
   *
   * ⛔ And the difference is not academic. Instagram reports no reaction
   * breakdown at all, so EVERY Instagram post is unmeasurable here. Collapsed
   * into "not upset", a whole channel silently looks safe.
   */
  it("⛔ 'cannot tell' is a DIFFERENT answer from 'nobody was angry'", () => {
    const unmeasured = upsetSignal(post({ angry: null }));
    const measuredCalm = upsetSignal(post({ angry: 0 }));

    expect(unmeasured.upset).toBe(false);
    expect(measuredCalm.upset).toBe(false);
    // ⚠️ THE ASSERTION THE OLD VERSION COULD NOT MAKE.
    expect(unmeasured.checked).toBe(false);
    expect(measuredCalm.checked).toBe(true);
  });

  it("no Instagram post can be checked for this, and that is reported", () => {
    const rows = [
      post({ platform: "instagram", angry: null }),
      post({ platform: "instagram", angry: null }),
      post({ platform: "facebook", angry: 1, reactions: 10 }),
    ];
    const cover = upsetCoverage(rows);
    expect(cover.find((c) => c.platform === "instagram")).toEqual({ platform: "instagram", checked: 0, total: 2 });
    expect(cover.find((c) => c.platform === "facebook")).toEqual({ platform: "facebook", checked: 1, total: 1 });
  });
});

describe("when a post needs a person", () => {
  it("a clear majority of anger raises it", () => {
    const out = upsetSignal(post({ angry: 12, reactions: 16, love: 1, sad: 0 }));
    expect(out.upset).toBe(true);
    expect(out.why).toMatch(/needs a person/i);
    expect(out.why).toMatch(/Nothing is auto-corrected/i);
  });

  it(`⛔ needs ${ANGRY_MIN_COUNT} angry reactions, not one cross person`, () => {
    // One or two angry reactions on a small post is a Tuesday, not a signal.
    const tiny = post({ angry: ANGRY_MIN_COUNT - 1, reactions: ANGRY_MIN_COUNT - 1, love: 0, sad: 0 });
    expect(upsetSignal(tiny).upset).toBe(false);
  });

  it("⛔ and a SHARE of the reaction, not a raw count", () => {
    // 🔴 Otherwise a popular post is punished for being popular: 5 angry out
    // of 500 is noise, and would trip any fixed threshold as the page grows.
    expect(upsetSignal(post({ angry: 5, reactions: 500, love: 400, sad: 0 })).upset).toBe(false);
    expect(ANGRY_SHARE_ALARM).toBeGreaterThan(0.1);
    expect(ANGRY_SHARE_ALARM).toBeLessThan(0.5);
  });

  it("⚠️ SAD does not raise it, and that is a judgement about this brand", () => {
    /**
     * 🔑 A sad reaction to a post about the hours nobody staffs is very often
     * the post landing exactly as intended — somebody recognising themselves.
     * Anger is different: it means the post misread someone, or claimed
     * something it should not have.
     */
    expect(upsetSignal(post({ angry: 0, sad: 30, reactions: 30, love: 0 })).upset).toBe(false);
  });
});

describe("an upset post is not a data point", () => {
  const good = Array.from({ length: 6 }, () => post({ pool: "privacy", shares: 1, reactions: 10, reach: 100 }));
  const upsetting = Array.from({ length: 6 }, () =>
    // ⚠️ HIGH engagement — anger travels. This is exactly the row that would
    // teach the rotation to prefer whatever caused it.
    post({ pool: "the-unsaid", shares: 40, reactions: 60, angry: 50, love: 2, sad: 0, reach: 100 }),
  );

  it("⛔ it is excluded from the scores, however well it 'performed'", () => {
    const scores = angleScores([...good, ...upsetting]);
    expect(scores.find((s) => s.pool === "the-unsaid")).toBeUndefined();
    expect(scores.find((s) => s.pool === "privacy")).toBeDefined();
  });

  it("⛔ so the angle that upset people does NOT get more turns", () => {
    /**
     * 🔴 THE WHOLE POINT, stated as the outcome rather than the mechanism:
     * without this, `the-unsaid` has four times the shares of `privacy` and
     * would be promoted to three turns against one.
     */
    const pools = ["privacy", "quiet-hours", "the-unsaid"];
    const turns = turnsFor(pools, angleScores([...good, ...upsetting]), "facebook");
    expect(turns.get("the-unsaid")).toBe(1);
    expect(turns.get("the-unsaid")!).toBeLessThanOrEqual(turns.get("privacy")!);
  });

  it("and it is handed to a person instead, by name", () => {
    // ⛔ Returned, not logged. A warning that reaches only a server log is a
    // warning nobody receives.
    const flagged = postsNeedingAPerson([{ ...upsetting[0], postId: "p-1" }, good[0]]);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].postId).toBe("p-1");
    expect(flagged[0].why).toMatch(/angry reaction/i);
  });
});
