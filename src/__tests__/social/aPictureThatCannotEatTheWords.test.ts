/**
 * 🔴 WORDS OVER A PICTURE, WITHOUT BETTING ON THE PICTURE.
 *
 * ⛔ THIS FILE USED TO PIN THE OPPOSITE DESIGN. The illustration was a BAND
 * across the top with the words safely beneath it, and the guarantee asserted
 * here was that the content box started below the picture so no layout could
 * overlap it. That was structurally sound — and it was not what the owner
 * asked for. He sent 27 reference posts and every one sets the text STRAIGHT
 * OVER the image. The band was my caution, not his brief.
 *
 * 🔑 THE OBJECTION STILL STANDS, AND IS ANSWERED DIFFERENTLY. You cannot bet
 * legibility on what the model happened to draw — so nothing is bet. The ink
 * and the veil arrive MEASURED, from the real pixels under the real text zone
 * ⇒ backgroundPlan.planBackground. Compose only draws what the measurement
 * decided.
 *
 * ⚠️ AND THE VEIL COVERS THE TEXT ZONE ALONE. A wash over the whole frame
 * would turn twelve styles into twelve versions of one — the monotony this
 * entire feature exists to end.
 */

import { describe, it, expect } from "vitest";
import { composePicture, zoneBox, veilGradient, imagesInPicture, wordsInPicture } from "@/lib/social/compose";
import { zoneRect, type TextZone } from "@/lib/social/backgroundPlan";
import { recipeHash } from "@/lib/social/visualRecipe";

const SRC = "data:image/png;base64,AAAA";
const ZONES: TextZone[] = ["top", "bottom", "left", "right", "centre"];

function card(opts: { ink?: "light" | "dark"; scrim?: number; zone?: TextZone } | null) {
  const recipe = {
    layout: "centred-statement",
    palette: "sand",
    typeTreatment: "display",
    motif: "arcs",
    wash: "flat",
    script: "latin",
  } as const;
  return composePicture({
    recipe: { ...recipe, hash: recipeHash(recipe) },
    headline: "When there is nobody left online",
    support: "Some nights the phone just sits there.",
    language: "en",
    platform: "facebook",
    illustration: opts
      ? { src: SRC, ink: opts.ink ?? "dark", scrim: opts.scrim ?? 0, zone: opts.zone ?? "top" }
      : null,
  });
}

/** Every style node in the tree, so a colour can be looked for anywhere. */
function styles(node: ReturnType<typeof card>["root"]): Record<string, string | number>[] {
  const out: Record<string, string | number>[] = [node.style];
  for (const k of node.children ?? []) out.push(...styles(k));
  return out;
}

describe("the picture is the whole background", () => {
  it("🔴 it is drawn, and it fills the frame", () => {
    const pic = card({});
    expect(imagesInPicture(pic)).toContain(SRC);
    const img = (pic.root.children ?? []).find((k) => k.tag === "img" && k.src === SRC);
    expect(img, "no picture in the tree").toBeTruthy();
    expect(img!.style.height, "the picture is still a band").toBe(`${pic.height}px`);
    expect(img!.style.width).toBe(`${pic.width}px`);
  });

  it("⛔ and nothing at all without one — today's card, exactly", () => {
    expect(imagesInPicture(card(null))).not.toContain(SRC);
  });

  it("⚠️ the words are identical either way", () => {
    /**
     * 🔑 A picture must not change what a card SAYS. If adding one dropped the
     * support line, the gate would have approved words that never appeared —
     * which is precisely what happened for weeks when compose accepted a
     * `support` that no render route passed.
     */
    expect(wordsInPicture(card({}))).toEqual(wordsInPicture(card(null)));
  });

  it("⚠️ the picture sits under the words, never over them", () => {
    const kids = card({}).root.children ?? [];
    const imgAt = kids.findIndex((k) => k.tag === "img" && k.src === SRC);
    expect(imgAt).toBeGreaterThan(-1);
    expect(imgAt, "the picture is painted after the content").toBeLessThan(kids.length - 1);
  });
});

