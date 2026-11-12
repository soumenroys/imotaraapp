// src/__tests__/auth/everySignInDoorIsCurrent.test.ts
// 🔴 Found walking every door in the #134 live test (12 Nov 2026):
//   · org invite, domain-join and /org/new told people only admin-made accounts could use a password,
//     and their Sign in detoured through Settings, losing the page;
//   · a signed-OUT org admin opening /org/dashboard was sent to /org/new — "submit an organisation
//     request" — as if they had no organisation.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "__tests__") walk(p, out); }
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

describe("no page still says email + password is only for admin-made accounts", () => {
  it("the old sentence is gone everywhere", () => {
    const hits = walk("src").filter((f) => readFileSync(f, "utf8").includes("Was your account set up by an Imotara admin?"));
    expect(hits).toEqual([]);
  });
});

describe("a signed-out organisation admin is asked to sign in — not sent to 'create an organisation'", () => {
  const L = readFileSync("src/app/org/dashboard/layout.tsx", "utf8");
  it("checks for a real signed-in account BEFORE deciding there is no organisation", () => {
    const check = L.indexOf("if (!data.user || data.user.is_anonymous) { setSignedOut(true)");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(L.indexOf('router.replace("/org/new")'));
  });
  it("its Sign in opens the panel and comes back to the dashboard", () => {
    expect(L).toMatch(/openSignIn\(pathname \|\| "\/org\/dashboard"\)/);
  });
  it("/org/new signs in on the panel and returns to /org/new", () => {
    const N = readFileSync("src/app/org/new/page.tsx", "utf8");
    expect(N).toMatch(/openSignIn\("\/org\/new"\)/);
    expect(N).not.toContain('<Link href="/settings"');
  });
});
