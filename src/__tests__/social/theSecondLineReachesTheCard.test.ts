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
import { headlineFromBody, supportFromBody } from "@/lib/social/visualRecipe";

const ROUTES = [
  "src/app/api/admin/social/picture/[id]/route.ts",
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
      expect(
        /support:\s*supportFromBody\(/.test(src),
        "the route imports supportFromBody but never passes the result as `support`",
      ).toBe(true);
    });

    it(`${route.split("/").slice(-2)[0]} derives it from the post's own body`, () => {
      // ⛔ Not from the subject, and not from a stored column. A picture must
      // not be able to show a sentence the word check did not read.
      const src = readFileSync(join(process.cwd(), route), "utf8");
      expect(src).toMatch(/supportFromBody\(post\.body as string\)/);
    });
  }
});
