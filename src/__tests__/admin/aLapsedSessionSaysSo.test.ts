/**
 * 🔑 Owner, 25 Oct 2026: To do showed a bare red "Unauthorized" when the
 * 8-hour admin sign-in had lapsed. Every admin page now says so, with a way back.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ui = read("src/app/admin/_components/ui.tsx");

describe("a lapsed admin session says so", () => {
  it("every admin page gets it — it lives in the shared frame", () =>
    expect(ui).toMatch(/<SessionEndedNotice \/>\s*<AdminNav/));
  it("⛔ a 401 alone is not proof — it asks /api/admin/auth/me first", () =>
    expect(ui).toMatch(/fetch\("\/api\/admin\/auth\/me"[\s\S]{0,120}if \(r\.status === 401\) setEnded\(true\)/));
  it("⛔ a wrong password at sign-in is not a lapsed session", () =>
    expect(ui).toMatch(/!path\.startsWith\("\/api\/admin\/auth\/"\)/));
  it("'Sign in again' clears the same per-tab marker the admin page keeps", () => {
    const key = /const SESSION_KEY = "([^"]+)"/.exec(read("src/app/admin/page.tsx"))?.[1];
    expect(key).toBeTruthy();
    expect(ui).toContain(`const ADMIN_TAB_KEY = "${key}"`);
  });
});
