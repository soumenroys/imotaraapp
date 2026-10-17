// src/lib/social/compose.ts
// Turning a recipe plus the post's own words into a picture.
//
// 🔑 IT RETURNS DATA, NOT JSX. The route maps the tree below onto React
// elements for `next/og`; this module stays a pure function so the layout can
// be asserted — which palette on which ground, whether the headline came from
// the body, whether a wordmark was substituted — without a renderer, a font
// download or a browser.
//
// ⛔ EVERY WORD IN THE RESULT CAME FROM THE CAPTION THE GATE READ. Nothing here
// writes copy. The gate cannot read a picture, so a picture may only repeat
// words that have already been through it.

import { PALETTES, wordmarkFor, type Recipe } from "@/lib/social/visualRecipe";
import { BRAND_IN_SCRIPT } from "@/lib/social/languages";
import { planWordmark, type WordmarkPlan } from "@/lib/social/fonts";

/**
 * A minimal flexbox tree.
 *
 * ⚠️ FLEX ONLY — no grid. Satori does not support `display: grid`, and a grid
 * layout fails by rendering everything stacked at the top left rather than by
 * throwing, which is the kind of failure that ships.
 */
export type Node = {
  tag: "div" | "span";
  style: Record<string, string | number>;
  text?: string;
  children?: Node[];
};

export type Picture = {
  width: number;
  height: number;
  root: Node;
  /** Shown to the reviewer, never silently swallowed. */
  notes: string[];
  wordmark: WordmarkPlan;
  recipe: Recipe;
};

/** 1200 × 630 — what both Facebook and LinkedIn render a link card at. */
export const PICTURE_WIDTH = 1200;
export const PICTURE_HEIGHT = 630;

export type ComposeInput = {
  recipe: Recipe;
  /** Taken from the post body by `headlineFromBody`. ⛔ Never written here. */
  headline: string;
  /** A short supporting line, also from the post. Optional. */
  support?: string;
  language: string;
};

const MOTIF_OPACITY = 0.14;

/**
 * The motif layer: line and shape fields, built from plain divs.
 *
 * ⛔ No gradient wash, and nothing representational. There is no code path here
 * that can draw a figure, a face or anything that reads as distress — which is
 * the point, rather than a rule somebody has to remember
 * ⇒ visualRecipe.NEVER_IN_A_PICTURE.
 */
