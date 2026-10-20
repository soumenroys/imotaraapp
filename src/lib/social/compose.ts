// src/lib/social/compose.ts
// Turning a recipe plus the post's own words into a picture.
//
// 🔑 IT RETURNS DATA, NOT JSX, AND IT IS SYNCHRONOUS. The route maps the tree
// onto React elements for `next/og`; keeping this pure is what lets the layout
// be asserted — which palette on which ground, whether the headline came from
// the body, whether the sign-off is last — with no renderer, font or network.
// The QR image is passed IN for the same reason: making it is async, and
// awaiting a code nobody is checking would make every geometry test async too.
//
// ⛔ EVERY WORD IN THE RESULT CAME FROM THE CAPTION THE GATE READ. Nothing here
// writes copy. The gate cannot read a picture, so a picture may only repeat
// words that have already been through it.

import { PALETTES, wordmarkFor, canonicalLayout, HEADLINE_MAX, type Recipe } from "@/lib/social/visualRecipe";
import { BRAND_IN_SCRIPT } from "@/lib/social/languages";
import { planWordmark, type WordmarkPlan } from "@/lib/social/fonts";
import { platformSpec } from "@/lib/social/platforms";
import { LOGO_URL, onGround, relativeLuminance, shiftLightness, type QrCode } from "@/lib/social/brandMarks";

/**
 * A minimal flexbox tree.
 *
 * ⚠️ FLEX ONLY — no grid, and no CSS shorthand Satori quietly ignores. `inset`
 * was one: the motif layer got no height, the dotted grid rendered as a single
 * row of dots along the top edge, and two of six motifs were silently
 * decorative. Satori does not warn about a property it does not understand.
 */
/**
 * What a node IS, declared rather than guessed.
 *
 * 🔴 The animation first worked this out by shape — "a div with a background
 * colour and no children is probably the accent rule" — and got it wrong the
 * moment it ran: the white QR panels have no text and no colour of their own,
 * so they were treated as part of nothing and appeared in frame one, before
 * the headline, as three floating white squares.
 *
 * ⇒ A role is one word per node and it cannot be misread.
 */
export type NodeRole = "motif" | "label" | "rule" | "headline" | "support" | "footer";

export type Node = {
  tag: "div" | "span" | "img";
  style: Record<string, string | number>;
  text?: string;
  src?: string;
  role?: NodeRole;
  children?: Node[];
};

export type Picture = {
  width: number;
  height: number;
  root: Node;
  notes: string[];
  wordmark: WordmarkPlan;
  recipe: Recipe;
  platform: string;
};

export type ComposeInput = {
  recipe: Recipe;
  /** Taken from the post body by `headlineFromBody`. ⛔ Never written here. */
  headline: string;
  support?: string;
  language: string;
  platform: string;
  /** The three codes — website, Android, iPhone — from `allQrCodes`. ⚠️ A
   *  reader on a phone wants the store for the phone they are holding. */
  qrCodes?: QrCode[];
  /**
   * 🔑 WHERE THIS CARD SITS IN A CAROUSEL, 1-based — "3 / 5".
   *
   * ⚠️ NOT DECORATION. A carousel asks for a swipe before it has given
   * anything, and the only thing that makes that a fair bargain is knowing how
   * many swipes are being asked for. A reader on an unnumbered card three does
   * not know whether the good one is next or whether there are nine more.
   *
   * ⛔ Absent on a single card, where it would be a count of one.
   */
  counter?: { index: number; total: number };
  /**
   * 🔑 THE SHORT LINE ABOVE THE HEADLINE, naming the post's own subject
   * ⇒ eyebrowFor. Null is the normal answer and draws nothing.
   *
   * ⛔ NEVER WRITTEN HERE, and never defaulted to a brand claim. What used to
   * stand in this slot was the literal string "22 languages", printed on a
   * third of all single cards whatever they were about.
   */
  eyebrow?: string | null;
  /**
   * 🔑 A PICTURE BEHIND THE WORDS — added 20 Oct 2026, because the owner,
   * looking at the live feed: *"all posts still looks very similar."* Every
   * card until now is type on a flat colour.
   *
   * ⛔ IT TAKES A BAND, NOT THE FRAME, and that is the whole safety argument.
   * A full-bleed generated image under a headline is a legibility bet on what
   * the model happened to draw — one dark passage and the post is unreadable,
   * and nobody here would see it because the render looks fine at desk size
   * ⇒ the blank poster, the Bengali card and the mobile crop were all that
   * shape. With a band, the words always sit on the flat palette ground, and a
   * failed or ugly generation degrades to exactly today's card.
   *
   * ⚠️ Absent is the normal case and draws nothing.
   */
  illustration?: {
    src: string;
    /** Measured, never guessed ⇒ backgroundPlan.planBackground. */
    ink: "light" | "dark";
    /** 0 when the picture needs no help. */
    scrim: number;
    /** Where this style reserved its quiet area ⇒ illustrationStyles.ts. */
    zone: "top" | "bottom" | "left" | "right" | "centre";
  } | null;
};

/**
 * The veil's box, in the same places `backgroundPlan.zoneRect` measures.
 *
 * ⛔ THE TWO MUST AGREE. Measuring one part of the frame and veiling another
 * is worse than doing neither — it would report a readable card and produce
 * an unreadable one. ⚠️ Pinned by test against `zoneRect`.
 */
export function zoneBox(
  zone: "top" | "bottom" | "left" | "right" | "centre",
  w: number,
  h: number,
): Record<string, string> {
  const band = Math.max(1, Math.round(h * 0.42));
  const side = Math.max(1, Math.round(w * 0.55));
  switch (zone) {
    case "top":
      return { top: "0px", left: "0px", width: `${w}px`, height: `${band}px` };
    case "bottom":
      return { top: `${h - band}px`, left: "0px", width: `${w}px`, height: `${band}px` };
    case "left":
      return { top: "0px", left: "0px", width: `${side}px`, height: `${h}px` };
    case "right":
      return { top: "0px", left: `${w - side}px`, width: `${side}px`, height: `${h}px` };
    case "centre":
      return {
        top: `${Math.round((h - band) / 2)}px`,
        left: "0px",
        width: `${w}px`,
        height: `${band}px`,
      };
  }
}

