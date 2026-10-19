/**
 * 🔴 THE QUIET FAILURE THIS PREVENTS.
 *
 * `buildPicture` returns no picture when the opening sentence is too long to
 * set as a headline. That is deliberate — half a thought on a card reads
 * worse than no card — and on Facebook the words still go out.
 *
 * ⛔ Instagram has no text-only post. Saving such a post would queue something
 * the publisher must hold on EVERY RUN FOREVER, and the only symptom would be
 * Instagram going quiet: indistinguishable from a channel nobody scheduled
 * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLATFORMS, platformSpec } from "@/lib/social/platforms";
import { instagramCardPlan } from "@/lib/social/instagramCardPlan";

const POST_ID = "b1b9f1f6-0000-4000-8000-000000000001";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const pipeline = read("src/lib/social/pipeline.ts");
/** ⚠️ Comments stripped: a test that reads the prose explaining a rule passes
 *  just as happily when the rule itself is gone. */
const code = pipeline.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const writer = read("src/lib/social/writer.ts");
const recipe = read("src/lib/social/visualRecipe.ts");
const publisher = read("src/app/api/cron/social-publish/route.ts")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("which channels cannot take a post without a picture", () => {
  it("Instagram does, and it is the only one", () => {
    expect(platformSpec("instagram").requiresPicture).toBe(true);
    for (const spec of Object.values(PLATFORMS)) {
      if (spec.id === "instagram") continue;
      expect(spec.requiresPicture, `${spec.id} should still allow a text post`).toBe(false);
    }
  });

  it("is a property of the channel, not a string compared somewhere", () => {
    /**
     * ⛔ The thing this guards: `platform === "instagram"` written inline.
     * The next channel with the same rule — a Reel, a Short — would be added
     * by somebody who never finds that line.
     */
    expect(code).toContain("requiresPicture");
    expect(code).not.toMatch(/args\.platform\s*===\s*["']instagram["']/);
  });
});

describe("a long opening is a bad DRAFT, not a dead channel", () => {
  it("the generated path rejects the draft and writes another", () => {
    /**
     * 🔴 MY FIRST VERSION REFUSED OUTRIGHT, AND THE FIRST REAL INSTAGRAM
     * DRAFT FAILED EXACTLY THIS WAY. A channel that gives up whenever one
     * sentence runs long is a channel that never posts — which is the same
     * silence the rule was written to prevent.
     *
     * ⚠️ So it behaves like every other objection in the loop: the draft is
     * rejected with a reason, the model is told, and it tries again. Only
     * when every attempt fails is it a refusal, and the exhaustion message
     * already says that is a signal about the brief.
     */
    const guard = code.indexOf("requiresPicture && !picture");
    expect(guard).toBeGreaterThan(-1);
    const block = code.slice(guard, guard + 600);
    expect(block).toContain("rejected.push");
    expect(block).toContain("objections.push");
    expect(block).toContain("continue;");
    // ⛔ And it does NOT bail out of the whole run on one bad draft.
    expect(block.slice(0, block.indexOf("continue;"))).not.toContain("return {");
  });

  it("the check runs before the post is saved", () => {
    // ⚠️ Order, not presence. A post saved first and refused later is a row
    // that sits in the queue forever.
    const guard = code.indexOf("requiresPicture && !picture");
    const save = code.indexOf("mediaKind: mediaKindFor");
    expect(save).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(save);
  });

  it("the reason names the channel and what to do about it", () => {
    const guard = code.indexOf("requiresPicture && !picture");
    const block = code.slice(guard, guard + 600);
    expect(block).toContain("no text-only post");
    // ▶️ The actionable half: it is the FIRST SENTENCE that has to be short.
    expect(block).toContain("first sentence");
  });
});

describe("the writer is told the limit before it drafts", () => {
  it("a picture-only channel gets the headline length in its prompt", () => {
    /**
     * 🔑 THE REAL FIX IS UPSTREAM. Retrying handles a bad draft; telling the
     * writer the constraint stops most of them being written.
     */
    expect(writer).toContain("spec.requiresPicture");
    expect(writer).toContain("HEADLINE_MAX");
    expect(writer).toContain("NO TEXT-ONLY POST");
  });

  it("the prompt and the check read the SAME number", () => {
    /**
     * ⛔ A limit written twice is a limit that drifts — and the drift would be
     * invisible: posts would simply start failing to make cards, with the
     * instruction still claiming a different number.
     */
    expect(recipe).toContain("export const HEADLINE_MAX");
    expect(recipe).not.toMatch(/maxChars = 64/);
    expect(writer).not.toMatch(/at most 64 characters/);
  });
});

describe("both ways in, not just the generated one", () => {
  it("the hand-written path refuses too", () => {
    /**
     * 🔴 I SHIPPED THIS GUARD ON ONE PATH. `prepareGenerated` had it and
     * `prepareWritten` did not, so a post typed into the composer would still
     * have been saved cardless ⇒ trap_crisis_card_two_detectors_two_platforms,
     * where a protection reached one platform and not the other.
     */
    const guards = code.match(/requiresPicture && !picture/g) ?? [];
    expect(guards.length).toBe(2);
    // ⚠️ One on each side of the file's two entry points, not two in the same
    // function — pinned by position rather than by count alone.
    const written = code.indexOf("origin: \"written\"");
    const second = code.lastIndexOf("requiresPicture && !picture");
    expect(second).toBeLessThan(written);
    expect(second).toBeGreaterThan(code.indexOf("requiresPicture && !picture"));
  });
});

describe("the publisher still refuses too, because both can be reached", () => {
  it("holds an Instagram post that somehow arrives without a card", () => {
    /**
     * 🔑 BELT AND BRACES ON PURPOSE. A post can reach the publisher without
     * passing through today's generator — written by hand in the composer, or
     * queued before this rule existed ⇒ trap_a_frozen_decision_outlives_its_rule,
     * where six already-queued posts stayed cardless after the rule was fixed
     * and the first public post went out as text.
     */
    /**
     * 🔴 THIS USED TO READ THE ROUTE'S SOURCE for the string
     * `post.media_kind !== "graphic"`, and it broke the moment that decision
     * moved into a module where it could be CALLED — which is the whole
     * problem with testing a rule by looking for it. ⛔ A text assertion
     * cannot see whether the rule still runs.
     *
     * ⚠️ So the rule is exercised, and the route is only asked to still
     * consult it.
     */
    const out = instagramCardPlan({ id: POST_ID, subject: "A subject", media_kind: null }, "https://x.test");
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.hint).toContain("Nothing was published");

    expect(publisher).toContain("instagramCardPlan(");
    // ⛔ And it acts on the refusal before anything is published: the `continue`
    // comes between the plan and the publish call.
    const at = publisher.indexOf("instagramCardPlan(");
    const toPublish = publisher.slice(at, publisher.indexOf("publishToInstagram", at));
    expect(toPublish).toContain("continue;");
  });
});
