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
/**
 * 🔴 NAMES THESE AXES USED TO HAVE, AND WHAT THEY BECAME.
 *
 * Renaming the layouts on 18 Oct broke every picture already stored under an
 * old name: the recipe lives in `social_posts.visual_recipe` as JSON, so a post
 * approved an hour earlier suddenly rendered as
 * `unknown layout "split-rule"` — a 422 and a broken image in the queue.
 *
 * ⚠️ THE GENERAL LESSON, which is worth more than this map: ANY value that is
 * persisted and then matched by name is a public identifier, even when it looks
 * like an internal one. Renaming it is a migration, not a tidy-up. The same
 * applies to the palettes, the motifs and the type treatments below — if one of
 * those is ever renamed, it needs an entry here too.
 *
 * ⛔ The HASH is deliberately NOT rewritten. The register recorded what was
 * actually used, and rewriting history to match a new vocabulary would be a
 * worse bug than the one this fixes: a recipe could then be used twice.
 */
export const RETIRED_LAYOUTS: Record<string, string> = {
  "wordmark-corner": "corner-block",
  "split-rule": "side-bar",
  stacked: "stacked-label",
  "language-grid": "stacked-label",
};

/** The current name for a layout, old or new. ⛔ Still throws on one that was
 *  never a layout at all — a typo must not silently become a picture. */
export function canonicalLayout(name: string): string {
  return RETIRED_LAYOUTS[name] ?? name;
}

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
/**
 * 🔑 THE CARD'S HEADLINE LIMIT, named so the WRITER can be told it.
 *
 * ⛔ It was a default argument only, which meant the one number that decides
 * whether a post can have a card at all was invisible to the thing writing
 * the post. On a channel with no text-only post that is the difference
 * between a draft and no post ever.
 */
export const HEADLINE_MAX = 64;

export function headlineFromBody(body: string, maxChars = HEADLINE_MAX): string | null {
  // ⚠️ Same rule as the support line: a tag on a card is not a word.
  body = withoutHashtags(body);
  const first = body.trim().split(/(?<=[.!?])\s+/)[0]?.trim();
  if (!first) return null;
  const clean = first.replace(/\s+/g, " ").replace(/[.]$/, "");
  if ([...clean].length > maxChars) return null;
  return clean;
}

/**
 * The headline a card should actually carry.
 *
 * 🔴 THE SUBJECT WAS WRITTEN TO BE THIS AND WAS BEING THROWN AWAY.
 *
 * `writer.ts` instructs the model: *"subject is for our records and for the
 * headline on the picture: a short phrase, under sixty characters"*. The gate
 * reads it — `checkVoice(`${subject}\n${body}`)` — so it is as safe to publish
 * as the body. And then the renderer ignored it and used the body's opening
 * sentence, which nothing had ever asked to be short.
 *
 * ⚠️ So the card disappeared exactly when the writing was good: the 18 Oct
 * content rules push for a specific, concrete opening line, the first one
 * written under them ran to 160 characters, and the post went out as grey text
 * in a feed of bold graphics.
 *
 * ⛔ THE RULES THAT MATTER ARE UNTOUCHED. Nothing is invented — both candidates
 * are words the gate has already read. Nothing is truncated — an over-long
 * subject falls through to the body, and an over-long body still returns null
 * and the post goes out as text.
 */
export function headlineFor(subject: string, body: string, maxChars = HEADLINE_MAX): string | null {
  const fromSubject = subject?.trim().replace(/\s+/g, " ").replace(/[.]$/, "") ?? "";
  if (fromSubject && [...fromSubject].length <= maxChars) return fromSubject;
  return headlineFromBody(body, maxChars);
}

/**
 * The line under the headline: what the body says after its opening sentence.
 *
 * 🔴 BOTH RENDER ROUTES CALLED compose WITH THE HEADLINE ALONE. composePicture
 * has taken a `support` since the day it was written, all eight layouts place
 * it, and the tests pass one in — so every one of them exercised a node that
 * nothing in production ever supplied. No published card has ever carried a
 * second line, and the empty upper third of every card was the layout
 * distributing space around a node that was not there.
 *
 * ⚠️ A test that hands compose a support and checks where it lands says
 * nothing about whether anything hands compose a support. That is the
 * reachability trap, and it is the second time it has bitten this feature.
 *
 * ⛔ DERIVED FROM THE BODY, NEVER STORED — the same rule as the headline, for
 * the same reason: a picture must not be able to show a sentence the word check
 * did not read. If the words are edited, the card follows them.
 *
 * ⚠️ Whole sentences only. A support line cut mid-clause reads as a bug, and
 * returning nothing is the better failure: the card is then exactly what every
 * card has been until now.
 */
/**
 * 🔴 A HASHTAG IS CAPTION SYNTAX, AND A CARD IS NOT A CAPTION.
 *
 * Caught on the second Instagram card, before it published: the body ends
 * with `#imfine #theunsaid #quietthoughts #feelings`, the support line is
 * taken from the body, and so four hashtags were set in type on the image.
 * On a picture they mean nothing, they are not clickable, and they read as
 * clutter under a line somebody was meant to sit with.
 *
 * ⚠️ The first Instagram card hid this: its support line was cut short by a
 * long opening sentence before it ever reached the tags.
 *
 * ⛔ Stripped wherever they appear, not only at the end. `\p{M}` is in the
 * class so a Bengali or Devanagari tag is removed whole rather than leaving
 * its vowel signs behind ⇒ the same lesson as the hashtag counter.
 */
export function withoutHashtags(text: string): string {
  return text
    .replace(/(^|\s)#[\p{L}\p{N}\p{M}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function supportFromBody(
  body: string,
  maxChars = 150,
  /**
   * ⚠️ Which sentence to start from.
   *
   * 🔑 It was always 1 — skip the opening, because the opening WAS the
   * headline. Now that the headline comes from the subject, starting at 1
   * means the post's strongest line never appears on the card at all, so the
   * caller says where to begin rather than this guessing.
   */
  from = 1,
): string | null {
  // ⛔ Tags removed BEFORE the sentences are counted, so a trailing tag line
  // does not become a "sentence" that the caller then has to skip past.
  const sentences = withoutHashtags(body)
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= from) return null;

  let out = "";
  for (const s of sentences.slice(from)) {
    const next = out ? `${out} ${s}` : s;
    if ([...next].length > maxChars) break;
    out = next.replace(/\s+/g, " ");
  }
  return out || null;
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
