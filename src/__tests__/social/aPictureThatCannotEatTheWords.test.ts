/**
 * 🔴 THE PICTURE TAKES A BAND, NEVER THE FRAME.
 *
 * ⛔ THE SAFETY ARGUMENT, and it is the whole design. A full-bleed generated
 * image under a headline is a legibility bet on what the model happened to
 * draw: one dark passage behind white type and the post is unreadable — and
 * nobody here would see it, because the render looks fine at desk size. Three
 * defects this month were exactly that shape: the blank video poster, the
 * Bengali card that drew অভিমান as অভমিান, and the Facebook crop that ate both
 * ends of every sentence.
 *
 * 🔑 With a band and an inset content box, legibility is STRUCTURAL. No layout
 * can put a word over the picture — including the ones that position
 * absolutely against the frame, because they now measure against the inset box
 * — and a failed or ugly generation degrades to exactly today's card.
 *
 * ⚠️ Verified by rendering six real queued posts over a stand-in and LOOKING:
 * the words never touched the picture on any of them.
 */

import { describe, it, expect } from "vitest";
import { composePicture, ILLUSTRATION_BAND, imagesInPicture, wordsInPicture } from "@/lib/social/compose";
import { recipeHash } from "@/lib/social/visualRecipe";

const SRC = "data:image/png;base64,AAAA";

function card(withPicture: boolean) {
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
    illustration: withPicture ? { src: SRC } : null,
  });
}

describe("a picture that cannot eat the words", () => {
  it("🔴 draws the illustration when there is one", () => {
    expect(imagesInPicture(card(true))).toContain(SRC);
  });

  it("⛔ and nothing at all when there is not — today's card, exactly", () => {
    expect(imagesInPicture(card(false))).not.toContain(SRC);
  });

  it("⚠️ the words are identical either way", () => {
    /**
     * 🔑 A picture must not change what a card SAYS. If adding one dropped the
     * support line or the wordmark, the gate would have approved words that
     * never appeared ⇒ every published card carried no second line for weeks,
     * because compose accepted a `support` no render route passed.
     */
    expect(wordsInPicture(card(true))).toEqual(wordsInPicture(card(false)));
  });

  it("🔴 the band is a FRACTION of the frame, not the frame", () => {
    // ⛔ The number that stops this becoming a full-bleed image by drift.
    expect(ILLUSTRATION_BAND).toBeGreaterThan(0);
    expect(ILLUSTRATION_BAND, "the picture is taking half the card or more").toBeLessThan(0.5);
  });

  it("⛔ the content box starts BELOW the picture, so no layout can overlap it", () => {
    /**
     * 🔑 This is the structural guarantee, so it is asserted on the tree
     * rather than trusted. The wrapper's top margin must be at least the
     * picture's height.
     */
    const pic = card(true);
    const kids = pic.root.children ?? [];
    const img = kids.find((k) => k.tag === "img" && k.src === SRC);
    expect(img, "the illustration is not in the tree").toBeTruthy();

    const bandPx = Number(String(img!.style.height).replace("px", ""));
    expect(bandPx).toBe(Math.round(pic.height * ILLUSTRATION_BAND));

    const wrapper = kids[kids.length - 1];
    const marginTop = Number(String(wrapper.style.marginTop ?? "0").replace("px", ""));
    expect(marginTop, "the words start above the bottom of the picture").toBeGreaterThanOrEqual(bandPx);
  });

  it("⛔ a card without a picture keeps the full frame for its words", () => {
    const kids = card(false).root.children ?? [];
    const wrapper = kids[kids.length - 1];
    expect(wrapper.style.marginTop ?? "0").toBe("0");
  });

  it("⚠️ the picture sits under the words in the tree, never over them", () => {
    const kids = card(true).root.children ?? [];
    const imgAt = kids.findIndex((k) => k.tag === "img" && k.src === SRC);
    expect(imgAt).toBeGreaterThan(-1);
    expect(imgAt, "the picture is painted after the content").toBeLessThan(kids.length - 1);
  });
});
