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

import { PALETTES, wordmarkFor, canonicalLayout, type Recipe } from "@/lib/social/visualRecipe";
import { BRAND_IN_SCRIPT } from "@/lib/social/languages";
import { planWordmark, type WordmarkPlan } from "@/lib/social/fonts";
import { platformSpec } from "@/lib/social/platforms";
import { LOGO_URL, type QrCode } from "@/lib/social/brandMarks";

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
};

const MOTIF_OPACITY = 0.13;

// ─────────────────────────────────────────────────────────────────────────────
// Motifs — line and shape fields only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⛔ No gradient wash, nothing representational. There is no code path here
 * that can draw a figure, a face, or anything that reads as distress — which
 * is the point, rather than a rule somebody has to remember.
 */
function motifLayer(motif: string, accent: string, w: number, h: number): Node | null {
  const base: Record<string, string | number> = {
    position: "absolute",
    display: "flex",
    opacity: MOTIF_OPACITY,
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
        },
        children: [34, 22, 14, 8].map((bh) => ({
          tag: "div" as const,
          style: { display: "flex", width: "100%", height: `${bh}px`, backgroundColor: accent, marginTop: "16px" },
        })),
      };

    case "rule-stack":
      return {
        tag: "div",
        role: motifRole,
        style: {
          ...base,
          right: 0,
          top: `${Math.round(h * 0.12)}px`,
          width: `${Math.round(w * 0.3)}px`,
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

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type
// ─────────────────────────────────────────────────────────────────────────────

/** Scaled to the frame: a 1080 square and a 1600×900 are not one canvas, and a
 *  single type scale across both leaves one of them wrong. */
function typeScale(treatment: string, w: number) {
  const k = w / 1200;
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
  wordmark: string;
  qrCodes?: QrCode[];
  scale: number;
}): Node {
  const { ink, muted, wordmark, qrCodes, scale } = opts;
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
      children: qrCodes.map((code): Node => ({
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
              border: `${Math.max(2, Math.round(3 * scale))}px solid ${code.color}`,
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
                  backgroundColor: code.color,
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
      })),
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
      // Hairlines between the pieces, like a printed index.
      return column([
        ...(label ? [label, hairline({ marginTop: `${Math.round(18 * scale)}px`, marginBottom: `${Math.round(26 * scale)}px` })] : []),
        headline,
        ...(support ? [support] : []),
        spacer(),
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
  const { recipe, headline, support, language, platform, qrCodes } = input;

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
  const type = typeScale(recipe.typeTreatment, w);

  const notes: string[] = [];
  const wordmark = planWordmark(language);
  if (wordmark.note) notes.push(wordmark.note);

  // 🔑 The wordmark TEXT follows the script actually in use, not the language.
  // Setting the Bengali form in a Latin font renders as empty boxes.
  const wordmarkText = wordmark.substituted ? BRAND_IN_SCRIPT.en : wordmarkFor(language);

  const label: Node | null =
    recipe.layout === "stacked-label" || recipe.typeTreatment === "caps-label"
      ? {
          tag: "div",
          role: "label",
          style: {
            display: "flex",
            fontSize: `${type.label}px`,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: palette.muted,
          },
          text: "22 languages",
        }
      : null;

  const headlineNode: Node = {
    tag: "div",
    role: "headline",
    style: {
      display: "flex",
      fontSize: `${type.headline}px`,
      lineHeight: 1.16,
      letterSpacing: type.tracking,
      fontWeight: 600,
      color: palette.ink,
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
          color: palette.muted,
          maxWidth: `${Math.round(w * 0.74)}px`,
          marginTop: `${Math.round(20 * scale)}px`,
        },
        text: support.trim(),
      }
    : null;

  const foot = footerNode({
    ink: palette.ink,
    muted: palette.muted,
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
        backgroundColor: palette.ground,
        // ⚠️ An explicit family: Satori has no system default, and text in an
        // unnamed family simply does not appear.
        fontFamily: wordmark.font.family,
        overflow: "hidden",
      },
      children: motif ? [motif, content] : [content],
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
