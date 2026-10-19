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
import { SCRIPT_FONTS } from "@/lib/social/fonts";

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

describe("one switch, not two detectors", () => {
  /**
   * 🔴 fonts.ts ALREADY CARRIED THIS CONCERN, as a per-script
   * `shapingVerified` flag gated on "somebody who READS this script has
   * looked at a rendered picture and said it is right". It governs the
   * WORDMARK. I wrote shaping.ts hours later without noticing
   * ⇒ trap_crisis_card_two_detectors_two_platforms — the same shape as the
   * defect shaping.ts was created to fix.
   *
   * ⚠️ They agree today only because every complex script is unverified.
   * These tests pin that they agree BY CONSTRUCTION, not by coincidence.
   *
   * ▶️ WHEN A SCRIPT IS GENUINELY VERIFIED by a reader, the assertions below
   * that expect it BLOCKED must be updated deliberately. That is the intent,
   * not friction: unlocking somebody's script on a public card is a decision,
   * and a decision should have to touch a test.
   */
  it("takes the verdict from fonts.ts rather than its own list", () => {
    const src = read("src/lib/social/shaping.ts");
    expect(src).toContain("SCRIPT_FONTS[s.script]?.shapingVerified");
    // ⛔ And no second hard-coded allow/deny list hiding beside it.
    expect(src).not.toMatch(/shapingVerified:\s*(true|false)/);
  });

  it("unlocks the moment a script is verified — the same switch as the wordmark", () => {
    /**
     * 🔑 THE BEHAVIOUR THAT MATTERS. If a native reader confirms Bengali on a
     * rendered card, flipping ONE flag in fonts.ts must unlock the headline
     * too. This proves it by flipping the real table at runtime.
     */
    const before = unshapableScripts(ABHIMAAN);
    expect(before).toContain("Bengali");

    const entry = SCRIPT_FONTS.bengali;
    const saved = entry.shapingVerified;
    try {
      (entry as { shapingVerified: boolean }).shapingVerified = true;
      expect(unshapableScripts(ABHIMAAN)).toEqual([]);
    } finally {
      (entry as { shapingVerified: boolean }).shapingVerified = saved;
    }
    // ⚠️ Restored, and checked — a leaked mutation would silently unblock
    // Bengali for every test after this one.
    expect(unshapableScripts(ABHIMAAN)).toContain("Bengali");
  });

  it("⛔ treats a script fonts.ts has never heard of as unverified", () => {
    // Thai, Khmer, Myanmar and Sinhala are in the ranges and not in the font
    // table — none of the 22 languages use them. `?? false`, never `?? true`:
    // an unknown script is not a safe one.
    expect(unshapableScripts("สวัสดี")).toContain("Thai");
    expect(SCRIPT_FONTS.thai).toBeUndefined();
  });

  it("every blocked script name is one a person can read", () => {
    // ⚠️ The note goes to a human. "oriya" is a table key; "Odia" is a word.
    expect(unshapableScripts("ଅଭିମାନ")).toContain("Odia");
    expect(unshapableScripts("ଅଭିମାନ")).not.toContain("oriya");
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

  it("the renderer SKIPS an unshapable sentence and uses the next one", () => {
    /**
     * ⛔ My first version dropped the support line outright, which left a
     * card with one line and an empty upper third — the exact weakness
     * `supportFromBody` was added to fix. The broken word was in sentence 0;
     * sentences 1 to 3 were plain Latin and would have carried the card.
     *
     * ⚠️ Pinned as a LOOP that advances, not a single assignment, and with
     * the give-up branch intact: a post written entirely in an unshapable
     * script has nothing to offer here.
     */
    const at = renderer.indexOf("for (let from = startAt");
    expect(at).toBeGreaterThan(-1);
    const block = renderer.slice(at, at + 400);
    expect(block).toContain("unshapableScripts(support)");
    expect(block).toContain("supportFromBody(post.body, 150, from + 1)");
    expect(block).toContain("support = undefined");
  });

  it("⛔ the skip cannot loop forever on a body it never satisfies", () => {
    // ⚠️ `supportFromBody` returns null once `from` passes the sentence
    // count, and an unchanged value also ends it — both exits are pinned,
    // because an infinite loop here would hang a publish, not fail it.
    const at = renderer.indexOf("for (let from = startAt");
    const block = renderer.slice(at, at + 400);
    expect(block).toMatch(/if \(!next \|\| next === support\)/);
    expect(block).toContain("break;");
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
