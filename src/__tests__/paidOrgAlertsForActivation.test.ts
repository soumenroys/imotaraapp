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

describe("⛔ the decision is respected — payment does NOT activate", () => {
  it("a purchased org is still created pending", () => {
    expect(WEBHOOK()).toContain('status: "pending"');
  });

  it("nothing in the webhook flips an org to active", () => {
    // If this ever fails, auto-activation has been reintroduced against an
    // explicit decision.
    const s = WEBHOOK();
    expect(s).not.toMatch(/status:\s*"active"[\s\S]{0,60}organizations/);
    expect(s).not.toMatch(/organizations[\s\S]{0,200}update\([\s\S]{0,80}status:\s*"active"/);
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

  it("says plainly that the customer is blocked until it is done", () => {
    const src = read("src/app/api/payments/razorpay/webhook/route.ts");
    expect(src).toMatch(/cannot add a single member/i);
    expect(src).toMatch(/ACTION NEEDED/);
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
