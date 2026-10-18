/**
 * 🔴 A CRON THAT DIES FAILS WHERE NOBODY IS WATCHING.
 *
 * Vercel returned NO runtime logs at all for a 45-minute window — including
 * for broadcast-queue and social-queue, which fire every minute and
 * demonstrably work. Log retention is a plan setting; it is not a monitor.
 *
 * ⚠️ And this repo has already been bitten: two of seven crons were declared
 * GET in vercel.json and written as POST, and answered 405 for MONTHS without
 * anyone noticing — because a dead cron produces exactly as much output as a
 * healthy one with nothing to do. None.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expectedIntervalMinutes, lateAfterMinutes, judgeJobs } from "@/lib/cron/heartbeat";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const CRONS = (JSON.parse(read("vercel.json")).crons ?? []) as { path: string; schedule: string }[];

describe("every scheduled job reports that it ran", () => {
  it("vercel.json really declares crons — otherwise this file is vacuous", () => {
    expect(CRONS.length).toBeGreaterThan(5);
  });

  it("🔴 every single one records a heartbeat", () => {
    // ⛔ Read from vercel.json, never a hand-kept list: a cron added to the
    // schedule and not to the monitor would be invisible, which is the exact
    // failure this whole thing exists to prevent.
    const silent = CRONS.filter((c) => !read(`src/app${c.path}/route.ts`).includes("markCronFired"));
    expect(silent.map((c) => c.path), "these jobs would die unnoticed").toEqual([]);
  });

  it("⚠️ records it under its own path, so two jobs cannot share a row", () => {
    for (const c of CRONS) {
      const src = read(`src/app${c.path}/route.ts`);
      expect(src, `${c.path} reports under the wrong name`).toContain(`markCronFired("${c.path}")`);
    }
  });

  it("⛔ only after the auth guard, so a stranger cannot forge a heartbeat", () => {
    // 🔑 Otherwise anybody could GET the route unauthenticated and keep a dead
    // job looking alive — a monitor that can be spoofed is worse than none.
    for (const c of CRONS) {
      const src = read(`src/app${c.path}/route.ts`);
      expect(src.indexOf("401"), `${c.path} has no 401 path`).toBeGreaterThan(-1);
      expect(
        src.indexOf("markCronFired(\"") > src.indexOf("401"),
        `${c.path} records the heartbeat before refusing an unauthorised caller`,
      ).toBe(true);
    }
  });
});

describe("reading a schedule", () => {
  it("understands the shapes this project uses", () => {
    expect(expectedIntervalMinutes("* * * * *")).toBe(1);
    expect(expectedIntervalMinutes("*/10 * * * *")).toBe(10);
    expect(expectedIntervalMinutes("*/30 * * * *")).toBe(30);
    expect(expectedIntervalMinutes("0 * * * *")).toBe(60);
    expect(expectedIntervalMinutes("0 2 * * *")).toBe(1440);
    expect(expectedIntervalMinutes("30 3 * * *")).toBe(1440);
  });

  it("🔑 and every schedule actually in vercel.json is one of them", () => {
    const unreadable = CRONS.filter((c) => expectedIntervalMinutes(c.schedule) === null);
    expect(unreadable.map((c) => `${c.path} (${c.schedule})`)).toEqual([]);
  });

  it("⛔ says null rather than guessing at one it does not understand", () => {
    // A confident wrong interval would mark a healthy job late, or — worse —
    // a dead one healthy. "Not judged" is shown in the panel instead.
    expect(expectedIntervalMinutes("0 0 * * 1")).toBeNull();      // weekly
    expect(expectedIntervalMinutes("0 0 1 * *")).toBeNull();      // monthly
    expect(expectedIntervalMinutes("nonsense")).toBeNull();
    expect(expectedIntervalMinutes("* * *")).toBeNull();
  });
});

describe("how late is late", () => {
  it("scales with the schedule instead of using one flat number", () => {
    // ⛔ Five minutes would cry wolf at every daily job; two hours would never
    // notice a minute-cron had stopped.
    expect(lateAfterMinutes(1)).toBe(11);
    expect(lateAfterMinutes(10)).toBe(20);
    expect(lateAfterMinutes(1440)).toBe(2160);
  });

  it("always allows at least one whole missed run", () => {
    for (const i of [1, 10, 30, 60, 1440]) expect(lateAfterMinutes(i)).toBeGreaterThan(i);
  });
});

describe("judging the jobs", () => {
  const now = new Date("2026-10-18T06:00:00Z");
  const declared = [
    { path: "/api/cron/fast", schedule: "* * * * *" },
    { path: "/api/cron/daily", schedule: "0 3 * * *" },
    { path: "/api/cron/weekly", schedule: "0 0 * * 1" },
  ];
  const beat = (job: string, minutesAgo: number) => ({
    job,
    last_fired_at: new Date(now.getTime() - minutesAgo * 60000).toISOString(),
    fire_count: 5,
    last_note: null,
  });

  it("🔴 a job that has NEVER fired is reported, not omitted", () => {
    // It has no heartbeat row, so a report driven by rows would show nothing
    // at all — the most important case silently missing.
    const out = judgeJobs(declared, []);
    expect(out).toHaveLength(3);
    expect(out.every((j) => j.state === "never" || j.state === "unknown-schedule")).toBe(true);
  });

  it("marks a stopped minute-cron late and a recent one fine", () => {
    const out = judgeJobs(declared, [beat("/api/cron/fast", 45), beat("/api/cron/daily", 60)], now);
    expect(out.find((j) => j.job === "/api/cron/fast")!.state).toBe("late");
    expect(out.find((j) => j.job === "/api/cron/daily")!.state).toBe("ok");
  });

  it("⚠️ worst first — a dead job must not sit under nine healthy ones", () => {
    const out = judgeJobs(declared, [beat("/api/cron/fast", 45), beat("/api/cron/weekly", 1)], now);
    expect(out[0].state).toBe("never");          // daily, no heartbeat at all
    expect(out[1].state).toBe("late");           // fast, stopped
    expect(out[2].state).toBe("unknown-schedule");
  });

  it("a schedule it cannot read is 'not judged', never a false green", () => {
    const out = judgeJobs([{ path: "/api/cron/weekly", schedule: "0 0 * * 1" }], [beat("/api/cron/weekly", 99999)], now);
    expect(out[0].state).toBe("unknown-schedule");
  });
});

describe("the monitor cannot be its own single point of failure", () => {
  it("⛔ recording a heartbeat never throws", () => {
    // A monitoring write that can fail a cron turns an observability feature
    // into an outage — the exact inversion this is meant to prevent.
    const src = read("src/lib/cron/heartbeat.ts");
    const fn = src.slice(src.indexOf("export async function markCronFired"));
    expect(fn.slice(0, 700)).toMatch(/try\s*\{[\s\S]*\}\s*catch\s*\{/);
  });

  it("the route says which migration to run if the table is missing", () => {
    const route = read("src/app/api/admin/cron-health/route.ts");
    expect(route).toContain("cron_heartbeats.sql");
  });

  it("🔑 and refuses to render a reassuring empty list", () => {
    // An unreadable vercel.json must not produce a green panel proving nothing.
    const route = read("src/app/api/admin/cron-health/route.ts");
    expect(route).toMatch(/list of scheduled jobs is unknown/);
  });
});
