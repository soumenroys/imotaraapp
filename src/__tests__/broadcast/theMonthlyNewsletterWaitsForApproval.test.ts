/**
 * 🗓️ THE MONTHLY NEWSLETTER — written by itself three days ahead, one theme a
 * month rotated in code, sent on the day only if approved (owner, 24 Oct 2026).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEAD_DAYS, THEMES, monthKey, nextMonth, sendAtFor, themeFor } from "@/lib/broadcast/autoBroadcast";

const s = { enabled: true, dayOfMonth: 5, hourIst: 11, listIds: ["L"] };

describe("when", () => {
  it("the month is India's month", () => expect(monthKey(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11")); // 01:30 IST, 1 Nov
  it("sends on day 5 at 11:00 India time", () => expect(sendAtFor("2026-11", s).toISOString()).toBe("2026-11-05T05:30:00.000Z"));
  it("a day past the month's end lands on its last day", () => expect(sendAtFor("2027-02", { ...s, dayOfMonth: 28 }).toISOString()).toBe("2027-02-28T05:30:00.000Z"));
  it("drafts come three days early, so there is time to approve", () => expect(LEAD_DAYS).toBe(3));
});

describe("what", () => {
  it("one theme a month, every theme in turn", () => {
    const seen = new Set(Array.from({ length: THEMES.length }, (_, i) => themeFor(`2027-${String(i + 1).padStart(2, "0")}`).id));
    expect(seen.size).toBe(THEMES.length);
  });
});

describe("⛔ never sent without approval", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/broadcast/autoBroadcast.ts"), "utf8");
  it("checks the approval against the words as they are now, before enqueueing", () => {
    const check = src.indexOf('approvalState(approvals, id, b) !== "approved"');
    const send = src.indexOf("await enqueueBroadcast(");
    expect(check).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(check);
  });
  it("only a draft is ever sent — one sent by hand or discarded is left alone", () => {
    expect(src).toMatch(/if \(!b \|\| b\.status !== "draft"\) continue;/);
  });
});

describe("review fixes, 24 Oct", () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const st = { settings: s, runs: {} };
  it("before the 5th, the next newsletter is this month's", () => expect(nextMonth(new Date("2026-11-03T05:30:00Z"), st)).toBe("2026-11"));
  it("after it, next month's — the settings page and the sample agree", () => {
    expect(nextMonth(new Date("2026-11-06T05:30:00Z"), st)).toBe("2026-12");
    expect(nextMonth(new Date("2026-12-06T05:30:00Z"), st)).toBe("2027-01");
    for (const p of ["src/app/api/admin/broadcast/auto/route.ts", "src/app/api/admin/broadcast/auto/sample/route.ts"]) expect(src(p)).toMatch(/nextMonth\(now, s\)/);
  });
  it("⛔ a draft approved after its month still goes — every run due in the last 30 days is looked at", () =>
    expect(src("src/lib/broadcast/autoBroadcast.ts")).toMatch(/for \(const run of Object\.values\(latest\.runs\)\)/));
  it("⛔ a slow run never writes back a stale copy of the settings", () =>
    expect(src("src/lib/broadcast/autoBroadcast.ts")).not.toMatch(/writeAuto\(supabase, state\)/));
  it("⛔ a newsletter whose checks fail cannot be approved", () =>
    expect(src("src/app/api/admin/broadcast/broadcasts/[id]/approve/route.ts")).toMatch(/checkDraft\([\s\S]*status: 422/));
});
