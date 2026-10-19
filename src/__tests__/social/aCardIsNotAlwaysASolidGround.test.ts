/**
 * 🔴 THE OWNER, 19 Oct: "the contents are always with a solid coloured
 * background with a text in front... if you add more variations the posts
 * will be nicer."
 *
 * They were right, and the measurement is unflattering: six motifs, all of
 * them THIN LINE fields, on six palettes of which five were dark. Every card
 * was a sibling of the last however the colours moved.
 *
 * ⛔ AND THIS REVERSES A WRITTEN RULE, so the reasoning is pinned here as
 * well as in the source. visualRecipe.ts said: "⛔ No gradient wash. It is the
 * single most recognisable mark of a picture that nobody designed, and this
 * brand cannot afford to look generated."
 *
 * ⚠️ THAT FEAR IS STILL RIGHT. It is not a fear of gradients, it is a fear of
 * ONE gradient — the unanchored purple-to-pink diagonal every template ships
 * with. So the rule is kept BY CONSTRUCTION rather than by prohibition: every
 * wash is built from the palette's OWN ground, shifted against itself. There
 * is no second hue available to it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { composePicture, imagesInPicture } from "@/lib/social/compose";
import { WASHES, MOTIFS, PALETTES, PALETTE_NAMES, recipeHash, type Recipe } from "@/lib/social/visualRecipe";
import { contrastRatio } from "@/lib/social/brandMarks";

const recipe = (over: Partial<Recipe> = {}): Recipe =>
  ({
    layout: "rule-over",
    palette: "forest",
    typeTreatment: "display",
    motif: "none",
    script: "latin",
    hash: "t",
    ...over,
  }) as Recipe;

const card = (over: Partial<Recipe> = {}) =>
  composePicture({ recipe: recipe(over), headline: "A headline", language: "en", platform: "instagram" });

/** A colour's hue in degrees. ⚠️ A grey has no meaningful hue and returns 0. */
function hueOf(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** How colourful it is, 0 (grey) to 1. */
function saturationOf(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/** ⛔ AND NO WASH MAY REACH BLACK OR WHITE. Pinned separately because the
 *  grey exemption above would otherwise let exactly that through. */
function notClamped(hex: string): boolean {
  return hex.toUpperCase() !== "#000000" && hex.toUpperCase() !== "#FFFFFF";
}

/** The shorter way round the colour wheel. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Every style object in the tree, flattened. */
function styles(node: unknown): Record<string, unknown>[] {
  const n = node as { style?: Record<string, unknown>; children?: unknown[] };
  return [...(n.style ? [n.style] : []), ...(n.children ?? []).flatMap(styles)];
}

describe("the ground can be painted, not only filled", () => {
  it("every wash renders and none throws", () => {
    for (const wash of WASHES) {
      expect(() => card({ wash }), `wash ${wash}`).not.toThrow();
    }
  });

  it("⛔ `flat` is still a plain ground — the historic behaviour is the default", () => {
    const flat = JSON.stringify(card({ wash: "flat" }).root.style);
    const absent = JSON.stringify(card({}).root.style);
    expect(flat).toBe(absent);
    expect(flat).not.toContain("gradient");
  });

  it("the others paint it", () => {
    for (const wash of WASHES.filter((w) => w !== "flat")) {
      expect(JSON.stringify(card({ wash }).root.style), wash).toContain("gradient");
    }
  });

  it("⛔ a wash can only be made of the palette's OWN colour", () => {
    /**
     * 🔴 THE RULE THE OLD PROHIBITION WAS PROTECTING, kept by construction.
     * A gradient between a ground and a shifted version of that same ground
     * cannot introduce a hue the palette did not contain — so it can only
     * ever look like this brand, never like a template.
     *
     * ⚠️ CHECKED AS HUE, NOT AS CONTRAST. My first version asserted a
     * contrast ratio below 2.2 and failed on teal/duotone at 2.48 — which is
     * not a second colour, it is the SAME colour further apart. Contrast
     * conflates intensity with hue, and the rule is about hue: a wash may be
     * as light or dark as it likes, it may not become a different colour.
     */
    for (const name of PALETTE_NAMES) {
      const groundHue = hueOf(PALETTES[name].ground);
      for (const wash of WASHES.filter((w) => w !== "flat")) {
        const style = JSON.stringify(card({ palette: name, wash }).root.style);
        const hexes = [...style.matchAll(/#([0-9A-Fa-f]{6})/g)].map((m) => `#${m[1]}`);
        expect(hexes.length, `${name}/${wash} painted nothing`).toBeGreaterThan(1);
        for (const hex of hexes) {
          /**
           * ⚠️ A NEAR-GREY HAS NO MEANINGFUL HUE, so comparing one is noise.
           * ⛔ But it is also not a licence: a wash that greys out entirely
           * has lost the palette's colour, which is why shiftLightness now
           * refuses to reach black or white at all.
           */
          expect(notClamped(hex), `${name}/${wash} clamped to ${hex}`).toBe(true);
          if (saturationOf(hex) < 0.08) continue;
          const d = hueDistance(hueOf(hex), groundHue);
          expect(d, `${name}/${wash} introduced ${hex}, hue ${d.toFixed(0)}° away`).toBeLessThan(12);
        }
      }
    }
  });

  it("⛔ and no wash costs the words their legibility", () => {
    // A pale ground is only pretty if the headline can still be read on it.
    for (const name of PALETTE_NAMES) {
      const p = PALETTES[name];
      expect(contrastRatio(p.ink, p.ground), `${name} ink`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(p.muted, p.ground), `${name} muted`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("the motifs are no longer all thin lines", () => {
  it("every motif renders, including the three added", () => {
    for (const motif of MOTIFS) {
      expect(() => card({ motif }), `motif ${motif}`).not.toThrow();
    }
    for (const added of ["halo", "drift", "wave"]) {
      expect([...MOTIFS]).toContain(added);
    }
  });

  it("⛔ the added ones actually draw something", () => {
    /**
     * 🔴 I LISTED THEM BEFORE I DREW THEM. For a few minutes `halo`, `drift`
     * and `wave` were in MOTIFS with no case in the switch — so the rotation
     * would have picked them and produced a card with no motif at all, which
     * looks exactly like a card whose motif is "none".
     */
    for (const motif of ["halo", "drift", "wave"]) {
      const found = styles(card({ motif }).root).some((s) => s.borderRadius === "9999px");
      expect(found, `${motif} drew nothing`).toBe(true);
    }
  });

  it("⛔ still nothing representational — the rule that has not moved", () => {
    /**
     * 🔑 No code path here can produce a figure, a face, or anything that
     * reads as distress. On a mental-health feed that is protection, not
     * timidity. ⚠️ Checked as "no images beyond the brand marks": a motif
     * that pulled in a picture would be the way this rule breaks.
     */
    for (const motif of MOTIFS) {
      const images = imagesInPicture(card({ motif }));
      for (const src of images) {
        expect(src, `motif ${motif} pulled in an image`).toMatch(/android-chrome|^data:image\/png/);
      }
    }
  });
});

describe("the space got bigger, and uniqueness survived it", () => {
  it("⛔ a flat recipe hashes EXACTLY as it did before the axis existed", () => {
    /**
     * 🔴 THE GUARANTEE THIS PROTECTS is backed by a unique index on every
     * recipe ever used. Appending the wash unconditionally would make every
     * historic combination hashable again as a "new" recipe — so cards
     * already published could quietly come round a second time.
     */
    const withFlat = recipeHash({ layout: "rule-over", palette: "forest", typeTreatment: "display", motif: "arcs", wash: "flat", script: "en" });
    const without = recipeHash({ layout: "rule-over", palette: "forest", typeTreatment: "display", motif: "arcs", script: "en" });
    expect(withFlat).toBe(without);
  });

  it("and a painted one is genuinely a different recipe", () => {
    const flat = recipeHash({ layout: "rule-over", palette: "forest", typeTreatment: "display", motif: "arcs", wash: "flat", script: "en" });
    const linear = recipeHash({ layout: "rule-over", palette: "forest", typeTreatment: "display", motif: "arcs", wash: "linear", script: "en" });
    expect(linear).not.toBe(flat);
  });
});

/**
 * 🔴 THE AXIS HAS TO SURVIVE THE ROUND TRIP, AND IT NEARLY DID NOT.
 *
 * `renderPostPicture` rebuilds the recipe FIELD BY FIELD from the stored row
 * — correctly, because a database row is untrusted and a spread would carry
 * whatever the column held. ⛔ But that means every new axis must be added
 * there too, and forgetting is invisible: the wash is saved, `composePicture`
 * is handed `undefined`, and every card renders flat while the row insists
 * otherwise.
 *
 * ⚠️ NO PREVIEW COULD HAVE CAUGHT IT. They all build a recipe inline and
 * never touch that path — the same blind spot as testing fonts on a machine
 * that already has them.
 */
describe("a stored wash is still there when the card is drawn", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/social/renderPicture.ts"), "utf8");

  it("⛔ the rebuilt recipe carries every axis the picker can set", () => {
    const at = source.indexOf("const recipe: Recipe = {");
    expect(at).toBeGreaterThan(-1);
    const block = source.slice(at, source.indexOf("};", at));
    for (const axis of ["layout", "palette", "typeTreatment", "motif", "script", "wash"]) {
      expect(block, `the rebuilt recipe drops ${axis}`).toContain(`${axis}:`);
    }
  });

  it("and a row with no wash reads as flat, not as undefined", () => {
    // ⚠️ Every recipe stored before 19 Oct has no wash at all, and those
    // cards must still render exactly as they did.
    const at = source.indexOf("wash:");
    expect(source.slice(at, at + 90)).toContain('"flat"');
  });
});