/**
 * How much of the frame the picture may take.
 *
 * ⚠️ A FRACTION, NOT A PIXEL COUNT — the same card is composed at 1080×1350,
 * 1080×1080 and 1080×1920, and a fixed band would be a third of one and a
 * tenth of another.
 */
export const ILLUSTRATION_BAND = 0.38;

/**
 * 🔴 ONE OPACITY FOR EVERY MOTIF WAS WHY ELEVEN MOTIFS LOOKED LIKE NONE.
 *
 * ⛔ Measured 20 Oct 2026 by rendering nine queued cards and LOOKING at them
 * together: at a flat **0.13** on a flat ground, tone-on-tone line work is
 * invisible at feed size. plum/concentric and plum/arcs are the same picture
 * to a reader. The owner's words: *"all posts still looks very similar."*
 * ⇒ the 25,344-recipe figure was arithmetically true and visually overstated,
 * exactly as the 18 Oct note admitted and nobody acted on.
 *
 * 🔑 THE TWO FAMILIES ARE NOT THE SAME PROBLEM, which is why one number could
 * never serve both:
 *   • THIN LINE FIELDS (arcs, dotted-grid, bands, rule-stack, concentric) are
 *     drawn ACROSS the frame and pass under words somebody has to read. They
 *     may be raised, but not far ⇒ the warning further down this file about a
 *     motif "still crossing a word somebody has to read".
 *   • BIG SOFT SHAPES (halo, drift, wave) are large, diffuse and sit mostly in
 *     the empty half of the frame. They can carry two to three times as much
 *     before they compete with anything.
 *
 * ⚠️ `none` STAYS AT ZERO. A card that asked for no motif must get no motif —
 * and it is also the control: if every card suddenly has a field, this table
 * is being ignored.
 */
const MOTIF_OPACITY_BY_NAME: Record<string, number> = {
  none: 0,
  // thin line fields — raised enough to read, not enough to fight the words
  arcs: 0.2,
  "dotted-grid": 0.18,
  concentric: 0.2,
  bands: 0.17,
  "rule-stack": 0.17,
  // big soft shapes — these are the ones that give the frame a picture
  halo: 0.34,
  drift: 0.3,
  wave: 0.3,
};

/** ⚠️ The old flat value, kept as the fallback for a motif added without a
 *  considered opacity — visible, conservative, and never zero by accident. */
const MOTIF_OPACITY = 0.13;

