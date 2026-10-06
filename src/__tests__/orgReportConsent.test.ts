/**
 * Per-user wellbeing reporting, to the owner's consent spec.
 *
 * 🔑 THE PROMISE, in the owner's words (2026-10-05):
 *   "user may decline to accept, or set off the consent option from the
 *    setting and in those cases organisational admin will not be able to get
 *    that user specific information but will get his/her report in the
 *    aggreegated format"
 *
 * ⇒ Consent OFF removes someone from IDENTIFICATION, never from the AGGREGATE.
 *
 * 🔴 THE FAILURE THIS SUITE EXISTS TO PREVENT. If one query served both the
 * individual and the aggregate view with a consent filter applied, every
 * opt-out would silently shrink the organisation's totals — under-reporting
 * the org to its own funders, AND making each opt-out visible by arithmetic to
 * anyone watching the numbers move. The person who asked not to be identified
 * would be identified by the act of asking. So the two views MUST stay two
 * separate queries.
 *
 * Small-N threshold: 10 active members, owner decision 2026-10-06 (5 was
 * proposed; the owner chose the more conservative figure).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AGGREGATE = () => stripComments(read("src/app/api/org/dashboard/analytics/route.ts"));
const INDIVIDUAL = () => stripComments(read("src/app/api/org/dashboard/member-trends/route.ts"));
const CONSENT_API = () => stripComments(read("src/app/api/org/report-consent/route.ts"));
const MIGRATION = () => read("docs/sql/org_member_report_consent.sql");

describe("🔴 the aggregate counts EVERYONE, including those who opted out", () => {
  it("the aggregate endpoint never filters on report_consent", () => {
    // The single most important assertion in this file. If this ever fails,
    // opting out has started shrinking the org's own totals.
    expect(AGGREGATE()).not.toContain("report_consent");
  });

  it("the aggregate still selects members by status alone", () => {
    const s = AGGREGATE();
    expect(s).toContain('.eq("status", "active")');
  });

  it("individual and aggregate are genuinely two separate routes", () => {
    // Not one route with a flag — two files, two queries.
    expect(fs.existsSync(path.join(process.cwd(), "src/app/api/org/dashboard/analytics/route.ts"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "src/app/api/org/dashboard/member-trends/route.ts"))).toBe(true);
  });
});

describe("the individual view honours consent", () => {
  it("filters to consenting members", () => {
    // ⚠️ NOT just `toContain("report_consent")` — that word also appears in
    // the .select(), so deleting the filter still passed. Mutation testing
    // caught this: assert the FILTER, not the mention.
    const s = INDIVIDUAL();
    expect(s).toMatch(/filter\(\s*\(m\)\s*=>\s*m\.report_consent\s*\)/);
  });

  it("the user ids queried are the CONSENTING ones", () => {
    // The second half of the same guarantee: whatever list is built, the
    // usage_events query must be scoped to it.
    const s = INDIVIDUAL();
    expect(s).toMatch(/consentingIds\s*=\s*consenting\.map/);
    expect(s).toMatch(/\.in\("user_id",\s*consentingIds\)/);
  });

  it("only resolves emails for members who consented", () => {
    // Never put a non-consenting member's address in the response, even
    // unused — it would leak via the network tab.
    const s = INDIVIDUAL();
    expect(s).toMatch(/consentingIds\.includes\(u\.id\)/);
  });

  it("reports how many opted out, as a COUNT and not as names", () => {
    const s = INDIVIDUAL();
    expect(s).toContain("optedOut");
    expect(s).toContain("consentingMembers");
  });
});

describe("the small-N threshold protects the person who opted out", () => {
  it("is 10, and the API and SQL agree", () => {
    expect(INDIVIDUAL()).toContain("MIN_MEMBERS_FOR_INDIVIDUAL = 10");
    expect(MIGRATION()).toMatch(/returns integer[\s\S]{0,80}select 10/);
  });

  it("counts ACTIVE members, not consenting ones", () => {
    // 🔑 If the threshold moved with the number of consenters, each person
    // switching consent off could flip the whole breakdown on or off — which
    // leaks exactly what the threshold is meant to hide.
    const s = INDIVIDUAL();
    const gate = s.slice(s.indexOf("activeCount"), s.indexOf("consenting ="));
    expect(gate).toContain("MIN_MEMBERS_FOR_INDIVIDUAL");
    expect(gate).not.toContain("report_consent");
  });

  it("refuses below the threshold with an explanation, not an error", () => {
    const s = INDIVIDUAL();
    expect(s).toContain("below_threshold");
    expect(s).toContain("available: false");
  });

  it("the aggregate is NOT gated by the threshold", () => {
    // Opting out of identification must not cost a small org its totals.
    expect(AGGREGATE()).not.toContain("MIN_MEMBERS");
  });
});

describe("the checkbox belongs to the member, not the admin", () => {
  it("PATCH takes no userId — only the caller's own membership", () => {
    const s = CONSENT_API();
    const patch = s.slice(s.indexOf("export async function PATCH"));
    expect(patch).toContain('.eq("user_id", userId)');
    expect(patch).not.toMatch(/body\.userId|params\.userId/);
  });

  it("an anonymous identity cannot give consent", () => {
    expect(CONSENT_API()).toContain("is_anonymous");
  });

  it("reports applicable:false for someone with no org membership", () => {
    // Per the spec: off, and not applicable, for a personal account.
    const s = CONSENT_API();
    expect(s).toContain("applicable: false");
    expect(s).toContain("consent: false");
  });

  it("writes an audit entry when consent changes", () => {
    const s = CONSENT_API();
    expect(s).toContain("report_consent_granted");
    expect(s).toContain("report_consent_withdrawn");
  });
});

describe("the flag is scoped so it cannot outlive the membership", () => {
  it("lives on org_members, not on licenses or auth.users", () => {
    const m = MIGRATION();
    expect(m).toMatch(/alter table org_members[\s\S]{0,120}report_consent/);
    expect(m).not.toMatch(/alter table licenses[\s\S]{0,80}report_consent/);
  });

  it("defaults to true — 'on while you are an org member'", () => {
    expect(MIGRATION()).toMatch(/report_consent boolean not null default true/);
  });

  it("contains no backfill that switches anyone OFF", () => {
    // That is the member's choice, not a migration's.
    expect(MIGRATION()).not.toMatch(/update org_members[\s\S]{0,120}report_consent\s*=\s*false/);
  });
});
