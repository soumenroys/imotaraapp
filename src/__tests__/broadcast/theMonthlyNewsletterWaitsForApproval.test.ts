/**
 * 🗓️ THE MONTHLY NEWSLETTER — written by itself three days ahead, one theme a
 * month rotated in code, sent on the day only if approved (owner, 24 Oct 2026).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEAD_DAYS, THEMES, monthKey, sendAtFor, themeFor } from "@/lib/broadcast/autoBroadcast";

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
