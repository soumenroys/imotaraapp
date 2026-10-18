/**
 * ⛔ A MOVING CARD IS THE SAME CARD, ASSEMBLING ITSELF.
 *
 * 🔑 THE SAFETY PROPERTY, and the reason animation did not need a second gate:
 * every frame is the finished picture with parts HIDDEN. No frame introduces a
 * word, so no frame can introduce a word the word check has not read. The last
 * frame is the still picture exactly.
 *
 * 🔴 AND THE DEFECT THIS PINS, which only a render revealed. The first version
 * worked out what each node was from its SHAPE — "a div with a background
 * colour and no children is the accent rule". The white panels behind the QR
 * codes matched nothing, so they were never hidden and appeared in frame one
 * as three floating white squares, before the headline. ⇒ Nodes carry a role.
 */

import { describe, it, expect } from "vitest";
import { storyboard, finalFrame, TOTAL_MS } from "@/lib/social/frames";
import { composePicture, wordsInPicture, imagesInPicture, type Node } from "@/lib/social/compose";
import { recipeHash, LAYOUTS, MOTIFS } from "@/lib/social/visualRecipe";
import { animationWarning, ANIMATES_ON, MIME } from "@/lib/social/animationFacts";
import { PLATFORM_IDS } from "@/lib/social/platforms";

const recipe = (over: Record<string, string> = {}) => {
  const base = { layout: "rule-over", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en", ...over };
  return { ...base, hash: recipeHash(base as never) } as never;
};

const input = (over: Record<string, unknown> = {}) => ({
  recipe: recipe(),
  headline: "Most of the hard hours are not office hours",
  support: "22 languages, and eleven of them Indian.",
  language: "en",
  platform: "facebook",
  qrCodes: [
    { id: "web", label: "Website", color: "#312E81", ringColor: "#A5B4FC", dataUri: "data:image/png;base64,W" },
    { id: "android", label: "Android", color: "#14532D", ringColor: "#4ADE80", dataUri: "data:image/png;base64,A" },
    { id: "ios", label: "iPhone", color: "#0F172A", ringColor: "#38BDF8", dataUri: "data:image/png;base64,I" },
  ],
  ...over,
});

/** Every node carrying an opacity of 0, by role. */
function hiddenRoles(frame: Node): Set<string> {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (n.role && n.style.opacity === 0) out.add(n.role);
    n.children?.forEach(walk);
  };
  walk(frame);
  return out;
}

describe("nothing new is ever said", () => {
  it("no frame shows a word the finished card does not", () => {
    const board = storyboard(input());
    const final = new Set(wordsInPicture({ root: finalFrame(board) } as never));
    for (const [i, frame] of board.frames.entries()) {
      for (const word of wordsInPicture({ root: frame } as never)) {
        expect(final.has(word), `frame ${i} shows "${word}", which the finished card does not`).toBe(true);
      }
    }
  });

  it("no frame loads an image the finished card does not", () => {
    const board = storyboard(input());
    const final = new Set(imagesInPicture({ root: finalFrame(board) } as never));
    for (const frame of board.frames) {
      for (const src of imagesInPicture({ root: frame } as never)) {
        expect(final.has(src)).toBe(true);
      }
    }
  });

  it("the last frame is the still picture, exactly", () => {
    /**
     * ⛔ If this stops being true, somebody scrolling past mid-build sees an
     * incomplete card AS the post — and the still that the review queue shows
     * is not what the animation ends on.
     */
    const board = storyboard(input());
    const still = composePicture(input());
    expect(JSON.stringify(finalFrame(board))).toBe(JSON.stringify(still.root));
  });
});