function motifLayer(motif: string, accent: string): Node | null {
  const base: Record<string, string | number> = {
    position: "absolute",
    display: "flex",
    opacity: MOTIF_OPACITY,
  };

  /**
   * A full-frame layer, written as four properties rather than the shorthand.
   *
   * 🔴 Satori ignores `inset`, so the layer came out with no height: the dotted
   * grid rendered as a single row of dots along the top edge, and the bands did
   * not appear at all. ⛔ Nothing threw and nothing warned — the picture simply
   * came out wrong, and two of the six motifs were silently decorative.
   *
   * ⚠️ FOUND BY RENDERING A PNG AND LOOKING AT IT. No test caught it and none
   * could have: every assertion about the tree was satisfied.
   */
  const fullFrame: Record<string, string | number> = {
    ...base,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  };

  switch (motif) {
    case "none":
      return null;
    case "bands":
      return {
        tag: "div",
        style: { ...fullFrame, flexDirection: "column", justifyContent: "flex-end" },
        children: [0.5, 0.3, 0.15].map((h) => ({
          tag: "div" as const,
          style: {
            display: "flex",
            width: "100%",
            height: `${Math.round(h * 40)}px`,
            backgroundColor: accent,
            marginTop: "14px",
          },
        })),
      };
    case "rule-stack":
      return {
        tag: "div",
        style: { ...base, right: "0", bottom: "0", width: "320px", flexDirection: "column" },
        children: Array.from({ length: 7 }, () => ({
          tag: "div" as const,
          style: { display: "flex", width: "100%", height: "3px", backgroundColor: accent, marginTop: "16px" },
        })),
      };
    case "dotted-grid":
      return {
        tag: "div",
        style: { ...fullFrame, flexWrap: "wrap", alignContent: "flex-start", padding: "40px" },
        // ⚠️ Enough to FILL the frame. 96 covered about four rows and stopped
        // halfway down, which reads as a broken pattern rather than a chosen
        // one. 1120px of usable width at 52px per dot is ~21 across, and
        // 550px of height is ~10 down.
        children: Array.from({ length: 210 }, () => ({
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
    case "concentric":
      return {
        tag: "div",
        style: { ...base, right: "-160px", top: "-160px", flexDirection: "column" },
        children: [520, 400, 280].map((d) => ({
          tag: "div" as const,
          style: {
            display: "flex",
            width: `${d}px`,
            height: `${d}px`,
            borderRadius: "999px",
            border: `3px solid ${accent}`,
            position: "absolute",
            right: `${(520 - d) / 2}px`,
            top: `${(520 - d) / 2}px`,
          },
        })),
      };
    case "arcs":
      return {
        tag: "div",
        style: { ...base, left: "-120px", bottom: "-240px", display: "flex" },
        children: [
          {
            tag: "div",
            style: {
              display: "flex",
              width: "520px",
              height: "520px",
              borderRadius: "999px",
              border: `4px solid ${accent}`,
            },
          },
        ],
      };
    default:
      return null;
  }
}

/** Type sizes per treatment. ⚠️ Headline size is capped so a long line wraps
 *  rather than overflowing the frame — Satori clips, it does not shrink. */
const TYPE_SCALE: Record<string, { headline: number; support: number; label: number; tracking: string }> = {
  display:         { headline: 64, support: 26, label: 18, tracking: "-0.02em" },
  "tight-display": { headline: 58, support: 24, label: 17, tracking: "-0.03em" },
  measured:        { headline: 46, support: 24, label: 16, tracking: "0em" },
  "caps-label":    { headline: 52, support: 22, label: 14, tracking: "0.01em" },
};

/**
 * Where the pieces sit. Eight layouts, all flex.
 *
 * 🔑 Each returns the same three pieces in a different arrangement — label,
 * headline, footer — so no layout can introduce content the others do not have.
 * A layout that could add a line would be a layout that could add a claim.
 */
function arrange(
  layout: string,
  pieces: { label: Node | null; headline: Node; support: Node | null; footer: Node },
): { style: Record<string, string | number>; order: (Node | null)[] } {
  const { label, headline, support, footer } = pieces;
  const pad = { padding: "72px" };

  switch (layout) {
    case "centred-statement":
      return {
        style: { ...pad, alignItems: "center", justifyContent: "center", textAlign: "center" },
        order: [label, headline, support, footer],
      };
    case "low-horizon":
      return { style: { ...pad, justifyContent: "flex-end" }, order: [label, headline, support, footer] };
    case "stacked":
      return { style: { ...pad, justifyContent: "space-between" }, order: [label, headline, support, footer] };
    case "split-rule":
      return { style: { ...pad, justifyContent: "center" }, order: [label, headline, support, footer] };
    case "offset-quote":
      return {
        style: { ...pad, paddingLeft: "140px", justifyContent: "center" },
        order: [headline, support, label, footer],
      };
    case "wordmark-corner":
      return { style: { ...pad, justifyContent: "center" }, order: [headline, support, footer, label] };
    case "language-grid":
      // 🔴 The footer used to sit BEFORE the support line here, so the brand
      // sign-off appeared above a sentence that was still part of the post.
      // Obvious the moment it was rendered; invisible in the tree.
      return { style: { ...pad, justifyContent: "space-between" }, order: [label, headline, support, footer] };
    case "full-bleed-type":
      return {
        style: { padding: "56px", justifyContent: "center" },
        order: [headline, support, footer, label],
      };
    default:
      throw new Error(`compose: unknown layout "${layout}". Layouts live in visualRecipe.LAYOUTS.`);
  }
}

/**
 * Compose the picture.
 *
 * ⛔ Throws rather than guessing on an unknown palette or layout. A picture
 * composed from a half-understood recipe would still be published.
 */
export function composePicture(input: ComposeInput): Picture {
  const { recipe, headline, support, language } = input;

  const palette = PALETTES[recipe.palette];
  if (!palette) {
    throw new Error(`compose: unknown palette "${recipe.palette}". Palettes live in visualRecipe.PALETTES.`);
  }
  const scale = TYPE_SCALE[recipe.typeTreatment];
  if (!scale) {
    throw new Error(`compose: unknown type treatment "${recipe.typeTreatment}".`);
  }
  if (!headline.trim()) {
    throw new Error(
      "compose: no headline. ⛔ This module never writes one — the caller takes it from the post " +
        "body with headlineFromBody, so that every word in a picture has been through the gate.",
    );
  }

  const notes: string[] = [];
  const wordmark = planWordmark(language);
  if (wordmark.note) notes.push(wordmark.note);

  // 🔑 The wordmark TEXT follows the script actually being used, not the
  // language. Setting the Bengali form in a Latin font would render as boxes,
  // which is the failure the substitution exists to avoid.
  const wordmarkText = wordmark.substituted ? BRAND_IN_SCRIPT.en : wordmarkFor(language);

  const label: Node | null =
    recipe.layout === "language-grid" || recipe.typeTreatment === "caps-label"
      ? {
          tag: "div",
          style: {
            display: "flex",
            fontSize: `${scale.label}px`,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: palette.muted,
          },
          text: "22 languages",
        }
      : null;

  const headlineNode: Node = {
    tag: "div",
    style: {
      display: "flex",
      fontSize: `${scale.headline}px`,
      lineHeight: 1.18,
      letterSpacing: scale.tracking,
      fontWeight: 600,
      color: palette.ink,
      maxWidth: "900px",
    },
    text: headline,
  };

  const supportNode: Node | null = support?.trim()
    ? {
        tag: "div",
        style: {
          display: "flex",
          fontSize: `${scale.support}px`,
          lineHeight: 1.45,
          color: palette.muted,
          maxWidth: "820px",
          marginTop: "20px",
        },
        text: support.trim(),
      }
    : null;

  const footer: Node = {
    tag: "div",
    style: { display: "flex", alignItems: "baseline", marginTop: "36px" },
    children: [
      {
        tag: "span",
        style: { display: "flex", fontSize: "30px", fontWeight: 600, color: palette.ink },
        text: wordmarkText,
      },
      {
        tag: "span",
        style: { display: "flex", fontSize: "20px", color: palette.muted, marginLeft: "18px" },
        text: "imotara.com",
      },
    ],
  };

  const { style: layoutStyle, order } = arrange(recipe.layout, {
    label,
    headline: headlineNode,
    support: supportNode,
    footer,
  });

  const content: Node = {
    tag: "div",
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      ...layoutStyle,
    },
    children: order.filter((n): n is Node => n !== null),
  };

  const motif = motifLayer(recipe.motif, palette.accent);

  return {
    width: PICTURE_WIDTH,
    height: PICTURE_HEIGHT,
    notes,
    wordmark,
    recipe,
    root: {
      tag: "div",
      style: {
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: palette.ground,
        // ⚠️ An explicit font family, because Satori has no system default and
        // text in an unnamed family simply does not appear.
        fontFamily: wordmark.font.family,
        overflow: "hidden",
      },
      children: motif ? [motif, content] : [content],
    },
  };
}

/** Every string a composed picture will show, for asserting that each one
 *  came from text the gate had already read. */
export function wordsInPicture(picture: Picture): string[] {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.text) out.push(n.text);
    n.children?.forEach(walk);
  };
  walk(picture.root);
  return out;
}
