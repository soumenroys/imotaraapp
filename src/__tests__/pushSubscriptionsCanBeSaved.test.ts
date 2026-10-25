/**
 * 🔴 25 Oct 2026: NOT ONE web push subscription had ever been saved. Every
 * POST /api/push/subscribe since build 63 failed on the live
 * user_memory_confidence_check, because it wrote confidence: 1; the 464 rows that
 * exist all use 0.8 or 0.9. So the web daily check-in never reached anyone.
 * ⛔ The constraint lives only in the database (no .sql file in the repo has it),
 * so this pins the WRITES: no user_memory write may use confidence 1.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("user_memory writes stay inside the live check constraint", () => {
  it("no write uses confidence: 1", () => {
    const offenders = files(join(process.cwd(), "src/app/api")).filter((f) => {
      const t = readFileSync(f, "utf8");
      return t.includes('from("user_memory")') && /confidence:\s*1(\.0+)?\s*[,}]/.test(t);
    });
    expect(offenders).toEqual([]);
  });
  it("the subscription itself is written at 0.9", () =>
    expect(readFileSync(join(process.cwd(), "src/app/api/push/subscribe/route.ts"), "utf8")).toMatch(/key: "subscription",[\s\S]{0,400}confidence: 0\.9,/));
});
