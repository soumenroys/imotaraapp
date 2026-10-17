// src/lib/social/frames.ts
// The storyboard: a card that assembles itself.
//
// 🔑 KEYFRAMES, NOT A FRAME RATE. A six-second clip at 24fps is 144 renders,
// and each one goes through Satori — half a minute of compute for a card that
// is mostly still. ⇒ Ten keyframes, each held for a beat, and the encoder
// repeats them. The motion is a build, not a movie: a rule draws in, the words
// arrive, the mark and the codes land.
//
// ⚠️ WHY A BUILD AND NOT AN EFFECT. The one thing a moving post must not do on
// this product is demand attention — no shake, no flash, no zoom. Somebody
// meeting this on a bad day should see a sentence appear calmly. ⇒ Everything
// here is reveal and settle; there is deliberately no code path for anything
// that pulses, bounces or strobes.
//
// ⛔ AND NOTHING NEW IS SAID. Every frame is the SAME picture with fewer parts
// showing. A frame cannot introduce a word the gate has not read, because no
// frame introduces words at all — it only stops hiding them.

import { composePicture, type Picture, type Node } from "@/lib/social/compose";
import type { Recipe } from "@/lib/social/visualRecipe";
import type { QrCode } from "@/lib/social/brandMarks";

export type FrameInput = {
  recipe: Recipe;
  headline: string;
  support?: string;
  language: string;
  platform: string;
  qrCodes?: QrCode[];
};

export type Storyboard = {
  width: number;
  height: number;
  /** Each frame is a complete picture tree, ready to render. */
  frames: Node[];
  /** How long each frame is held, in milliseconds. */
  holdMs: number[];
  notes: string[];
  wordmark: Picture["wordmark"];
};

/** How long the whole thing runs. ⚠️ Under seven seconds: past that a silent
 *  card in a feed is just a still that somebody waited through. */
export const TOTAL_MS = 6_200;

/**
 * What is visible at each step.
 *
 * 🔑 The order is the reading order, which is the point: a reader's eye is led
 * down the card once rather than landing on a finished composition and hunting.
 */
const STEPS = [
  { show: { rule: false, headline: false, support: false, footer: false }, hold: 500 },
  { show: { rule: true, headline: false, support: false, footer: false }, hold: 450 },
  { show: { rule: true, headline: true, support: false, footer: false }, hold: 1200 },
  { show: { rule: true, headline: true, support: true, footer: false }, hold: 900 },
  { show: { rule: true, headline: true, support: true, footer: true }, hold: 3150 },
] as const;

/** Opacity is the only thing that changes. ⛔ No movement, no scale: a card
 *  that slides is a card that cannot be read while it slides. */
const HIDDEN = 0;

/** Which step each role arrives at. ⚠️ The motif is never hidden — it is the
 *  ground the card is printed on, not an element that appears. */
const ARRIVES: Record<string, keyof (typeof STEPS)[number]["show"] | null> = {
  motif: null,
  label: "rule",
  rule: "rule",
  headline: "headline",
  support: "support",
  footer: "footer",
};

/**
 * Walk the tree and dim the parts that have not arrived yet.
 *
 * 🔴 IT READS A ROLE. The first version inferred one from each node's shape —
 * "a div with a background colour and no children is the accent rule" — and
 * was wrong immediately: the white panels behind the QR codes matched nothing,
 * so they were never hidden and appeared in the first frame as three floating
 * white squares, before the headline.
 *
 * ⚠️ IT HIDES, IT DOES NOT REMOVE. Taking a node out changes the layout, so
 * the headline would jump as the support line appeared. Everything occupies
 * its final place from frame one and simply becomes visible — which is also
 * why the last frame is pixel-identical to the still picture.
 */
function withVisibility(
  root: Node,
  show: (typeof STEPS)[number]["show"],
): Node {
  const walk = (n: Node): Node => {
    const gate = n.role ? ARRIVES[n.role] : undefined;
    /**
     * ⚠️ OPACITY IS SET ONLY WHEN HIDING. Writing `opacity: 1` on a shown node
     * renders identically but makes the final frame a different OBJECT from the
     * still picture — and "the last frame is the still, exactly" is a property
     * worth being able to assert rather than approximate.
     */
    const style =
      gate === undefined || gate === null || show[gate]
        ? n.style
        : { ...n.style, opacity: HIDDEN };

    // ⛔ A role covers everything inside it. Recursing past the footer would
    // let a child override the parent and reintroduce the white-panel bug.
    const children = n.role && gate ? n.children : n.children?.map(walk);

    return { ...n, style, children };
  };

  return walk(root);
}

export function storyboard(input: FrameInput): Storyboard {
  const picture = composePicture(input);

  return {
    width: picture.width,
    height: picture.height,
    frames: STEPS.map((s) => withVisibility(picture.root, s.show)),
    holdMs: STEPS.map((s) => s.hold),
    notes: [
      ...picture.notes,
      // ⚠️ Said to the reviewer, because a moving post is harder to judge from
      // a still and they are approving the whole thing.
      "This one moves: the words arrive, then the mark and the codes. It ends on the still picture.",
    ],
    wordmark: picture.wordmark,
  };
}

/** The last frame is the finished card. ⛔ If this ever stops being true, a
 *  reader who scrolls past mid-build sees something incomplete as the post. */
export function finalFrame(board: Storyboard): Node {
  return board.frames[board.frames.length - 1];
}
