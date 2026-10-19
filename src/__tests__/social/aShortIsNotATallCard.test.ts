/**
 * ⛔ A 9:16 FRAME HAS SOMEBODY ELSE'S INTERFACE DRAWN ON IT.
 *
 * 🔴 TWO THINGS FOUND ON 19 Oct, BOTH BY LOOKING AT A RENDER.
 *
 * 1. YouTube's card was sized 1280×720 — "the community-post and thumbnail
 *    ratio" — and the YouTube Data API HAS NO ENDPOINT FOR CREATING COMMUNITY
 *    POSTS. The channel was configured, and carried on the board for weeks,
 *    for a format no code could ever reach. ⇒ What the API CAN do is upload a
 *    video, and this product now makes narrated ones, so the path is SHORTS.
 *
 * 2. A Short is shown with YouTube's own chrome OVER the video: the channel
 *    handle and description along the bottom, the like/comment/share buttons
 *    up the right. The wordmark at the foot of the frame was not at the foot
 *    of the frame — it was underneath a row of buttons. ⚠️ Every check passed.
 *    The card was correct and partly invisible.
 */

import { describe, it, expect } from "vitest";
import { composePicture, type Node } from "@/lib/social/compose";
import { PLATFORMS, PLATFORM_IDS } from "@/lib/social/platforms";
import { recipeHash } from "@/lib/social/visualRecipe";

const card = (platform: string) => {
  const base = { layout: "rule-over", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en" };
  return composePicture({
    recipe: { ...base, hash: recipeHash(base as never) } as never,
    headline: "Awake at an hour with no queue",
    support: "It will not call itself therapy.",
    language: "en",
    platform,
  });
};

/** The padding the laid-out column uses, in pixels. */
function paddingOf(root: Node): { top: number; bottom: number; base: number } {
  const px = (v: unknown) => Number(String(v ?? "0").replace("px", ""));
  let found: Record<string, unknown> | null = null;
  const walk = (n: Node) => {
    if (!found && n.style?.padding !== undefined && n.style?.flexDirection === "column") {
      found = n.style as Record<string, unknown>;
    }
    n.children?.forEach(walk);
  };
  walk(root);
  if (!found) throw new Error("no padded column found — the layout has changed shape");
  const f = found as Record<string, unknown>;
  const base = px(f.padding);
  return { top: px(f.paddingTop ?? f.padding), bottom: px(f.paddingBottom ?? f.padding), base };
}

describe("the Shorts frame", () => {
  it("🔴 YouTube is PORTRAIT, not the thumbnail ratio it was", () => {
    /**
     * ⛔ Pinned as a RATIO, not as pixels. 9:16 is what YouTube requires;
     * 1080×1920 is merely one size that satisfies it, and pinning the pixels
     * would fail on a perfectly good 720×1280.
     */
    const { width, height } = PLATFORMS.youtube.picture;
    expect(width / height).toBeCloseTo(9 / 16, 2);
    expect(PLATFORMS.youtube.label, "still named for the impossible format").not.toMatch(/community/i);
  });

  it("🔴 the wordmark clears the strip YouTube draws its own UI on", () => {
    /**
     * ⚠️ The channel handle and description sit along the bottom of a Short.
     * A footer inside that strip is not a footer, it is a collision.
     */
    const pic = card("youtube");
    const { bottom } = paddingOf(pic.root);
    expect(bottom / pic.height, "the footer sits under YouTube's own chrome").toBeGreaterThanOrEqual(0.14);
  });

  it("⛔ and no OTHER channel's padding changed", () => {
    /**
     * 🔑 THE REGRESSION HALF. A safe area added for one shape must not quietly
     * reflow the four cards that were already right — this project has
     * published a layout change it did not intend before.
     */
    for (const id of PLATFORM_IDS) {
      if (id === "youtube") continue;
      const pic = card(id);
      const { top, bottom, base } = paddingOf(pic.root);
      expect(top, `${id}'s top padding moved`).toBe(base);
      expect(bottom, `${id}'s bottom padding moved`).toBe(base);
    }
  });

  it("⚠️ the safe area follows the SHAPE, not the channel's name", () => {
    // 🔑 So a second portrait channel gets it without anybody remembering to
    // add it — and so YouTube loses it if it ever stops being portrait.
    for (const id of PLATFORM_IDS) {
      const { width, height } = PLATFORMS[id].picture;
      const isTall = width / height < 0.8;
      const pic = card(id);
      const { bottom, base } = paddingOf(pic.root);
      expect(bottom > base, `${id} (${width}x${height}) has the wrong safe area`).toBe(isTall);
    }
  });
});
