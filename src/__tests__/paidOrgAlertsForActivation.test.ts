/**
 * A paid organisation must not wait in silence.
 *
 * 🔑 ACTIVATION IS MANUAL BY OWNER DECISION (2026-10-06): "after payment the
 * activation should be manual". That is settled and this file does NOT argue
 * with it — there are tests below asserting the org is still created pending.
 *
 * 🔴 BUT MANUAL ONLY WORKS IF SOMEBODY IS TOLD. The webhook created the org at
 * status "pending" and notified nobody. It wrote "Activate from /admin" into
 * the organisation's own notes column — a string only visible to someone
 * already looking at the record they do not know exists. Meanwhile the
 * self-serve org/new path, where no money changes hands, HAS always sent an
 * alert. The path where someone actually paid did not.
 *
 * So a customer could pay for 50 seats and be unable to add a single member,
 * indefinitely, with no part of the system aware of it.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const WEBHOOK = () => strip(read("src/app/api/payments/razorpay/webhook/route.ts"));

describe("⚖️ the decision REVERSED 2026-10-07 — payment now activates", () => {
  /**
   * The owner's words: *"anyone can purchase and auto-activate."* This guard
   * used to assert the opposite and warned that a failure meant "auto-activation
   * has been reintroduced against an explicit decision". That decision changed,
   * so the guard changed with it — but only because the two things that made
   * automation unsafe landed first: `7cf67c9` (a human is told) and `2d9cdaa`
   * (activation cannot overwrite a member's own paid licence).
   */
  it("a purchased org is created active", () => {
    expect(WEBHOOK()).toContain('status: "active"');
    expect(WEBHOOK()).not.toContain('status: "pending"');
  });

  it("🔑 and the buyer is granted the tier they paid for, not 'free'", () => {
    const s = WEBHOOK();
    expect(s).toMatch(/grantOrgTierWithFloor\(/);
    expect(s).not.toMatch(/tier:\s*"free"[\s\S]{0,80}source:\s*"org"/);
  });
});

describe("but a human is told, so 'manual' is a process and not a silence", () => {
  it("sends an activation alert after the org is created", () => {
    const s = WEBHOOK();
    expect(s).toContain("sendActivationAlert(");
  });

  it("the alert carries what an admin needs to act", () => {
    const s = WEBHOOK();
    const fn = s.slice(s.indexOf("async function sendActivationAlert"));
    for (const field of ["orgId", "orgType", "seats", "userEmail", "paymentId"]) {
      expect(fn, `alert omits ${field}`).toContain(field);
    }
  });

  it("says plainly that nothing is owed — it is a record, not a summons", () => {
    // 🔑 It used to say "cannot add a single member" and "[ACTION NEEDED]".
    // Both were true then and are false now; an alert that still said them would
    // be lying to the human who reads it, and would send them to /admin to fix
    // something already fixed. Removing the WAIT is not removing the RECORD.
    const src = read("src/app/api/payments/razorpay/webhook/route.ts");
    expect(src).not.toMatch(/cannot add a single member/i);
    expect(src).not.toMatch(/ACTION NEEDED/);
    expect(src).toMatch(/activated automatically/i);
  });
});

describe("🔴 the alert can never break the payment webhook", () => {
  it("is fired without awaiting it", () => {
    // Razorpay retries on a non-200. Blocking a payment webhook on SMTP would
    // be far worse than a missed email.
    expect(WEBHOOK()).toMatch(/void sendActivationAlert\(/);
  });

  it("swallows its own failures", () => {
    const s = WEBHOOK();
    const fn = s.slice(s.indexOf("async function sendActivationAlert"));
    expect(fn).toMatch(/catch\s*\(/);
  });

  it("no-ops when SMTP is not configured, instead of throwing", () => {
    const s = WEBHOOK();
    const fn = s.slice(s.indexOf("async function sendActivationAlert"));
    expect(fn).toMatch(/if\s*\(!user\s*\|\|\s*!pass\)\s*return;/);
  });
});
