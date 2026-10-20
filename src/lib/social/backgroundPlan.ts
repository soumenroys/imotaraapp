// src/lib/social/backgroundPlan.ts
// Reading the picture before writing on it.
//
// 🔴 WHY THIS EXISTS AT ALL. I refused full-background cards on the grounds
// that "you cannot bet legibility on what the model happened to draw" — one
// dark passage behind white type and the post is unreadable, and nobody here
// would see it because the render looks fine at desk size. That reasoning was
// sound and the conclusion was wrong: the owner's 27 references all put text
// straight over the image, and they are legible because the words are placed
// where the picture is quiet.
//
// 🔑 SO IT IS NOT A BET. The picture is MEASURED — the actual pixels under the
// actual text zone — and the ink colour follows the measurement. Where the
// zone is too busy for any ink, a veil is laid over that area alone. Nothing
// is assumed about what the model drew.
//
// ⚠️ THIS IS THE THIRD TIME THIS MONTH that looking at the real artefact was
// the only thing that worked: the blank video poster, the Bengali card, the
// Facebook crop. The difference here is that the looking is done in code, on
// every post, instead of by a person on some of them.

import sharp from "sharp";

/** Where the words go — declared per style ⇒ illustrationStyles.ts. */
export type TextZone = "top" | "bottom" | "left" | "right" | "centre";

export type BackgroundPlan = {
  /** Which ink the words must be drawn in to be read. */
  ink: "light" | "dark";
  /**
   * 🔑 A VEIL OVER THE TEXT ZONE ONLY, 0 when the picture does not need one.
   * ⛔ Never over the whole frame: that is the muddy scrim that makes every
   * generated-background post look the same, which is the complaint this
   * feature started from.
   */
  scrim: number;
  /** What was actually measured, so a bad decision can be traced to its cause. */
  measured: { mean: number; sd: number };
};

/**
 * The slice of the frame the words will occupy.
 *
 * ⚠️ Generous on purpose. Measuring exactly the glyph box would call a zone
 * quiet when the busy part is a few pixels outside it, and descenders, long
 * headlines and a second line all move that box.
 */
export function zoneRect(
  zone: TextZone,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const band = Math.max(1, Math.round(height * 0.42));
  const side = Math.max(1, Math.round(width * 0.55));
  switch (zone) {
    case "top":
      return { left: 0, top: 0, width, height: band };
    case "bottom":
      return { left: 0, top: height - band, width, height: band };
    case "left":
      return { left: 0, top: 0, width: side, height };
    case "right":
      return { left: width - side, top: 0, width: side, height };
    case "centre":
      return {
        left: 0,
        top: Math.round((height - band) / 2),
        width,
        height: band,
      };
  }
}

/**
 * ⚠️ TUNED AGAINST THE OWNER'S OWN REFERENCES, not chosen from taste — 27 real
 * posts that are known to be readable, measured with this same code.
 */
export const LIGHT_INK_BELOW = 140;
/**
 * ⚠️ 44 RATHER THAN THE 52 THIS STARTED AT. Rendering six real cards found an
 * autumn-wood photograph measuring **48.9** — comfortably under 52, so it got
 * almost no veil, and its support line was genuinely hard to read against the
 * foliage. ⛔ The headline survives a busy ground because it is large and
 * heavy; the SUPPORT LINE is small and thin and gives up first, so the
 * threshold has to be set for the weaker of the two.
 */
export const BUSY_SD = 44;

/**
 * 🔴 THE FLOOR UNDER EVERY DECISION — added after measuring the owner's own
 * references and finding the honest weakness.
 *
 * ⛔ A BRIGHTNESS THRESHOLD IS WEAKEST EXACTLY IN THE MIDDLE. His CoSchedule
 * reference measures 148 and the real poster sets WHITE type on it; another
 * reference at 157 sets BLACK. Two adjacent numbers, opposite answers — no
 * single threshold can separate them, and pretending otherwise is how a card
 * ships unreadable.
 *
 * 🔑 So the threshold picks the ink and THIS guarantees it can be read: the
 * distance between the ink and what is behind it must clear a floor, and
 * where it does not, the veil makes up the difference. ⚠️ Legibility is
 * guaranteed; being the prettiest choice is not.
 *
 * ⚠️ 150 RATHER THAN THE 110 THIS STARTED AT, and the reason is worth keeping:
 * at 110 the veil only fired for means between 138 and 144 — a six-unit band,
 * a safety net so narrow it barely existed, while the mid-tones it was built
 * for sailed through untouched. ⛔ A guard that almost never fires has not
 * been proven safe; it has been proven absent.
 *
 * ▶️ AND IT IS STILL ARITHMETIC. The only honest test is composing real cards
 * over real backgrounds and looking at them.
 */
