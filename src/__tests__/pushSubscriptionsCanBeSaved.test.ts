/**
 * 🔴 25 Oct 2026: NOT ONE web push subscription had ever been saved — and when
 * the first fix met a second constraint (type "push"), it moved to its own
 * table, push_reminders, because user_memory is loaded whole into the AI. Every
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
  it("⛔ web push is not stored in user_memory at all — the AI reads that table whole", () => {
    for (const f of ["src/app/api/push/subscribe/route.ts", "src/app/api/push/cron/route.ts", "src/app/api/reminders/snooze/route.ts"]) {
      const t = readFileSync(join(process.cwd(), f), "utf8");
      expect(t, f).not.toMatch(/type:\s*"push"|\.eq\("type", "push"\)/);
    }
    expect(readFileSync(join(process.cwd(), "src/app/api/push/subscribe/route.ts"), "utf8"))
      .toMatch(/from\(PUSH_REMINDERS_TABLE\)\.upsert\(\s*\{ user_id: userId, subscription, updated_at: now \}/);
  });
  it("the table is server-only, with its GRANTs in the same SQL", () => {
    const sql = readFileSync(join(process.cwd(), "docs/sql/push_reminders.sql"), "utf8");
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.push_reminders from anon, authenticated/);
    expect(sql).toMatch(/grant select, insert, update, delete on public\.push_reminders to service_role/);
  });
});
