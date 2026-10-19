/**
 * 🔴 THE OWNER, 19 Oct: "don't you think the content is always coming with
 * one or two small sentences?"
 *
 * Measured before answering: 23 of 30 posts were EXACTLY two sentences, and
 * Facebook's median body was 163 characters against a 500-character fold. A
 * third of the format, every day, for weeks.
 *
 * ⛔ AND NOTHING IN THE SYSTEM COULD SEE IT. Every length check asked "is
 * this too long?" — the hard ceiling, the fold, the first line. There was no
 * floor, so a post using a third of its channel was indistinguishable from a
 * post using all of it.
 *
 * ⚠️ THE CAUSE WAS UPSTREAM OF THE CHECK. The writer is given the schedule's
 * `lengthHint`, which is generic — "short" means 200–350 whatever the
 * channel — so it had no way to know Facebook gives three times Instagram's
 * room, and wrote to the tighter one everywhere. The same shape as
 * HEADLINE_MAX living as a default argument
 * ⇒ trap_a_constraint_nobody_told_the_writer.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { checkHouseStyle } from "@/lib/social/voiceGate";
import { PLATFORMS, platformSpec } from "@/lib/social/platforms";

const writer = readFileSync(join(process.cwd(), "src/lib/social/writer.ts"), "utf8");

/** A body of exactly n characters, in whole words. */
const body = (n: number) => "word ".repeat(Math.ceil(n / 5)).slice(0, n).trim();

describe("every channel has a floor as well as a ceiling", () => {
  it("each one declares the room it actually gives", () => {
    for (const spec of Object.values(PLATFORMS)) {
      expect(spec.bodyTarget.min, `${spec.id} has no floor`).toBeGreaterThan(0);
      expect(spec.bodyTarget.max).toBeGreaterThan(spec.bodyTarget.min);
      /**
       * 🔴 MY FIRST VERSION OF THIS ASSERTED `max <= limits.soft` AND FAILED
       * — on Instagram, where the target is 200 and the fold is 125.
       *
       * ⚠️ The DATA was right and the assertion was wrong. Running past the
       * fold is Instagram's own convention: the opening carries the post and
       * the rest rewards a tap. The real rule is not "stop at the fold", it
       * is "the part before the fold must work alone" — and that is already
       * enforced, separately, by the detector that refuses a post which
       * finishes nothing before it ⇒ voiceGate.
       *
       * ⛔ So what is actually invariant is only this: never advise past what
       * the platform will ACCEPT.
       */
      expect(spec.bodyTarget.max, `${spec.id} targets past its hard limit`).toBeLessThanOrEqual(spec.limits.hard);
    }
  });

  it("⛔ Facebook's room is far larger than Instagram's, because it is", () => {
    /**
     * 🔑 THE WHOLE POINT OF PER-CHANNEL. Facebook shows ~500 characters;
     * Instagram folds at ~125 and the rest is behind "see more". One number
     * for both is how every post ended up written to the tighter channel.
     */
    expect(platformSpec("facebook").bodyTarget.min).toBeGreaterThan(
      platformSpec("instagram").bodyTarget.max,
    );
  });
});

describe("the check notices a post that is too short", () => {
  it("says so for a Facebook post of the length we were actually writing", () => {
    // 163 characters — the measured median that prompted the question.
    const r = checkHouseStyle(body(163), "facebook");
    expect(r.problems.join(" ")).toMatch(/short for Facebook/i);
  });

  it("⛔ and says nothing for the same post on Instagram", () => {
    // 🔴 Where two sentences IS right: the fold is at ~125.
    const r = checkHouseStyle(body(163), "instagram");
    expect(r.problems.join(" ")).not.toMatch(/short for/i);
  });

  it("⛔ uses EACH channel's number, not one number wearing a per-channel label", () => {
    /**
     * 🔴 A MUTATION REPLACING `spec.bodyTarget.min` WITH A FIXED 320 SURVIVED
     * my first version of this file, and the reason is worth keeping.
     *
     * On Instagram the two thresholds nearly coincide — the fold is 125 and
     * the floor 120 — and the length checks are an if/else chain, so any
     * Instagram post long enough to tell the numbers apart takes the FOLD
     * branch and never reaches the floor at all. The channel I had chosen to
     * prove per-channel behaviour was the one channel that could not.
     *
     * ⚠️ LinkedIn can: floor 140, fold 210. A 170-character post sits in the
     * gap — correct on LinkedIn, short under any single shared number.
     */
    const linkedin = checkHouseStyle(body(170), "linkedin").problems.join(" ");
    expect(linkedin).not.toMatch(/short for/i);
    expect(linkedin).not.toMatch(/see more/i);

    // ...and the same length IS short for Facebook, whose floor is higher.
    expect(checkHouseStyle(body(170), "facebook").problems.join(" ")).toMatch(/short for Facebook/i);
  });

  it("is quiet once the post uses the room", () => {
    const r = checkHouseStyle(body(380), "facebook");
    expect(r.problems.join(" ")).not.toMatch(/short for/i);
  });

  it("⛔ is ADVICE, never a refusal", () => {
    // 🔑 The house style has never blocked a post and must not start. Some
    // posts really are one line.
    const r = checkHouseStyle(body(60), "facebook");
    expect(r.problems.length).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    // ⚠️ `ok:false` here means "a reviewer should look", not "cannot publish"
    // — pinned by the gate being a separate function entirely.
    expect(typeof r.characters).toBe("number");
  });

  it("⛔ does not say 'fold', which is a different complaint", () => {
    // Two problems sharing a word is how one gets mistaken for the other.
    const short = checkHouseStyle(body(60), "facebook").problems.join(" ");
    expect(short).toMatch(/short for/i);
    expect(short).not.toMatch(/fold/i);
  });
});

describe("⛔ and the writer is TOLD, which is where it actually gets fixed", () => {
  it("the channel's room reaches the prompt, not just the checker", () => {
    /**
     * 🔴 A CHECK THAT CATCHES WHAT THE WRITER WAS NEVER TOLD TO DO just
     * produces drafts that fail. The limit has to be in the instruction
     * ⇒ trap_a_constraint_nobody_told_the_writer, where HEADLINE_MAX lived as
     * a default argument and the writer could never satisfy it.
     */
    expect(writer).toMatch(/spec\.bodyTarget\.min/);
    expect(writer).toMatch(/spec\.bodyTarget\.max/);
  });

  it("and is told not to pad, because that is the obvious wrong reading", () => {
    // ⚠️ "Aim for 320–460" with nothing else is an instruction to waffle.
    const at = writer.indexOf("spec.bodyTarget.min");
    expect(writer.slice(at, at + 500)).toMatch(/do NOT pad/i);
  });
});
