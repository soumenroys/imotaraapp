/**
 * 🔴 THE DEFECT: no published card has ever carried its second line.
 *
 * composePicture has accepted a `support` since the day it was written. All
 * eight layouts place it. Several tests pass one in and assert where it lands,
 * and every one of them passed. Both render routes — the picture and the
 * animation — called compose with the headline and nothing else, so the node
 * was never built in production. The empty upper third of every card was the
 * layout distributing space around something that was not there.
 *
 * ⚠️ THIS IS THE REACHABILITY TRAP, for the second time in this feature. A test
 * that hands compose a support and checks the result says nothing whatever
 * about whether anything hands compose a support. ⇒ The first describe block
 * below tests the derivation; the second tests that somebody calls it, which
 * is the half that was missing.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { headlineFromBody, supportFromBody, withoutHashtags, recipeHash } from "@/lib/social/visualRecipe";
import { storyboard } from "@/lib/social/frames";

/**
 * ⚠️ THE STILL PICTURE'S RENDERER MOVED on 18 Oct, out of the admin route and
 * into a shared module, because the publisher needs the same bytes and cannot
 * be handed a URL behind an admin guard ⇒ src/lib/social/renderPicture.ts.
 *
 * 🔑 THE TEST FOLLOWED THE CODE RATHER THAN BEING RELAXED. It fired on the
 * move, which is what it is for — and pointing it at the new home keeps it
 * checking the same thing: that a call site exists at all. ⛔ Deleting the
 * failing case, or loosening it to "somewhere in src/", would have thrown away
 * the one check that caught the original bug.
 */
/**
 * 🔴 AND IT MOVED AGAIN ON 19 OCT, for the same reason and with the same
 * answer. The animation route had its own copy of the whole pipeline; it now
 * calls `renderAnimation`, so the call site this guard looks for lives there.
 *
 * ⛔ THE TEST FOLLOWED THE CODE A SECOND TIME. Both failures were real: the
 * file it was reading no longer composes anything, so a green result would
 * have meant nothing at all.
 */
const COMPOSER_CALLERS = [
  "src/lib/social/renderPicture.ts",
  "src/lib/social/renderAnimation.ts",
];

describe("what the second line says", () => {
  const body =
    "What you say to Imotara stays with you by default. No one else sees your conversations unless you decide to turn on cloud sync.";

  it("is the body after its opening sentence", () => {
    expect(supportFromBody(body)).toBe(
      "No one else sees your conversations unless you decide to turn on cloud sync.",
    );
  });

  it("⛔ never overlaps the headline", () => {
    // 🔑 The card would otherwise print the same sentence twice, large and
    // then small, which is the single most obvious way this could look broken.
    const headline = headlineFromBody(body);
    expect(headline).toBeTruthy();
    expect(supportFromBody(body)).not.toContain(headline as string);
  });

  it("is nothing at all when there is only one sentence", () => {
    expect(supportFromBody("A single thought, and no more than one.")).toBeNull();
  });

  it("⚠️ stops on a sentence boundary rather than mid-clause", () => {
    const long =
      "Short opener. " +
      "This second sentence is deliberately written to run well past the hundred and fifty character budget that the support line is given, so that it cannot fit. " +
      "Third.";
    // ⛔ Returning null — the card as it has always been — beats a line that
    // stops in the middle of a word and reads as a bug to every viewer.
    expect(supportFromBody(long)).toBeNull();
  });

  it("takes several short sentences while they fit, and no more", () => {
    // "Two is here. Three is here too." is 31 characters; adding " Four."
    // takes it to 37. A budget of 35 proves both halves of the rule in one go.
    const out = supportFromBody("One. Two is here. Three is here too. Four.", 35);
    expect(out).toBe("Two is here. Three is here too.");
  });

  it("collapses the whitespace a pasted body carries", () => {
    expect(supportFromBody("Opening line. Second\n\n  line  here.")).toBe("Second line here.");
  });
});

