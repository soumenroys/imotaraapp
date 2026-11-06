// src/__tests__/payments/iphoneRenewalsAreKept.test.ts
// 🔴 6 Nov 2026: an iPhone subscriber would have dropped to Free after the
// first period (a renewal's NEW transaction id reached us only if they opened
// the upgrade sheet), and a known transaction id re-granted Plus to whoever sent it.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const grants: { user: string; product: string; source: string; expiry: unknown }[] = [];
vi.mock("@/lib/imotara/grantLicense", () => ({
  PRODUCT_CATALOG: { plus_monthly: { type: "subscription", tier: "plus", days: 30, paise: 14900 } },
  grantLicense: vi.fn(async (user: string, product: string, _db: unknown, source: string, expiry?: string | null) => {
    grants.push({ user, product, source, expiry });
    return { ok: true, tier: "plus", tokenBalance: 0, expiresAt: expiry ?? null };
  }),
}));

import { latestActiveExpiry } from "@/lib/apple/storeServer";
import { sweepAppleRenewals } from "@/lib/imotara/playRenewal";

const jws = (p: object) => `h.${Buffer.from(JSON.stringify(p)).toString("base64url")}.s`;
const yes = () => true;

describe("Apple's answer: the latest ACTIVE expiry", () => {
  it("active (1) and grace (4) count; the latest wins", () => {
    const body = { data: [{ lastTransactions: [
      { status: 1, signedTransactionInfo: jws({ expiresDate: Date.parse("2026-12-06T00:00:00Z") }) },
      { status: 4, signedTransactionInfo: jws({ expiresDate: Date.parse("2026-12-20T00:00:00Z") }) },
    ] }] };
    expect(latestActiveExpiry(body, yes)).toBe("2026-12-20T00:00:00.000Z");
  });
  it("expired (2), billing retry (3), revoked (5) ⇒ null — never extended", () => {
    const body = { data: [{ lastTransactions: [2, 3, 5].map((status) => ({ status, signedTransactionInfo: jws({ expiresDate: Date.parse("2027-01-01T00:00:00Z") }) })) }] };
    expect(latestActiveExpiry(body, yes)).toBeNull();
  });
  it("⛔ an entry whose signature fails is ignored", () => {
    const body = { data: [{ lastTransactions: [{ status: 1, signedTransactionInfo: jws({ expiresDate: Date.parse("2027-01-01T00:00:00Z") }) }] }] };
    expect(latestActiveExpiry(body, () => false)).toBeNull();
  });
});

function fakeDb(rows: Record<string, unknown>[]) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in", "neq"]) b[m] = () => b;
  b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res);
  return { from: () => b } as never;
}

beforeEach(() => { grants.length = 0; });

describe("the daily sweep keeps iPhone subscribers", () => {
  it("an active subscription is extended to APPLE'S expiry, for its owner, as an Apple grant", async () => {
    const db = fakeDb([{ payment_id: "2000000912345678", user_id: "owner", product_id: "plus_monthly", tier: "plus" }]);
    const out = await sweepAppleRenewals(db, { expiry: async () => ({ ok: true, expiresAt: "2026-12-06T00:00:00.000Z" }) });
    expect(out).toMatchObject({ checked: 1, extended: 1 });
    expect(grants).toEqual([{ user: "owner", product: "plus_monthly", source: "apple", expiry: "2026-12-06T00:00:00.000Z" }]);
  });
  it("a lapsed one is left alone", async () => {
    const db = fakeDb([{ payment_id: "2000000912345678", user_id: "owner", product_id: "plus_monthly", tier: "plus" }]);
    await sweepAppleRenewals(db, { expiry: async () => ({ ok: true, expiresAt: null }) });
    expect(grants).toHaveLength(0);
  });
  it("Razorpay and Play rows are not sent to Apple; one call per person + product", async () => {
    const expiry = vi.fn(async () => ({ ok: true as const, expiresAt: null }));
    const db = fakeDb([
      { payment_id: "pay_ABC", user_id: "u", product_id: "plus_monthly", tier: "plus" },
      { payment_id: "x".repeat(120), user_id: "u", product_id: "plus_monthly", tier: "plus" },
      { payment_id: "2000000000000001", user_id: "u", product_id: "plus_monthly", tier: "plus" },
      { payment_id: "2000000000000002", user_id: "u", product_id: "plus_monthly", tier: "plus" },
    ]);
    const out = await sweepAppleRenewals(db, { expiry });
    expect(out.checked).toBe(1);
    expect(expiry).toHaveBeenCalledTimes(1);
  });
});

describe("the Apple purchase route", () => {
  const src = readFileSync("src/app/api/license/verify-apple-purchase/route.ts", "utf8");
  it("⛔ a known transaction from ANOTHER account is refused before anything is granted", () => {
    const refuse = src.indexOf("existingPayment.user_id !== userId");
    expect(refuse).toBeGreaterThan(-1);
    expect(refuse).toBeLessThan(src.indexOf("await grantLicense("));
  });
  it("claims once before granting, and releases on a failed grant", () => {
    expect(src.indexOf("await claimPayment(")).toBeGreaterThan(-1);
    expect(src.indexOf("await claimPayment(")).toBeLessThan(src.lastIndexOf("await grantLicense("));
    expect(src).toMatch(/releasePayment\(admin, transactionId\)/);
  });
  it("the daily job asks Apple too", () => {
    expect(readFileSync("src/app/api/cron/store-renewals/route.ts", "utf8")).toMatch(/sweepAppleRenewals\(/);
  });
});
