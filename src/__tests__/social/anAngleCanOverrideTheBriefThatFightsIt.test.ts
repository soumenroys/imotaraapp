/**
 * ⛔ A BRIEF CAN OVERRIDE AN ANGLE'S SHAPE, AND DID — EVERY TIME.
 *
 * 🔴 THE MEASUREMENT THIS IS BUILT ON, four previews per combination:
 *
 *     ways-of-saying @ the live brief   → 3/3 product-shaped, NO list
 *     ways-of-saying @ a neutral brief  → 2/2 genuine five-item lists
 *
 * ⚠️ The live brief asks for "one capability of Imotara and what it is for".
 * Most pools are supposed to answer that. A list of five ways a feeling shows
 * up CANNOT, and loses — reliably, not occasionally. ⇒ The angle that needs a
 * different instruction carries it, rather than needing a whole second
 * schedule, which on a channel meant to post once a day would mean two.
 *
 * 🔑 AND THE SHAPE TRAVELS WITH IT. A list of five recognitions is a carousel
 * or it is six lines of small type.
 */

import { describe, it, expect } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { TOPIC_POOLS } from "@/lib/social/topicPools";
import { usablePools } from "@/lib/social/pipeline";

const waysOfSaying = () => TOPIC_POOLS.find((p) => p.id === "ways-of-saying")!;

describe("the angle that carries its own brief", () => {
  it("🔴 has one at all — without it the measurement above repeats", () => {
    expect(waysOfSaying().brief, "ways-of-saying has no brief of its own").toBeTruthy();
  });

  it("⛔ and that brief does NOT ask for a capability or name the product", () => {
    /**
     * 🔑 THIS IS THE ENTIRE DIFFERENCE between the 3/3 failure and the 2/2
     * success. A brief that mentions the product gets a post about the
     * product, whatever the angle says.
     */
    const brief = waysOfSaying().brief!.toLowerCase();
    expect(brief, "the brief names the product").not.toMatch(/imotara/);
    expect(brief, "the brief asks for a capability").not.toMatch(/capability|feature|what it is for/);
    // ⚠️ And it says what it DOES want, not only what it does not.
    expect(brief).toMatch(/recognis/);
  });

  it("forces the shape, because for this angle the form is the point", () => {
    expect(waysOfSaying().shape).toBe("carousel");
  });

  it("⚠️ every OTHER pool still inherits the schedule's brief", () => {
    /**
     * ⛔ An override on every angle would make the schedule's brief dead
     * letter, and the product pools — privacy, voice, offline, languages —
     * are SUPPOSED to answer it.
     */
    const overridden = TOPIC_POOLS.filter((p) => p.brief).map((p) => p.id);
    expect(overridden).toEqual(["ways-of-saying"]);
  });
});

describe("an angle whose shape a channel cannot carry stands down", () => {
  const POOLS = ["privacy", "ways-of-saying", "quiet-hours"];

  it("🔴 ways-of-saying is dropped on Facebook, not posted in the wrong form", () => {
    /**
     * ⛔ Facebook takes multi-photo posts by a route nothing has been built
     * for ⇒ mediaPlan.ts. Degrading the carousel to a single card would
     * publish six lines of small type and call it a post.
     */
    expect(usablePools(POOLS, {}, {}, "facebook")).not.toContain("ways-of-saying");
    expect(usablePools(POOLS, {}, {}, "facebook")).toContain("privacy");
  });

  it("and kept on Instagram, which can", () => {
    expect(usablePools(POOLS, {}, {}, "instagram")).toContain("ways-of-saying");
  });

  it("⚠️ omitting the channel drops nothing, so every old caller is unchanged", () => {
    // 🔑 The parameter is optional precisely so adding it could not quietly
    // narrow a rotation somewhere else.
    expect(usablePools(POOLS, {}, {})).toContain("ways-of-saying");
  });

  it("⛔ shape is checked BEFORE material, so an unpublishable angle never appears", () => {
    // ⚠️ Otherwise an angle with material left would pass the one gate that
    // ran and reach a channel that cannot publish it.
    expect(usablePools(["ways-of-saying"], { "ways-of-saying": 0 }, {}, "facebook")).toEqual([]);
  });
});

/**
 * ⛔ AND THE PIPELINE ACTUALLY USES BOTH.
 *
 * 🔴 THIS TRAP HAS FIRED THREE TIMES IN ONE DAY: the content-mix rotation
 * passed twelve unit tests and all 3,826 while the pipeline ignored it; the
 * dials were read and never sent to the model; the support line was accepted
 * by the composer and passed by nobody
 * ⇒ trap_text_assertions_cannot_see_reachability.
 *
 * ⚠️ AND THE SAME SHAPE AGAIN, caught by reading the DATABASE rather than the
 * code: `ways-of-saying` was in no schedule's pool at all, so every line above
 * would have been correct and unreachable.
 */
