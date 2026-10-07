/**
 * P3-4 — a paid organisation becomes usable the moment it is paid for.
 *
 * ⚖️ OWNER DECISION 2026-10-07: *"anyone can purchase and auto-activate."*
 *
 * 🔴 WHAT "pending" ACTUALLY COST. It was never just "an admin has to click
 * something". `status:"pending"` disabled the org three separate ways, and the
 * buyer had already paid:
 *
 *   1. check_org_seat_available (org_functions.sql) is
 *        `seats_used < seats_purchased AND status = 'active' AND …`
 *      ⇒ a pending org has ZERO usable seats no matter what was purchased, so
 *      POST /api/org/dashboard/members answers "No seats available".
 *   2. assign_org_license raises `'Organization is not active'`, so even an
 *      invite that somehow existed could not be accepted.
 *   3. Both webhooks wrote the BUYER'S OWN licence as `tier:"free"` — they paid
 *      for an org plan and were left on the free tier until a human noticed.
 *
 * ⛔ It is only safe to automate this now because two things landed first:
 * `7cf67c9` (a human is alerted) and `2d9cdaa` (activation can no longer
 * overwrite a member's own paid licence). Before those, auto-activation would
 * have silently destroyed personally purchased Plus licences at scale.
 *
 * 🔴 TWO BUGS THIS CHANGE HAD TO FIX FIRST, because automation makes them live:
 *
 *   A. NO EXPIRY. The purchase is explicitly ANNUAL — /pricing/corporate says
 *      "₹1,999/seat/yr" and the button reads "Pay … /yr". The webhooks set no
 *      expires_at, relying on an admin to type one. Auto-activating without one
 *      turns a one-year payment into a perpetual org.
 *
 *   B. EVERY ORG TYPE WAS GRANTED ENTERPRISE. The webhook carried
 *        tierMap = { commercial:"enterprise", ngo:"enterprise",
 *                    edu:"edu", govt:"enterprise" }
 *      which ignores seat count, while the ORDER was priced by
 *        tierForSeats = edu→edu, seats>=100→enterprise, else "plus".
 *      So a 10-seat purchase sold as Plus would have been granted Enterprise —
 *      including the institutional features that are never bypassed. Harmless
 *      while nothing activated automatically; a giveaway the moment it did.
 *
 * ⚠️ Asserted against the source. These routes need Razorpay/Stripe signatures,
 * Supabase and a live payment; a stubbed happy path would not have caught
 * either bug above, because the old code "worked" — it just quietly withheld
 * what was paid for, and quietly over-granted what was not.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TIER_RANK } from "@/types/license";

const read = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const RZP    = "src/app/api/payments/razorpay/webhook/route.ts";
const STRIPE = "src/app/api/payments/stripe/webhook/route.ts";
const PAID   = [["razorpay", RZP], ["stripe", STRIPE]] as const;

describe("🔴 a paid org is created ACTIVE, not pending", () => {
  it.each(PAID)("%s creates the org with status active", (_name, file) => {
    const s = read(file);
    const insert = s.slice(s.indexOf('from("organizations").insert'));
    expect(insert.slice(0, 600)).toMatch(/status:\s*"active"/);
  });

  it.each(PAID)("%s no longer creates a paid org pending", (_name, file) => {
    const s = read(file);
    const insert = s.slice(s.indexOf('from("organizations").insert'), s.indexOf('from("organizations").insert') + 600);
    expect(insert).not.toMatch(/status:\s*"pending"/);
  });
});

describe("🔴 bug A — the purchase is ANNUAL, so activation must set an expiry", () => {
  it.each(PAID)("%s sets expires_at on the org", (_name, file) => {
    const s = read(file);
    const insert = s.slice(s.indexOf('from("organizations").insert'), s.indexOf('from("organizations").insert') + 700);
    expect(insert).toMatch(/expires_at:/);
  });

  it.each(PAID)("%s derives that expiry from a shared one-year constant", (_name, file) => {
    // Not a literal in two places: the two webhooks must not be able to drift
    // into selling different lengths of the same product.
    expect(read(file)).toMatch(/orgTermExpiresAt\(\)/);
  });

  it("the shared term is exactly one year", async () => {
    const { orgTermExpiresAt } = await import("@/lib/imotara/org");
    const got  = new Date(orgTermExpiresAt()).getTime();
    const want = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).getTime();
    expect(Math.abs(got - want)).toBeLessThan(60_000);
  });
});

describe("🔴 bug B — the tier that was PAID for is the tier that is granted", () => {
  it.each(PAID)("%s does not blanket-map every org type to enterprise", (_name, file) => {
    const s = read(file);
    // The old map granted enterprise to commercial, ngo AND govt alike.
    expect(s).not.toMatch(/commercial\s*:\s*"enterprise"[\s\S]{0,80}ngo\s*:\s*"enterprise"/);
  });

  it.each(PAID)("%s honours the tier carried on the order", (_name, file) => {
    expect(read(file)).toMatch(/resolveOrgTier\(/);
  });

  it("resolveOrgTier prices by SEATS, matching tierForSeats on the order route", async () => {
    const { resolveOrgTier } = await import("@/lib/imotara/org");
    // edu is edu at any size
    expect(resolveOrgTier("edu", 10)).toBe("edu");
    expect(resolveOrgTier("edu", 500)).toBe("edu");
    // 🔑 the bug: a 10-seat commercial org was sold as Plus and granted Enterprise
    expect(resolveOrgTier("commercial", 10)).toBe("plus");
    expect(resolveOrgTier("commercial", 50)).toBe("plus");
    expect(resolveOrgTier("commercial", 100)).toBe("enterprise");
    expect(resolveOrgTier("commercial", 500)).toBe("enterprise");
    expect(resolveOrgTier("ngo", 10)).toBe("plus");
    expect(resolveOrgTier("govt", 500)).toBe("enterprise");
  });

  it("…and it agrees with the route that actually took the money", () => {
    const s = read("src/app/api/payments/razorpay/corporate/route.ts");
    // tierForSeats: edu → edu, >=100 → enterprise, else plus
    expect(s).toMatch(/orgType === "edu"\) return "edu"/);
    expect(s).toMatch(/seats >= 100\) return "enterprise"/);
    expect(s).toMatch(/return "plus"/);
  });
});

describe("🔴 the buyer's own licence is the tier they paid for, never 'free'", () => {
  it.each(PAID)("%s stops writing tier free for the owner", (_name, file) => {
    const s = read(file);
    expect(s).not.toMatch(/tier:\s*"free"[\s\S]{0,80}source:\s*"org"/);
  });

  it.each(PAID)("%s grants through the shared floor helper", (_name, file) => {
    expect(read(file)).toMatch(/grantOrgTierWithFloor\(/);
  });
});

describe("🔴 …but activation still cannot DOWNGRADE a licence they already bought", () => {
  /**
   * This is `2d9cdaa`'s rule, and the reason auto-activation is safe at all.
   * A buyer who already holds Plus and purchases a 10-seat Plus org must keep
   * their own expiry, not have it replaced by the org's.
   */
  it("the helper only raises — strictly greater-than", () => {
    const s = read("src/lib/imotara/org.ts");
    const fn = s.slice(s.indexOf("export async function grantOrgTierWithFloor"));
    expect(fn).toMatch(/orgRank\s*>\s*curRank/);
    expect(fn).toMatch(/TIER_RANK\[/);
  });

  it("a member at or above the org tier keeps their own tier and expiry", () => {
    const s = read("src/lib/imotara/org.ts");
    const fn = s.slice(s.indexOf("export async function grantOrgTierWithFloor"));
    expect(fn).toMatch(/tier:\s*cur!?\.tier/);
    expect(fn).toMatch(/expires_at:\s*cur!?\.expires_at/);
  });

  it("someone with no licence at all is still raised", () => {
    const s = read("src/lib/imotara/org.ts");
    const fn = s.slice(s.indexOf("export async function grantOrgTierWithFloor"));
    expect(fn).toMatch(/curRank\s*=\s*cur\s*\?[\s\S]{0,80}:\s*-1/);
  });

  it("the ranking it uses is the real one", () => {
    expect(TIER_RANK.enterprise).toBeGreaterThan(TIER_RANK.plus);
    expect(TIER_RANK.plus).toBeGreaterThan(TIER_RANK.free);
  });
});

