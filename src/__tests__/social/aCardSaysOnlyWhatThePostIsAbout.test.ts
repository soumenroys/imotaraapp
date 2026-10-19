/**
 * ⛔ THE LINE ABOVE THE HEADLINE NAMES THE POST'S SUBJECT, OR SAYS NOTHING.
 *
 * 🔴 THE DEFECT. It was the literal string "22 languages", drawn whenever the
 * recipe rolled `stacked-label` or `caps-label` — one single card in three. A
 * post about a message typed and deleted carried a brand claim above it. The
 * CAROUSEL half of this was fixed on 19 Oct by making the eyebrow a counter;
 * the single-card half survived the same afternoon, because a counter is
 * meaningless on a card of one and the `: null` branch still reached the
 * constant. ⇒ A fix that addresses one branch is not a fix.
 *
 * 🔑 THE SAFETY PROPERTY THAT MATTERS MOST HERE: omission is now harmless.
 * Six paths draw a card for the same post. Before, a path that passed nothing
 * got a brand claim; now it gets no eyebrow. The worst outcome of forgetting
 * went from "the wrong words, confidently set" to "a plainer card".
 */

import { describe, it, expect } from "vitest";
import { TOPIC_POOLS, eyebrowFor } from "@/lib/social/topicPools";
import { composePicture, wordsInPicture } from "@/lib/social/compose";
import { recipeHash } from "@/lib/social/visualRecipe";
import { storyboard, finalFrame } from "@/lib/social/frames";

/** A recipe that DOES draw a label, so the eyebrow is actually reachable. */
const labelled = (over: Record<string, string> = {}) => {
  const base = {
    layout: "stacked-label",
    palette: "ink",
    typeTreatment: "display",
    motif: "arcs",
    script: "en",
    ...over,
  };
  return { ...base, hash: recipeHash(base as never) } as never;
};

const card = (over: Record<string, unknown> = {}) =>
  composePicture({
    recipe: labelled(),
    headline: "The message typed and deleted",
    language: "en",
    platform: "facebook",
    ...over,
  });

describe("the eyebrow comes from the post's own pool", () => {
  it("⛔ draws no label at all when nothing is passed", () => {
    /**
     * 🔴 THE REGRESSION. This exact call — a `stacked-label` recipe with no
     * eyebrow — used to render "22 languages" above a sentence about a
     * message typed and deleted.
     */
    const words = wordsInPicture(card());
    expect(words, "a brand claim came back").not.toContain("22 languages");
    for (const pool of TOPIC_POOLS) {
      expect(words, `the ${pool.id} eyebrow appeared unasked`).not.toContain(pool.eyebrow);
    }
  });

  it("draws the eyebrow it is given", () => {
    expect(wordsInPicture(card({ eyebrow: "Left unsaid" }))).toContain("Left unsaid");
  });

  it("⛔ says “22 languages” for exactly one pool", () => {
    // ⚠️ The claim is not banned — it is TRUE on a post about the languages.
    // It is banned from every other subject.
    const owners = TOPIC_POOLS.filter((p) => p.eyebrow === "22 languages").map((p) => p.id);
    expect(owners).toEqual(["languages"]);
  });

  it("every pool carries one, short, and not its admin label", () => {
    for (const pool of TOPIC_POOLS) {
      expect(pool.eyebrow, `${pool.id} has no eyebrow`).toBeTruthy();
      // ⚠️ An eyebrow is tracked and set small. Past ~22 characters it wraps
      // or collides with the rule beneath it — measured in a render.
      expect(pool.eyebrow.length, `${pool.id}'s eyebrow is ${pool.eyebrow.length} chars`).toBeLessThanOrEqual(22);
      /**
       * ⛔ NOT "THE EYEBROW DIFFERS FROM THE LABEL", which is what this first
       * asserted and was wrong about: `limits` is labelled "What it is not",
       * which is a perfectly good thing to print. The property is narrower.
       *
       * 🔑 `label` is written for the admin choosing a pool — "The ways one
       * feeling actually shows up (carousel)" — so it carries notes meant for
       * whoever runs the schedule. An eyebrow is read by a stranger above a
       * sentence, and the format name is not their business.
       */
      expect(pool.eyebrow, `${pool.id}'s eyebrow carries an aside`).not.toMatch(/[()]/);
      expect(pool.eyebrow.toLowerCase(), `${pool.id} names the format`).not.toMatch(
        /carousel|video|gif|graphic|slide/,
      );
    }
  });
});

describe("when there is nothing true to say, it says nothing", () => {
  it("refuses any language but English", () => {
    // 🔑 The eyebrows are English prose. On a Bengali or Spanish card they
    // would be the same defect in a new costume: the wrong words, set
    // confidently ⇒ feedback_check_a_dictionary_before_writing_another_language.
    expect(eyebrowFor("the-unsaid", "en")).toBe("Left unsaid");
    for (const lang of ["bn", "es", "hi", "fr", "ru", "zh", "ta"]) {
      expect(eyebrowFor("the-unsaid", lang), `${lang} got English furniture`).toBeNull();
    }
  });

  it("refuses a post with no pool, and a hand-written one", () => {
    expect(eyebrowFor(null, "en")).toBeNull();
    expect(eyebrowFor(undefined, "en")).toBeNull();
    expect(eyebrowFor("", "en")).toBeNull();
  });

  it("⛔ refuses a pool id it does not recognise, rather than guessing", () => {
    /**
     * 🔴 THE SAME TRAP AS A STORED LAYOUT NAME ⇒ RETIRED_LAYOUTS. `topic_pool`
     * is PERSISTED on the post and matched by name later, which makes it a
     * public identifier even though it looks internal. A pool renamed today
     * leaves rows pointing at the old id; those cards must lose an eyebrow,
     * never acquire the wrong one.
     */
    expect(eyebrowFor("retired-pool", "en")).toBeNull();
    expect(eyebrowFor("LANGUAGES", "en"), "matched case-insensitively").toBeNull();
  });

  it("resolves every live pool id", () => {
    for (const pool of TOPIC_POOLS) {
      expect(eyebrowFor(pool.id, "en"), `${pool.id} does not resolve`).toBe(pool.eyebrow);
    }
  });
});

describe("the counter still wins", () => {
  it("a carousel card numbers itself instead", () => {
    /**
     * ⚠️ A reader on card three wants to know how many swipes are left far
     * more than they want the subject named ⇒ the counter comment in compose.
     * ⛔ And both in that slot at once would collide.
     */
    const words = wordsInPicture(
      card({ eyebrow: "How it shows up", counter: { index: 3, total: 5 } }),
    );
    expect(words).toContain("3 / 5");
    expect(words).not.toContain("How it shows up");
  });
});

describe("a moving card carries it too", () => {
  it("the eyebrow survives into every frame of the storyboard", () => {
    /**
     * 🔑 WHY THIS IS NOT COVERED BY THE COMPOSER'S OWN TESTS. `storyboard`
     * spreads its input into `composePicture` once per scene. A field missing
     * from `FrameInput` compiles and is silently dropped — which is how the
     * video would have ended on a card the review screen never showed.
     */
    const board = storyboard({
      recipe: labelled(),
      headline: "The message typed and deleted",
      support: "One sentence. And then a second one.",
      language: "en",
      platform: "facebook",
      eyebrow: "Left unsaid",
    });
    expect(wordsInPicture({ root: finalFrame(board) } as never)).toContain("Left unsaid");
  });
});
