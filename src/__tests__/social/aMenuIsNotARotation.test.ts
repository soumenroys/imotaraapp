/**
 * 🔴 THE NEW ANGLES WERE OFFERED EVERY TIME AND NEVER TAKEN.
 *
 * Three pools were added on 18 Oct precisely because the first seven are all
 * product explanation, and product explanation does not get sent to a friend.
 * They were added to the schedule, they reached the prompt, and the next three
 * posts were about privacy, about memory, and about having no streaks.
 *
 * ⚠️ THE GENERAL SHAPE, which is worth more than this one fix: A MENU HANDED
 * TO A MODEL IS NOT A ROTATION. Asked to "choose one of these angles" it picks
 * the safest item, consistently, and the variety somebody configured never
 * happens — silently, because every individual post looks reasonable.
 *
 * 🔑 Languages were always rotated in code for exactly this reason. The angle
 * now is too.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextPool, nextLanguage } from "@/lib/social/pipeline";
import { TOPIC_POOLS } from "@/lib/social/topicPools";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the angle rotates like the language does", () => {
  const pools = ["privacy", "quiet-hours", "untranslatable", "the-unsaid", "built-wrong"];

  it("walks every pool before repeating one", () => {
    const seen = pools.map((_, i) => nextPool(pools, i));
    expect([...new Set(seen)].sort()).toEqual([...pools].sort());
  });

  it("comes back round, so a long-running schedule keeps cycling", () => {
    expect(nextPool(pools, 5)).toBe(nextPool(pools, 0));
    expect(nextPool(pools, 7)).toBe(nextPool(pools, 2));
  });

  it("is deterministic — the same count gives the same angle", () => {
    expect(nextPool(pools, 3)).toBe(nextPool(pools, 3));
  });

  /**
   * ⛔ NO DEFAULT. A schedule with no pool is one nobody finished setting up,
   * and quietly picking an angle hides that — which is how a brand ends up
   * posting whatever the model finds easiest.
   */
  it("refuses an empty list rather than choosing for you", () => {
    expect(() => nextPool([], 0)).toThrow(/no topic pool/i);
    expect(() => nextPool(pools, -1)).toThrow();
    expect(() => nextPool(pools, Number.NaN)).toThrow();
  });

  it("behaves the same way the language rotation does", () => {
    // 🔑 Same counter, same arithmetic — so the two never disagree about which
    // post this is.
    const langs = ["en", "bn", "hi"];
    for (let i = 0; i < 9; i++) {
      expect(nextPool(langs, i)).toBe(nextLanguage(langs, i));
    }
  });

  it("every pool that exists can come up", () => {
    const ids = TOPIC_POOLS.map((p) => p.id);
    const seen = ids.map((_, i) => nextPool(ids, i));
    expect(new Set(seen).size).toBe(ids.length);
  });
});

describe("exactly one angle reaches the writer", () => {
  const pipeline = read("src/lib/social/pipeline.ts");

  /**
   * ⛔ THE WHOLE POINT. Passing the schedule's full list is what produced the
   * menu, so the assertion is on the ARGUMENT, not on the existence of
   * nextPool somewhere in the file.
   */
  it("hands over a single-element list, not the schedule's whole set", () => {
    expect(pipeline).toMatch(/topicPool: \[nextPool\(args\.schedule\.topicPool, args\.postsSoFar\)\]/);
    expect(
      /topicPool: args\.schedule\.topicPool,/.test(pipeline),
      "the full pool list is being handed to the model again",
    ).toBe(false);
  });

  /**
   * ⚠️ NOT `attempt`. A gate rejection retries the same post; changing the
   * angle mid-retry would mean the post that eventually passes is about
   * something other than the one the rotation chose, and a pool would be
   * skipped for reasons nobody could see from the outside.
   */
  it("keeps the same angle across retries of one post", () => {
    expect(pipeline).not.toMatch(/nextPool\([^)]*attempt/);
  });
});

describe("one counter drives both rotations", () => {
  const route = read("src/app/api/admin/social/generate/route.ts");

  /**
   * ⚠️ Calling postCountFor twice would be two different numbers if a post
   * landed in between, and the language and the angle would then drift apart
   * for no reason anybody could see from the outside.
   */
  it("reads the post count once and uses it for both", () => {
    expect(route).toMatch(/const postsSoFar = await postCountFor\(schedule\.id\)/);
    expect(route).toMatch(/nextLanguage\(schedule\.languages, postsSoFar\)/);
    expect((route.match(/postCountFor\(schedule\.id\)/g) ?? []).length).toBe(1);
  });

  it("a preview walks the pools, because it has no history to count", () => {
    // Pressing "See what it would write" repeatedly would otherwise show the
    // same angle every time and look like the rotation is broken.
    expect(route).toMatch(/postsSoFar: Math\.floor\(Math\.random\(\)/);
  });

  it("the cron passes the count it already had", () => {
    const cron = read("src/app/api/cron/social-queue/route.ts");
    expect(cron).toMatch(/postsSoFar: count/);
  });
});