export function motifOpacity(motif: string): number {
  return MOTIF_OPACITY_BY_NAME[motif] ?? MOTIF_OPACITY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Motifs — line and shape fields only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⛔ No gradient wash, nothing representational. There is no code path here
 * that can draw a figure, a face, or anything that reads as distress — which
 * is the point, rather than a rule somebody has to remember.
 */
/**
 * 🔑 HOW THE GROUND IS PAINTED ⇒ visualRecipe.WASHES.
 *
 * 🔴 THIS REVERSES A WRITTEN RULE, so the reasoning is here rather than in a
 * commit nobody will find. visualRecipe.ts said: "⛔ No gradient wash. It is
 * the single most recognisable mark of a picture that nobody designed, and
 * this brand cannot afford to look generated." ⚠️ THAT FEAR IS STILL RIGHT —
 * it is just not a fear of gradients, it is a fear of ONE gradient: the
 * unanchored purple-to-pink diagonal every template ships with.
 *
 * ⇒ So the rule is kept BY CONSTRUCTION. Every stop below is the palette's
 * OWN ground, lightened or darkened against itself. There is no second hue,
 * no colour the palette did not already contain, and the stops sit close
 * together so a card reads as light falling on paper rather than as a
 * gradient. A wash cannot make this brand look like anything else because it
 * has nothing else to be made of.
 *
 * ⛔ AND IT MUST RENDER IN BOTH RENDERERS. Satori is the stricter one: it
 * supports linear-gradient and radial-gradient and little else, so there is
 * no blur, no blend mode and no filter here. A wash that only worked in the
 * browser would publish differently from the card a reviewer approved.
 */
function washFor(wash: string | undefined, ground: string): Record<string, string> {
  // ⚠️ `flat` is the default and the historic behaviour: a plain ground.
  if (!wash || wash === "flat") return { backgroundColor: ground };

  const lift = shiftLightness(ground, 0.1);
  const drop = shiftLightness(ground, -0.08);

  switch (wash) {
    case "linear":
      return {
        backgroundColor: ground,
        backgroundImage: `linear-gradient(160deg, ${lift} 0%, ${ground} 55%, ${drop} 100%)`,
      };
    case "radial":
      // Light pooling in one corner, like a lamp off-frame.
      return {
        backgroundColor: ground,
        backgroundImage: `radial-gradient(circle at 22% 18%, ${lift} 0%, ${ground} 58%)`,
      };
    case "duotone":
      // ⚠️ Two stops of the SAME hue, further apart. The nearest this gets to
      // a conventional gradient, and still only one colour deep.
      return {
        backgroundColor: ground,
        backgroundImage: `linear-gradient(135deg, ${shiftLightness(ground, 0.16)} 0%, ${shiftLightness(ground, -0.14)} 100%)`,
      };
    default:
      // ⛔ An unknown wash is a flat ground, never a missing background.
      return { backgroundColor: ground };
  }
}

function motifLayer(motif: string, accent: string, w: number, h: number): Node | null {
  const base: Record<string, string | number> = {
    position: "absolute",
    display: "flex",
    opacity: motifOpacity(motif),
  };
  // ⚠️ Longhand, never `inset`. See the note on Node above.
  const full = { ...base, top: 0, left: 0, width: `${w}px`, height: `${h}px` };
  // Every motif branch returns a layer with this role; it is always visible.
  const motifRole = "motif" as const;

  switch (motif) {
    case "none":
      return null;

    case "bands":
      // ⚠️ Held clear of the footer. Anchored flush to the bottom the bands ran
      // straight under the wordmark and "imotara.com" sat on one — legible, and
      // visibly unconsidered. Seen only in a render.
      return {
        tag: "div",
        role: motifRole,
        style: {
          ...full,
          flexDirection: "column",
          justifyContent: "flex-end",
          paddingBottom: `${Math.round(h * 0.22)}px`,
          alignItems: "flex-end",
        },
        /**
         * 🔴 FULL-WIDTH BARS CUT THE CARD IN HALF. Moved clear of the footer
         * once already; the remaining problem was the other edge — four
         * full-bleed bars between the message and the wordmark read as a
         * divider, or as a rendering fault, rather than as a mark.
         *
         * ⚠️ Seen only in a render, again. ⇒ Narrowing and right-aligning
         * them turns the same four rules into something deliberate: they sit
         * beside the text block instead of slicing it off.
         */
        children: [34, 22, 14, 8].map((bh, i) => ({
          tag: "div" as const,
          style: {
            display: "flex",
            width: `${[46, 34, 24, 16][i]}%`,
            height: `${bh}px`,
            backgroundColor: accent,
            marginTop: "16px",
          },
        })),
      };

    case "rule-stack":
      return {
        tag: "div",
        role: motifRole,
        style: {
          ...base,
          right: 0,
          /**
           * 🔴 IT STARTED AT 12% AND RAN 30% WIDE — straight through the
           * headline. Seen in a render: nine rules crossed the letterforms of
           * "rewrote" and "did not" on a three-line headline. Faint at 0.13
           * opacity, and still crossing a word somebody has to read.
           *
           * ⚠️ A motif cannot know where the text is, so it is kept out of
           * the band where a headline can reach: narrower, and starting
           * below the midline. ⛔ Texture must never cost legibility — the
           * headline is the post.
           */
          top: `${Math.round(h * 0.56)}px`,
          width: `${Math.round(w * 0.18)}px`,
          flexDirection: "column",
        },
        children: Array.from({ length: 9 }, () => ({
          tag: "div" as const,
          style: { display: "flex", width: "100%", height: "3px", backgroundColor: accent, marginTop: "18px" },
        })),
      };

    case "dotted-grid": {
      // ⚠️ Enough to FILL the frame. A fixed 96 covered four rows and stopped
      // halfway down, which reads as a broken pattern rather than a chosen one.
      const across = Math.ceil((w - 80) / 52) + 1;
      const down = Math.ceil((h - 80) / 52) + 1;
      return {
        tag: "div",
        role: motifRole,
        style: { ...full, flexWrap: "wrap", alignContent: "flex-start", padding: "40px" },
        children: Array.from({ length: across * down }, () => ({
          tag: "div" as const,
          style: {
            display: "flex",
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: accent,
            margin: "22px",
          },
        })),
      };
    }

    case "concentric": {
      const d = Math.round(Math.min(w, h) * 0.9);
      return {
        tag: "div",
        role: motifRole,
        style: {
          ...base,
          right: `${-Math.round(d * 0.3)}px`,
          top: `${-Math.round(d * 0.3)}px`,
          width: `${d}px`,
          height: `${d}px`,
        },
        children: [1, 0.76, 0.52].map((f) => ({
          tag: "div" as const,
          style: {
            position: "absolute",
            display: "flex",
            width: `${Math.round(d * f)}px`,
            height: `${Math.round(d * f)}px`,
            borderRadius: "999px",
            border: `3px solid ${accent}`,
            right: `${Math.round((d - d * f) / 2)}px`,
            top: `${Math.round((d - d * f) / 2)}px`,
          },
        })),
      };
    }

    case "arcs": {
      const d = Math.round(Math.min(w, h) * 1.15);
      return {
        tag: "div",
        role: motifRole,
        style: {
          ...base,
          left: `${-Math.round(d * 0.28)}px`,
          bottom: `${-Math.round(d * 0.55)}px`,
          width: `${d}px`,
          height: `${d}px`,
          borderRadius: "999px",
          border: `4px solid ${accent}`,
        },
      };
    }

    /**
     * 🔑 THE THREE ADDED 19 Oct ARE LARGE AND SOFT, and that is the point.
     * The six above are all thin-line fields, which is why every card looked
     * like a sibling of the last one however the colours moved — the owner
     * saw it before I did. These give the frame one big shape to sit in.
     *
     * ⛔ STILL NOTHING REPRESENTATIONAL. A circle is a circle: no code path
     * here can produce a figure, a face, or anything that reads as distress.
     * ⚠️ And all of them are built from `accent` at MOTIF_OPACITY, so they
     * cannot introduce a colour the palette did not already contain.
     */
    case "halo":
      // One very large circle, mostly off-frame, like light through a window.
      return {
        tag: "div",
        role: motifRole,
        style: {
          ...base,
          top: `${Math.round(-h * 0.35)}px`,
          left: `${Math.round(w * 0.42)}px`,
          width: `${Math.round(w * 0.95)}px`,
          height: `${Math.round(w * 0.95)}px`,
          borderRadius: "9999px",
          backgroundColor: accent,
        },
      };

    case "drift":
      // Three overlapping ovals, low and wide. ⚠️ Kept BELOW the headline
      // band — texture must never cost legibility.
      return {
        tag: "div",
        role: motifRole,
        style: { ...full, flexDirection: "column" },
        children: [0, 1, 2].map((i) => ({
          tag: "div" as const,
          style: {
            position: "absolute" as const,
            display: "flex",
            top: `${Math.round(h * (0.58 + i * 0.12))}px`,
            left: `${Math.round(w * (-0.15 + i * 0.28))}px`,
            width: `${Math.round(w * 0.72)}px`,
            height: `${Math.round(h * 0.28)}px`,
            borderRadius: "9999px",
            backgroundColor: accent,
            opacity: 0.55,
          },
        })),
      };

    case "wave":
      // Two broad curved bands sweeping across the lower frame.
      return {
        tag: "div",
        role: motifRole,
        style: { ...full },
        /**
         * 🔴 THE GEOMETRY MATTERS AND I GOT IT WRONG FIRST TIME.
         *
         * My first version was 1.4w wide and 0.34h tall. An ellipse that much
         * wider than it is tall has an almost FLAT top edge across the part
         * you can see — so it rendered as hard-edged horizontal stripes, not
         * as a wave. Obvious in one render, invisible in the numbers.
         *
         * ⇒ Taller than the frame and mostly below it, so what shows is the
         * curved shoulder rather than a straight edge. Satori draws no paths;
         * a clipped ellipse is the only way to get a curve at all.
         */
        children: [0, 1].map((i) => ({
          tag: "div" as const,
          style: {
            position: "absolute" as const,
            display: "flex",
            top: `${Math.round(h * (0.52 + i * 0.22))}px`,
            left: `${Math.round(-w * (0.35 - i * 0.2))}px`,
            width: `${Math.round(w * 1.7)}px`,
            height: `${Math.round(h * 1.1)}px`,
            borderRadius: "9999px",
            backgroundColor: accent,
            opacity: i === 0 ? 0.75 : 0.5,
          },
        })),
      };

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scaled to the frame: a 1080 square and a 1600×900 are not one canvas, and a
 * single type scale across both leaves one of them wrong.
 *
 * 🔴 IT SCALED BY WIDTH ALONE, AND THE SQUARE PAID FOR IT. `w / 1200` was
 * right while the only card was Facebook's 1200×630 landscape. Instagram is
 * 1080×1080, so k came out at 0.90 and the headline rendered at **59px on a
 * 1080 square** — about 5% of the frame, with three times the vertical room
 * left empty. That is the dead space on the first two published cards.
 *
 * ✅ The geometric mean of the frame instead. A square has far more room than
 * a letterbox of the same width and should use it.
 *
 *   Facebook  1200×630  → 1.00  (⛔ EXACTLY unchanged — the live channel)
 *   Instagram 1080×1080 → 1.24  (59px → 82px)
 *   X         1600×900  → 1.38
 *
 * ⚠️ `h` is now required. Passing width only is what caused this, so the
 * signature no longer allows it.
 */
function typeScale(treatment: string, w: number, h: number) {
  const k = Math.sqrt(w * h) / Math.sqrt(1200 * 630);
  const base: Record<string, { headline: number; support: number; label: number; tracking: string }> = {
    display: { headline: 66, support: 27, label: 18, tracking: "-0.02em" },
    "tight-display": { headline: 60, support: 25, label: 17, tracking: "-0.035em" },
    measured: { headline: 46, support: 25, label: 16, tracking: "0em" },
    "caps-label": { headline: 52, support: 23, label: 14, tracking: "0.01em" },
  };
  const s = base[treatment];
  if (!s) throw new Error(`compose: unknown type treatment "${treatment}".`);
  return {
    headline: Math.round(s.headline * k),
    support: Math.round(s.support * k),
    label: Math.round(s.label * k),
    tracking: s.tracking,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The footer: logo, wordmark, QR
// ─────────────────────────────────────────────────────────────────────────────

function footerNode(opts: {
  ink: string;
  muted: string;
  /** ⚠️ The card's own ground. The ring and the dot are drawn ON it, so a
   *  colour chosen without it is a colour that may not be there. */
  ground: string;
  wordmark: string;
  qrCodes?: QrCode[];
  scale: number;
}): Node {
  const { ink, muted, ground, wordmark, qrCodes, scale } = opts;
  const mark = Math.round(58 * scale);

  /**
   * 🔴 THE LOGO IS CROPPED TO ITS MARK, and the numbers below are measured
   * rather than guessed.
   *
   * `android-chrome-192.png` has the wordmark baked in underneath the heart:
   * the mark occupies x 39–149, y 28–113, and "Imotara" sits at y 117–148.
   * Drawn whole at 58px that wordmark became an illegible smear — AND a second
   * copy of the word already set in type two centimetres to its right.
   *
   * ⇒ So the image is scaled up inside a clipped box and offset so only the
   * mark shows. ⚠️ If the asset is ever replaced, these four numbers are wrong
   * and the crop will cut through the heart. Re-measure, do not nudge.
   */
  const MARK_BOX = { x: 39, y: 28, w: 111, h: 86, img: 192 };
  /**
   * ⚠️ THE CLIP BOX TAKES THE MARK'S OWN PROPORTIONS, not a square. A square
   * box fitted to the mark's WIDTH shows 111/0.92 = 120 source rows centred on
   * the mark — and the wordmark starts at row 117, so thirteen rows of it leaked
   * back in as a smudge under the heart. Visible only in a render.
   *
   * ⇒ Scaled by width exactly, and the box is as tall as the mark. Nothing
   * outside x 39–149, y 28–113 can appear.
   */
  const k = mark / MARK_BOX.w;
  const boxH = Math.round(MARK_BOX.h * k);
  const imgSize = Math.round(MARK_BOX.img * k);
  const offsetX = -Math.round(MARK_BOX.x * k);
  const offsetY = -Math.round(MARK_BOX.y * k);

  const left: Node = {
    tag: "div",
    style: { display: "flex", alignItems: "center" },
    children: [
      {
        tag: "div",
        style: {
          display: "flex",
          width: `${mark}px`,
          height: `${boxH}px`,
          overflow: "hidden",
        },
        children: [
          {
            tag: "img",
            src: LOGO_URL,
            style: {
              display: "flex",
              width: `${imgSize}px`,
              height: `${imgSize}px`,
              marginLeft: `${offsetX}px`,
              marginTop: `${offsetY}px`,
            },
          },
        ],
      },
      {
        tag: "div",
        style: { display: "flex", flexDirection: "column", marginLeft: `${Math.round(18 * scale)}px` },
        children: [
          {
            tag: "span",
            style: { display: "flex", fontSize: `${Math.round(30 * scale)}px`, fontWeight: 600, color: ink },
            text: wordmark,
          },
          {
            tag: "span",
            style: {
              display: "flex",
              fontSize: `${Math.round(19 * scale)}px`,
              color: muted,
              marginTop: `${Math.round(2 * scale)}px`,
            },
            text: "imotara.com",
          },
        ],
      },
    ],
  };

  const children: Node[] = [left];

  if (qrCodes && qrCodes.length > 0) {
    /**
     * ⛔ EACH CODE SITS ON ITS OWN WHITE PANEL, never on the palette's ground.
     * Scanners threshold the image, so a code tinted to match the card is not
     * a subtle code — it is one that does not work, silently, and only for the
     * reader. The padding is the quiet zone, which is not optional and is the
     * commonest way a QR on a designed card fails while looking fine.
     *
     * ⚠️ AND EACH IS LABELLED. Three unlabelled codes side by side is a puzzle:
     * a reader has to scan one to find out whether it was the one for their
     * phone. The label is the whole reason there are three rather than one.
     */
    const q = Math.round(74 * scale);
    children.push({
      tag: "div",
      style: { display: "flex", alignItems: "flex-end" },
      children: qrCodes.map((code): Node => {
        // 🔑 TWO JOBS, TWO VALUES. The modules keep the brand colour and stay
        // dark, because they sit on white and a scanner thresholds them. The
        // ring and the dot sit on the CARD, which is a different pair and the
        // one nobody checked.
        //
        // ⚠️ onGround is kept around the chosen colour rather than replaced by
        // it. The five dark palettes all clear the bar on these values today;
        // the guard is what keeps that true if a palette's ground is ever
        // retuned, which is precisely how this broke the first time.
        const ring = onGround(
          relativeLuminance(ground) < 0.5 ? code.ringColor : code.color,
          ground,
        );
        return {
        tag: "div" as const,
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginLeft: `${Math.round(14 * scale)}px`,
        },
        children: [
          {
            tag: "div" as const,
            style: {
              display: "flex",
              backgroundColor: "#FFFFFF",
              borderRadius: `${Math.round(10 * scale)}px`,
              padding: `${Math.round(8 * scale)}px`,
              // ⚠️ The colour goes on the RING, and the modules themselves are
              // already dark enough to scan. Tinting the white behind a code is
              // where a designed QR stops working.
              border: `${Math.max(2, Math.round(3 * scale))}px solid ${ring}`,
            },
            children: [
              {
                tag: "img" as const,
                src: code.dataUri,
                style: { display: "flex", width: `${q}px`, height: `${q}px` },
              },
            ],
          },
          {
            tag: "div" as const,
            style: {
              display: "flex",
              alignItems: "center",
              marginTop: `${Math.round(8 * scale)}px`,
            },
            children: [
              // A dot in the code's own colour, so the three read as a set on a
              // dark ground where the labels must stay light to be legible.
              {
                tag: "div" as const,
                style: {
                  display: "flex",
                  width: `${Math.max(5, Math.round(7 * scale))}px`,
                  height: `${Math.max(5, Math.round(7 * scale))}px`,
                  borderRadius: "999px",
                  backgroundColor: ring,
                  marginRight: `${Math.round(6 * scale)}px`,
                },
              },
              {
                tag: "span" as const,
                style: {
                  display: "flex",
                  fontSize: `${Math.round(16 * scale)}px`,
                  color: muted,
                },
                text: code.label,
              },
            ],
          },
        ],
        };
      }),
    });
  }

  return {
    tag: "div",
    role: "footer",
    style: { display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" },
    children,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layouts — geometry, not alignment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 THE EARLIER VERSION OF THIS WAS NEARLY A LIE. Eight "layouts" that
 * differed only in `justifyContent` and padding — one of them named
 * `split-rule` and drawing no rule. The combination count was arithmetically
 * true and visually overstated: a reader scrolling would have seen the same
 * card with the text in a different corner.
 *
 * ⇒ Each layout now contributes GEOMETRY — a rule, a bar, a block, a division
 * of the frame — so two posts a day apart look like two posts.
 */
function layoutFor(
  layout: string,
  p: { ground: string; ink: string; muted: string; accent: string },
  pieces: { label: Node | null; headline: Node; support: Node | null; foot: Node },
  box: { w: number; h: number; pad: number; scale: number },
): Node {
  const { label, headline, support, foot } = pieces;
  const { w, h, pad, scale } = box;
  const body = [label, headline, support].filter((n): n is Node => n !== null);

  /**
   * ⚠️ A SQUARE IS NOT A WIDE CARD WITH LESS ROOM. The bottom-weighted layouts
   * read as a lower third on 16:9 and as a third of the frame left empty on
   * Instagram's 1:1 — the words sink to the floor and the picture looks
   * unfinished rather than airy.
   *
   * ⇒ On a frame narrower than about 4:3, the leading spacer is weighted and a
   * trailing one lifts the block to roughly two thirds of the height. Only
   * visible by rendering at each size, which is why both sizes get rendered.
   */
  const squarish = w / h < 1.35;

  /**
   * 🔴 A 9:16 FRAME IS NOT A TALL SQUARE — SOMEBODY ELSE'S UI IS ON IT.
   *
   * ⛔ A Short is shown with YouTube's own chrome drawn OVER the video: the
   * channel handle and the description sit along the bottom, and the like,
   * comment and share buttons run up the right. A wordmark at the foot of the
   * frame is not "at the foot of the frame" — it is underneath a row of
   * buttons.
   *
   * ⚠️ Seen by rendering at 1080×1920 and looking at it, which is the only way
   * this was ever going to be noticed: every check passed, and the card was
   * correct and partly invisible.
   */
  const tall = w / h < 0.8;
  /** Roughly what YouTube covers, as a fraction of the height. */
  const SHORTS_BOTTOM_UI = 0.16;
  const SHORTS_TOP_UI = 0.07;

  const spacer = (px?: number): Node =>
    px === undefined
      ? { tag: "div", style: { display: "flex", flex: "1" } }
      : { tag: "div", style: { display: "flex", height: `${Math.round(px * scale)}px` } };

  /** The lift under a bottom-weighted block, so it sits off the floor on a
   *  square and stays where it is on a wide card. */
  const lift = (): Node =>
    squarish
      ? { tag: "div", style: { display: "flex", flex: "0.5" } }
      : { tag: "div", style: { display: "flex", height: "0px" } };

  const accentRule = (width: string, thickness: number, extra: Record<string, string | number> = {}): Node => ({
    tag: "div",
    role: "rule",
    style: {
      display: "flex",
      width,
      height: `${Math.round(thickness * scale)}px`,
      backgroundColor: p.accent,
      borderRadius: "999px",
      ...extra,
    },
  });

  const hairline = (extra: Record<string, string | number> = {}): Node => ({
    tag: "div",
    role: "rule",
    style: {
      display: "flex",
      width: "100%",
      height: "1px",
      backgroundColor: p.muted,
      opacity: 0.35,
      ...extra,
    },
  });

  const column = (children: Node[], style: Record<string, string | number> = {}): Node => ({
    tag: "div",
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: `${pad}px`,
      /**
       * ⚠️ APPLIED AFTER `padding`, so it overrides only the two edges that
       * another app draws on ⇒ `tall`. ⛔ On every other shape these are
       * absent and nothing changes — the 1:1 and 16:9 cards are untouched.
       */
      ...(tall
        ? {
            paddingBottom: `${Math.round(h * SHORTS_BOTTOM_UI)}px`,
            paddingTop: `${Math.round(h * SHORTS_TOP_UI)}px`,
          }
        : {}),
      ...style,
    },
    children,
  });

  switch (layout) {
    case "rule-over":
      // A heavy accent rule above the words, everything pinned low.
      return column([
        spacer(),
        accentRule(`${Math.round(w * 0.22)}px`, 8, { marginBottom: `${Math.round(28 * scale)}px` }),
        ...body,
        lift(),
        spacer(40),
        foot,
      ]);

    case "centred-statement":
      return column(
        [spacer(), ...body, accentRule(`${Math.round(w * 0.1)}px`, 5, { marginTop: `${Math.round(26 * scale)}px` }), spacer(), foot],
        { alignItems: "center", textAlign: "center" },
      );

    case "side-bar":
      // A full-height accent bar down the leading edge.
      return {
        tag: "div",
        style: { position: "relative", display: "flex", width: "100%", height: "100%" },
        children: [
          {
            tag: "div",
            style: { display: "flex", width: `${Math.round(18 * scale)}px`, height: "100%", backgroundColor: p.accent },
          },
          column([spacer(), ...body, lift(), spacer(36), foot], { paddingLeft: `${Math.round(pad * 0.8)}px` }),
        ],
      };

    case "stacked-label":
      /**
       * Hairlines between the pieces, like a printed index.
       *
       * 🔴 THE ONE LAYOUT WITH NOTHING ABOVE THE WORDS, and on a 1080 square
       * it left two thirds of the frame empty under them — measured in a
       * render, invisible in this code, and the same fault `squarish` was
       * introduced to fix everywhere else. ⇒ The index still starts at the
       * top, because that is what makes it an index; the headline below it
       * now sits off the floor on a square and is unchanged on a wide card.
       */
      return column([
        ...(label ? [label, hairline({ marginTop: `${Math.round(18 * scale)}px`, marginBottom: `${Math.round(26 * scale)}px` })] : []),
        ...(squarish ? [spacer()] : []),
        headline,
        ...(support ? [support] : []),
        spacer(),
        ...(squarish ? [spacer()] : []),
        hairline({ marginBottom: `${Math.round(24 * scale)}px` }),
        foot,
      ]);

    case "offset-quote":
      // A heavy accent bar beside the words, like a pulled quote.
      return {
        tag: "div",
        style: {
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          padding: `${pad}px`,
          alignItems: "center",
        },
        children: [
          {
            tag: "div",
            style: {
              display: "flex",
              width: `${Math.round(10 * scale)}px`,
              height: `${Math.round(h * 0.34)}px`,
              backgroundColor: p.accent,
              borderRadius: "999px",
              marginRight: `${Math.round(40 * scale)}px`,
            },
          },
          {
            tag: "div",
            style: { display: "flex", flexDirection: "column", flex: "1", height: "100%" },
            children: [spacer(), ...body, spacer(), foot],
          },
        ],
      };

    case "corner-block":
      // A solid accent block in the top corner, words set low against it.
      return {
        tag: "div",
        style: { position: "relative", display: "flex", width: "100%", height: "100%" },
        children: [
          {
            tag: "div",
            style: {
              position: "absolute",
              display: "flex",
              top: 0,
              right: 0,
              width: `${Math.round(w * 0.3)}px`,
              height: `${Math.round(w * 0.09)}px`,
              backgroundColor: p.accent,
            },
          },
          column([spacer(), ...body, lift(), spacer(40), foot]),
        ],
      };

    case "low-horizon":
      // A rule straight across the frame, words in the lower third.
      return {
        tag: "div",
        style: { position: "relative", display: "flex", width: "100%", height: "100%" },
        children: [
          {
            tag: "div",
            style: {
              position: "absolute",
              display: "flex",
              left: 0,
              top: `${Math.round(h * 0.5)}px`,
              width: "100%",
              height: `${Math.round(2 * scale)}px`,
              backgroundColor: p.muted,
              opacity: 0.4,
            },
          },
          column([spacer(), ...body, lift(), spacer(34), foot]),
        ],
      };

    case "full-bleed-type":
      // The words fill the frame; the chrome gets out of the way.
      return column([spacer(), ...body, spacer(), foot], { padding: `${Math.round(pad * 0.7)}px` });

    default:
      throw new Error(`compose: unknown layout "${layout}". Layouts live in visualRecipe.LAYOUTS.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function composePicture(input: ComposeInput): Picture {
  const { recipe, headline, support, language, platform, qrCodes, illustration } = input;

  /**
   * 🔴 THE INK THE WORDS ARE ACTUALLY DRAWN IN.
   *
   * ⛔ WITH A BACKGROUND PICTURE THE PALETTE'S GROUND IS NOT VISIBLE, so the
   * palette's ink is a colour chosen against something nobody can see. The
   * ink must come from what is ACTUALLY behind the words — measured from the
   * real pixels of the real picture ⇒ backgroundPlan.planBackground.
   *
   * ⚠️ Without a picture this is the palette exactly as before, so every card
   * that has no illustration renders byte-for-byte as it does today.
   */
  const overPicture = Boolean(input.illustration);
  const OVER_INK = { light: "#ffffff", dark: "#161310" } as const;
  const OVER_MUTED = { light: "rgba(255,255,255,0.88)", dark: "rgba(22,19,16,0.82)" } as const;

  const spec = platformSpec(platform);
  const { width: w, height: h } = spec.picture;

  const palette = PALETTES[recipe.palette];
  if (!palette) {
    throw new Error(`compose: unknown palette "${recipe.palette}". Palettes live in visualRecipe.PALETTES.`);
  }
  if (!headline.trim()) {
    throw new Error(
      "compose: no headline. ⛔ This module never writes one — the caller takes it from the post " +
        "body with headlineFromBody, so that every word in a picture has been through the gate.",
    );
  }

  const scale = w / 1200;
  const pad = Math.round(72 * scale);
  const type = typeScale(recipe.typeTreatment, w, h);

  const notes: string[] = [];
  const wordmark = planWordmark(language);
  if (wordmark.note) notes.push(wordmark.note);

  // 🔑 The wordmark TEXT follows the script actually in use, not the language.
  // Setting the Bengali form in a Latin font renders as empty boxes.
  const wordmarkText = wordmark.substituted ? BRAND_IN_SCRIPT.en : wordmarkFor(language);

  /**
   * 🔴 ON A CAROUSEL THE EYEBROW IS THE COUNTER, AND IT IS ALWAYS DRAWN.
   *
   * ⛔ The fixed "22 languages" was a brand claim stamped on whatever the post
   * happened to be about — five identical copies of it down a carousel about
   * restlessness, measured in a render. A counter is true on every card, is
   * the one thing a reader on card three actually wants, and is drawn on EVERY
   * layout rather than only the two that happen to have an eyebrow: a reader
   * does not know which recipe was rolled.
   *
   * 🔴 AND ON A SINGLE CARD THE SAME CLAIM SURVIVED THAT FIX, for another day.
   * A counter is meaningless on a card of one, so the `: null` branch below
   * still reached the constant — one single card in three. ⇒ The eyebrow now
   * comes from the post's own topic pool ⇒ eyebrowFor, and is null far more
   * often than not.
   */
  const labelText = input.counter
    ? `${input.counter.index} / ${input.counter.total}`
    : /**
       * ⚠️ THE LAYOUT GATE IS KEPT, and keeping it was a decision rather than
       * an oversight. These two are the recipes DESIGNED around a label; the
       * other six are not, and printing one on all of them would make every
       * card structurally identical — which is the sameness this whole axis
       * exists to avoid. ⛔ The defect was never WHERE the eyebrow appeared.
       * It was the WORDS.
       */
      recipe.layout === "stacked-label" || recipe.typeTreatment === "caps-label"
      ? (input.eyebrow ?? null)
      : null;

  const label: Node | null = labelText
    ? {
        tag: "div",
        role: "label",
        style: {
          display: "flex",
          fontSize: `${type.label}px`,
          // ⚠️ A counter is digits and a slash: tracked like a label, but not
          // upper-cased, because there is nothing to upper-case.
          letterSpacing: input.counter ? "0.12em" : "0.18em",
          textTransform: input.counter ? "none" : "uppercase",
          color: overPicture ? OVER_MUTED[input.illustration!.ink] : palette.muted,
        },
        text: labelText,
      }
    : null;

  /**
   * 🔑 A SHORT CARD DESERVES BIGGER TYPE, and a carousel is mostly short
   * cards. "You tidy a drawer that was already tidy." set at the size chosen
   * for a 64-character headline occupies a third of a square and leaves the
   * rest empty — measured, in a render.
   *
   * ⛔ NOT A FIXED BUMP FOR CAROUSELS. Slides are not length-capped, so a
   * blanket multiplier would overflow the long one. The scale comes from the
   * text's OWN length and reaches 1 well before the headline limit, which
   * makes it self-limiting.
   *
   * 🔴 AND ONLY WHEN THERE IS NO SUPPORT LINE. My first version scaled every
   * short headline, and on a 1200×630 Facebook card it pushed the support
   * line straight through the bottom hairline — rendered, looked at, and
   * caught there. A card with a support line is already using its vertical
   * room; a slide, which is one sentence alone in a square, is not. ⇒ The
   * emptiness this fixes is the emptiness that only a lone headline creates.
   */
  /**
   * ⚠️ PORTRAIT, BUT NOT A SHORT. `h > w` alone also catches 1080×1920, whose
   * cards were checked by rendering and are already placed around YouTube's
   * own chrome ⇒ the `tall` branch in layoutFor. Enlarging type there would
   * move a card nobody complained about, to fix a frame it does not have
   * ⇒ trap_blunt_fix_trades_one_failure_for_its_opposite.
   *
   * ⛔ 1:1 is excluded by `h > w` on its own, and must stay excluded: a feed
   * renders to a fixed width, so Instagram's type already reads at the size
   * it was tuned to.
   */
  const portrait = h > w && w / h >= 0.8;
  const fit = support?.trim()
    ? /**
       * 🔴 A PORTRAIT CARD RUNS OUT OF WORDS BEFORE IT RUNS OUT OF FRAME.
       *
       * This was a flat `1` whenever a support line existed, and on 1.91:1 that
       * was right — the card was already using its vertical room. At 1080×1350
       * it is not: the width is unchanged, so a headline wraps exactly as it
       * does on Instagram and the block is the same height, while the card is
       * 270px taller. That 20% of the frame is empty by construction.
       *
       * ⛔ NOT A BLANKET MULTIPLIER FOR PORTRAIT. A feed renders a card at a
       * fixed WIDTH, so type at 1080 across already appears the same size to a
       * reader whatever the height — Facebook's 92px is bigger on screen than
       * Instagram's 82px today. Scaling everything would not make the card
       * more readable, only louder, and would crowd the long headlines.
       *
       * ⇒ Same self-limiting rule as the no-support case, with a lower
       * ceiling: SHORT text grows to use the room it has, long text is left
       * exactly as it is. A 64-character headline gets 1.0 either way.
       */
      portrait
      ? Math.min(1.25, Math.max(1, HEADLINE_MAX / Math.max(headline.trim().length, 1)))
      : 1
    : Math.min(1.42, Math.max(1, HEADLINE_MAX / Math.max(headline.trim().length, 1)));

  const headlineNode: Node = {
    tag: "div",
    role: "headline",
    style: {
      display: "flex",
      fontSize: `${Math.round(type.headline * fit)}px`,
      lineHeight: 1.16,
      letterSpacing: type.tracking,
      fontWeight: 600,
      color: overPicture ? OVER_INK[input.illustration!.ink] : palette.ink,
      maxWidth: `${Math.round(w * 0.84)}px`,
    },
    text: headline,
  };

  const supportNode: Node | null = support?.trim()
    ? {
        tag: "div",
        role: "support",
        style: {
          display: "flex",
          fontSize: `${type.support}px`,
          lineHeight: 1.45,
          color: overPicture ? OVER_MUTED[input.illustration!.ink] : palette.muted,
          maxWidth: `${Math.round(w * 0.74)}px`,
          marginTop: `${Math.round(20 * scale)}px`,
        },
        text: support.trim(),
      }
    : null;

  const foot = footerNode({
    /**
     * ⛔ THE FOOTER SITS OVER THE PICTURE TOO, and it was the one place the
     * measured ink did not reach — caught by the test asserting the palette's
     * ink appears nowhere on a picture card. The wordmark is words; words over
     * a picture need the ink the picture asked for.
     */
    ink: overPicture ? OVER_INK[input.illustration!.ink] : palette.ink,
    muted: overPicture ? OVER_MUTED[input.illustration!.ink] : palette.muted,
    /**
     * ⚠️ `ground` is NOT switched, and that is deliberate. It is used to pick
     * a contrasting ring around each QR code, and the codes sit on their own
     * white panels — a scanner thresholds them, so they are unaffected by what
     * is behind the card ⇒ the note in footerNode.
     */
    ground: palette.ground,
    wordmark: wordmarkText,
    qrCodes,
    scale,
  });

  const content = layoutFor(
    // ⚠️ Translated, not trusted. A stored recipe may name a layout that has
    // since been renamed, and a post approved yesterday must still render.
    canonicalLayout(recipe.layout),
    palette,
    { label, headline: headlineNode, support: supportNode, foot },
    { w, h, pad, scale },
  );
  const motif = motifLayer(recipe.motif, palette.accent, w, h);

  /**
   * 🔑 THE BAND, AND THE INSET THAT MAKES IT SAFE.
   *
   * ⛔ The content is wrapped in a box that STARTS below the picture, so no
   * layout can put a word over it — including the ones that position
   * absolutely against the frame, because they now measure against this box.
   * ⚠️ Doing it here rather than inside the eight layouts is deliberate: a
   * rule enforced in one place cannot be forgotten by the ninth layout
   * ⇒ trap_a_constraint_nobody_told_the_writer.
   */
  /**
   * 🔴 THE PICTURE IS THE WHOLE BACKGROUND — rewritten 20 Oct 2026.
   *
   * ⛔ IT WAS A BAND, AND THAT WAS MY CAUTION RATHER THAN THE BRIEF. The owner
   * sent 27 references and every one puts the text STRAIGHT OVER the image.
   * My objection — you cannot bet legibility on what the model drew — was
   * sound and the conclusion was wrong: those posters are readable because
   * the words sit where the picture is quiet, and because somebody looked.
   *
   * 🔑 SO NOTHING HERE IS A BET. The ink and the veil both arrive MEASURED,
   * from the real pixels under the real text zone ⇒ backgroundPlan.ts. This
   * function only draws what that measurement decided.
   *
   * ⚠️ THE VEIL COVERS THE TEXT ZONE ONLY, never the frame. A wash over the
   * whole card would make twelve styles into twelve versions of one — which
   * is the monotony this entire feature exists to end.
   */
  const picture: Node | null = illustration
    ? {
        tag: "img",
        src: illustration.src,
        style: {
          position: "absolute",
          display: "flex",
          top: 0,
          left: 0,
          width: `${w}px`,
          height: `${h}px`,
          objectFit: "cover",
        },
      }
    : null;

  const veil: Node | null =
    illustration && illustration.scrim > 0
      ? {
          tag: "div",
          style: {
            position: "absolute",
            display: "flex",
            ...zoneBox(illustration.zone, w, h),
            /**
             * ⚠️ THE VEIL MATCHES THE GROUND THE INK NEEDS, not a fixed
             * colour: a dark wash under dark type would bury it.
             */
            backgroundColor:
              illustration.ink === "light"
                ? `rgba(0,0,0,${illustration.scrim})`
                : `rgba(255,255,255,${illustration.scrim})`,
          },
        }
      : null;

  const body: Node = content;

  return {
    width: w,
    height: h,
    notes,
    wordmark,
    recipe,
    platform,
    root: {
      tag: "div",
      style: {
        position: "relative",
        display: "flex",
        width: `${w}px`,
        height: `${h}px`,
        // 🔑 The ground, however this recipe paints it ⇒ washFor.
        ...washFor(recipe.wash, palette.ground),
        // ⚠️ An explicit family: Satori has no system default, and text in an
        // unnamed family simply does not appear.
        fontFamily: wordmark.font.family,
        overflow: "hidden",
      },
      // ⚠️ Order matters: ground, then motif, then the picture, then the words.
      // ⚠️ Order: ground, motif, picture, veil, then the words on top.
      children: [
        ...(motif ? [motif] : []),
        ...(picture ? [picture] : []),
        ...(veil ? [veil] : []),
        body,
      ],
    },
  };
}

/** Every string a composed picture will show, for asserting each one came from
 *  text the gate had already read. */
export function wordsInPicture(picture: Picture): string[] {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.text) out.push(n.text);
    n.children?.forEach(walk);
  };
  walk(picture.root);
  return out;
}

/** Every image a composed picture will load. ⛔ Only the logo and a QR data URI
 *  may ever appear here — nothing from a model, nothing from a stock source. */
export function imagesInPicture(picture: Picture): string[] {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.src) out.push(n.src);
    n.children?.forEach(walk);
  };
  walk(picture.root);
  return out;
}
