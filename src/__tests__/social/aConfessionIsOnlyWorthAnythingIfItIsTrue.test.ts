/**
 * 🔴 THE FIRST POST THE "WHAT WE GOT WRONG" ANGLE EVER WROTE WAS INVENTED.
 *
 *   "We started with cloud sync on by default and realised it wasn't right
 *    for something private."
 *
 * ⛔ That never happened. The owner confirmed it on 18 Oct, and nothing in the
 * code, the memory files or git history records sync ever being on by default.
 * The model had no access to the product's history, was asked for a piece of
 * it, and produced a plausible one — exactly as it did with the Tamil word
 * ⇒ aWordNobodyCheckedIsNotAFact.test.ts.
 *
 * 🔑 THIS ONE IS WORSE. A wrong gloss embarrasses us with speakers of one
 * language. A false confession is an untrue statement about the company,
 * published voluntarily, in the one register where being caught costs most —
 * because the entire value of an admission is that it is true.
 *
 * ⚠️ AND THE CHECK IS WEAKER HERE, which this file says out loud rather than
 * implying parity with the word case. A word is in the post or it is not. A
 * mistake can be the right subject with an invented detail bolted on, and no
 * string match sees that. Hence the second safeguard: it never auto-publishes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_MISTAKES,
  vettedMistakes,
  mistakesPoolReady,
  pickMistake,
  mentionsMistake,
} from "@/lib/social/productMistakes";
import { usablePools } from "@/lib/social/pipeline";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const pipeline = read("src/lib/social/pipeline.ts");

describe("nothing is usable until somebody signs it", () => {
  it("⛔ an unsigned entry is never offered", () => {
    for (const m of vettedMistakes()) {
      expect(m.confirmedBy, `${m.id} is offered with nobody's name on it`).not.toBeNull();
    }
  });

  /**
   * ⚠️ PASSES TODAY BECAUSE THE TABLE IS UNSIGNED, and that is the intent. I
   * cannot fill this one at all: the product's history is not something I have
   * access to, and producing a plausible version of it is the failure above.
   */
  it("the angle is off, and says why", () => {
    if (vettedMistakes().length === 0) {
      expect(mistakesPoolReady().ok).toBe(false);
      expect(mistakesPoolReady().reason).toMatch(/invented a history that never happened/i);
      expect(pickMistake(0)).toBeNull();
    } else {
      expect(mistakesPoolReady().ok).toBe(true);
    }
  });

  it("every candidate carries what went wrong, the fix, and keywords to check it by", () => {
    for (const m of PRODUCT_MISTAKES) {
      expect(m.what.length, `${m.id} does not say what went wrong`).toBeGreaterThan(20);
      expect(m.fix.length, `${m.id} does not say what it was changed to`).toBeGreaterThan(5);
      expect(m.keywords.length, `${m.id} has no keywords, so no post can be checked`).toBeGreaterThan(1);
    }
  });

  it("a candidate says where somebody can check it actually happened", () => {
    for (const m of PRODUCT_MISTAKES) {
      expect(m.evidence, `${m.id} has nothing to check it against`).toBeTruthy();
    }
  });
});

describe("the post has to be about the mistake it was given", () => {
  const m = PRODUCT_MISTAKES[0];

  it("accepts a post that covers every keyword", () => {
    const body = `We said a channel was connected when we had only saved the token. It is checked now.`;
    expect(mentionsMistake(body, m)).toBe(true);
  });

  /**
   * ⛔ EVERY keyword, not any. "token" alone matches half the posts this
   * product writes, and a check that passes easily is a check that is not
   * running.
   */
  it("refuses a post that only brushes past it", () => {
    expect(mentionsMistake("We take your token seriously.", m)).toBe(false);
  });

  it("🔴 refuses the invented one that caused this", () => {
    const invented =
      "We started with cloud sync on by default and realised it wasn't right for something private.";
    expect(mentionsMistake(invented, m)).toBe(false);
  });
});

describe("the pipeline enforces it", () => {
  it("drops the angle from the rotation when nothing is confirmed", () => {
    const pools = ["privacy", "built-wrong", "the-unsaid"];
    if (mistakesPoolReady().ok) {
      expect(usablePools(pools)).toEqual(pools);
    } else {
      expect(usablePools(pools)).toEqual(["privacy", "the-unsaid"]);
    }
  });

  it("refuses a draft that wandered off the supplied mistake", () => {
    expect(pipeline).toMatch(/if \(mistake && !mentionsMistake\(/);
    const branch = pipeline.slice(pipeline.indexOf("if (mistake && !mentionsMistake("));
    expect(branch.slice(0, 700)).toContain("rejected.push");
    expect(branch.slice(0, 700)).toContain("continue;");
  });

  /**
   * 🔴 THE SECOND SAFEGUARD, and the one that matters most. The keyword check
   * proves the post is about the right mistake; it cannot prove the post did
   * not ADD to it. So a human stays in the way even when "post without asking
   * me" is on.
   */
  it("⛔ never lets a confession publish unattended", () => {
    expect(pipeline).toMatch(/const status = mistake \? "needs_review" : decided\.status;/);
  });

  it("⛔ and the override only ever moves TOWARDS review", () => {
    // A rule that could turn needs_review into approved would be a hole, not
    // a safeguard. The only literal in that expression is "needs_review".
    const line = pipeline.slice(
      pipeline.indexOf("const status = mistake ?"),
      pipeline.indexOf("const note ="),
    );
    expect(line).not.toMatch(/"approved"/);
  });

  it("tells the reader why it was held", () => {
    expect(pipeline).toMatch(/never publishes[\s\S]{0,40}unattended/);
  });
});

describe("the writer is handed the mistake, not asked for one", () => {
  const writer = read("src/lib/social/writer.ts");

  it("carries what went wrong and what it was changed to", () => {
    expect(writer).toContain("THE MISTAKE IS ALREADY CHOSEN");
    expect(writer).toMatch(/req\.mistake\.what/);
    expect(writer).toMatch(/req\.mistake\.fix/);
  });

  it("⛔ tells it not to add anything, and says why that matters", () => {
    expect(writer).toMatch(/do not add a[\s\S]{0,40}detail that is not in the two lines above/);
    expect(writer).toMatch(/false statement about a real company/);
  });
});
