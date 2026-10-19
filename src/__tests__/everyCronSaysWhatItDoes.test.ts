/**
 * ⛔ A LIST OF PATHS IS NOT A LIST OF JOBS.
 *
 * 🔑 THE OWNER, 19 Oct 2026: "in the Scheduled jobs cron job list, add a small
 * description that which cron is doing what."
 *
 * 🔴 WHY IT MATTERS MORE THAN TIDINESS. The panel exists to show a job that
 * has stopped. `connect-orphans` showing LATE cannot be acted on until a
 * reader knows whether that is an outage or a tidy-up — so the panel could
 * raise an alarm nobody could judge, which is most of the way back to not
 * having one.
 *
 * ⚠️ THE LIST IS DRIVEN BY vercel.json, so a cron added there appears in the
 * panel immediately — described or not. This is what stops the undescribed
 * state lasting.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CRON_DESCRIPTIONS, describeJob } from "@/lib/cron/jobDescriptions";

const declared = (
  JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")).crons ?? []
) as { path: string; schedule: string }[];

describe("every scheduled job says what it does", () => {
  it("🔴 there is a line for every cron in vercel.json", () => {
    // ▶️ Adding a cron is adding a line here. That is the whole guard.
    const missing = declared.filter((d) => !describeJob(d.path)).map((d) => d.path);
    expect(missing, `these crons have no description: ${missing.join(", ")}`).toEqual([]);
  });

  it("⛔ and no description for a cron that no longer exists", () => {
    /**
     * 🔑 THE OTHER DIRECTION. A line for a deleted job is worse than none —
     * it describes behaviour nothing has, and the next reader believes it
     * ⇒ trap_a_sentence_that_states_the_world_goes_stale.
     */
    const paths = new Set(declared.map((d) => d.path));
    const orphans = Object.keys(CRON_DESCRIPTIONS).filter((p) => !paths.has(p));
    expect(orphans, `described but not scheduled: ${orphans.join(", ")}`).toEqual([]);
  });

  it("⚠️ each line is a sentence, not a restatement of the path", () => {
    /**
     * ⛔ "Runs the social-queue cron" is worse than blank: it reads as
     * information and carries none. A description must add something the
     * path does not already say.
     */
    for (const [path, text] of Object.entries(CRON_DESCRIPTIONS)) {
      const slug = path.split("/").pop()!;
      expect(text.length, `${path}'s description is too short to say anything`).toBeGreaterThan(40);
      expect(text.toLowerCase(), `${path} merely repeats its own name`).not.toContain(slug);
      expect(text.trim().endsWith("."), `${path}'s description is not a sentence`).toBe(true);
    }
  });

  it("⛔ returns null for an unknown job rather than inventing a line", () => {
    expect(describeJob("/api/cron/nope")).toBeNull();
  });
});

describe("the panel receives it", () => {
  it("🔑 judgeJobs attaches the description, so the screen does not look it up", async () => {
    /**
     * ⚠️ REACHABILITY. A correct map that nothing reads is this project's
     * most repeated defect — four times in one day
     * ⇒ trap_text_assertions_cannot_see_reachability.
     */
    const { judgeJobs } = await import("@/lib/cron/heartbeat");
    const [judged] = judgeJobs([{ path: "/api/cron/social-publish", schedule: "* * * * *" }], []);
    expect(judged.description, "the job carries no description to the screen").toBeTruthy();
    expect(judged.description).toBe(describeJob("/api/cron/social-publish"));
  });

  it("⚠️ a job with no line is carried as null, not as an empty string", () => {
    // 🔑 So the screen can tell "nobody wrote one" from "it says nothing".
    expect(describeJob("/api/cron/unknown")).toBeNull();
  });
});
