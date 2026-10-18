/**
 * 🔴 AN INSTANT REQUEST NOBODY ACCEPTED STAYED PENDING FOREVER.
 *
 * Two crons touch stuck sessions and neither covered this one:
 *   • connect-scheduled expires pending requests, but filters
 *     `type = "scheduled"` AND `scheduled_at < cutoff`. An instant request has
 *     a null scheduled_at, so it never matches either clause.
 *   • connect-orphans only ever selected `status = "active"`.
 *
 * ⇒ "Talk to me now" requests accumulated. The oldest found in production was
 * **63 days old**, with four in total.
 *
 * ⚠️ HOW IT SURFACED, which is the part worth remembering: it was not reported
 * as a bug. It appeared while trying to remove two obvious test companions from
 * the public marketplace — the admin soft-delete refuses a consultant with any
 * pending session (409), so four abandoned rows were protecting fake listings
 * from being taken down.
 *
 * Three people are affected by one row: whoever asked and never got an answer,
 * the companion who could still accept weeks later, and the admin who cannot
 * tidy up.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const orphans = read("src/app/api/cron/connect-orphans/route.ts");
const scheduled = read("src/app/api/cron/connect-scheduled/route.ts");

describe("something expires an unanswered instant request", () => {
  it("🔴 the orphans cron looks at pending instant sessions, not only active ones", () => {
    expect(orphans, "no pending sweep at all").toMatch(/\.eq\("status",\s*"pending"\)/);
    expect(orphans, "it does not narrow to instant requests").toMatch(/\.eq\("type",\s*"instant"\)/);
  });

  it("cancels them rather than completing them", () => {
    // ⛔ Completing would be a lie and, worse, a billing event: a session that
    // never started has no minutes and must credit nobody.
    const sweep = orphans.slice(orphans.indexOf("INSTANT_PENDING_TTL_MS"));
    expect(sweep).toMatch(/status:\s*"cancelled"/);
    expect(sweep, "the unanswered-request sweep must not credit anybody").not.toMatch(/creditConsultantDurably/);
  });

  it("⚠️ guards the write on status, like the active path does", () => {
    // A companion may be accepting in the same instant the cron fires.
    const sweep = orphans.slice(orphans.indexOf("INSTANT_PENDING_TTL_MS"));
    expect(sweep).toMatch(/\.eq\("id",\s*request\.id\)[\s\S]{0,80}\.eq\("status",\s*"pending"\)/);
  });

  it("🔑 frees the companion, who would otherwise stay invisible", () => {
    // is_busy set by a request that never began would hide them from the
    // marketplace until they noticed and fixed it themselves.
    const sweep = orphans.slice(orphans.indexOf("INSTANT_PENDING_TTL_MS"));
    expect(sweep).toMatch(/is_busy:\s*false/);
  });

  it("expires an instant request faster than a scheduled booking", () => {
    /**
     * 🔑 "Talk to me now" and "meet me on Thursday" are not the same promise.
     * Somebody who asked half an hour ago and heard nothing has gone; ringing
     * their phone later is worse than letting the request lapse.
     */
    const ttl = orphans.match(/INSTANT_PENDING_TTL_MS\s*=\s*(\d+)\s*\*\s*60\s*\*\s*1000/);
    expect(ttl, "the instant TTL is not stated in minutes").toBeTruthy();
    const instantMinutes = Number(ttl![1]);
    expect(instantMinutes).toBeGreaterThan(5);   // not so eager it races a real accept
    expect(instantMinutes).toBeLessThanOrEqual(60);

    const scheduledHours = scheduled.match(/Date\.now\(\)\s*-\s*(\d+)\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(scheduledHours).toBeTruthy();
    expect(instantMinutes).toBeLessThan(Number(scheduledHours![1]) * 60);
  });
});

describe("why the old filters could not have caught it", () => {
  it("⛔ connect-scheduled is keyed on scheduled_at, which an instant request does not have", () => {
    // Pinned so nobody 'simplifies' the new sweep away on the grounds that
    // connect-scheduled already expires pending sessions. It does not.
    expect(scheduled).toMatch(/\.eq\("type",\s*"scheduled"\)/);
    expect(scheduled).toMatch(/\.lt\("scheduled_at"/);
  });
});

describe("\u26d4 and the sweep is actually REACHED", () => {
  /**
   * \ud83d\udd34 THE FIRST VERSION OF THIS FIX NEVER RAN. The sweep was appended to the
   * end of the handler, below an early `return NextResponse.json({ ok: true,
   * completed: 0 })` that fires whenever there are no stuck ACTIVE sessions —
   * which is almost always. The cron was provably firing, its query provably
   * matched four rows, and nothing happened.
   *
   * \u26a0\ufe0f Every test in the block above passed the whole time, because they
   * assert what the sweep CONTAINS. Reachability is a different question and
   * needs a different assertion: code added to the end of a handler is not
   * reachable just because the handler is.
   */
  it("no success return can fire before the sweep", () => {
    const sweepAt = orphans.indexOf("INSTANT_PENDING_TTL_MS");
    expect(sweepAt, "the sweep is gone").toBeGreaterThan(-1);

    // Everything the handler can return before reaching the sweep.
    const before = orphans.slice(0, sweepAt);
    const earlyReturns = [...before.matchAll(/return NextResponse\.json\(([\s\S]{0,60})/g)]
      .map((m) => m[1].replace(/\s+/g, " ").trim());

    for (const r of earlyReturns) {
      // \ud83d\udd11 An error exit above the sweep is fine \u2014 the run genuinely failed.
      // A SUCCESS exit is not: it skips the sweep and reports ok.
      expect(
        /ok: false|status: 4\d\d|status: 5\d\d/.test(r),
        `a success return runs before the sweep and skips it: ${r}`,
      ).toBe(true);
    }
  });

  it("the sweep's own result is reported, so a silent skip is visible", () => {
    // If `cancelled` ever stops being returned, the only signal that the sweep
    // ran at all disappears again.
    const tail = orphans.slice(orphans.lastIndexOf("return NextResponse.json"));
    expect(tail).toMatch(/cancelled/);
  });
});
