/**
 * ⛔ A VIDEO POST CARRIES THE SAME PICTURE AS THE STILL.
 *
 * 🔴 THE DEFECT THIS PINS, found 21 Oct by grabbing the last frame of a queued
 * video. When every queued post gained a background on 20 Oct, the stills drew
 * it and the videos did not: both video callers selected a column list without
 * `illustration`, and the storyboard had no field to carry it. Every video kept
 * the bare palette card while its background.jpg sat beside it in the bucket.
 *
 * ⚠️ THREE LINKS, AND EACH ONE WAS MISSING. The storyboard must pass the
 * picture to every frame; the picture must never be hidden by the build (the
 * poster is frame 0); and both callers must read the column.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storyboard } from "@/lib/social/frames";
import type { Node } from "@/lib/social/compose";
import { recipeHash } from "@/lib/social/visualRecipe";

const SRC = "data:image/jpeg;base64,BACKGROUND";

const recipe = () => {
  const base = { layout: "rule-over", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en" };
  return { ...base, hash: recipeHash(base as never) } as never;
};

const input = (over: Record<string, unknown> = {}) => ({
  recipe: recipe(),
  headline: "A friend for the hours you can't name",
  support: "You can talk to Imotara when there is nobody else to listen. It stays with you.",
  language: "en",
  platform: "youtube",
  ...over,
});

/** The background <img>, if the frame has one, and whether anything hides it. */
function background(frame: Node): { found: boolean; hidden: boolean } {
  let found = false;
  let hidden = false;
  const walk = (n: Node, underHidden: boolean) => {
    const here = underHidden || n.style?.opacity === 0;
    if (n.tag === "img" && n.src === SRC) {
      found = true;
      hidden = here;
    }
    n.children?.forEach((c) => walk(c, here));
  };
  walk(frame, false);
  return { found, hidden };
}

describe("the video carries the picture", () => {
  it("every frame, the poster included, shows the background", () => {
    const board = storyboard(input({ illustration: { src: SRC, ink: "light", scrim: 0.3, zone: "top" } }));
    expect(board.frames.length).toBeGreaterThan(1);
    for (const [i, frame] of board.frames.entries()) {
      const bg = background(frame);
      expect(bg.found, `frame ${i} has no background`).toBe(true);
      expect(bg.hidden, `frame ${i} hides the background`).toBe(false);
    }
  });

  it("a post without a picture still renders today's card", () => {
    const board = storyboard(input());
    for (const frame of board.frames) expect(background(frame).found).toBe(false);
  });
});

describe("both video callers read the picture from the row", () => {
  // ⚠️ Source-level, because the defect was a SELECT list: the type system saw
  // a field that was simply never fetched.
  for (const file of ["src/lib/social/ensureCard.ts", "src/app/api/admin/social/animation/[id]/route.ts"]) {
    it(file, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).toMatch(/media_kind, visual_recipe, topic_pool, illustration"/);
      expect(src).toMatch(/illustration: post\.illustration as PictureSource\["illustration"\]/);
    });
  }
});