describe("⛔ and something actually calls it", () => {
  /**
   * 🔑 A SOURCE ASSERTION, DELIBERATELY. Every other way of testing this —
   * invoking the handler, mocking Supabase and next/og — tests the mock. The
   * thing that broke was a call site that did not exist, and the only cheap
   * check that sees a missing call site is to look for it.
   *
   * ⚠️ It is coarse: it would not notice `support` being passed an empty
   * string. It would have caught the actual bug on the day it shipped, which
   * nothing else in 325 tests did.
   */
  for (const route of COMPOSER_CALLERS) {
    it(`${route.split("/").slice(-2)[0]} passes a support to the composer`, () => {
      const src = readFileSync(join(process.cwd(), route), "utf8");
      /**
       * ⚠️ "FROM THE BODY", NOT "FROM supportFromBody" — widened 19 Oct, and
       * the distinction is the whole rule rather than a loosening of it.
       *
       * 🔑 The animation renderer passes the WHOLE body, because a video has
       * room for every sentence and `supportFromBody` returns one. Both are
       * the body, and the body is what the word check read ⇒ the gate runs on
       * `${subject}\n${body}`. What is still forbidden is a support that
       * comes from anywhere else.
       */
      expect(src, "nothing here derives a support from the body at all").toMatch(
        /supportFromBody\(|withoutHashtags\(\s*post\.body|support:\s*post\.body\b/,
      );

      /**
       * ⚠️ FOLLOWS ONE HOP, because the value no longer reaches the composer
       * inline. A script this renderer cannot shape has its support line
       * DROPPED ⇒ shaping.ts, which needs a step between deriving the line
       * and passing it. The rule did not change: whatever `support` is given
       * must come from supportFromBody.
       *
       * ⛔ Still bites on the bug it was written for — `support` not passed
       * at all, or passed a literal `undefined`.
       */
      /**
       * ⚠️ `support: x`, `support: someCall(...)`, `support: post.body` or the
       * shorthand `support,` — the rule is about what reaches the composer,
       * not style.
       *
       * 🔴 THE CALL BRANCH IS DELIBERATELY ANONYMOUS, after naming the
       * functions one at a time failed twice. It read `supportFromBody\(`,
       * so when the value became `withoutHashtags(post.body)` the bare
       * identifier branch matched instead and the test went looking for a
       * `const withoutHashtags = …`. A pattern that has to be edited every
       * time a legitimate helper is introduced will be edited carelessly once.
       * ⇒ Any call is a call; WHAT it is given is checked below and in the
       * next case.
       */
      const passed = src.match(
        /support:\s*(post\.body\b|[A-Za-z_$][\w$]*\(|[A-Za-z_$][\w$]*)|^\s*support,\s*$/m,
      );
      expect(passed, "nothing is passed as `support` to the composer").not.toBeNull();
      const value = passed![1] ?? "support";
      expect(value, "`support` is passed a literal undefined").not.toBe("undefined");
      // ⚠️ A direct call or `post.body` needs no hop; a bare name does.
      if (!value.endsWith("(") && value !== "post.body") {
        const assigned = new RegExp(
          `(const|let)\\s+${value}\\b[^;]*(supportFromBody\\(|post\\.body)`,
          "s",
        );
        expect(
          assigned.test(src),
          `\`support\` is passed ${value}, which is not derived from the post's body`,
        ).toBe(true);
      }
    });

    it(`${route.split("/").slice(-2)[0]} derives it from the post's own body`, () => {
      // ⛔ Not from the subject, and not from a stored column. A picture must
      // not be able to show a sentence the word check did not read.
      //
      // ⚠️ The `as string` cast is NOT part of the rule and used to be baked
      // into this pattern. Once the renderer moved into a module that types
      // `body` properly, the cast was gone and the assertion failed over
      // punctuation rather than over the thing it exists to check.
      const src = readFileSync(join(process.cwd(), route), "utf8");
      expect(src).toMatch(
        /supportFromBody\(\s*post\.body\b|withoutHashtags\(\s*post\.body\b|support:\s*post\.body\b/,
      );
      // ⛔ And still not from either of the two wrong sources.
      expect(src).not.toMatch(/supportFromBody\(\s*post\.subject\b/);
      expect(src, "the support is taken from the subject").not.toMatch(/support:\s*post\.subject\b/);
    });
  }
});

/**
 * 🔴 CAUGHT ON THE SECOND INSTAGRAM CARD, BEFORE IT PUBLISHED.
 *
 * The body ended with `#imfine #theunsaid #quietthoughts #feelings`, the
 * support line is taken from the body, and so four hashtags were set in type
 * on the image. On a picture they mean nothing, they are not clickable, and
 * they read as clutter under a line somebody was meant to sit with.
 *
 * ⚠️ The FIRST Instagram card hid this: its support was cut short by a long
 * opening sentence before it ever reached the tags.
 */
describe("a hashtag is caption syntax, and a card is not a caption", () => {
  const body =
    "You say you’re fine because it’s faster than explaining what’s really on your mind.\n\n" +
    "Nobody asks twice.\n\n#imfine #theunsaid #quietthoughts #feelings";

  it("keeps the words and drops the tags", () => {
    const support = supportFromBody(body, 150, 0);
    expect(support).toContain("Nobody asks twice.");
    expect(support).not.toMatch(/#/);
    expect(support).not.toMatch(/imfine|theunsaid|quietthoughts|feelings/);
  });

  it("does not leave a trailing tag line masquerading as a sentence", () => {
    // ⛔ Stripped BEFORE the sentences are counted, or `from` would have to
    // skip past a "sentence" made only of tags.
    expect(supportFromBody(body, 150, 1)).toBe("Nobody asks twice.");
    expect(supportFromBody(body, 150, 2)).toBeNull();
  });

  it("⛔ nor on a video frame, nor in the narrator's mouth", () => {
    /**
     * 🔴 THE SAME DEFECT, RE-OPENED FOR A DAY BY A FIX TO SOMETHING ELSE.
     *
     * On 19 Oct the animation renderer stopped passing `supportFromBody` and
     * started passing the whole body — correctly, because a video has room
     * for every sentence and that call returns one. ⛔ But the stripping
     * lived INSIDE the call that was removed. Tags carry no sentence-ending
     * punctuation, so `sentencesOf` handed them back as a scene of their own:
     * a final frame reading "#imfine #theunsaid #quietthoughts #feelings",
     * set in display type, and then SPOKEN ALOUD by the narrator.
     *
     * ⚠️ Measured, not reasoned: the storyboard was run and its scenes
     * printed ⇒ trap_blunt_fix_trades_one_failure_for_its_opposite.
     */
    const base = { layout: "rule-over", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en" };
    const board = storyboard({
      recipe: { ...base, hash: recipeHash(base as never) } as never,
      headline: "The thing nobody said",
      // ⇒ exactly what renderAnimation passes.
      support: withoutHashtags(body),
      language: "en",
      platform: "facebook",
    });

    // 🔑 `sceneTexts` is BOTH what is drawn and what is spoken ⇒ speech.ts.
    for (const scene of board.sceneTexts) {
      expect(scene, `a scene reads "${scene}"`).not.toMatch(/#/);
      expect(scene).not.toMatch(/imfine|theunsaid|quietthoughts|feelings/);
    }
    // ⚠️ And the words that matter are still all there.
    expect(board.sceneTexts.join(" ")).toContain("Nobody asks twice.");
  });

  it("removes a tag in a script that uses combining marks, whole", () => {
    // ⚠️ `\p{M}` is in the class, or the vowel signs are left behind as
    // loose marks on the card ⇒ the same lesson as the hashtag counter.
    expect(withoutHashtags("keep this #অভিমান gone")).toBe("keep this gone");
    expect(withoutHashtags("keep this #बहुत gone")).toBe("keep this gone");
  });

  it("the headline is protected the same way", () => {
    // ⚠️ The trailing full stop is dropped by the headline rule, not by the
    // tag strip — a headline on a card does not end in a period.
    expect(headlineFromBody("#imfine You say you’re fine.", 64)).toBe("You say you’re fine");
  });
});
