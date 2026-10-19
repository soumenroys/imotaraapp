/**
 * 🔴 THE THREE FAULTS THAT WERE INVISIBLE IN THE CODE AND OBVIOUS IN A RENDER.
 *
 * The carousel path was built, typechecked, and passing 3,570 tests when I
 * rendered the five cards and looked at them:
 *
 *   1. every card carried the fixed eyebrow "22 LANGUAGES" — a brand claim
 *      stamped on a carousel about restlessness, five identical times;
 *   2. nothing told a reader they were on card three of five, which is the
 *      one thing that makes a swipe a fair bargain;
 *   3. a one-sentence slide was set at the size chosen for a 64-character
 *      headline and left two thirds of a 1080 square empty.
 *
 * ⛔ AND THE FIRST FIX FOR (3) BROKE A FACEBOOK CARD, pushing its support line
 * through the bottom hairline — also caught only by looking. That regression
 * is pinned here too.
 *
 * ⚠️ These assertions read the composed TREE, not the pixels. A test cannot
 * see a collision; it can see the number that caused one.
 */

import { describe, it, expect } from "vitest";
import { composePicture, type Node } from "@/lib/social/compose";
import { HEADLINE_MAX, type Recipe } from "@/lib/social/visualRecipe";

const recipe = (over: Partial<Recipe> = {}): Recipe =>
  ({
    layout: "stacked-label",
    palette: "forest",
    typeTreatment: "display",
    motif: "none",
    script: "latin",
    hash: "test",
    ...over,
  }) as Recipe;

/** Every node with this role, anywhere in the tree. */
function byRole(node: Node, role: string): Node[] {
  const here = (node as { role?: string }).role === role ? [node] : [];
  const kids = (node as { children?: Node[] }).children ?? [];
  return [...here, ...kids.flatMap((k) => byRole(k, role))];
}

const px = (n: Node) => parseFloat(String((n.style as Record<string, string>).fontSize));

const compose = (over: Parameters<typeof composePicture>[0] extends infer T ? Partial<T> : never) =>
  composePicture({
    recipe: recipe(),
    headline: "A headline",
    language: "en",
    platform: "instagram",
    ...over,
  } as Parameters<typeof composePicture>[0]);

describe("the eyebrow on a carousel card", () => {
  it("is the counter, 1-based, and never the languages claim", () => {
    const p = compose({ counter: { index: 3, total: 5 } });
    const labels = byRole(p.root, "label");
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe("3 / 5");
    expect(labels[0].text).not.toMatch(/languages/i);
  });

  it("⛔ is drawn on EVERY layout, not only the two with an eyebrow", () => {
    /**
     * 🔴 A reader does not know which recipe was rolled. A counter that
     * appeared on two layouts in six would be a carousel that tells you where
     * you are a third of the time — which is worse than never, because the
     * reader stops looking for it.
     */
    for (const layout of ["rule-over", "centred-statement", "side-bar", "stacked-label", "offset-quote"]) {
      const p = compose({ recipe: recipe({ layout }), counter: { index: 2, total: 4 } });
      const labels = byRole(p.root, "label");
      expect(labels.map((l) => l.text), `layout ${layout} should carry the counter`).toContain("2 / 4");
    }
  });

  it("is absent on a single card, where it would be a count of one", () => {
    const p = compose({ recipe: recipe({ layout: "rule-over" }) });
    expect(byRole(p.root, "label")).toHaveLength(0);
  });
});

describe("how big a lone sentence is set", () => {
  const SHORT = "You tidy a drawer that was already tidy.";

  it("a short headline with no support line is set larger", () => {
    const plain = compose({ headline: "x".repeat(HEADLINE_MAX) });
    const short = compose({ headline: SHORT });
    expect(px(byRole(short.root, "headline")[0])).toBeGreaterThan(px(byRole(plain.root, "headline")[0]));
  });

  it("⛔ a headline WITH a support line is never enlarged", () => {
    /**
     * 🔴 THE REGRESSION THIS PINS. Scaling every short headline pushed the
     * support line through the bottom hairline on a 1200×630 Facebook card —
     * visible in one render, invisible in the code, and passing every test in
     * the suite at the time.
     */
    for (const platform of ["facebook", "instagram"]) {
      const plain = compose({ platform, headline: "x".repeat(HEADLINE_MAX), support: "A support line." });
      const short = compose({ platform, headline: SHORT, support: "A support line." });
      expect(px(byRole(short.root, "headline")[0]), platform).toBe(px(byRole(plain.root, "headline")[0]));
    }
  });

  it("⛔ a long slide is not enlarged either, so it cannot overflow", () => {
    // Slides are not length-capped: the scale has to come from the text's own
    // length, and reach 1 before the headline limit does.
    const long = compose({ headline: "A sentence that runs right up to the limit of what a card will hold." });
    const plain = compose({ headline: "x".repeat(HEADLINE_MAX) });
    expect(px(byRole(long.root, "headline")[0])).toBe(px(byRole(plain.root, "headline")[0]));
  });

  it("the enlargement is bounded, however short the card", () => {
    const tiny = compose({ headline: "Oh." });
    const plain = compose({ headline: "x".repeat(HEADLINE_MAX) });
    expect(px(byRole(tiny.root, "headline")[0])).toBeLessThanOrEqual(px(byRole(plain.root, "headline")[0]) * 1.45);
  });
});
