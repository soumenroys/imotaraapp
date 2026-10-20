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
import { nextPool, nextLanguage, usablePools, bodyUsesWord } from "@/lib/social/pipeline";
import { untranslatablePoolReady } from "@/lib/social/untranslatableWords";
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
    // ⚠️ The angle is decided ONCE, above the retry loop, and passed as a
    // one-element list ⇒ the `pool` const.
    /**
     * ⛔ THIS ANCHOR HAS NOW BROKEN THREE TIMES ON CHANGES THAT KEPT THE RULE —
     * usablePools gaining the spend counts, the rotation gaining a weighted
     * cycle, and (20 Oct) the cross-channel narrowing inserting a dozen lines
     * between the two anchors.
     *
     * 🔑 EACH TIME THE FIX WAS TO WIDEN A BYTE WINDOW, which only sets the
     * next break. ⇒ it now pins the ORDER of the three steps rather than how
     * far apart they sit: the pool list is built from the schedule, it is
     * weighted, and THEN exactly one angle is drawn from it. Anything may be
     * inserted between them; nothing may reorder them or skip one.
     */
    const built = pipeline.indexOf("usablePools(args.schedule.topicPool");
    const weighted = pipeline.indexOf("weightedCycle(");
    const at = pipeline.indexOf("const pool = nextPool(");
    expect(built, "the pool list is no longer built from the schedule").toBeGreaterThan(-1);
    expect(weighted, "the rotation is no longer weighted").toBeGreaterThan(-1);
    expect(at, "nothing draws a single angle any more").toBeGreaterThan(-1);
    expect(built, "the list is weighted before it is built").toBeLessThan(weighted);
    expect(weighted, "an angle is drawn before the list is weighted").toBeLessThan(at);
    expect(pipeline.slice(at, at + 120)).not.toContain("args.schedule.topicPool");
    expect(pipeline).toMatch(/topicPool: \[pool\],/);
    expect(
      /topicPool: args\.schedule\.topicPool,/.test(pipeline),
      "the full pool list is being handed to the model again",
    ).toBe(false);
  });

  /**
   * 🔴 THE INSTRUCTION WAS NOT ENOUGH. Handed অভিমান and told in capitals to
   * use exactly it, the writer produced a post about talking versus typing.
   * ⛔ So the word is chosen by the pipeline — which is therefore able to
   * check the result — and an off-angle draft is rejected rather than queued.
   */
  it("⛔ rejects a word-angle draft that does not use its word", () => {
    expect(pipeline).toMatch(/if \(word && !bodyUsesWord\(/);
    const branch = pipeline.slice(pipeline.indexOf("if (word && !bodyUsesWord("));
    expect(branch.slice(0, 600)).toContain("rejected.push");
    expect(branch.slice(0, 600)).toContain("continue;");
  });

  it("decides the word once, outside the retry loop", () => {
    const decided = pipeline.indexOf('const word = pool === "untranslatable"');
    const loop = pipeline.indexOf("for (let attempt = 1;");
    /**
     * ⚠️ THE `> -1` IS THE WHOLE TEST. `indexOf` returns -1 when the line is
     * gone, and -1 is less than any loop position — so the original version
     * of this assertion passed with the word-picking DELETED. Found by
     * mutation ⇒ trap_mutation_harness_can_report_false_caught.
     */
    expect(decided, "the word is never picked at all").toBeGreaterThan(-1);
    expect(loop).toBeGreaterThan(-1);
    expect(decided, "the word is picked per attempt, so a retry changes the subject").toBeLessThan(loop);
  });

  /**
   * ⛔ An angle with nothing behind it is worse than a missing angle: the
   * rotation would land on it every fifth post and have nothing to write from.
   */
  it("drops an angle from the cycle when nothing is confirmed behind it", () => {
    /**
     * 🔴 THIS USED TO READ THE SOURCE for two specific `out.filter(...)`
     * calls, and it broke the moment those two checks were correctly
     * collapsed into one rule — while the behaviour was unchanged. ⛔ A test
     * that pins the SHAPE of an implementation fails on a refactor and passes
     * on a regression; the rule is what matters.
     *
     * ⚠️ `limits` is injected so both angles can be exercised. With nothing
     * confirmed in either table the real counts are 0, which is the "never
     * available" case — correct, but it cannot show the DIFFERENCE between
     * never-available and all-used.
     */
    const pools = ["privacy", "untranslatable", "built-wrong"];
    const nothingConfirmed = { untranslatable: 0, "built-wrong": 0 };
    expect(usablePools(pools, {}, nothingConfirmed)).toEqual(["privacy"]);

    // BOTH angles, not just the first — the one that was added second is the
    // one that gets forgotten ⇒ untranslatableWords.ts and productMistakes.ts.
    const oneEach = { untranslatable: 1, "built-wrong": 1 };
    expect(usablePools(pools, {}, oneEach)).toEqual(pools);
    expect(usablePools(pools, { untranslatable: 1 }, oneEach)).toEqual(["privacy", "built-wrong"]);
    expect(usablePools(pools, { "built-wrong": 1 }, oneEach)).toEqual(["privacy", "untranslatable"]);
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

/**
 * ⚠️ BEHAVIOUR, NOT SOURCE. The assertions above read the file; these run the
 * function, because "did it use the word" is the thing that actually has to
 * be true ⇒ trap_text_assertions_cannot_see_reachability.
 */
describe("using the word it was given", () => {
  const word = { word: "অভিমান", roman: "abhimaan" };

  it("accepts the word in its own script", () => {
    expect(bodyUsesWord("There is a Bengali word, অভিমান, for this.", word)).toBe(true);
  });

  it("accepts the romanisation, for readers who do not read the script", () => {
    expect(bodyUsesWord("There is a Bengali word — Abhimaan — for this.", word)).toBe(true);
  });

  it("⛔ refuses a post that is about something else entirely", () => {
    expect(
      bodyUsesWord("Some feelings are easier to say than to write. You can talk or type here.", word),
    ).toBe(false);
  });

  it("does not accept a near miss", () => {
    // ⚠️ A post about "abhiman" or "abhimana" is a post about a word nobody
    // confirmed, which is the whole failure this guards.
    expect(bodyUsesWord("The word abhiman means pride.", word)).toBe(false);
  });
});

describe("the pool cycle skips an angle with nothing behind it", () => {
  it("keeps the word angle only while a word is confirmed", () => {
    const pools = ["privacy", "untranslatable", "the-unsaid"];
    const usable = usablePools(pools);
    if (untranslatablePoolReady().ok) {
      expect(usable).toEqual(pools);
    } else {
      expect(usable).not.toContain("untranslatable");
      expect(usable).toEqual(["privacy", "the-unsaid"]);
    }
  });

  it("leaves every other pool alone", () => {
    expect(usablePools(["privacy", "the-unsaid"])).toEqual(["privacy", "the-unsaid"]);
  });
});
