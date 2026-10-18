/**
 * 🔴 THE FIRST INSTAGRAM POST PASSED EVERY CHECK AND WAS STILL MEDIOCRE.
 *
 * 18 Oct. All four word checks green, one advisory note about length — and
 * reading it found three breaches of this product's own written rules: it
 * opened on a wind-up, no sentence finished before the fold, and it used none
 * of its five tags on an account where tags are close to the only way a
 * stranger arrives.
 *
 * ⛔ That post was caught because somebody read it. Tomorrow's 17:00 post goes
 * out with nobody reading it, which is what these checks are for.
 *
 * ⚠️ ADVICE, NEVER A GATE. A person may open with a scene-setting clause on
 * purpose — but they should be told they did
 * ⇒ feedback_social_content_standing_rules, which draws that line.
 */

import { describe, it, expect } from "vitest";
import { checkHouseStyle } from "@/lib/social/voiceGate";

/** The caption exactly as the writer produced it. */
const AS_WRITTEN =
  "In Bengali, অভিমান (abhimaan) means the hurt pride you can only feel towards someone you " +
  "love — wounded, a little sulky, and waiting for them to notice without being told. It's a " +
  "feeling English needs a whole sentence for.";

/** The caption that actually went out, after the three problems were fixed. */
const AS_PUBLISHED =
  "অভিমান (abhimaan): the hurt only someone you love can cause.\n\n" +
  "Half wounded, half sulking — and waiting to be noticed without having to ask for it.\n\n" +
  "No English word carries it. Bengali needed one.\n\n" +
  "#abhimaan #অভিমান #bengali #untranslatablewords";

const problems = (text: string, platform = "instagram") =>
  checkHouseStyle(text, platform).problems.join("\n");

describe("the real post, before and after", () => {
  it("finds all three problems in the version that nearly went out", () => {
    const p = problems(AS_WRITTEN);
    expect(p).toMatch(/wind-up/i);
    expect(p).toMatch(/Nothing finishes before the fold/);
    expect(p).toMatch(/No hashtags/);
  });

  it("finds none of them in the version that did go out", () => {
    // ⛔ The length note remains and should: 244 characters past a 125 fold is
    // a fact worth saying. The three judgements are gone.
    const p = problems(AS_PUBLISHED);
    expect(p).not.toMatch(/wind-up/i);
    expect(p).not.toMatch(/Nothing finishes before the fold/);
    expect(p).not.toMatch(/No hashtags/);
  });
});

describe("nothing finishes before the fold", () => {
  it("is about whether a thought COMPLETES, not where the cut falls", () => {
    /**
     * 🔴 MY FIRST VERSION DEMANDED THE FOLD LAND EXACTLY ON A SENTENCE END,
     * and it flagged the rewrite that fixed the original — a complete
     * sentence at 60 characters followed by a trailing clause, which is fine
     * and arguably better, because the cut-off is where the curiosity is.
     * ⛔ A check that calls the fix a failure teaches people to ignore it.
     */
    const short = "A finished thought. " + "and then a long trailing clause ".repeat(12);
    expect(problems(short)).not.toMatch(/Nothing finishes before the fold/);

    const none = "A single sentence that simply keeps going and going without ever stopping ".repeat(4);
    expect(problems(none)).toMatch(/Nothing finishes before the fold/);
  });

  it("counts a paragraph break as a thought finishing", () => {
    const broken = "No full stop here\n\n" + "trailing words ".repeat(20);
    expect(problems(broken)).not.toMatch(/Nothing finishes before the fold/);
  });

  it("counts a danda, because this product writes in Indic scripts", () => {
    // ⚠️ ।  is the sentence end in Hindi, Bengali, Marathi and more. A check
    // that only knows the full stop would flag every Devanagari post.
    const hindi = "यह एक पूरा वाक्य है। " + "और फिर कुछ और शब्द ".repeat(14);
    expect(problems(hindi)).not.toMatch(/Nothing finishes before the fold/);
  });

  it("says nothing at all about a post that fits inside the fold", () => {
    expect(problems("Short enough to need no fold at all.")).not.toMatch(/fold/);
  });
});

describe("the unused tag budget", () => {
  it("is raised on a channel that has one", () => {
    expect(problems("A post with no tags at all, written for Instagram.")).toMatch(/No hashtags/);
  });

  it("⛔ is NOT raised on Facebook, where zero is the right answer", () => {
    // 🔑 Saying "you used none of your tags" on a channel whose rule is "use
    // none" would be advice to do the wrong thing.
    expect(problems("A post with no tags at all.", "facebook")).not.toMatch(/No hashtags/);
  });

  it("⛔ is NOT raised on LinkedIn either, though it permits three", () => {
    /**
     * 🔴 MY FIRST VERSION ASKED `spec.hashtags > 0`, which flagged every
     * tagless LinkedIn post — and broke three existing tests that assert a
     * short clean post passes house style. "How many are allowed" and "do
     * tags bring strangers here" are different questions, and only the second
     * one belongs in this check ⇒ platforms.ts `tagsDriveDiscovery`.
     */
    expect(problems("A short, clean post with no tags.", "linkedin")).not.toMatch(/No hashtags/);
  });

  it("says what a good tag is, and what is never one", () => {
    const p = problems("No tags here.");
    expect(p).toMatch(/a real person searches/);
    // ⛔ The line that does not move, repeated where somebody will read it.
    expect(p).toMatch(/condition somebody might be living with/);
  });
});

describe("the wind-up", () => {
  it("catches the one that nearly shipped", () => {
    expect(problems("In Bengali, there is a word for it.")).toMatch(/wind-up/i);
  });

  it("catches the other shapes of the same move", () => {
    for (const opener of [
      "There's a word in Japanese, and it means something.",
      "Have you ever noticed, in the evening, how quiet it gets?",
      "According to most people, this is true.",
    ]) {
      expect(problems(opener), opener).toMatch(/wind-up/i);
    }
  });

  it("⛔ leaves a sentence that merely begins with a preposition alone", () => {
    // ⚠️ The pattern is narrow on purpose: a SHORT scene-setting phrase then
    // a comma. "In the room where she used to sit, nothing had moved" is a
    // real opening, not throat-clearing.
    for (const fine of [
      "In the room where she used to sit, nothing had been moved at all.",
      "অভিমান (abhimaan): the hurt only someone you love can cause.",
      "Nobody asks how you are twice.",
    ]) {
      expect(problems(fine), fine).not.toMatch(/wind-up/i);
    }
  });
});