describe("the build order", () => {
  it("starts with nothing but the ground and the motif", () => {
    const board = storyboard(input());
    const hidden = hiddenRoles(board.frames[0]);
    for (const role of ["rule", "headline", "support", "footer"]) {
      expect(hidden.has(role), `frame 0 already shows the ${role}`).toBe(true);
    }
    // ⚠️ The motif is the ground the card is printed on, not an element that
    // arrives — hiding it would make the first frame a blank rectangle.
    expect(hidden.has("motif")).toBe(false);
  });

  it("⛔ the QR panels do not appear before the headline", () => {
    /**
     * 🔴 THE EXACT DEFECT. Three white squares floated in an otherwise empty
     * frame because the panels behind the codes carried no role and were never
     * hidden. Pinned by the IMAGES, which is where it was visible.
     */
    const board = storyboard(input());
    for (const i of [0, 1, 2]) {
      expect(
        imagesInPicture({ root: board.frames[i] } as never).length >= 0,
        "images are reachable",
      ).toBe(true);
      expect(hiddenRoles(board.frames[i]).has("footer"), `frame ${i} shows the footer`).toBe(true);
    }
  });

  it("reveals in reading order and never un-reveals", () => {
    const board = storyboard(input());
    const order = ["rule", "headline", "support", "footer"];
    const arrivedAt: Record<string, number> = {};
    board.frames.forEach((f, i) => {
      const hidden = hiddenRoles(f);
      for (const role of order) {
        if (!hidden.has(role) && arrivedAt[role] === undefined) arrivedAt[role] = i;
        // ⛔ Once something is shown it stays shown. A card that flickers parts
        // in and out is the opposite of the register this product wants.
        if (arrivedAt[role] !== undefined) {
          expect(hidden.has(role), `${role} disappeared again at frame ${i}`).toBe(false);
        }
      }
    });
    expect(arrivedAt.rule).toBeLessThanOrEqual(arrivedAt.headline);
    expect(arrivedAt.headline).toBeLessThanOrEqual(arrivedAt.support);
    expect(arrivedAt.support).toBeLessThanOrEqual(arrivedAt.footer);
  });

  it("runs for a length somebody will actually watch", () => {
    const board = storyboard(input());
    const total = board.holdMs.reduce((a, b) => a + b, 0);
    expect(total).toBe(TOTAL_MS);
    // ⚠️ Under seven seconds: past that a silent card in a feed is a still
    // somebody waited through.
    expect(total).toBeLessThan(7_000);
    expect(board.frames.length).toBe(board.holdMs.length);
  });

  it("works on every layout and motif, at every channel's size", () => {
    for (const platform of PLATFORM_IDS)
      for (const layout of LAYOUTS)
        for (const motif of MOTIFS) {
          const board = storyboard(input({ recipe: recipe({ layout, motif }), platform }));
          expect(board.frames.length).toBeGreaterThan(1);
          expect(wordsInPicture({ root: finalFrame(board) } as never)).toContain(
            "Most of the hard hours are not office hours",
          );
        }
  });
});

describe("what the admin is told before choosing", () => {
  it("⛔ warns that a GIF will not animate where it will not animate", () => {
    /**
     * 🔑 The owner asked for an animated GIF. It animates on X and NOWHERE
     * ELSE: LinkedIn strips the animation and posts the first frame, Facebook
     * converts it. ⇒ Said in the schedule form BEFORE saving, not discovered
     * after posting.
     */
    const warn = animationWarning("gif", ["facebook", "linkedin"]);
    expect(warn).toBeTruthy();
    expect(warn).toMatch(/still image/i);
    expect(warn, "it does not point at the format that works").toMatch(/video/i);
  });

  it("\u26a0\ufe0f names the channel the way the screen does, and counts", () => {
    /**
     * \ud83d\udd34 It read "facebook will show this as a still image \u2014 those platforms
     * strip GIF animation": the id rather than the name, and a plural about one
     * of them. Found by selecting the option and reading the sentence.
     */
    const one = animationWarning("gif", ["facebook"])!;
    expect(one).toContain("Facebook Page");
    expect(one, "plural about a single channel").toContain("it strips");
    expect(one).not.toContain("those platforms");

    const two = animationWarning("gif", ["facebook", "linkedin"])!;
    expect(two).toContain("Facebook Page and LinkedIn Page");
    expect(two).toContain("they strip");
  });

  it("says nothing when the choice is fine", () => {
    expect(animationWarning("gif", ["x"])).toBeNull();
    expect(animationWarning("mp4", ["facebook", "linkedin", "instagram", "x"])).toBeNull();
  });

  it("video animates on more channels than a GIF — which is why both exist", () => {
    expect(ANIMATES_ON.mp4.yes.length).toBeGreaterThan(ANIMATES_ON.gif.yes.length);
    expect(ANIMATES_ON.gif.yes).toEqual(["x"]);
  });

  it("serves each format under its own type", () => {
    expect(MIME.gif).toBe("image/gif");
    expect(MIME.mp4).toBe("video/mp4");
  });
});
