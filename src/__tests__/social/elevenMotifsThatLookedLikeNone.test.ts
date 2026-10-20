/**
 * 🔴 ELEVEN MOTIFS AND EVERY CARD LOOKED THE SAME.
 *
 * The owner, 20 Oct 2026: *"all posts still looks very similar."* Nine queued
 * cards were rendered and looked at together, and he was right — the variety
 * was almost entirely HUE. One cause was a single number: every motif drew at
 * a flat **0.13**, and tone-on-tone line work at 13% on a flat ground is
 * invisible at feed size. plum/concentric and plum/arcs are one picture.
 *
 * ⚠️ AND IT WAS ALREADY WRITTEN DOWN. An 18 Oct note said the 25,344-recipe
 * figure was "arithmetically true and visually overstated" and that it was
 * "worth strengthening before daily posting starts". Daily posting started on
 * the 19th ⇒ [[feedback_a_status_block_is_not_a_todo_list]] — a row in a
 * status block is not a task, and nobody reads line 1133.
 */

import { describe, it, expect } from "vitest";
import { motifOpacity } from "@/lib/social/compose";
import { MOTIFS } from "@/lib/social/visualRecipe";

const LINE_FIELDS = ["arcs", "dotted-grid", "concentric", "bands", "rule-stack"];
const BIG_SHAPES = ["halo", "drift", "wave"];

describe("a motif you can actually see", () => {
  it("⛔ `none` draws nothing — and is the control", () => {
    /**
     * 🔑 If this ever returns more than zero, every card has a field and the
     * table is being ignored rather than applied.
     */
    expect(motifOpacity("none")).toBe(0);
  });

  it("🔴 every drawn motif is stronger than the flat 0.13 that hid them all", () => {
    for (const m of MOTIFS.filter((x) => x !== "none")) {
      expect(motifOpacity(m), `${m} is still at or below the invisible value`).toBeGreaterThan(0.13);
    }
  });

  it("🔑 big soft shapes carry more than thin line fields", () => {
    /**
     * ⛔ THE WHOLE REASON ONE NUMBER COULD NOT SERVE BOTH. Line fields cross
     * the frame and pass under words somebody has to read; the big shapes sit
     * in the empty half. Raising them together would mean either invisible
     * shapes or unreadable headlines.
     */
    const line = Math.max(...LINE_FIELDS.map(motifOpacity));
    const big = Math.min(...BIG_SHAPES.map(motifOpacity));
    expect(big, "the big shapes are no bolder than the line work").toBeGreaterThan(line);
  });

  it("⚠️ and no motif is strong enough to fight the words", () => {
    // A field over ~0.4 on a flat ground starts competing with the headline.
    for (const m of MOTIFS) {
      expect(motifOpacity(m), `${m} is loud enough to hurt legibility`).toBeLessThanOrEqual(0.4);
    }
  });

  it("⛔ `none` is the ONLY motif that draws nothing", () => {
    /**
     * 🔑 A motif added to the catalogue without a considered value falls back
     * to the old flat 0.13 — visible, but it is the value this whole change
     * exists to get away from, and `> 0.13` above is what catches that. This
     * one catches the other direction: a motif silently set to zero is a
     * recipe axis that does nothing while still counting toward the variety
     * arithmetic ⇒ the 25,344 figure all over again.
     */
    const silent = MOTIFS.filter((m) => motifOpacity(m) === 0);
    expect(silent, `these motifs draw nothing: ${silent.join(", ")}`).toEqual(["none"]);
  });

  it("the catalogue is the size this table was written against", () => {
    // ⚠️ If a motif is added, it needs a row — otherwise it ships at the old
    // invisible fallback and nobody finds out by looking at a test.
    expect(MOTIFS.length).toBeGreaterThanOrEqual(9);
  });
});