describe("⛔ the ENQUIRY path is untouched — no money, no activation", () => {
  /**
   * /api/org/new is a form, not a checkout: "our team will get in touch within
   * 24–48 hours" (P3-7). Nothing has been paid, so nothing may be activated.
   * This is the guard that stops the change leaking out of the paid paths.
   */
  it("org/new still creates the org pending", () => {
    const s = read("src/app/api/org/new/route.ts");
    expect(s).toMatch(/status:\s*"pending"/);
    expect(s).not.toMatch(/status:\s*"active",[\s\S]{0,120}seats_purchased/);
  });

  it("org/new grants no seats and no org tier", () => {
    const s = read("src/app/api/org/new/route.ts");
    expect(s).toMatch(/seats_purchased:\s*0/);
    expect(s).not.toMatch(/grantOrgTierWithFloor/);
  });
});

describe("the human is still told — automation replaced the WAIT, not the record", () => {
  it("razorpay still sends the alert", () => {
    expect(read(RZP)).toMatch(/sendActivationAlert\(/);
  });

  it("neither alert still shouts ACTIVATE NOW, nor claims the org is pending", () => {
    // The alert must survive — removing the wait is not removing the record —
    // but it is now a notification, not a summons. If it still told a human the
    // customer was blocked, it would be lying to them.
    for (const [, f] of PAID) {
      const s = read(f);
      expect(s).not.toMatch(/ACTIVATE NOW/);
      expect(s).not.toMatch(/ACTION NEEDED/);
      expect(s).not.toMatch(/awaiting activation/);
      expect(s).toMatch(/activated automatically/);
    }
  });
});
