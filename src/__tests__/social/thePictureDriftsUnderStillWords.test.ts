/**
 * 🔑 THE PICTURE DRIFTS; THE WORDS DO NOT.
 *
 * The owner asked for "movement, colours, non-monotonous posts". The frames
 * file refuses anything that demands attention — no shake, no flash, no zoom —
 * so the movement is a slow pan of the background under words that stay
 * exactly where they are.
 *
 * ⚠️ THREE THINGS PINNED: the words layer really drops the picture and the
 * ground (and nothing else); the direction is deterministic from the recipe so
 * a re-render moves like the approved one; and the filter graph uses only what
 * production's 2018 ffmpeg has ⇒ trap_production_ffmpeg_is_older_than_local.
 */

import { describe, it, expect } from "vitest";
import { storyboard, wordsLayer, driftFor, DRIFTS } from "@/lib/social/frames";
import { videoGraph, DRIFT_MARGIN } from "@/lib/social/animate";
import { wordsInPicture, type Node } from "@/lib/social/compose";
import { recipeHash } from "@/lib/social/visualRecipe";

const SRC = "data:image/jpeg;base64,BACKGROUND";

const board = () => {
  const base = { layout: "rule-over", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en" };
  return storyboard({
    recipe: { ...base, hash: recipeHash(base as never) } as never,
    headline: "A friend for the hours you can't name",
    support: "You can talk to Imotara when there is nobody else to listen. It stays with you.",
    language: "en",
    platform: "youtube",
    illustration: { src: SRC, ink: "light", scrim: 0.3, zone: "top" },
  });
};

const hasImg = (n: Node, src: string): boolean =>
  (n.tag === "img" && n.src === src) || (n.children ?? []).some((c) => hasImg(c, src));

describe("the words layer", () => {
  it("drops the picture and the ground, on every frame", () => {
    for (const frame of board().frames) {
      const layer = wordsLayer(frame, SRC);
      expect(layer).not.toBeNull();
      expect(hasImg(layer!, SRC), "the picture is still in the words layer").toBe(false);
      expect(Object.keys(layer!.style).filter((k) => k.startsWith("background"))).toEqual([]);
    }
  });

  it("⛔ keeps every word the frame shows", () => {
    for (const frame of board().frames) {
      const before = wordsInPicture({ root: frame } as never);
      const after = wordsInPicture({ root: wordsLayer(frame, SRC)! } as never);
      expect(after).toEqual(before);
    }
  });

  it("⚠️ returns null when the picture is not there, so the caller draws whole frames", () => {
    expect(wordsLayer(board().frames[0], "data:image/jpeg;base64,OTHER")).toBeNull();
  });
});

describe("the direction", () => {
  it("is the same for the same recipe — a re-render moves like the approved one", () => {
    expect(driftFor("abc123")).toEqual(driftFor("abc123"));
  });

  it("varies across recipes, so the feed does not move one way every day", () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(driftFor(`hash-${i}`))));
    expect(seen.size).toBeGreaterThan(3);
  });

  it("⛔ is always a pan — never still on both axes", () => {
    for (const d of DRIFTS) expect(Math.abs(d.dx) + Math.abs(d.dy)).toBeGreaterThan(0);
  });
});

describe("the filter graph", () => {
  const g = videoGraph({ width: 1080, height: 1920, seconds: 11.25, background: { index: 1, drift: { dx: -1, dy: 0 } } });

  it("lays the moving picture under the words and labels the result [v]", () => {
    expect(g).toMatch(/^\[1:v\]scale=/);
    expect(g).toMatch(/\[bg\]\[0:v\]overlay=0:0:shortest=1,/);
    expect(g).toMatch(/\[v\]$/);
  });

  it("⛔ uses only filters production's 2018 ffmpeg has", () => {
    const filters = g.split(/[;,]/).map((s) => s.replace(/\[[^\]]*\]/g, "").split("=")[0]).filter((f) => /^[a-z]+$/.test(f));
    const ALLOWED = new Set(["scale", "crop", "overlay", "fps", "format"]);
    for (const f of filters) expect(ALLOWED.has(f), `filter "${f}" is not on the 2018-safe list`).toBe(true);
    expect(g).not.toMatch(/zoompan|normalize|scale2ref|xfade/);
  });

  it("⚠️ quotes the expressions, whose min(a,b) carries a comma", () => {
    expect(g).toMatch(/x='[^']*min\(t\/11\.250,1\)[^']*'/);
  });

  it("draws the picture only the margin larger — the pan's whole room", () => {
    const w = Math.round((1080 * (1 + DRIFT_MARGIN)) / 2) * 2;
    expect(g).toContain(`scale=${w}:`);
  });

  it("without a picture, is today's chain exactly", () => {
    expect(videoGraph({ width: 1080, height: 1920, seconds: 5 })).toBe(
      "[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=25,format=yuv420p[v]",
    );
  });
});
