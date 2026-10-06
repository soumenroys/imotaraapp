/**
 * The org-admin surface for Connect companions, and the Connect marketplace
 * switch that sits beside it.
 *
 * 🔴 WHY THE GUARDS HERE MATTER MORE THAN THE FEATURE
 * "Make a companion private to my organisation" is a small, pleasant feature
 * with one nasty failure mode: if an admin can point it at ANY companion, they
 * can pull a popular public companion out of the marketplace from a dashboard
 * that is meant to govern only their own people. That costs the companion their
 * visibility and every other user their access, and nothing would error.
 *
 * So the rule is: you may only privatise a companion whose user is an ACTIVE
 * MEMBER OF YOUR OWN ORG, and you may only release one your own org holds.
 *
 * ⚠️ These assert the CALLS and the CONSTRAINTS in source, in the same style as
 * connectOrgScoping.test.ts — the routes need Supabase, and a stubbed happy path
 * would prove far less than pinning the guards themselves.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const COMPANIONS = () => strip(read("src/app/api/org/dashboard/connect-companions/route.ts"));
const SETTINGS   = () => strip(read("src/app/api/org/dashboard/settings/route.ts"));

describe("🔴 an org admin cannot privatise somebody else's companion", () => {
  it("every handler is behind requireOrgAdmin", () => {
    const s = COMPANIONS();
    // GET, POST and DELETE — three handlers, three guards.
    expect(s.match(/requireOrgAdmin\(req\)/g) ?? []).toHaveLength(3);
  });

  it("claiming verifies ACTIVE membership of the claiming org", () => {
    const s = COMPANIONS();
    const post = s.slice(s.indexOf("export async function POST"));
    expect(post).toMatch(/from\("org_members"\)/);
    expect(post).toMatch(/\.eq\("org_id",\s*auth\.orgId\)/);
    expect(post).toMatch(/\.eq\("status",\s*"active"\)/);
    // and it is the CONSULTANT's user that must be the member, not the admin
    expect(post).toMatch(/\.eq\("user_id",\s*consultant\.user_id\)/);
  });

  it("a non-member companion is refused, not silently claimed", () => {
    const post = COMPANIONS().slice(COMPANIONS().indexOf("export async function POST"));
    expect(post).toMatch(/if \(!membership\)/);
    expect(post).toMatch(/status:\s*403/);
  });

  it("a companion held by another org is refused", () => {
    const post = COMPANIONS().slice(COMPANIONS().indexOf("export async function POST"));
    expect(post).toMatch(/consultant\.org_id\s*&&\s*consultant\.org_id\s*!==\s*auth\.orgId/);
    expect(post).toMatch(/status:\s*409/);
  });

  it("an unreadable row fails CLOSED rather than proceeding", () => {
    const post = COMPANIONS().slice(COMPANIONS().indexOf("export async function POST"));
    expect(post).toMatch(/if \(readErr\)/);
    expect(post).toMatch(/if \(memErr\)/);
  });

  it("releasing is scoped to the admin's OWN org", () => {
    // Without the org_id filter an admin could release another org's companion.
    const del = COMPANIONS().slice(COMPANIONS().indexOf("export async function DELETE"));
    expect(del).toMatch(/\.eq\("org_id",\s*auth\.orgId\)/);
  });

  it("claiming sets both the org AND the visibility", () => {
    // org_id alone would leave them in the public marketplace; visibility alone
    // would violate the org_only-needs-an-org constraint.
    const post = COMPANIONS().slice(COMPANIONS().indexOf("export async function POST"));
    expect(post).toMatch(/org_id:\s*auth\.orgId/);
    expect(post).toMatch(/visibility:\s*"org_only"/);
  });

  it("releasing clears both, so nobody is left unreachable", () => {
    const del = COMPANIONS().slice(COMPANIONS().indexOf("export async function DELETE"));
    expect(del).toMatch(/org_id:\s*null/);
    expect(del).toMatch(/visibility:\s*"public"/);
  });
});

describe("the marketplace switch does not trash the rest of org_settings", () => {
  it("🔑 reads the current settings and MERGES", () => {
    // org_settings is shared with branding (logo, accent colour, brand name) and
    // domain verification. A replacing write would wipe them silently.
    const s = SETTINGS();
    const patch = s.slice(s.indexOf("export async function PATCH"), s.indexOf("export async function DELETE"));
    expect(patch).toMatch(/select\("org_settings"\)/);
    expect(patch).toMatch(/\.\.\.\(\(current\?\.org_settings \?\? \{\}\)/);
    expect(patch).toMatch(/connect_allow_public:\s*body\.connectAllowPublic/);
  });

  it("still lets an admin rename without touching the switch", () => {
    const patch = SETTINGS().slice(SETTINGS().indexOf("export async function PATCH"));
    expect(patch).toMatch(/const wantsName\s*=/);
    expect(patch).toMatch(/const wantsToggle\s*=/);
  });

  it("rejects a non-boolean switch rather than storing it", () => {
    const patch = SETTINGS().slice(SETTINGS().indexOf("export async function PATCH"));
    expect(patch).toMatch(/typeof body\.connectAllowPublic !== "boolean"/);
  });

  it("an empty body is a 400, not a silent no-op write", () => {
    const patch = SETTINGS().slice(SETTINGS().indexOf("export async function PATCH"));
    expect(patch).toMatch(/if \(!wantsName && !wantsToggle\)/);
  });

  it("tier, seats and status remain out of reach of org admins", () => {
    // ⚠️ Assert what is WRITTEN, not what is mentioned. A naive /status:/ here
    // matches `{ status: 400 }` in the HTTP responses and fails on correct code —
    // the same substring trap these guards exist to avoid.
    const patch = SETTINGS().slice(
      SETTINGS().indexOf("export async function PATCH"),
      SETTINGS().indexOf("export async function DELETE"),
    );
    const assigned = [...patch.matchAll(/update\.(\w+)\s*=/g)].map((m) => m[1]).sort();
    expect(assigned).toEqual(["name", "org_settings"]);
    for (const field of ["tier", "seats_purchased", "billing_type", "expires_at"]) {
      expect(assigned, `PATCH must not write ${field}`).not.toContain(field);
    }
  });
});
