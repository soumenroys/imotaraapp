// src/__tests__/payments/graceNoticeReachesThePerson.test.ts
// 🔑 Owner, 6 Nov 2026: tell a subscriber when their payment failed and they are
// in Apple's / Google's billing grace period — a banner AND one email.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/imotara/grantLicense", () => ({
  PRODUCT_CATALOG: { plus_monthly: { type: "subscription", tier: "plus", days: 30, paise: 14900 } },
  grantLicense: vi.fn(async (_u: string, _p: string, _db: unknown, _s: string, expiry?: string | null) => ({ ok: true, tier: "plus", tokenBalance: 0, expiresAt: expiry ?? null })),
}));

import { subscriptionSnapshot } from "@/lib/apple/storeServer";
import { billingIssueFromRow, graceEmail, notifyGraceOnce, recordBillingState, MANAGE_URL } from "@/lib/imotara/billingIssue";
import { sweepAppleRenewals, sweepPlayRenewals } from "@/lib/imotara/playRenewal";
import { billingBannerText } from "@/components/imotara/BillingIssueBanner";

const jws = (p: object) => `h.${Buffer.from(JSON.stringify(p)).toString("base64url")}.s`;
const yes = () => true;
const NOV22 = Date.parse("2026-11-22T00:00:00Z");

/** A tiny licences table: records every update and the filters it was scoped by. */
function licencesDb(rows: Record<string, unknown>[] = [], others: Record<string, unknown[]> = {}) {
  const updates: { set: Record<string, unknown>; where: [string, unknown][] }[] = [];
  function from(table: string) {
    const where: [string, unknown][] = [];
    let set: Record<string, unknown> | null = null;
    const b: Record<string, unknown> = {};
    const run = () => {
      if (set) {
        updates.push({ set, where: [...where] });
        for (const r of rows) if (where.every(([k, v]) => r[k] === v)) Object.assign(r, set);
        return { data: null, error: null };
      }
      const src = table === "licenses" ? rows : others[table] ?? [];
      return { data: src.filter((r) => where.every(([k, v]) => (r as Record<string, unknown>)[k] === v)), error: null };
    };
    Object.assign(b, {
      select: () => b, in: () => b, neq: () => b, not: () => b,
      update: (v: Record<string, unknown>) => ((set = v), b),
      eq: (k: string, v: unknown) => (where.push([k, v]), b),
      is: (k: string, v: unknown) => (where.push([k, v ?? null]), b),
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    });
    return b;
  }
  return { db: { from } as never, updates, rows };
}

describe("Apple says 'grace' ⇒ we know until when", () => {
  it("status 4 ⇒ graceUntil = the renewal info's grace end; the grant date is unchanged", () => {
    const snap = subscriptionSnapshot({ data: [{ lastTransactions: [{
      status: 4,
      signedTransactionInfo: jws({ expiresDate: Date.parse("2026-11-06T00:00:00Z") }),
      signedRenewalInfo: jws({ gracePeriodExpiresDate: NOV22 }),
    }] }] }, yes);
    expect(snap).toEqual({ expiresAt: "2026-11-06T00:00:00.000Z", graceUntil: "2026-11-22T00:00:00.000Z" });
  });
  it("status 1 (paid) ⇒ no grace", () => {
    const snap = subscriptionSnapshot({ data: [{ lastTransactions: [{ status: 1, signedTransactionInfo: jws({ expiresDate: NOV22 }) }] }] }, yes);
    expect(snap.graceUntil).toBeNull();
  });
});

describe("the licence carries it — and only the store that set it can clear it", () => {
  it("grace ⇒ written for that person", async () => {
    const t = licencesDb();
    await recordBillingState(t.db, "u1", "apple", "2026-11-22T00:00:00.000Z");
    expect(t.updates[0]).toEqual({ set: { billing_issue: "grace", billing_issue_until: "2026-11-22T00:00:00.000Z", billing_issue_store: "apple" }, where: [["user_id", "u1"]] });
  });
  it("paid ⇒ cleared, scoped to the SAME store (Google cannot wipe Apple's notice)", async () => {
    const t = licencesDb();
    await recordBillingState(t.db, "u1", "google_play", null);
    expect(t.updates[0].where).toEqual([["user_id", "u1"], ["billing_issue_store", "google_play"]]);
    expect(t.updates[0].set).toMatchObject({ billing_issue: null, billing_issue_notified_at: null });
  });
  it("⛔ a database that throws never breaks the caller", async () => {
    const broken = { from: () => { throw new Error("no such column"); } } as never;
    await expect(recordBillingState(broken, "u1", "apple", null)).resolves.toBeUndefined();
  });
  it("a grace date already past is not shown", () => {
    expect(billingIssueFromRow({ billing_issue: "grace", billing_issue_until: "2026-11-01T00:00:00Z", billing_issue_store: "apple" }, NOV22)).toBeNull();
    expect(billingIssueFromRow({ billing_issue: "grace", billing_issue_until: "2026-11-22T00:00:00Z", billing_issue_store: "apple" }, Date.parse("2026-11-10T00:00:00Z")))
      .toEqual({ kind: "grace", until: "2026-11-22T00:00:00Z", store: "apple" });
  });
});