describe("the ink comes from the measurement, not the palette", () => {
  it("🔴 light ink on a dark picture", () => {
    const all = styles(card({ ink: "light" }).root).map((s) => String(s.color ?? ""));
    expect(all, "the headline is not white over a dark picture").toContain("#ffffff");
  });

  it("🔴 dark ink on a light picture", () => {
    const all = styles(card({ ink: "dark" }).root).map((s) => String(s.color ?? ""));
    expect(all).toContain("#161310");
  });

  it("⛔ the palette's ink is NOT used over a picture", () => {
    /**
     * 🔑 THE WHOLE POINT. With a background the palette's ground is invisible,
     * so its ink was chosen against something nobody can see.
     */
    const over = styles(card({ ink: "light" }).root).map((s) => String(s.color ?? ""));
    const plain = styles(card(null).root).map((s) => String(s.color ?? ""));
    const paletteInk = plain.find((c) => c.startsWith("#") && c !== "");
    expect(paletteInk).toBeTruthy();
    expect(over, "a picture card is still using the palette ink").not.toContain(paletteInk);
  });
});

describe("the veil", () => {
  it("⛔ is absent when the measurement says the picture needs no help", () => {
    const kids = card({ scrim: 0 }).root.children ?? [];
    const veils = kids.filter((k) => String(k.style.backgroundImage ?? "").startsWith("linear-gradient"));
    expect(veils, "a veil was drawn over a picture that did not need one").toHaveLength(0);
  });

  it("🔴 covers the text zone ONLY, never the frame", () => {
    const pic = card({ scrim: 0.3, zone: "top" });
    const veil = (pic.root.children ?? []).find((k) =>
      String(k.style.backgroundImage ?? "").startsWith("linear-gradient"),
    );
    expect(veil, "no veil drawn").toBeTruthy();
    expect(
      Number(String(veil!.style.height).replace("px", "")),
      "the veil covers the whole card",
    ).toBeLessThan(pic.height);
  });

  it("⚠️ darkens for light ink and lightens for dark ink", () => {
    // ⛔ A dark wash under dark type would bury it.
    expect(veilGradient("top", "light", 0.3)).toContain("rgba(0,0,0,0.3)");
    expect(veilGradient("top", "dark", 0.3)).toContain("rgba(255,255,255,0.3)");
  });

  it("🔴 fades out, so it leaves no seam across the picture", () => {
    /**
     * ⛔ FOUND ON THE FIRST REAL CARD. Drawn as a flat alpha block, the veil
     * left a HARD HORIZONTAL LINE ruled across a soft pastel painting where it
     * stopped — and the line was more noticeable than the busy pixels it had
     * been hiding. A veil exists to make words readable, not to announce that
     * something was laid over the art.
     */
    for (const zone of ZONES) {
      const g = veilGradient(zone, "dark", 0.3);
      expect(g, `${zone} is not a gradient`).toMatch(/^linear-gradient/);
      expect(g, `${zone} never reaches transparent`).toContain("rgba(255,255,255,0)");
    }
  });

  it("⛔ and it fades AWAY from the words, never towards them", () => {
    /**
     * 🔑 A fade in the wrong direction thins the veil exactly where the last
     * line of text needs it most.
     */
    expect(veilGradient("top", "dark", 0.3)).toMatch(/to bottom.*rgba\(255,255,255,0\.3\) 0%/);
    expect(veilGradient("bottom", "dark", 0.3)).toMatch(/to top.*rgba\(255,255,255,0\.3\) 0%/);
  });

  it("⚠️ the centre zone fades at BOTH ends, because words sit in the middle", () => {
    const g = veilGradient("centre", "dark", 0.3);
    expect(g.startsWith("linear-gradient(to bottom, rgba(255,255,255,0) 0%")).toBe(true);
    expect(g.endsWith("rgba(255,255,255,0) 100%)")).toBe(true);
  });

  it("🔴 sits exactly where the measurement was taken", () => {
    /**
     * ⛔ THE TWO MUST AGREE. Measuring one part of the frame and veiling
     * another is worse than doing neither: it would report a readable card and
     * produce an unreadable one, with every check green.
     */
    const pic = card({ scrim: 0.3 });
    const { width: w, height: h } = pic;
    for (const zone of ZONES) {
      const box = zoneBox(zone, w, h);
      const rect = zoneRect(zone, w, h);
      expect(box.top, `${zone} top`).toBe(`${rect.top}px`);
      expect(box.left, `${zone} left`).toBe(`${rect.left}px`);
      expect(box.width, `${zone} width`).toBe(`${rect.width}px`);
      expect(box.height, `${zone} height`).toBe(`${rect.height}px`);
    }
  });
});
