/**
 * 🔴 THE MODEL WAS ASKED FOR A HEADLINE, GAVE ONE, AND IT WAS THROWN AWAY.
 *
 * `writer.ts` instructs it: *"subject is for our records and for the headline
 * on the picture: a short phrase, under sixty characters"*. The gate reads it
 * — `checkVoice(`${subject}\n${body}`)` — so it is exactly as safe to publish
 * as the body. Two more comments in the codebase state the same thing.
 *
 * ⛔ And the renderer used the BODY'S OPENING SENTENCE, which nothing had ever
 * asked to be short.
 *
 * ⚠️ So the card disappeared precisely when the writing was good. The 18 Oct
 * content rules push for a specific, concrete opening line; the first post
 * written under them opened with 160 characters; the card was correctly
 * refused rather than truncated; and Imotara's first ever public post went out
 * as grey text into a feed of bold graphics.
 *
 * 🔑 Seen only by looking at the actual Facebook Page next to its own older
 * posts. No test said anything was wrong, because nothing was broken — it was
 * doing exactly what it had been told.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { headlineFor, headlineFromBody, supportFromBody } from "@/lib/social/visualRecipe";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** The post that exposed it, verbatim. */
const SUBJECT = "The message you almost sent";
const BODY =
  "Typing out a reply, watching the words fill the screen, then erasing the whole thing before " +
  "you hit send. There's a reason some things never leave drafts.";

describe("the headline comes from the subject", () => {
  it("🔴 gives the post that went out as plain text a card", () => {
    // 160 characters in the opening sentence — no headline was possible.
    expect(headlineFromBody(BODY)).toBeNull();
    // 27 in the subject.
    expect(headlineFor(SUBJECT, BODY)).toBe(SUBJECT);
  });

  it("tidies it the same way as the body headline", () => {
    expect(headlineFor("  The message   you almost sent.  ", BODY)).toBe(SUBJECT);
  });

  /**
   * ⛔ NOTHING IS TRUNCATED, which is the rule that must survive this change.
   * A half sentence on a card is worse than no card.
   */
  it("falls back to the body when the subject is too long", () => {
    const longSubject = "A".repeat(80);
    const shortBody = "A short opening. And then some more.";
    expect(headlineFor(longSubject, shortBody)).toBe("A short opening");
  });

  it("returns null when neither fits, so the post goes out as text", () => {
    expect(headlineFor("A".repeat(80), "B".repeat(200))).toBeNull();
  });

  it("⛔ invents nothing — the answer is always one of the two inputs", () => {
    const out = headlineFor(SUBJECT, BODY);
    expect(out !== null && (SUBJECT.includes(out) || BODY.includes(out))).toBe(true);
  });

  it("copes with a missing subject rather than throwing", () => {
    expect(headlineFor("", "A short opening. And more.")).toBe("A short opening");
  });
});

describe("the second line depends on where the headline came from", () => {
  /**
   * 🔑 THE POINT OF THE `from` ARGUMENT. The support line always skipped
   * sentence 0 because sentence 0 WAS the headline. Now that the headline is
   * the subject, skipping it would leave the post's strongest line — its
   * opening — nowhere on the card at all.
   */
  it("starts at the opening line when the headline is the subject", () => {
    const support = supportFromBody(BODY, 150, 0);
    expect(support).toMatch(/^Typing out a reply/);
  });

  it("⛔ skips the opening when the headline IS the opening, or the card repeats itself", () => {
    const body = "A short opening. And then the second thought.";
    expect(headlineFromBody(body)).toBe("A short opening");
    expect(supportFromBody(body, 150, 1)).toBe("And then the second thought.");
  });

  it("still returns null when there is nothing left to say", () => {
    expect(supportFromBody("Only one sentence here.", 150, 1)).toBeNull();
    // ⚠️ But from 0 there IS something — the one sentence.
    expect(supportFromBody("Only one sentence here.", 150, 0)).toBe("Only one sentence here.");
  });
});

describe("both renderers were given the subject", () => {
  const renderer = read("src/lib/social/renderPicture.ts");

  it("the shared renderer asks for the headline the right way", () => {
    expect(renderer).toMatch(/headlineFor\(post\.subject \?\? "", post\.body\)/);
    expect(renderer).not.toMatch(/const headline = headlineFromBody\(/);
  });

  it("chooses where the second line starts from where the headline came from", () => {
    expect(renderer).toMatch(/headline === \(post\.subject \?\? ""\)\.trim\(\) \? 0 : 1/);
  });

  /**
   * ⛔ BOTH CALLERS, OR THE PUBLISHED CARD DIFFERS FROM THE APPROVED ONE —
   * which is the whole reason there is one renderer and not two.
   */
  it("the admin preview and the publisher both pass it", () => {
    expect(read("src/app/api/admin/social/picture/[id]/route.ts")).toMatch(/subject: post\.subject/);
    const cron = read("src/app/api/cron/social-publish/route.ts");
    expect(cron).toMatch(/subject: post\.subject/);
    // ⚠️ And the publisher must actually SELECT it, or it passes undefined.
    expect(cron).toMatch(/\.select\("id, platform, language, subject, body/);
  });
});
