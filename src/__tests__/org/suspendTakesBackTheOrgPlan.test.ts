// #132 — 12 Nov 2026, proven on the live database with a throwaway org: a member of a Pro org stayed
// on Pro after the org was SUSPENDED and after it was CANCELLED (their licence holds a copy of the
// org's plan, and resolve_user_tier falls back to it once the org is not active).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/admin/organizations/[orgId]/route.ts", "utf8");
const block = route.slice(route.indexOf("const nowInactive"), route.indexOf("// If tier OR status changed to active"));

describe("suspending or cancelling an org takes back the plan it granted", () => {
  it("runs for any status that is not active", () => {
    expect(block).toMatch(/const nowInactive = body\.status !== undefined && body\.status !== "active";/);
    expect(block).toMatch(/if \(nowInactive && before\)/);
  });
  it("touches ONLY what the org granted: same org, source org, the org's tier AND the org's old end date", () => {
    expect(block).toMatch(/\.eq\("org_id", orgId\)/);
    expect(block).toMatch(/\.eq\("source", "org"\)/);
    expect(block).toMatch(/\.eq\("tier", before\.tier\)/);
    expect(block).toMatch(/before\.expires_at \? granted\.eq\("expires_at", before\.expires_at\) : granted\.is\("expires_at", null\)/);
  });
  it("sets those copies to free, and re-activation still hands the plan back", () => {
    expect(block).toMatch(/update\(\{ tier: "free", expires_at: null/);
    expect(route).toMatch(/const justActivated = body\.status === "active";/);
    expect(route.indexOf("const nowInactive")).toBeLessThan(route.indexOf("const justActivated"));
  });
});
