// src/lib/social/toHtml.ts
// The same composed card, as HTML a browser can draw.
//
// 🔴 WHY A SECOND WAY TO DRAW THE SAME TREE, MEASURED RATHER THAN ASSUMED.
//
// `composePicture` returns a tree of boxes and text. Satori turns that into a
// picture — and Satori does NO complex-script shaping: no pre-base vowel
// reordering, no conjunct formation, no Arabic joining. That is why অভিমান
// drew as অভমিান on a LIVE Instagram post the owner then deleted, and why 12
// of 13 scripts are still `shapingVerified: false` ⇒ fonts.ts.
//
// ⛔ I TESTED THE ALTERNATIVES BEFORE CHOOSING, because this has been guessed
// at twice already. The same ten strings through three renderers:
//
//     satori        ✗  marks before the wrong consonant
//     resvg-js      ✗  marks misplaced and glyphs overlapping — rustybuzz did
//                      not apply the font's substitutions
//     Chromium      ✓  every script correct, including Bengali's pre-base ি
//
// ⇒ A browser is the only one of the three that is right, and Playwright was
// already a dependency of this repo.
//
// ⚠️ THIS IS A SECOND RENDERER, NOT A REPLACEMENT. Latin posts keep going
// through Satori: it is fast, it has no binary behind it, and every card
// published so far came out of it. ⛔ Two renderers that both draw everything
// would drift; this one draws only what the other cannot.

import type { Node } from "@/lib/social/compose";

/** camelCase style keys to CSS, which the browser wants. */
function css(style: Record<string, string | number> | undefined): string {
  if (!style) return "";
  return Object.entries(style)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      // ⚠️ Unitless numbers are px in Satori's model, and the browser needs
      // that said. ⛔ Except the properties where a bare number is correct —
      // `flex: 1` in pixels is not flex at all.
      const unitless = new Set(["flex", "flexGrow", "flexShrink", "opacity", "zIndex", "lineHeight", "fontWeight"]);
      const value = typeof v === "number" && !unitless.has(k) ? `${v}px` : String(v);
      return `${prop}:${value}`;
    })
    .join(";");
}

const escapeText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

/** One node, as HTML. */
export function nodeToHtml(node: Node): string {
  const style = css(node.style as Record<string, string | number> | undefined);
  if (node.tag === "img") {
    // ⚠️ Void element: a src and nothing inside it.
    return `<img style="${escapeAttr(style)}" src="${escapeAttr(node.src ?? "")}">`;
  }
  const kids = (node.children ?? []).map(nodeToHtml).join("");
  const text = node.text ? escapeText(node.text) : "";
  return `<${node.tag} style="${escapeAttr(style)}">${text}${kids}</${node.tag}>`;
}

/**
 * A whole page, sized exactly to the card.
 *
 * 🔑 `display:flex` ON EVERY DIV, because that is what Satori's layout assumes
 * and the tree was built for it. A browser defaults to block, so without this
 * the same tree lays out differently in the two renderers — and the card a
 * reviewer approved would not be the card that published.
 *
 * ⛔ NO EXTERNAL STYLESHEET and no webfont link. The fonts come from the
 * machine doing the drawing; a stylesheet that failed to load would produce a
 * card that is subtly wrong rather than one that fails.
 */
export function cardHtml(root: Node, width: number, height: number, fontStack: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
div{display:flex}
html,body{width:${width}px;height:${height}px;overflow:hidden}
body{font-family:${fontStack}}
</style></head><body>${nodeToHtml(root)}</body></html>`;
}

/**
 * The families to ask for, in order.
 *
 * ⚠️ NAMED EXPLICITLY RATHER THAN LEFT TO `sans-serif`. A generic family
 * resolves to whatever the rendering machine happens to have, which is one
 * thing on a developer's Mac and another on a build server — and the
 * difference would show up as a card that looks right in review and wrong in
 * public.
 */
export const SCRIPT_FONT_STACK = [
  "Noto Sans",
  "Noto Sans Bengali",
  "Noto Sans Devanagari",
  "Noto Sans Tamil",
  "Noto Sans Telugu",
  "Noto Sans Gujarati",
  "Noto Sans Kannada",
  "Noto Sans Malayalam",
  "Noto Sans Gurmukhi",
  "Noto Sans Oriya",
  "Noto Naskh Arabic",
  "sans-serif",
]
  .map((f) => (f.includes(" ") ? `"${f}"` : f))
  .join(",");
