/**
 * 🔴 THE MEASUREMENT THAT MAKES A FULL-BACKGROUND CARD SAFE.
 *
 * ⛔ I REFUSED FULL-BACKGROUND CARDS, and the reasoning was sound: you cannot
 * bet legibility on what the model happened to draw — one dark passage behind
 * white type and the post is unreadable, and nobody here would see it because
 * the render looks fine at desk size. The conclusion was still wrong. The
 * owner's 27 references all put text straight over the image, and they are
 * legible because the words sit where the picture is quiet.
 *
 * 🔑 So it is not a bet. The actual pixels under the actual text zone are
 * measured, and the ink follows the measurement.
 *
 * ⚠️ TWO NUMBERS, NOT ONE, AND THE SECOND MATTERS MORE. A zone can be
 * perfectly mid-bright ON AVERAGE and still be unreadable — foliage, a crowd
 * of shapes, a painted sky with hard clouds. Brightness says which ink; the
 * SPREAD says whether any ink will do. Judging on the mean alone is exactly
 * how a card passes every check and is illegible on a phone.
 *
 * 🔑 THRESHOLDS TUNED AGAINST THE OWNER'S OWN 27 REFERENCES, measured with
 * this code. Spot-checks that agree with the real posters: the CoSchedule blue
 * (mean 128) takes light ink and its poster is white-on-blue; the white
 * infographic (mean 228) takes dark ink; "Dream it believe it" (mean 254,
 * sd 3) takes dark ink and no veil at all.
 */

import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  planBackground,
  zoneRect,
  LIGHT_INK_BELOW,
  BUSY_SD,
} from "@/lib/social/backgroundPlan";

const flat = (hex: string) =>
  sharp({ create: { width: 400, height: 500, channels: 3, background: hex } }).png().toBuffer();

/** A zone that is mid-bright on average but violently busy. */
const noisy = async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
    <rect width="400" height="500" fill="#ffffff"/>
    ${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 10}" y="0" width="5" height="500" fill="#000000"/>`).join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

