/**
 * Editing an organisation must not destroy a member's own paid licence.
 *
 * 🔴 WHY THIS EXISTS. PATCH /api/admin/organizations/[orgId] used to sync members
 * like this:
 *
 *     await admin.from("licenses").upsert(
 *       members.map((m) => ({ user_id: m.user_id, tier: newTier,
 *                             expires_at: org.expires_at, source: "org", ... })),
 *       { onConflict: "user_id" });
 *
 * — every active member's licence row replaced wholesale with the organisation's
 * tier, source and expiry. So an admin editing an org, or merely ACTIVATING one,
 * could overwrite a member's personally purchased Plus with a lower org tier and
 * swap their paid expiry date for the organisation's. The member paid for that;
 * the edit was about the organisation.
 *
 * The SQL has always known better. assign_org_license says so in a comment:
 *
 *     -- Only upgrade tier via org, never downgrade a personal license
 *     tier = case when tier_rank(v_org.tier) > tier_rank(licenses.tier)
 *                 then v_org.tier else licenses.tier end
 *
 * This route was one of the six paths that bypass that RPC (P3-6), and the only
 * one that wrote member tiers. It now applies the same floor.
 *
 * ⚠️ Asserted against the source. The route needs Supabase and an admin session;
 * what matters is the RULE, and a stubbed happy path would not have caught the
 * original bug either — the old code "worked", it just quietly took something.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TIER_ORDER, TIER_RANK } from "@/types/license";

const SRC = () =>
  fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/organizations/[orgId]/route.ts"),
    "utf8",
  );
const code = () => SRC().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("🔴 an org edit cannot lower a member who already paid for more", () => {
  it("compares the org tier against each member's CURRENT tier", () => {
    const s = code();
    // It must read what members already hold. The old code never looked.
    expect(s).toMatch(/from\("licenses"\)[\s\S]{0,120}\.select\(\s*"user_id, tier, expires_at"\s*\)/);
    expect(s).toMatch(/TIER_RANK\[/);
  });

  it("only raises — the comparison is strictly greater-than", () => {
    const s = code();
    expect(s).toMatch(/orgRank\s*>\s*curRank/);
  });

  it("🔑 members at or above the org tier keep their OWN tier and expiry", () => {
    // The whole point: linked to the org, but their purchase is untouched.
    const s = code();
    const link = s.slice(s.indexOf("linkOnly.length > 0"));
    expect(link).toMatch(/tier:\s*l\.tier/);
    expect(link).toMatch(/expires_at:\s*l\.expires_at/);
    // and must NOT write the org's tier for them
    expect(link).not.toMatch(/tier:\s*newTier/);
  });

  it("a member with no licence at all is still given the org tier", () => {
    // curRank of -1 means "nothing yet", which every org tier out-ranks.
    expect(code()).toMatch(/curRank\s*=\s*cur\s*\?[\s\S]{0,60}:\s*-1/);
  });
});

describe("🔴 the tier itself is validated before it reaches anyone's licence", () => {
  it("rejects a tier that is not a real tier", () => {
    const s = code();
    expect(s).toMatch(/isLicenseTier\(body\.tier\)/);
    expect(s).toMatch(/status:\s*400/);
  });

  it("…which matters because an unknown tier ranks as free", () => {
    // Not a style point: TIER_RANK has no entry for a typo, the `?? 0` makes it
    // free, and the old code would then have written free to every member.
    expect(TIER_RANK["enterprise" as keyof typeof TIER_RANK]).toBeGreaterThan(
      TIER_RANK["free" as keyof typeof TIER_RANK],
    );
    expect(Object.keys(TIER_RANK)).not.toContain("enterprize");
  });
});

describe("the TS ranking agrees with the SQL ranking it mirrors", () => {
  /**
   * TIER_RANK is index-based (0..4) and SQL tier_rank uses 0,1,3,4,5. The
   * numbers differ on purpose; only the ORDER has to agree, because that is all
   * either side compares. If they ever disagree, the floor enforced in this
   * route would stop matching the floor enforced in assign_org_license.
   */
  const SQL_RANK: Record<string, number> = {
    free: 0, plus: 1, family: 3, edu: 4, enterprise: 5,
  };

  it("orders every tier the same way", () => {
    const byTs  = [...TIER_ORDER].sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);
    const bySql = [...TIER_ORDER].sort((a, b) => SQL_RANK[a] - SQL_RANK[b]);
    expect(byTs).toEqual(bySql);
  });

  it("agrees that an org tier out-ranks plus, and that free out-ranks nothing", () => {
    expect(TIER_RANK.enterprise).toBeGreaterThan(TIER_RANK.plus);
    expect(TIER_RANK.edu).toBeGreaterThan(TIER_RANK.plus);
    expect(TIER_RANK.free).toBe(0);
  });
});
