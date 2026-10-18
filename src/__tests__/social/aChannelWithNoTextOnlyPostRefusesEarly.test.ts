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

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const pipeline = read("src/lib/social/pipeline.ts");
/** ⚠️ Comments stripped: a test that reads the prose explaining a rule passes
 *  just as happily when the rule itself is gone. */
const code = pipeline.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

describe("the refusal happens at generation, not at publish time", () => {
  it("refuses before the post is saved", () => {
    /**
     * ⚠️ ORDER, and it is the whole point. A post saved first and refused
     * later is a row that sits in the queue forever.
     */
    const guard = code.indexOf("requiresPicture");
    const save = code.indexOf("mediaKind: mediaKindFor");
    expect(guard).toBeGreaterThan(-1);
    expect(save).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(save);
  });

  it("the refusal is a refusal, with the drafts kept", () => {
    const block = code.slice(code.indexOf("requiresPicture"));
    const first = block.slice(0, block.indexOf("};") + 2);
    expect(first).toContain("ok: false");
    // ⚠️ The words passed the gate; the card is what failed. Dropping the
    // drafts would hide the only thing worth reading in the report.
    expect(first).toContain("rejected");
  });

  it("says which channel and why, not just that something went wrong", () => {
    const block = code.slice(code.indexOf("requiresPicture"));
    const first = block.slice(0, block.indexOf("};") + 2);
    expect(first).toContain("no text-only post");
    expect(first).toContain("Nothing was queued");
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
    expect(publisher).toContain('post.media_kind !== "graphic"');
    const block = publisher.slice(publisher.indexOf('post.media_kind !== "graphic"'));
    expect(block.slice(0, block.indexOf("continue;"))).toContain("Nothing was published");
  });
});
