// src/__tests__/social/theWriterHasADailyCeiling.test.ts
// 🔑 Owner, 30 Oct 2026: a daily ceiling on social-writer AI calls. Normal use
// ≈ 15 a day; a broken writer retrying 60 empty slots could spend $5–7 a day.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DRAFTS_PER_POST, MAX_WRITER_CALLS_PER_DAY, draftsUsed, istDay, mayWrite, today } from "@/lib/social/writerCeiling";

const NOW = new Date("2026-10-30T20:00:00Z"); // 31 Oct 01:30 IST

describe("the count is per IST day", () => {
  it("a UTC evening is already the next day in India", () => expect(istDay(NOW)).toBe("2026-10-31"));
  it("yesterday's count does not carry over", () => expect(today({ day: "2026-10-30", calls: 59, alerted: true }, NOW)).toEqual({ day: "2026-10-31", calls: 0 }));
  it("today's count is kept", () => expect(today({ day: "2026-10-31", calls: 12 }, NOW).calls).toBe(12));
});

describe("⛔ a post is only started if even its worst case fits", () => {
  it("normal day: room", () => expect(mayWrite({ day: "d", calls: 15 })).toBe(true));
  it(`stops when ${DRAFTS_PER_POST} more drafts would pass ${MAX_WRITER_CALLS_PER_DAY}`, () => {
    expect(mayWrite({ day: "d", calls: MAX_WRITER_CALLS_PER_DAY - DRAFTS_PER_POST })).toBe(true);
    expect(mayWrite({ day: "d", calls: MAX_WRITER_CALLS_PER_DAY - DRAFTS_PER_POST + 1 })).toBe(false);
  });
  it("normal use (~15) is far below the ceiling", () => expect(MAX_WRITER_CALLS_PER_DAY).toBeGreaterThanOrEqual(4 * 15));
});

describe("every draft counts, kept or thrown away", () => {
  it("kept on the first try = 1", () => expect(draftsUsed({ ok: true, post: { rejected: [] } })).toBe(1));
  it("kept after two rejects = 3", () => expect(draftsUsed({ ok: true, post: { rejected: [{}, {}] } })).toBe(3));
  it("all three rejected = 3", () => expect(draftsUsed({ ok: false, rejected: [{}, {}, {}] })).toBe(3));
  it("refused before any draft still counts one", () => expect(draftsUsed({ ok: false, rejected: [] })).toBe(1));
});

describe("the queue job obeys it", () => {
  const src = readFileSync(join(process.cwd(), "src/app/api/cron/social-queue/route.ts"), "utf8");
  it("checks BEFORE writing and counts AFTER", () => {
    const check = src.indexOf("if (!mayWrite(ceiling))");
    const write = src.indexOf("await prepareGenerated(");
    const count = src.indexOf("draftsUsed(prepared)");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(write);
    expect(count).toBeGreaterThan(write);
  });
  it("tells the owner once a day, not every minute", () => expect(src).toMatch(/if \(!ceiling\.alerted\)/));
});
