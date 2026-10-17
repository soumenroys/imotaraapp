/**
 * 🔴 THE DEFECT: the colour the owner asked for was not on five cards in six.
 *
 * "can you make those QRs more colourful and good looking?" — so each code got
 * a ring and a dot in its own colour, and `qrContrastOk` guarded the colour at
 * 7:1. The guard reads correctly, is well commented, and checks the MODULES
 * against the WHITE PANEL they sit on. Nothing checked the RING against the
 * CARD. All three brand colours are dark, five of the six palettes have a dark
 * ground, and 15 of the 18 combinations measured below 3:1 — the iPhone ring on
 * the ink palette came out at 1.01, the same luminance as the card.
 *
 * ⚠️ A guard can be entirely correct and still be the wrong pair.
 *
 * 🔴 AND THE SECOND DEFECT, WHICH THE FIRST FIX CAUSED. Lifting each colour's
 * lightness while keeping its hue turned the Website indigo and the near-black
 * iPhone into two blues 20ΔE apart. Visible, and no longer telling the reader
 * which code was which — the one thing three rings exist to do. ⇒ Both
 * properties are pinned here, because satisfying either alone is a regression.
 */

import { describe, it, expect } from "vitest";
import { composePicture, type Node } from "@/lib/social/compose";
import { QR_TARGETS, contrastRatio, onGround, allQrCodes } from "@/lib/social/brandMarks";
import { PALETTES, PALETTE_NAMES, LAYOUTS, recipeHash } from "@/lib/social/visualRecipe";

/** CIE76 ΔE. ⛔ A contrast ratio CANNOT answer "are these the same colour?":
 *  two different hues at one lightness measure 1.00:1 and look nothing alike. */
function deltaE(a: string, b: string): number {
  const lab = (hex: string): [number, number, number] => {
    const v = hex.replace("#", "");
    const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, bl] = [0, 2, 4].map((i) => f(parseInt(v.slice(i, i + 2), 16) / 255));
    const X = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    const Y = r * 0.2126 + g * 0.7152 + bl * 0.0722;
    const Z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const k = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [k(X), k(Y), k(Z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const codes = QR_TARGETS.map((t) => ({
  id: t.id,
  label: t.label,
  color: t.color,
  ringColor: t.onDark,
  dataUri: `data:image/png;base64,${t.id}`,
}));

const recipe = (palette: string, layout = "rule-over") => {
  const base = { layout, palette, typeTreatment: "display", motif: "arcs", script: "en" };
  return { ...base, hash: recipeHash(base as never) } as never;
};

/**
 * Every colour the composed card actually paints ON ITS GROUND for a code:
 * the ring (a border) and the dot (a background).
 *
 * 🔑 Read out of the real tree rather than recomputed, so this measures what
 * composePicture decided — not what this test thinks it should have decided.
 */
function ringColoursIn(root: Node): string[] {
  const out: string[] = [];
  const walk = (n: Node) => {
    // ⚠️ A RING IS THE BORDER OF THE PANEL THAT HOLDS A CODE, not any border.
    // The first version of this walker collected every border on the card and
    // picked up the layout's accent rule, which then failed the ΔE check
    // against a colour that is not a ring at all.
    const holdsACode = n.children?.some((c) => c.tag === "img" && c.src?.startsWith("data:image"));
    const border = n.style.border as string | undefined;
    if (holdsACode && typeof border === "string") {
      const hex = border.match(/(#[0-9A-Fa-f]{6})/)?.[1];
      if (hex) out.push(hex.toUpperCase());
    }
    n.children?.forEach(walk);
  };
  walk(root);
  return out;
}

describe("the ring is visible on the card it is drawn on", () => {
  it("clears 3:1 against every palette's own ground", () => {
    for (const palette of PALETTE_NAMES) {
      const ground = PALETTES[palette].ground;
      const picture = composePicture({
        recipe: recipe(palette),
        headline: "A headline",
        language: "en",
        platform: "facebook",
        qrCodes: codes,
      });
      const rings = ringColoursIn(picture.root);
      expect(rings.length, `${palette}: no ring was drawn at all`).toBe(codes.length);
      for (const ring of rings) {
        const ratio = contrastRatio(ring, ground);
        expect(
          ratio,
          `on the ${palette} palette the ring ${ring} measures ${ratio.toFixed(2)}:1 against its own card`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("⛔ and the three stay different colours from each other", () => {
    for (const palette of PALETTE_NAMES) {
      const rings = ringColoursIn(
        composePicture({
          recipe: recipe(palette),
          headline: "A headline",
          language: "en",
          platform: "facebook",
          qrCodes: codes,
        }).root,
      );
      for (let i = 0; i < rings.length; i++)
        for (let j = i + 1; j < rings.length; j++) {
          const d = deltaE(rings[i], rings[j]);
          expect(
            d,
            `on ${palette}, ${rings[i]} and ${rings[j]} are ${d.toFixed(1)}ΔE apart — ` +
              `a reader cannot tell which code is for which phone`,
          ).toBeGreaterThanOrEqual(25);
        }
    }
  });

  it("holds on every layout, not just the one that was looked at", () => {
    for (const layout of LAYOUTS)
      for (const palette of PALETTE_NAMES) {
        const rings = ringColoursIn(
          composePicture({
            recipe: recipe(palette, layout),
            headline: "A headline",
            language: "en",
            platform: "facebook",
            qrCodes: codes,
          }).root,
        );
        for (const ring of rings)
          expect(
            contrastRatio(ring, PALETTES[palette].ground),
            `${layout} on ${palette}: ${ring} disappears`,
          ).toBeGreaterThanOrEqual(3);
      }
  });
});

describe("the modules are a different question, and still answered", () => {
  it("⛔ the code itself stays dark enough to scan on its white panel", async () => {
    // 🔑 The ring moved; the modules must not have. A lifted #A5B4FC printed as
    // a QR on white is 1.6:1 — a code that photographs as a blank square.
    for (const c of await allQrCodes("facebook")) {
      expect(
        contrastRatio(c.color, "#FFFFFF"),
        `the ${c.id} modules would not scan`,
      ).toBeGreaterThanOrEqual(7);
    }
  });

  it("the two values are genuinely different values", () => {
    // ⚠️ If ringColor ever collapses back onto color, this feature is back to
    // where it started and every other test here would still pass.
    for (const t of QR_TARGETS) expect(t.onDark).not.toBe(t.color);
  });
});

describe("onGround, as the guard behind the chosen colours", () => {
  it("leaves a colour that already clears the bar alone", () => {
    expect(onGround("#A5B4FC", "#111827")).toBe("#A5B4FC");
  });

  it("lifts one that does not, and keeps lifting until it does", () => {
    const lifted = onGround("#0F172A", "#111827");
    expect(lifted).not.toBe("#0F172A");
    expect(contrastRatio(lifted, "#111827")).toBeGreaterThanOrEqual(3);
  });

  it("darkens against a light ground instead of lightening", () => {
    const lifted = onGround("#FEF3C7", "#F5EFE6");
    expect(contrastRatio(lifted, "#F5EFE6")).toBeGreaterThanOrEqual(3);
    // ⚠️ Moved DOWN. Lightening against a near-white ground never converges.
    expect(parseInt(lifted.slice(1, 3), 16)).toBeLessThan(0xfe);
  });
});