describe("⛔ and the pipeline honours the angle", () => {
  const CLEAN =
    "You reread the same message four times. You tidy a drawer that was already tidy. " +
    "You say yes to a thing you have no room for.";

  const deps = (seen: { brief?: string }) => ({
    recentSubjects: async () => [],
    poolUsage: async () => ({}),
    measuredPosts: async () => [],
    usedRecipeHashes: async () => new Set<string>(),
    recentPalettes: async () => [],
    recentLayouts: async () => [],
    overlay: async () => ({}),
    write: async (req: { brief: string }) => {
      seen.brief = req.brief;
      return {
        subject: "The ways restlessness shows up",
        body: CLEAN,
        support: "Not one of these is a problem to fix.",
        slides: [
          "You reread the same message four times.",
          "You tidy a drawer that was already tidy.",
          "You say yes to a thing you have no room for.",
        ],
      };
    },
    rng: () => 0.42,
  });

  const schedule = (pools: string[]) => ({
    id: "sched-ig",
    name: "One thing it does",
    brief: "Take one capability of Imotara and say what it is for, plainly.",
    platforms: ["instagram"],
    contentType: "text_graphic",
    contentMix: ["text_graphic", "short_video"],
    topicPool: pools,
    tone: "gentle_plain",
    lengthHint: "short",
    languages: ["en"],
    autoPublish: false,
  });

  it("🔴 the WRITER receives the angle's brief, not the schedule's", async () => {
    const { prepareGenerated } = await import("@/lib/social/pipeline");
    const seen: { brief?: string } = {};
    const r = await prepareGenerated(deps(seen) as never, {
      schedule: schedule(["ways-of-saying"]) as never,
      platform: "instagram",
      language: "en",
      postsSoFar: 0,
    });
    expect(r.ok).toBe(true);
    expect(seen.brief, "the writer was given no brief at all").toBeTruthy();
    expect(seen.brief, "the schedule's capability brief reached the writer").not.toMatch(/capability/i);
    expect(seen.brief).toMatch(/recognis/i);
  });

  it("🔴 the angle's shape BEATS the content mix", async () => {
    /**
     * ⛔ `postsSoFar: 0` would otherwise give `text_graphic` from the mix.
     * For this angle the form is the point, so the angle wins.
     */
    const { prepareGenerated } = await import("@/lib/social/pipeline");
    const r = await prepareGenerated(deps({}) as never, {
      schedule: schedule(["ways-of-saying"]) as never,
      platform: "instagram",
      language: "en",
      postsSoFar: 0,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.post.mediaKind).toBe("carousel");
  });

  it("⚠️ an ordinary angle still gets the schedule's brief and the mix's shape", async () => {
    // 🔑 The regression half: the override must not leak onto every post.
    const { prepareGenerated } = await import("@/lib/social/pipeline");
    const seen: { brief?: string } = {};
    const r = await prepareGenerated(deps(seen) as never, {
      schedule: schedule(["privacy"]) as never,
      platform: "instagram",
      language: "en",
      postsSoFar: 0,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(seen.brief).toMatch(/capability/i);
    expect(r.post.mediaKind).toBe("graphic");
  });
});

/**
 * 🔴 CAROUSEL WAS IMPOSSIBLE, AND HAD BEEN SINCE IT WAS ADDED.
 *
 * `wantsPicture` listed graphic, text_graphic, animated_gif and short_video —
 * and not carousel. Without a picture `mediaKindFor` returns "none", and
 * Instagram has no text-only post, so every carousel draft was refused with
 * "this draft made no card". The shape sat on the schedule form, selectable,
 * and could never once have produced a post.
 *
 * ⚠️ FOUND BY RUNNING THE PIPELINE, not by reading it — three unit tests of
 * the override were green while this made the whole thing unreachable. And
 * the knowledge was one function away: the comment on `mediaKindFor` says in
 * so many words that "a carousel still needs the picture machinery".
 */
describe("⛔ every shape that needs a picture asks for one", () => {
  it("🔴 carousel wants a picture — the omission that made it impossible", async () => {
    const { wantsPicture } = await import("@/lib/social/pipeline");
    expect(wantsPicture("carousel")).toBe(true);
  });

  it("every shape that IS a media kind asks for a picture", async () => {
    /**
     * 🔑 THE GENERAL RULE, so the next shape added cannot repeat this.
     *
     * 🔴 MY FIRST VERSION OF THIS WAS WRONG and worth recording. It compared
     * `wantsPicture(shape)` to `mediaKindFor(shape, true) !== "none"` — but
     * `mediaKindFor` falls through to "graphic" for anything it does not
     * name, so it reports "graphic" for `text` with a picture: a situation
     * that cannot occur, because a text post never has one. The test failed
     * on a case the system cannot reach.
     *
     * ⚠️ AND IT WOULD NOT HAVE CAUGHT THE BUG EITHER. With carousel missing
     * from `wantsPicture`, `mediaKindFor(carousel, false)` is "none" and the
     * two agree — consistently wrong.
     *
     * ⇒ The rule that holds: a shape whose own kind is not "none" NEEDS a
     * picture ⇒ kindOfShape. That is true of carousel whether or not
     * `wantsPicture` has heard of it, so the disagreement shows.
     */
    const { wantsPicture } = await import("@/lib/social/pipeline");
    const { kindOfShape } = await import("@/lib/social/contentMix");
    const { CONTENT_TYPES } = await import("@/lib/social/contentTypes");
    for (const shape of CONTENT_TYPES) {
      expect(
        wantsPicture(shape),
        `${shape} is the media kind "${kindOfShape(shape)}" but never asks for a picture`,
      ).toBe(kindOfShape(shape) !== "none");
    }
  });

  it("⚠️ and a text post still wants nothing", async () => {
    const { wantsPicture } = await import("@/lib/social/pipeline");
    expect(wantsPicture("text")).toBe(false);
  });
});
