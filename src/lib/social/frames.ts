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
/**
 * 🔴 NO LONGER A CONSTANT, BECAUSE THE LENGTH IS NOW THE CONTENT'S.
 *
 * It was 6,200ms when the clip showed one line held in five steps. A post
 * with four sentences cannot be 6.2 seconds without racing past three of
 * them — four sentences at a readable pace is about 18 seconds, and that is
 * reading time rather than a number anybody chose.
 *
 * ⛔ WHAT MUST STILL HOLD is the thing the old ceiling was protecting: no
 * single frame may sit long enough to become a still somebody waited
 * through. That is now asserted per FRAME rather than as a total
 * ⇒ MAX_SCENE_MS and the tests.
 */
export function totalMs(holdMs: number[]): number {
  return holdMs.reduce((a, b) => a + b, 0);
}

/** ⚠️ The longest any one frame may be held. ⛔ The ceiling that actually
 *  matters: a clip is long because it SAYS more, never because it waits. */
export const MAX_HOLD_MS = 5_400;

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

/**
 * 🔴 HOW LONG EACH SENTENCE STAYS ON SCREEN.
 *
 * ⚠️ READING SPEED, NOT A ROUND NUMBER. Comfortable silent reading is roughly
 * 200 words a minute, and a feed is not a comfortable place — so this is
 * deliberately slower, about 150, with a floor so a three-word line still
 * gets a beat rather than a flicker.
 *
 * ⛔ The post's FIRST line is unaffected by any of this: a reader who leaves
 * after two seconds has still seen the headline, which is the whole post
 * ⇒ writer.ts, "the first line is the whole post".
 */
const MS_PER_WORD = 380;
const MIN_SCENE_MS = 1_600;
/**
 * ⚠️ THE CAP IS WHAT ACTUALLY DECIDES THE LENGTH, and that is worth knowing.
 * Our sentences run 14–26 words, so every one of them asks for more than this
 * and gets exactly this. 3.8s for a 15-word line is about 240 words a minute
 * — brisk for a book, normal for a feed.
 *
 * ⛔ Four sentences at a readable pace is ~17 seconds whatever the pacing
 * numbers say. That is reading time, not a tuning choice, and shortening it
 * means showing FEWER sentences rather than faster ones.
 */
const MAX_SCENE_MS = 3_800;

export function sceneHold(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_SCENE_MS, Math.min(MAX_SCENE_MS, words * MS_PER_WORD));
}

/**
 * 🔑 THE SENTENCES, AS SCENES.
 *
 * ⛔ The owner, 19 Oct: "if we can add more graphics and visuals with some
 * more content ... that will be better". The body had FOUR sentences and the
 * video showed ONE — so a longer video would have been the same two lines
 * held for longer, which is not more content, it is a slower post.
 *
 * ⚠️ SPLIT ON SENTENCE ENDS, WHICH IS FRAGILE, AND BOUNDED BECAUSE OF IT.
 * An abbreviation, a decimal or a quoted full stop changes how many scenes
 * appear ⇒ the same hazard recorded against carousels, where slides are ASKED
 * for rather than cut out of the body. Here there is nothing to ask: the body
 * is already written. So the split is capped, and a body it cannot split
 * cleanly simply yields one scene — the behaviour this has always had.
 */
export function sentencesOf(body: string, max = 4): string[] {
  const parts = body
    .split(/(?<=[.!?।])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return parts.slice(0, max);
}

export function storyboard(input: FrameInput): Storyboard {
  /**
   * ⚠️ ONE COMPOSITION PER SCENE, because the support line CHANGES between
   * them. The old storyboard composed once and toggled opacity, which is why
   * it could only ever show the one line it was given.
   */
  const sentences = sentencesOf(input.support ?? "");
  const scenes = sentences.length > 1 ? sentences : [input.support ?? ""];

  const frames: Node[] = [];
  const holdMs: number[] = [];

  // ── The build: rule, then headline, before any sentence arrives ──────────
  const first = composePicture({ ...input, support: scenes[0] });
  frames.push(withVisibility(first.root, { rule: false, headline: false, support: false, footer: false }));
  holdMs.push(350);
  frames.push(withVisibility(first.root, { rule: true, headline: false, support: false, footer: false }));
  holdMs.push(400);
  // ⚠️ The headline alone, long enough to read before anything joins it: for
  // most viewers this IS the post ⇒ "the first line is the whole post".
  frames.push(withVisibility(first.root, { rule: true, headline: true, support: false, footer: false }));
  holdMs.push(1_300);

  /**
   * ── One scene per sentence, and the LAST one carries the footer ─────────
   *
   * 🔑 MERGED RATHER THAN APPENDED, which saves three seconds and is better
   * design: the mark and the codes arrive WITH the closing line instead of
   * after it, so the clip does not end on an epilogue nobody is reading.
   *
   * ⛔ IT ALSO KEEPS THE PROPERTY THAT MATTERS. The last frame is the
   * finished card — mark, codes and all — which is what a reader sees if they
   * scroll past mid-play and what a platform is most likely to take as a
   * thumbnail. A half-built frame there would BE the post, for most people
   * ⇒ finalFrame.
   */
  for (const [i, sentence] of scenes.entries()) {
    const isLast = i === scenes.length - 1;
    const picture = i === 0 ? first : composePicture({ ...input, support: sentence });
    frames.push(withVisibility(picture.root, { rule: true, headline: true, support: true, footer: isLast }));
    // ⚠️ The closing line is held longer: it is the one most likely to be
    // seen as a still, and the only one sharing the frame with the codes.
    holdMs.push(sceneHold(sentence) + (isLast ? 1_600 : 0));
  }

  return {
    width: first.width,
    height: first.height,
    frames,
    holdMs,
    notes: [
      ...first.notes,
      // ⚠️ Said to the reviewer, because a moving post is harder to judge from
      // a still and they are approving the whole thing.
      `This one moves: ${scenes.length} line${scenes.length === 1 ? "" : "s"} arrive in turn, then the ` +
        `mark and the codes. It ends on the finished card.`,
    ],
    wordmark: first.wordmark,
  };
}

/** The last frame is the finished card. ⛔ If this ever stops being true, a
 *  reader who scrolls past mid-build sees something incomplete as the post. */
export function finalFrame(board: Storyboard): Node {
  return board.frames[board.frames.length - 1];
}
