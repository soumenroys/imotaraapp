/**
 * The invariants of the org licence functions — including the owner's ruling on
 * what leaving an organisation lands you on.
 *
 * 🔑 THE TIER LADDER IS Free → Plus → Organisation. Owner ruling 2026-10-05,
 * verbatim: "the licensing tier is Free->Plus->Organisation. If any user is
 * removed from organisation he/she will be reverted back to free. because users
 * can go from Free to organisational license as well. so no money will be
 * returned back in any case."
 *
 * ⇒ Dropping to FREE on exit is CORRECT and intended. It is not a bug.
 *
 * This file exists partly to stop that being "fixed". A migration was written
 * in this very session to restore a remembered personal tier on exit, and was
 * reverted once the owner stated the ladder. The reasoning was plausible enough
 * to be re-invented by the next person who reads revoke_org_license and sees a
 * hardcoded 'free', so the decision is pinned here rather than left in a commit
 * message nobody will find.
 *
 * ⚠️ The one residual the owner accepted knowingly: a PERSONALLY bought Plus
 * subscription keeps auto-billing at Razorpay/Apple/Google after the person
 * drops to free — nothing in the code cancels it. Accepted; recorded so it is
 * not rediscovered as news.
 *
 * The rest pins invariants that were nearly lost while editing these functions:
 * the seat-leak lock, the audit action name, and the never-downgrade rule. All
 * three were dropped in a draft rewrite and caught in review.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/** Strip SQL line comments so assertions match behaviour, not explanation. */
const stripSql = (src: string) => src.replace(/^\s*--.*$/gm, "");

function fnBody(file: string, name: string): string {
  const src = read(file);
  const start = src.indexOf(`create or replace function ${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return stripSql(src.slice(start, end));
}

const ORG_FUNCTIONS = "docs/sql/org_functions.sql";
const REVOKE_SQL    = "docs/sql/org_revoke_license_idempotency_fix.sql";
const POOLS_SQL     = "docs/sql/org_license_pools.sql";
const DELETE_SQL    = "docs/sql/org_delete_license_release_trigger.sql";

describe("🔑 the ladder: leaving an org lands on FREE (owner ruling 2026-10-05)", () => {
  it("revoke_org_license drops the member to free", () => {
    const body = fnBody(REVOKE_SQL, "revoke_org_license");
    expect(body).toMatch(/tier\s*=\s*'free'/);
  });

  it("the org-delete trigger drops members to free", () => {
    const body = stripSql(read(DELETE_SQL));
    expect(body).toMatch(/tier\s*=\s*'free'/);
  });

  it("neither exit path consults a remembered personal tier", () => {
    // Guards against re-introducing the reverted restore-on-exit behaviour.
    // If this ever becomes desirable, the ruling above has to change first.
    for (const [file, name] of [[REVOKE_SQL, "revoke_org_license"]] as const) {
      expect(fnBody(file, name)).not.toContain("personal_tier");
    }
    expect(stripSql(read(DELETE_SQL))).not.toContain("personal_tier");
  });

  it("pool WITHDRAW is different on purpose — it resets to the ORG's tier", () => {
    // The member is still in the org, so free would be wrong here. Verified
    // against production on 2026-10-05.
    const body = fnBody(POOLS_SQL, "withdraw_pool_license");
    expect(body).toMatch(/select tier from organizations where id = v_asgn\.org_id/);
  });
});

describe("🔴 invariants of assign_org_license that a rewrite nearly lost", () => {
  const assign = () => fnBody(ORG_FUNCTIONS, "assign_org_license");

  it("holds `for update` — the seat-leak lock", () => {
    // The seat-leak class has recurred four times in this codebase. A draft
    // rewrite in this session dropped this lock while editing nearby code;
    // that is exactly how a fifth recurrence arrives.
    expect(assign()).toContain("for update");
  });

  it("logs the audit action as 'member_joined'", () => {
    // Not cosmetic: audit readers filter on this string. The same draft
    // renamed it to 'license_assigned'.
    expect(assign()).toContain("'member_joined'");
    expect(assign()).not.toContain("'license_assigned'");
  });

  it("refuses to downgrade an existing licence via the org tier", () => {
    // Under the ladder an org tier outranks Plus anyway, so this is normally
    // an upgrade — but the guard is what makes that true rather than lucky.
    expect(assign()).toContain("tier_rank(v_org.tier) > tier_rank(licenses.tier)");
  });

  it("checks seat availability before consuming one", () => {
    expect(assign()).toContain("seats_used >= v_org.seats_purchased");
  });

  it("refuses an org that is not active", () => {
    // This is why a freshly purchased org cannot add members until an admin
    // activates it — see the pending-activation test below.
    expect(assign()).toMatch(/status\s*!=\s*'active'|status\s*<>\s*'active'/);
  });
});

describe("revoke_org_license stays idempotent", () => {
  it("no-ops for someone who is not an active member", () => {
    // Without this, a repeat call double-releases a pool seat and
    // double-decrements seats_used — the seat-leak class again.
    const body = fnBody(REVOKE_SQL, "revoke_org_license");
    expect(body).toContain("v_was_active");
    expect(body).toMatch(/if not v_was_active then\s*return;/);
  });

  it("releases the pool assignment before ending membership", () => {
    const body = fnBody(REVOKE_SQL, "revoke_org_license");
    expect(body).toContain("org_license_assignments");
    expect(body).toMatch(/quantity_used = greatest\(quantity_used - 1, 0\)/);
  });
});

describe("✅ a paid org is ACTIVE on payment — reversed by owner decision 2026-10-07", () => {
  /**
   * ⚖️ This block used to record the opposite, and said so without endorsing it:
   * "the customer has paid, and until a human activates the org from /admin they
   * are on free AND cannot add members". The owner has now decided — *"anyone can
   * purchase and auto-activate"* — and P3-4 implements it. The invariant is
   * inverted rather than deleted, because the thing worth pinning is that the two
   * payment paths agree with each other and with the decision of the day.
   */
  it("the Razorpay corporate purchase creates the org as active", () => {
    // ⚠️ Strip comments first. The webhook still EXPLAINS the old behaviour in a
    // comment ("wrote 'Activate from /admin' into the org's own notes"), and an
    // assertion that reads the mention rather than the code fails on the prose.
    // Third time this trap has been hit in this repo — hence the helper.
    const src = read("src/app/api/payments/razorpay/webhook/route.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // ⚠️ Scope to the ORGANISATIONS insert. A bare toContain('status: "active"')
    // also matches the org_members insert two lines below, so it stayed green
    // with the organisation flipped back to pending — a guard with no teeth.
    // Caught by mutating it, not by reading it.
    const orgInsert = src.slice(src.indexOf('from("organizations").insert'));
    expect(orgInsert.slice(0, 700)).toMatch(/status:\s*"active"/);
    expect(orgInsert.slice(0, 700)).not.toMatch(/status:\s*"pending"/);
    expect(src).not.toMatch(/Activate from \/admin/);
  });

  it("…and gives it the annual expiry the plan was sold with", () => {
    // Without this the reversal would sell a perpetual org for one year's money.
    expect(read("src/app/api/payments/razorpay/webhook/route.ts")).toMatch(/orgTermExpiresAt\(\)/);
  });
});