export const MIN_CONTRAST = 150;

/** Roughly where the palette inks sit, so the sums are about real values. */
const LIGHT_INK_LUMA = 248;
const DARK_INK_LUMA = 34;

/**
 * Read the zone, decide the ink.
 *
 * ⛔ RETURNS A PLAN EVEN WHEN THE IMAGE CANNOT BE READ. A card whose picture
 * failed to decode must still publish legibly, so an unreadable image gets the
 * safe answer — dark ink on a veil — rather than an exception that loses the
 * slot ⇒ a missing post is worse than a plain one.
 */
export async function planBackground(
  bytes: Uint8Array | Buffer,
  zone: TextZone,
): Promise<BackgroundPlan> {
  try {
    const img = sharp(Buffer.from(bytes));
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) throw new Error("no dimensions");

    const rect = zoneRect(zone, w, h);
    /**
     * 🔴 THE CROP IS MATERIALISED FIRST, AND THIS IS NOT TIDINESS.
     *
     * ⛔ `sharp(...).extract(rect).stats()` reads the INPUT image, not the
     * result of the pipeline — `stats()` does not see prior operations. The
     * first version of this function did exactly that and measured the WHOLE
     * FRAME every time: a picture white at the top and black at the bottom
     * returned the identical mean for both zones. It would have chosen ink by
     * averaging the entire image, which is precisely the useless answer this
     * code exists to avoid — and it would have looked like it was working.
     *
     * ⚠️ Caught by the test that measures a half-white half-black image and
     * asserts the two zones disagree. Without that case it was green.
     */
    const cropped = await sharp(Buffer.from(bytes)).extract(rect).greyscale().toBuffer();
    const stats = await sharp(cropped).stats();
    const ch = stats.channels[0];
    const mean = ch.mean;
    const sd = ch.stdev;

    /**
     * 🔑 LIGHT INK ON A DARK ZONE, DARK INK ON A LIGHT ONE — the obvious half.
     * ⚠️ The threshold sits above mid-grey (140, not 128) because white type
     * fails on mid-grey sooner than black type does: a light glyph loses its
     * edge against a middling ground, where a dark one still reads.
     */
    const ink: "light" | "dark" = mean < LIGHT_INK_BELOW ? "light" : "dark";

    /**
     * 🔴 THE HALF THAT MATTERS MORE. A zone can be perfectly mid-bright on
     * AVERAGE and still be unreadable — foliage, a crowd of shapes, a painted
     * sky with hard clouds. The spread is what says "busy", and the average
     * says nothing about it. ⛔ Judging on the mean alone is exactly how a
     * card passes every check and is illegible on a phone.
     */
    const busyScrim = sd > BUSY_SD ? Math.min(0.45, 0.18 + (sd - BUSY_SD) / 220) : 0;

    /**
     * ⚠️ TWO REASONS TO VEIL, AND THE STRONGER ONE WINS. A zone can be quiet
     * but too close in tone to the ink, or far enough in tone but far too
     * busy. Taking the larger covers both without stacking them into mud.
     */
    const inkLuma = ink === "light" ? LIGHT_INK_LUMA : DARK_INK_LUMA;
    const contrast = Math.abs(inkLuma - mean);
    const contrastScrim =
      contrast >= MIN_CONTRAST ? 0 : Math.min(0.45, (MIN_CONTRAST - contrast) / MIN_CONTRAST * 0.45);

    const scrim = Math.max(busyScrim, contrastScrim);

    return { ink, scrim, measured: { mean: round(mean), sd: round(sd) } };
  } catch {
    // ⛔ The safe answer, not a throw.
    return { ink: "dark", scrim: 0.35, measured: { mean: -1, sd: -1 } };
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
