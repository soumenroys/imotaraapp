/**
 * 🔴 THE HOLE, FOUND 19 Oct BY TRACING WHAT WOULD HAPPEN RATHER THAN BY
 * ASSUMING IT WORKED.
 *
 * The owner asked how to switch on the motion formats. `short_video` and
 * `animated_gif` are offered by the schedule form, encoded by animate.ts and
 * previewable in the admin — so the obvious answer was "pick the shape". I
 * traced the publisher first, and the obvious answer was wrong in two
 * different ways:
 *
 *   · INSTAGRAM would have held every such post on every run forever, which
 *     looks exactly like a channel nobody scheduled
 *     ⇒ trap_a_dead_cron_fails_where_nobody_is_watching;
 *   · FACEBOOK would have published it AS BARE TEXT. The picture was rendered
 *     only `if (media_kind === "graphic")`, so every other kind fell through
 *     with no media and no complaint — the video the post was written around
 *     simply absent, under the brand's name, with nothing logged.
 *
 * ⛔ A FEATURE HALF-BUILT IS FINE. ONE THAT FAILS OPEN IS NOT. That is the
 * whole finding of ux_degradation_audit, three times over.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { mediaPlan } from "@/lib/social/mediaPlan";
import { CONTENT_TYPES } from "@/lib/social/contentTypes";
import { mediaKindFor } from "@/lib/social/pipeline";

const publisher = readFileSync(join(process.cwd(), "src/app/api/cron/social-publish/route.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("a post is never published without what it was written around", () => {
  /**
   * ⚠️ THESE TWO ASSERTED THE OPPOSITE UNTIL 19 Oct, AND WERE RIGHT TO.
   * Video was held on every channel because no adapter called any platform.
   * Both halves now exist on Meta — the call AND the stored bytes for Meta to
   * fetch ⇒ publishVideoToFacebook, publishReelToInstagram,
   * /api/social/video/[id]. ⛔ The rule did not soften; the code caught up.
   */
  it("a short video can publish where BOTH halves exist", () => {
    expect(mediaPlan("facebook", "short_video").ok).toBe(true);
    expect(mediaPlan("instagram", "short_video").ok).toBe(true);
  });

  it("⛔ and is still HELD where no adapter calls the platform", () => {
    /**
     * 🔑 THE LIST MATCHES THE CODE, NOT THE PLATFORM. LinkedIn and X both
     * take video perfectly well; nothing here has ever called them for it.
     * A list that matched their capabilities would wave a post through to a
     * path that does not exist — which is exactly how Facebook came to be
     * able to publish a video post as bare text.
     */
    for (const platform of ["linkedin", "x"]) {
      const r = mediaPlan(platform, "short_video");
      expect(r.ok, platform).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.why).toMatch(/nothing here can publish one yet/i);
      // ⚠️ And it says what to DO, not just that it refused.
      expect(r.why).toMatch(/▶️/);
    }
  });

  it("an animated GIF follows the same split", () => {
    for (const platform of ["facebook", "instagram"]) {
      expect(mediaPlan(platform, "animated_gif").ok, platform).toBe(true);
    }
    for (const platform of ["linkedin", "x"]) {
      expect(mediaPlan(platform, "animated_gif").ok, platform).toBe(false);
    }
  });

  it("the shapes that DO work still work", () => {
    expect(mediaPlan("facebook", "graphic").ok).toBe(true);
    expect(mediaPlan("facebook", "none").ok).toBe(true);
    expect(mediaPlan("instagram", "graphic").ok).toBe(true);
    expect(mediaPlan("instagram", "carousel").ok).toBe(true);
  });

  it("⛔ and Instagram still has no text-only post", () => {
    // 🔑 The rule that predates all of this, and must survive it.
    expect(mediaPlan("instagram", "none").ok).toBe(false);
    expect(mediaPlan("instagram", null).ok).toBe(false);
  });

  it("a carousel is refused on Facebook, with the reason", () => {
    const r = mediaPlan("facebook", "carousel");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.why).toMatch(/only Instagram/i);
  });

  it("⛔ an unknown channel is refused, not waved through", () => {
    // ⚠️ `?? true` on a lookup is how a new channel publishes nothing and
    // reports success ⇒ trap_a_null_lookup_makes_every_caller_invent_a_fallback.
    expect(mediaPlan("threads", "graphic").ok).toBe(false);
    expect(mediaPlan("youtube", "graphic").ok).toBe(false);
  });
});

describe("every shape a schedule can be set to has a verdict", () => {
  it("⛔ no content type reaches the publisher without one", () => {
    /**
     * 🔴 THE REAL DEFECT WAS A MISSING CASE, not a wrong one. Any kind the
     * `if` did not name fell through to "publish whatever we have" — so this
     * walks the ACTUAL list of shapes rather than the ones I remembered.
     */
    for (const contentType of CONTENT_TYPES) {
      const kind = mediaKindFor(contentType, true);
      for (const platform of ["facebook", "instagram"]) {
        const r = mediaPlan(platform, kind);
        // Either it can publish, or it says why. Never silence.
        if (!r.ok) expect(r.why.length, `${platform}/${contentType}`).toBeGreaterThan(20);
      }
    }
  });
});

describe("the publisher asks before it does anything", () => {
  it("⛔ the check runs BEFORE either channel's branch", () => {
    /**
     * 🔑 ONE QUESTION, BOTH BRANCHES. Instagram already refused anything
     * without a card and Facebook did not — two places answering "can this
     * publish?" is how they came to disagree.
     */
    const check = publisher.indexOf("mediaPlan(platform");
    const instagram = publisher.indexOf('platform === "instagram"');
    const facebook = publisher.indexOf("publishToFacebook(");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(instagram);
    expect(check).toBeLessThan(facebook);
  });

  it("and holds the post rather than marking it failed forever", () => {
    // ⚠️ `approved`, so a fix to the publisher lets it go out next run —
    // the post itself was never the problem.
    const at = publisher.indexOf("mediaPlan(platform");
    const block = publisher.slice(at, at + 700);
    // ⚠️ 24 Oct: via release(), which keeps it 'approved' until its attempts are spent,
    // then 'failed' with the reason — never 'approved' for ever.
    expect(block).toContain("release(post,");
    expect(publisher).toMatch(/status: spent \? "failed" : "approved"/);
    expect(block).toContain("continue;");
  });
});
