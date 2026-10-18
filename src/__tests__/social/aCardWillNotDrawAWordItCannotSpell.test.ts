/**
 * 🔴 FOUND BY THE OWNER, ON A LIVE POST, 18 Oct.
 *
 * The first Instagram card carried `অভিমান` and rendered it **অভমিান** — the
 * pre-base vowel sign ি did not move left of its consonant. Bengali requires
 * that reordering; Satori, which `next/og` uses to draw these cards, does not
 * do it.
 *
 * ⚠️ NOTHING ABOUT THE TEXT WAS WRONG. The caption, the database row and the
 * owner-confirmed word table were byte-identical and correct. Only the IMAGE
 * was wrong — which is why no dictionary check could have caught it, and why
 * the rule is "a reader of that script looks at a rendered picture"
 * ⇒ trap_a_card_cannot_draw_an_indic_script.
 *
 * ⛔ And the rule was already in renderPicture.ts, written about the wordmark
 * and never applied to the words.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unshapableScripts, unshapableNote } from "@/lib/social/shaping";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const renderer = strip(read("src/lib/social/renderPicture.ts"));
const pipeline = strip(read("src/lib/social/pipeline.ts"));

/** The exact word, with the exact code points that were published. */
const ABHIMAAN = "অভিমান";

describe("the word that broke", () => {
  it("is the one the table confirmed — the characters were never the problem", () => {
    expect(ABHIMAAN).toBe("অভিমান");
    expect(read("src/lib/social/untranslatableWords.ts")).toContain(ABHIMAAN);
  });

  it("is recognised as a script this renderer cannot draw", () => {
    expect(unshapableScripts(ABHIMAAN)).toContain("Bengali");
    expect(unshapableScripts(`${ABHIMAAN} (abhimaan): the hurt`)).toContain("Bengali");
  });
});

describe("which scripts are blocked, and which are deliberately not", () => {
  it("blocks every script that must reorder or join", () => {
    const cases: [string, string][] = [
      ["অভিমান", "Bengali"],
      ["अभिमान", "Devanagari (Hindi, Marathi)"],
      ["ਅਭਿਮਾਨ", "Gurmukhi (Punjabi)"],
      ["અભિમાન", "Gujarati"],
      ["ଅଭିମାନ", "Odia"],
      ["அபிமானம்", "Tamil"],
      ["అభిమానం", "Telugu"],
      ["ಅಭಿಮಾನ", "Kannada"],
      ["അഭിമാനം", "Malayalam"],
      ["كرامة", "Arabic (incl. Urdu)"],
    ];
    for (const [text, script] of cases) {
      expect(unshapableScripts(text), `${text} should be blocked`).toContain(script);
    }
  });

  it("⛔ does NOT block scripts that draw correctly as they are", () => {
    /**
     * ⚠️ The test is whether glyphs must MOVE or CHANGE SHAPE, not whether
     * the script is unfamiliar. Blocking these would cost the product
     * languages for no reason.
     */
    for (const text of [
      "Abhimaan",          // Latin
      "αβγ",               // Greek
      "Привет",            // Cyrillic
      "אהבה",              // Hebrew — right to left, but no reordering
      "愛しさ",             // Japanese
      "사랑",               // Korean
      "心",                 // Han
    ]) {
      expect(unshapableScripts(text), `${text} should be allowed`).toEqual([]);
    }
  });

  it("says which script, so the note names the post", () => {
    const note = unshapableNote(unshapableScripts(ABHIMAAN), "The card's headline");
    expect(note).toContain("Bengali");
    expect(note).toMatch(/misspelt|misspelling/);
    // ▶️ And why refusing is the right answer, where somebody will read it.
    expect(note).toMatch(/insults exactly the readers it is for/);
  });
});

describe("where the rule is enforced", () => {
  it("the renderer refuses a headline it cannot spell", () => {
    /**
     * 🔑 THE RENDERER IS THE AUTHORITY, because it re-derives the headline
     * from the post's words at draw time — a decision made anywhere else can
     * be re-made here with different input.
     */
    const at = renderer.indexOf("unshapableScripts(headline)");
    expect(at).toBeGreaterThan(-1);
    const block = renderer.slice(at, at + 400);
    expect(block).toContain("ok: false");
    expect(block).toContain("unshapableNote");
  });

  it("the renderer DROPS a support line rather than losing the card", () => {
    // ⚠️ The headline comes from the subject and is usually Latin. One good
    // line beats no card, and beats a misspelt word by a distance.
    expect(renderer).toMatch(/if \(support && unshapableScripts\(support\)\.length > 0\) support = undefined;/);
  });

  it("the pipeline refuses earlier, so nothing is queued that cannot be drawn", () => {
    // ⛔ Otherwise the post fails at 17:00 with nobody watching.
    const at = pipeline.indexOf("unshapableScripts(headline)");
    expect(at).toBeGreaterThan(-1);
    const block = pipeline.slice(at, at + 400);
    expect(block).toContain("picture: null");
  });

  it("⛔ neither place truncates, substitutes or transliterates", () => {
    // A card that quietly romanised somebody's language would be a different
    // insult, not a fix.
    for (const src of [renderer, pipeline]) {
      expect(src).not.toMatch(/translit/i);
      expect(src).not.toMatch(/normalize\("NFK[CD]"\)/);
    }
  });
});
