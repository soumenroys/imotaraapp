/**
 * ⛔ THE FAILURE THIS FORBIDS: "it saved" and a channel that never posts.
 *
 * Per-channel times arrive from a form as free-form json. A validator that
 * quietly discards what it does not understand means somebody sets Instagram
 * to 17:00, is told it saved, and finds out a day later that it did not — the
 * exact shape of failure this whole feature was built to stop
 * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanPlatformTimes } from "@/lib/social/platformTimes";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const patch = strip(read("src/app/api/admin/social/schedules/[id]/route.ts"));
const create = strip(read("src/app/api/admin/social/schedules/route.ts"));

describe("what it accepts", () => {
  it("a time on its own", () => {
    const r = cleanPlatformTimes({ instagram: { post_at: "17:00" } });
    expect(r).toEqual({ ok: true, value: { instagram: { post_at: "17:00" } } });
  });

  it("a time and days", () => {
    const r = cleanPlatformTimes({ instagram: { post_at: "17:00", days: [1, 2, 3] } });
    expect(r.ok && r.value).toEqual({ instagram: { post_at: "17:00", days: [1, 2, 3] } });
  });

  it("nothing at all, as null rather than an empty object", () => {
    // ⚠️ `{}` stored in the column would read as "there are overrides" to
    // anybody scanning the table. null says what is true.
    for (const input of [null, undefined, {}, { instagram: {} }]) {
      const r = cleanPlatformTimes(input);
      expect(r.ok && r.value, `${JSON.stringify(input)}`).toBeNull();
    }
  });

  it("drops an empty entry rather than storing a lie", () => {
    const r = cleanPlatformTimes({ instagram: { post_at: "" }, facebook: { post_at: "09:00" } });
    expect(r.ok && r.value).toEqual({ facebook: { post_at: "09:00" } });
  });
});

describe("what it refuses — and refusing is the point", () => {
  const bad: [unknown, RegExp][] = [
    [{ instagram: { post_at: "5pm" } }, /look like 17:00/],
    [{ instagram: { post_at: "25:00" } }, /look like 17:00/],
    [{ instagram: { post_at: "17:60" } }, /look like 17:00/],
    [{ instagram: { post_at: 1700 } }, /look like 17:00/],
    [{ tiktok: { post_at: "17:00" } }, /not a channel/],
    [{ instagram: "17:00" }, /not an object/],
    [{ instagram: { days: "mon" } }, /must be a list/],
    [{ instagram: { days: [] } }, /at least one day/],
    [{ instagram: { days: [9, 11] } }, /at least one day/],
    [[{ post_at: "17:00" }], /keyed by channel/],
    ["17:00", /keyed by channel/],
  ];

  for (const [input, message] of bad) {
    it(`refuses ${JSON.stringify(input)}`, () => {
      const r = cleanPlatformTimes(input);
      expect(r.ok).toBe(false);
      // ⚠️ The message names the channel or the field. "Invalid input" sends
      // somebody back to a form with no idea which box is wrong.
      expect(r.ok === false && r.error).toMatch(message);
    });
  }
});

describe("both routes use the same validator", () => {
  it("creating and editing cannot drift apart", () => {
    /**
     * 🔑 Rules written twice drift. On this surface that would mean a time
     * the create route accepts and the edit route rejects — or the reverse,
     * which is worse.
     */
    expect(create).toContain("cleanPlatformTimes");
    expect(patch).toContain("cleanPlatformTimes");
  });

  it("the edit route refuses rather than saving a partial patch", () => {
    /**
     * ⚠️ ANCHORED ON THE CALL, not on the name. `indexOf("cleanPlatformTimes")`
     * found the IMPORT at the top of the file, so the slice swept in every
     * other validation's `status: 400` and the assertion passed with the
     * refusal deleted ⇒ the same shape as the -1 trap.
     */
    const call = patch.indexOf("cleanPlatformTimes(body.platformTimes)");
    const assign = patch.indexOf("patch.platform_times");
    expect(call).toBeGreaterThan(-1);
    expect(assign).toBeGreaterThan(call);
    const between = patch.slice(call, assign);
    expect(between).toContain("status: 400");
    expect(between).toContain("return NextResponse.json");
  });

  it("the create route reports it alongside everything else wrong", () => {
    // ⚠️ Collected with the other problems rather than returned early, so one
    // submission reports everything wrong with it at once.
    expect(create).toMatch(/problems\.push\(times\.error\)/);
  });
});
