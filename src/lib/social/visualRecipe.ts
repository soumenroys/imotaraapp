// src/lib/social/visualRecipe.ts
// How a post's picture is composed, and how it is kept unique.
//
// 🎨 THE REQUIREMENT. "the image style, content, theme should be unique in all
// respect" — so a frozen template is not enough, even though a frozen template
// is the safe thing.
//
// ⛔ AND THE WRONG FIX. A free image model puts words into a picture that no
// word list can read, and faces that belong to nobody. On a page about how
// people feel, a generated face reads as a testimonial from a person who does
// not exist.
//
// ✅ SO: the picture is COMPOSED from independently varying axes. The
// combination is hashed and may never come round again. Every word in it comes
// from the caption the gate has already read. There is no axis for "put a
// person in it", because there is no safe value for that axis.

import { createHash } from "crypto";
import { BRAND_IN_SCRIPT, RTL_LANGUAGES, isSupportedLanguage } from "@/lib/social/languages";

export type Recipe = {
  layout: string;
  palette: string;
  typeTreatment: string;
  motif: string;
  script: string;
  hash: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// The axes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ RENAMED 18 Oct, because the old names described alignment and the new
 * ones describe GEOMETRY. `split-rule` drew no rule; `stacked` and
 * `wordmark-corner` differed from each other only in justification. Each of
 * these now contributes a mark to the frame — a rule, a bar, a block, a
 * division — so that two posts a day apart look like two posts.
 */
export const LAYOUTS = [
  "rule-over",
  "centred-statement",
  "side-bar",
  "stacked-label",
  "offset-quote",
  "corner-block",
  "low-horizon",
  "full-bleed-type",
] as const;

/**
 * Each palette carries its own text colours, already chosen against its ground.
 *
 * ⚠️ CONTRAST IS A PROPERTY OF THE PAIR, NOT OF THE COLOUR. A palette defined
 * as "a nice dark blue" and a caption colour chosen separately is how grey
 * caption text on a tinted card ends up at 3:1 and unreadable on a phone in
 * daylight. So `ink` and `muted` are part of the palette and are not
 * substitutable; `ink` clears 4.5:1 on `ground` and `muted` clears it too at
 * body size.
 */
export const PALETTES: Record<
  string,
  { ground: string; ink: string; muted: string; accent: string; accentInk: string }
> = {
  ink:    { ground: "#111827", ink: "#FFFFFF", muted: "#D1D5DB", accent: "#818CF8", accentInk: "#111827" },
  slate:  { ground: "#1E293B", ink: "#F8FAFC", muted: "#CBD5E1", accent: "#7DD3FC", accentInk: "#0B1220" },
  teal:   { ground: "#0F3D3E", ink: "#FFFFFF", muted: "#CFE8E7", accent: "#5EEAD4", accentInk: "#06302F" },
  sand:   { ground: "#F5EFE6", ink: "#2B2318", muted: "#5B4F3F", accent: "#9A3412", accentInk: "#FFFFFF" },
  plum:   { ground: "#2E1065", ink: "#FFFFFF", muted: "#DDD6FE", accent: "#C4B5FD", accentInk: "#1E0A44" },
  forest: { ground: "#14281D", ink: "#FFFFFF", muted: "#D1E3D5", accent: "#86EFAC", accentInk: "#0A1710" },
};

export const PALETTE_NAMES = Object.keys(PALETTES);

export const TYPE_TREATMENTS = ["display", "tight-display", "measured", "caps-label"] as const;

/**
 * Line and shape fields only.
 *
 * ⛔ No gradient wash. It is the single most recognisable mark of a picture
 * that nobody designed, and this brand cannot afford to look generated.
 */
export const MOTIFS = ["none", "arcs", "dotted-grid", "concentric", "bands", "rule-stack"] as const;

/**
 * 🔑 THE AXIS THAT IS NOT DECORATION. The wordmark is set in the script of the
 * language the post is written in — which is the product's whole argument, made
 * in the one place a reader sees before reading anything.
 *
 * ⛔ Forms come from the shipped product and are never transliterated here.
 */
export const SCRIPTS = Object.keys(BRAND_IN_SCRIPT);

export const TOTAL_COMBINATIONS =
  LAYOUTS.length * PALETTE_NAMES.length * TYPE_TREATMENTS.length * MOTIFS.length * SCRIPTS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Uniqueness
// ─────────────────────────────────────────────────────────────────────────────

export function recipeHash(r: Omit<Recipe, "hash">): string {
  return createHash("sha256")
    .update([r.layout, r.palette, r.typeTreatment, r.motif, r.script].join("|"))
    .digest("hex")
    .slice(0, 32);
}

/**
 * How far back the "do not look the same twice running" rule reaches, counted
 * in POSTS rather than days.
 *
 * 🔴 I FIRST WROTE THIS RULE AS "no palette or layout within 14 days", and it
 * is arithmetically impossible: there are six palettes, so fourteen days of
 * daily posting needs fourteen distinct ones. The rule would have been
 * unsatisfiable from day seven, and the only question was whether the code
 * failed loudly or quietly relaxed it where nobody would read the log.
 *
 * ⇒ Five posts. With six palettes and eight layouts it is always satisfiable,
 * and five posts is long enough that no reader scrolling the page sees the same
 * ground twice in a row. ⚠️ If a palette is ever removed, this number has to
 * come down with it — hence the assertion in the picker rather than a comment
 * asking the next person to remember.
 */
export const RECENT_WINDOW = 5;

/**
 * ⛔ The arithmetic that must hold for the recency preference to be meetable.
 *
 * 🔑 Extracted as its own function so it can be TESTED. Inline, it could only
 * be exercised by shrinking a shared exported constant at runtime, so it went
 * untested — and a mutation run then showed that deleting it broke nothing,
 * which is the same as not having written it
 * ⇒ trap_mutation_harness_can_report_false_caught.
 */
export function assertAxesSupportWindow(
  paletteCount: number,
  layoutCount: number,
  window: number,
): void {
  if (paletteCount <= window || layoutCount <= window) {
    throw new Error(
      `visualRecipe: RECENT_WINDOW is ${window} but there are only ${paletteCount} ` +
        `palettes and ${layoutCount} layouts. The "not among the last ${window}" rule ` +
        `cannot be satisfied — lower the window, or add an axis value.`,
    );
  }
}

export type PickInput = {
  language: string;
  /** Every recipe hash ever used. */
  usedHashes: Set<string>;
  /** Palettes and layouts from the last RECENT_WINDOW posts, newest first. */
  recentPalettes?: string[];
  recentLayouts?: string[];
  /** Injectable for tests. Returns a float in [0, 1). */
  rng?: () => number;
};

export type PickResult =
  | { ok: true; recipe: Recipe; relaxed: string[] }
  | { ok: false; reason: string };

/**
 * Choose a recipe that has never been used, preferring one that also does not
 * reuse a recent palette or layout.
 *
 * 🔑 THE TWO RULES ARE NOT EQUAL, and the difference is the whole design:
 *   • "never used before" is a GUARANTEE. It is backed by a unique index, and
 *     this function fails rather than break it.
 *   • "not among the last five" is a PREFERENCE. If honouring it would leave
 *     nothing, it is dropped and the drop is REPORTED in `relaxed` — because a
 *     preference that silently lapses is indistinguishable from a bug.
 */
export function pickRecipe(input: PickInput): PickResult {
  const { language, usedHashes, recentPalettes = [], recentLayouts = [], rng = Math.random } = input;

  if (!isSupportedLanguage(language)) {
    return { ok: false, reason: `${language} is not one of the 22 languages this product speaks.` };
  }

  // The invariant that keeps RECENT_WINDOW honest. ⛔ Not a comment asking the
  // next person to check: if an axis shrinks below the window, the preference
  // becomes unsatisfiable and this says so instead of quietly relaxing forever.
  assertAxesSupportWindow(PALETTE_NAMES.length, LAYOUTS.length, RECENT_WINDOW);

  const script = language;
  const avoidPalettes = new Set(recentPalettes.slice(0, RECENT_WINDOW));
  const avoidLayouts = new Set(recentLayouts.slice(0, RECENT_WINDOW));

  const unused: Omit<Recipe, "hash">[] = [];
  const unusedPreferred: Omit<Recipe, "hash">[] = [];

  for (const layout of LAYOUTS) {
    for (const palette of PALETTE_NAMES) {
      for (const typeTreatment of TYPE_TREATMENTS) {
        for (const motif of MOTIFS) {
          const candidate = { layout, palette, typeTreatment, motif, script };
          if (usedHashes.has(recipeHash(candidate))) continue;
          unused.push(candidate);
          if (!avoidPalettes.has(palette) && !avoidLayouts.has(layout)) {
            unusedPreferred.push(candidate);
          }
        }
      }
    }
  }

  if (unused.length === 0) {
    // 8 × 6 × 4 × 6 = 1,152 per language. At one post a day this is a problem
    // for somebody in the 2030s, and they should be told plainly rather than
    // handed a repeat.
    return {
      ok: false,
      reason:
        `Every one of the ${LAYOUTS.length * PALETTE_NAMES.length * TYPE_TREATMENTS.length * MOTIFS.length} ` +
        `picture recipes for ${language} has been used. Add a layout, a palette or a motif — ` +
        `⛔ do not reuse one, which is the only thing this register exists to prevent.`,
    };
  }

  const relaxed: string[] = [];
  let pool = unusedPreferred;
  if (pool.length === 0) {
    pool = unused;
    relaxed.push(
      `No unused recipe avoided the last ${RECENT_WINDOW} palettes and layouts, so that preference was dropped. ` +
        `The recipe is still one that has never been used.`,
    );
  }

  const chosen = pool[Math.floor(rng() * pool.length)];
  return { ok: true, recipe: { ...chosen, hash: recipeHash(chosen) }, relaxed };
}

// ─────────────────────────────────────────────────────────────────────────────
// What the picture says
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The headline for a composed picture, taken from the post's own words.
 *
 * ⛔ IT DOES NOT WRITE ANYTHING. That is the point: the gate reads text, not
 * images, so the only safe words to put in a picture are words the gate has
 * already read. Inventing a headline here — even a tasteful one — would open a
 * channel straight past every check in this directory.
 *
 * Returns null rather than truncating mid-thought: a half sentence on a card is
 * worse than no card, and the caller can fall back to text-only.
 */
export function headlineFromBody(body: string, maxChars = 64): string | null {
  const first = body.trim().split(/(?<=[.!?])\s+/)[0]?.trim();
  if (!first) return null;
  const clean = first.replace(/\s+/g, " ").replace(/[.]$/, "");
  if ([...clean].length > maxChars) return null;
  return clean;
}

export function isRtl(language: string): boolean {
  return RTL_LANGUAGES.has(language);
}

export function wordmarkFor(language: string): string {
  return BRAND_IN_SCRIPT[language] ?? BRAND_IN_SCRIPT.en;
}

/**
 * ⛔ The things a composed picture may never contain, as a list rather than a
 * hope. Nothing in this module can produce any of them — there is no face
 * asset, no photographic source and no image model wired in — and this is here
 * so that adding one is a visible decision rather than a convenient import.
 */
export const NEVER_IN_A_PICTURE = [
  "a human face, photographed or generated — it reads as a testimonial from somebody who does not exist",
  "any depiction of distress: a figure in the dark, a tear, a reaching hand. It is what this category reaches for by habit, and the worst thing to meet while scrolling on a bad day",
  "a word that was not in the caption the gate read",
  "country or festival furniture, which narrows the audience a post was supposed to be for",
  "a gradient wash, which is the mark of a picture nobody designed",
] as const;
