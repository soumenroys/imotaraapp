/**
 * 🔴 THE REFUSAL PROMISED EVIDENCE IT NEVER KEPT.
 *
 * `prepareGenerated`, when every draft fails:
 *
 *   "3 drafts were written and none passed. ⚠️ That is a signal about the
 *    brief, not bad luck — the objections are recorded against each attempt
 *    so the brief can be fixed."
 *
 * ⛔ **They were not recorded.** It returned them on `rejected`, and the queue
 * cron read only `.reason`, storing that one summary in
 * `social_slot_attempts.last_error`. So the single sentence telling an
 * operator where to look pointed at nothing
 * ⇒ trap_a_sentence_that_states_the_world_goes_stale.
 *
 * 🔑 FOUND THE HARD WAY, 20 Oct 2026. Four Instagram slots failed three
 * drafts out of three. The row said only that they had failed. Two then
 * recovered on a later retry — which makes it INTERMITTENT, and an
 * intermittent failure cannot be diagnosed afterwards unless the reason was
 * written down at the time it happened.
 *
 * ⚠️ A message that tells you where the evidence is, is itself a claim about
 * the world, and goes stale like any other.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { failureDetail, type RejectedDraft } from "@/lib/social/pipeline";

const draft = (attempt: number, why: string): RejectedDraft => ({
  attempt,
  subject: "a subject nobody should store",
  body: "a body nobody should store",
  why,
});

const REASON = "3 drafts were written and none passed.";

describe("a refusal carries the reasons with it", () => {
  it("🔴 names every attempt and what was wrong with it", () => {
    const detail = failureDetail(REASON, [
      draft(1, "Subject rejected: this exact subject has been used"),
      draft(2, "The gate rejected it: therapy (clinical)"),
      draft(3, "House style: 412 characters, over the 300 this channel shows"),
    ]);
    expect(detail).toContain(REASON);
    expect(detail).toContain("#1: Subject rejected");
    expect(detail).toContain("#2: The gate rejected it: therapy (clinical)");
    expect(detail).toContain("#3: House style");
  });

  it("⛔ does NOT carry the rejected words themselves", () => {
    /**
     * 🔑 The objection is the actionable part. Copying a rejected draft into
     * a failure row would put ungated words — the very words the gate just
     * refused — somewhere nobody is expecting to find them.
     */
    const detail = failureDetail(REASON, [draft(1, "The gate rejected it: therapy (clinical)")]);
    expect(detail).not.toContain("a subject nobody should store");
    expect(detail).not.toContain("a body nobody should store");
  });

  it("is unchanged when there is nothing to add", () => {
    // ⚠️ A refusal before any draft was written — a missing pool, a model
    // outage — has no objections, and must not gain a dangling separator.
    expect(failureDetail(REASON, [])).toBe(REASON);
    expect(failureDetail(REASON, [])).not.toContain("⇒");
  });

  it("⚠️ keeps the attempts distinguishable when two fail the same way", () => {
    // Without the attempt number, three identical objections read as one.
    const detail = failureDetail(REASON, [draft(1, "same"), draft(2, "same")]);
    expect(detail).toContain("#1: same");
    expect(detail).toContain("#2: same");
  });
});

describe("⛔ and the queue cron actually records it", () => {
  /**
   * 🔑 THE REACHABILITY HALF. `failureDetail` is pure and the route is free to
   * ignore it — which is exactly what the previous code did with `rejected`
   * ⇒ trap_text_assertions_cannot_see_reachability. Comments are stripped so
   * this cannot be satisfied by the prose explaining the fix.
   */
  const route = fs
    .readFileSync(path.join(process.cwd(), "src/app/api/cron/social-queue/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  it("builds the failure detail through the helper", () => {
    expect(route).toMatch(/failureDetail\(prepared\.reason,\s*prepared\.rejected\)/);
  });

  it("⛔ and stores THAT, not the bare summary", () => {
    expect(route).toMatch(/await failed\(detail\)/);
    // The exact shape of the old bug, named so it cannot come back quietly.
    expect(route, "the refusal is being recorded without its objections again").not.toMatch(
      /await failed\(prepared\.reason\)/,
    );
  });

  it("the route was actually read", () => {
    expect(route.length).toBeGreaterThan(2000);
  });
});
