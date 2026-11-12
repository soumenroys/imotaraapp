// #134 — 12 Nov 2026 live Microsoft test: signing in from /login landed an ordinary user on
// "Set up your organisation" because /login defaulted to /org/dashboard.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const code = (f: string) => readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");

describe("/login sends people to the chat unless a page asked for somewhere else", () => {
  it("the default is /chat, never the org dashboard", () => {
    const fn = code("src/app/login/page.tsx").match(/function safeRedirect[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn).toMatch(/return "\/chat";/);
    expect(fn).not.toMatch(/org\/dashboard/);
  });
  it("the admin page's org-member link asks for the dashboard explicitly", () => {
    expect(readFileSync("src/app/admin/page.tsx", "utf8")).toMatch(/href="\/login\?redirect=\/org\/dashboard"/);
  });
});