describe("reading the picture before writing on it", () => {
  it("🔴 a dark picture takes light ink", async () => {
    const plan = await planBackground(await flat("#1b2230"), "top");
    expect(plan.ink).toBe("light");
    expect(plan.measured.mean).toBeLessThan(LIGHT_INK_BELOW);
  });

  it("🔴 a light picture takes dark ink", async () => {
    const plan = await planBackground(await flat("#f4efe7"), "top");
    expect(plan.ink).toBe("dark");
  });

  it("⛔ a flat picture needs no veil at all", async () => {
    /**
     * 🔑 THE HALF THAT KEEPS THIS WORTH HAVING. A veil on every card is the
     * muddy sameness the whole feature exists to end — the owner's complaint
     * was monotony, and a grey wash over twelve different styles would make
     * them twelve versions of one.
     */
    expect((await planBackground(await flat("#f4efe7"), "top")).scrim).toBe(0);
    expect((await planBackground(await flat("#1b2230"), "top")).scrim).toBe(0);
  });

  it("🔴 a busy zone gets one even though its average is mid-grey", async () => {
    const plan = await planBackground(await noisy(), "top");
    // ⚠️ The average of hard black stripes on white is unremarkable. The
    // spread is what gives it away.
    expect(plan.measured.sd).toBeGreaterThan(BUSY_SD);
    expect(plan.scrim, "a zone of black stripes was called readable").toBeGreaterThan(0);
  });

  it("⚠️ the veil is capped, because an opaque one hides the picture", async () => {
    const plan = await planBackground(await noisy(), "top");
    expect(plan.scrim).toBeLessThanOrEqual(0.45);
  });

  it("⛔ an unreadable image still returns a plan rather than throwing", async () => {
    /**
     * 🔴 A missing post is worse than a plain one. If a picture fails to
     * decode, the card must still publish legibly ⇒ the safe answer, not an
     * exception that loses the slot.
     */
    const plan = await planBackground(Buffer.from("not an image"), "top");
    expect(plan.ink).toBe("dark");
    expect(plan.scrim).toBeGreaterThan(0);
    expect(plan.measured.mean, "it claimed to have measured something").toBe(-1);
  });

  it("🔑 it measures the zone the words will use, not the whole frame", async () => {
    /**
     * ⛔ THE WHOLE POINT. This picture is white at the top and black at the
     * bottom; measuring the frame would average to mid-grey and choose an ink
     * that fails at both ends.
     */
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
      <rect width="400" height="250" fill="#ffffff"/><rect y="250" width="400" height="250" fill="#000000"/></svg>`;
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    expect((await planBackground(buf, "top")).ink).toBe("dark");
    expect((await planBackground(buf, "bottom")).ink).toBe("light");
  });
});

describe("the zone the words occupy", () => {
  it("stays inside the frame for every zone", () => {
    for (const z of ["top", "bottom", "left", "right", "centre"] as const) {
      const r = zoneRect(z, 1080, 1350);
      expect(r.left, z).toBeGreaterThanOrEqual(0);
      expect(r.top, z).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width, z).toBeLessThanOrEqual(1080);
      expect(r.top + r.height, z).toBeLessThanOrEqual(1350);
      expect(r.width, z).toBeGreaterThan(0);
      expect(r.height, z).toBeGreaterThan(0);
    }
  });

  it("⚠️ top and bottom do not overlap — otherwise they measure the same thing", () => {
    const t = zoneRect("top", 1080, 1350);
    const b = zoneRect("bottom", 1080, 1350);
    expect(t.top + t.height).toBeLessThanOrEqual(b.top);
  });

  it("survives a tiny frame rather than producing a zero-sized crop", () => {
    // ⛔ sharp throws on a zero-width extract, which would lose the post.
    for (const z of ["top", "bottom", "left", "right", "centre"] as const) {
      const r = zoneRect(z, 1, 1);
      expect(r.width, z).toBeGreaterThan(0);
      expect(r.height, z).toBeGreaterThan(0);
    }
  });
});

/**
 * 🔴 THE FLOOR UNDER EVERY DECISION.
 *
 * ⛔ A brightness threshold is weakest exactly in the middle, and the owner's
 * own references prove it: his CoSchedule poster measures 148 and sets WHITE
 * type; another measures 157 and sets BLACK. Two adjacent numbers, opposite
 * answers. No single threshold separates them, and pretending one does is how
 * a card ships unreadable.
 *
 * 🔑 So the threshold picks the ink and the floor guarantees it can be READ.
 */
describe("the contrast floor", () => {
  const grey = (v: number) =>
    sharp({ create: { width: 400, height: 500, channels: 3, background: { r: v, g: v, b: v } } })
      .png()
      .toBuffer();

  it("🔴 a mid-tone zone gets a veil even though it is perfectly flat", async () => {
    /**
     * ⚠️ sd is ~0 here, so the busy rule says nothing at all — only the
     * contrast floor saves this one. ⛔ The first version of this test used
     * grey 150 and FAILED, correctly: dark ink on 150 is about 5:1 and
     * genuinely readable. Chasing that failure is what exposed the real
     * problem — the floor was set so low it fired across a six-unit band.
     */
    const plan = await planBackground(await grey(150), "top");
    expect(plan.measured.sd).toBeLessThan(BUSY_SD);
    expect(plan.scrim, "flat mid-grey was called readable").toBeGreaterThan(0);
  });

  it("⛔ while the clear cases are left alone", async () => {
    expect((await planBackground(await grey(250), "top")).scrim).toBe(0);
    expect((await planBackground(await grey(20), "top")).scrim).toBe(0);
  });

  it("⚠️ the nearer the ink, the heavier the veil", async () => {
    const near = await planBackground(await grey(150), "top");
    const nearer = await planBackground(await grey(139), "top");
    // 139 flips to light ink and sits closer to it than 150 does to dark.
    expect(nearer.ink).toBe("light");
    expect(near.ink).toBe("dark");
    for (const p of [near, nearer]) expect(p.scrim).toBeLessThanOrEqual(0.45);
  });
});

/**
 * 🔴 AN AVERAGE OVER A BAND HIDES THE BUSY END OF IT.
 *
 * ⛔ FOUND ON THE FIRST REAL CARD EVER RENDERED with a generated background —
 * a soft pastel still life, measured across the top band at spread 26.6 and
 * called quiet, so it got no veil. It WAS quiet at the top: the headline read
 * beautifully. The flowers rose into the LOWER part of that same band, which
 * is exactly where the support line lands, and the second line ran across the
 * petals.
 *
 * 🔑 The words occupy the whole band, so the quietest part of it does not help
 * the line sitting in the busiest part.
 */
describe("the busy end of a quiet band", () => {
  /** Plain at the top, detailed across the bottom — the still life, in miniature. */
  const quietThenBusy = async () => {
    /**
     * ⚠️ THE DETAIL MUST SIT INSIDE THE ZONE. The top zone of a 500px frame is
     * 210px, and the first version of this fixture put its stripes at y=300 —
     * outside the band altogether, so it proved nothing and failed. The busy
     * part belongs at the BOTTOM of the band, which is where the support line
     * goes.
     */
    const stripes = Array.from(
      { length: 30 },
      (_, i) => `<rect x="${i * 14}" y="140" width="7" height="70" fill="#1d1d1d"/>`,
    ).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
      <rect width="400" height="500" fill="#e9e6e0"/>${stripes}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  };

  it("🔴 the lower part of the zone is what decides the veil", async () => {
    /**
     * ⚠️ The top 42% of this image is 210px: the upper 300px are plain, so the
     * zone's own average is unremarkable. Only the bottom strip gives it away
     * — and that is where the support line goes.
     */
    const plan = await planBackground(await quietThenBusy(), "top");
    expect(plan.scrim, "a band busy at its bottom was called readable").toBeGreaterThan(0);
  });

  it("⛔ and a genuinely quiet band still gets no veil", async () => {
    // 🔑 The control. If this ever veils, the strips have made the check
    // paranoid and every card gets a wash — the monotony this exists to end.
    const plain = await sharp({
      create: { width: 400, height: 500, channels: 3, background: "#e9e6e0" },
    })
      .png()
      .toBuffer();
    expect((await planBackground(plain, "top")).scrim).toBe(0);
  });

  it("⚠️ the reported spread is the worst strip, not the average", async () => {
    const plan = await planBackground(await quietThenBusy(), "top");
    // The whole-band average of this image sits well under the busy line;
    // the worst strip does not.
    expect(plan.measured.sd).toBeGreaterThan(BUSY_SD);
  });
});