describe("the daily sweeps record it", () => {
  it("Apple grace ⇒ the licence is flagged, AND Plus is still extended", async () => {
    const t = licencesDb([], { payment_licenses: [{ payment_id: "2000000000000001", user_id: "u1", product_id: "plus_monthly", tier: "plus" }] });
    const out = await sweepAppleRenewals(t.db, { expiry: async () => ({ ok: true, expiresAt: "2026-11-06T00:00:00.000Z", graceUntil: "2026-11-22T00:00:00.000Z" }) });
    expect(out.extended).toBe(1);
    expect(t.updates.find((u) => u.set.billing_issue === "grace")).toBeTruthy();
  });
  it("Play IN_GRACE_PERIOD ⇒ flagged until Google's expiry; ACTIVE ⇒ cleared", async () => {
    const token = "t".repeat(120);
    const t = licencesDb([], { payment_licenses: [{ payment_id: token, user_id: "u1", product_id: "plus_monthly", tier: "plus" }] });
    await sweepPlayRenewals(t.db, { verify: async () => ({ valid: true, state: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", expiresAt: "2026-11-22T00:00:00.000Z" }) });
    expect(t.updates.some((u) => u.set.billing_issue === "grace" && u.set.billing_issue_store === "google_play")).toBe(true);
    const t2 = licencesDb([], { payment_licenses: [{ payment_id: token, user_id: "u1", product_id: "plus_monthly", tier: "plus" }] });
    await sweepPlayRenewals(t2.db, { verify: async () => ({ valid: true, state: "SUBSCRIPTION_STATE_ACTIVE", expiresAt: "2026-12-06T00:00:00.000Z" }) });
    expect(t2.updates.some((u) => u.set.billing_issue === null)).toBe(true);
  });
});

describe("ONE email, never two", () => {
  const graceRow = () => ({ user_id: "u1", billing_issue: "grace", billing_issue_until: "2026-11-22T00:00:00Z", billing_issue_store: "apple", billing_issue_notified_at: null });

  it("sends once, stamps it, and the next day's run sends nothing", async () => {
    const t = licencesDb([graceRow()]);
    const send = vi.fn(async () => true);
    const deps = { emailOf: async () => "person@example.com", send, now: Date.parse("2026-11-07T00:00:00Z") };
    expect((await notifyGraceOnce(t.db, deps)).sent).toBe(1);
    expect((await notifyGraceOnce(t.db, deps)).sent).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("a failed send is NOT stamped — tomorrow tries again", async () => {
    const t = licencesDb([graceRow()]);
    const out = await notifyGraceOnce(t.db, { emailOf: async () => "p@example.com", send: async () => false, now: Date.parse("2026-11-07T00:00:00Z") });
    expect(out.sent).toBe(0);
    expect(t.rows[0].billing_issue_notified_at).toBeNull();
  });
  it("no email address (a guest) ⇒ nothing sent, nothing stamped; the banner still tells them", async () => {
    const t = licencesDb([graceRow()]);
    const send = vi.fn(async () => true);
    await notifyGraceOnce(t.db, { emailOf: async () => null, send, now: Date.parse("2026-11-07T00:00:00Z") });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the words", () => {
  const mail = graceEmail({ kind: "grace", until: "2026-11-22T00:00:00.000Z", store: "apple" });
  it("says what happened, until when, and where to fix it — once", () => {
    expect(mail.subject).toBe("Your Imotara Plus payment didn't go through");
    expect(mail.text).toContain("22 November");
    expect(mail.text.split(MANAGE_URL.apple).length - 1).toBe(1);
    expect((mail.html.match(/<a /g) ?? []).length).toBe(1);
  });
  it("⛔ house style: no images, no 'AI', signed by the team", () => {
    expect(mail.html).not.toMatch(/<img/i);
    expect(mail.text).not.toMatch(/\bAI\b/);
    expect(mail.text).toMatch(/— The Imotara team$/);
  });
  it("the banner names the store and the date", () => {
    expect(billingBannerText("google_play", "2026-11-22T00:00:00.000Z")).toBe(
      "Your last payment for Imotara Plus didn't go through on Google Play. Plus stays on until 22 November — update your payment method to keep it.",
    );
  });
});

describe("wiring", () => {
  it("the licence endpoint returns billingIssue, read fail-soft", () => {
    const src = readFileSync("src/app/api/license/status/route.ts", "utf8");
    expect(src).toMatch(/billingIssue,/);
    expect(src).toMatch(/if \(!bErr\) billingIssue = billingIssueFromRow\(b\)/);
  });
  it("the daily job emails, and the chat page shows the banner", () => {
    expect(readFileSync("src/app/api/cron/store-renewals/route.ts", "utf8")).toMatch(/notifyGraceOnce\(/);
    expect(readFileSync("src/app/chat/page.tsx", "utf8")).toMatch(/<BillingIssueBanner \/>/);
  });
});
