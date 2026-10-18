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
import { headlineFromBody, supportFromBody, withoutHashtags } from "@/lib/social/visualRecipe";

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
const ROUTES = [
  "src/lib/social/renderPicture.ts",
  "src/app/api/admin/social/animation/[id]/route.ts",
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
  for (const route of ROUTES) {
    it(`${route.split("/").slice(-2)[0]} passes a support to the composer`, () => {
      const src = readFileSync(join(process.cwd(), route), "utf8");
      expect(src, "the route does not import supportFromBody").toContain("supportFromBody");

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
      // ⚠️ `support: x`, `support: supportFromBody(...)` or the shorthand
      // `support,` — the rule is about what reaches the composer, not style.
      const passed = src.match(/support:\s*([A-Za-z_$][\w$]*|supportFromBody\()|^\s*support,\s*$/m);
      expect(passed, "nothing is passed as `support` to the composer").not.toBeNull();
      const value = passed![1] ?? "support";
      expect(value, "`support` is passed a literal undefined").not.toBe("undefined");
      if (!value.startsWith("supportFromBody")) {
        const assigned = new RegExp(`(const|let)\\s+${value}\\b[^;]*supportFromBody\\(`, "s");
        expect(
          assigned.test(src),
          `\`support\` is passed ${value}, which is not derived from supportFromBody`,
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
      expect(src).toMatch(/supportFromBody\(\s*post\.body\b/);
      // ⛔ And still not from either of the two wrong sources.
      expect(src).not.toMatch(/supportFromBody\(\s*post\.subject\b/);
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
