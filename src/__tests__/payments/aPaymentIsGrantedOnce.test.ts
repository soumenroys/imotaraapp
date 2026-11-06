// src/__tests__/payments/aPaymentIsGrantedOnce.test.ts
//
// 🔴 6 Nov 2026: every Razorpay payment was granted THREE times (₹149 ⇒ 3
// months of Plus) and invoiced three times; and an Android subscription could
// never be renewed. ⇒ lib/imotara/claimPayment.ts, invoiceUtils, playRenewal.
//
// The fake below is a tiny Postgres: payment_id is a PRIMARY KEY and the
// invoice (gateway, ref) pair is UNIQUE, exactly as the live tables are — so
// the race is settled the way the database settles it.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const grants: { user: string; product: string; expiry: string | null | undefined }[] = [];
vi.mock("@/lib/imotara/grantLicense", () => ({
  PRODUCT_CATALOG: { plus_monthly: { type: "subscription", tier: "plus", days: 30, paise: 14900 }, tokens_100: { type: "tokens", tokens: 100, paise: 4900 } },
  grantLicense: vi.fn(async (user: string, product: string, _db: unknown, _src: string, expiry?: string | null) => {
    grants.push({ user, product, expiry });
    return { ok: true, tier: "plus", tokenBalance: 0, expiresAt: expiry ?? null };
  }),
}));

import { claimPayment, releasePayment } from "@/lib/imotara/claimPayment";
import { createInvoice } from "@/lib/imotara/invoiceUtils";
import { sweepPlayRenewals, renewPlaySubscription } from "@/lib/imotara/playRenewal";

type Row = Record<string, unknown>;
function fakeDb() {
  const tables: Record<string, Row[]> = { payment_licenses: [], payment_invoices: [] };
  let n = 0;
  function from(table: string) {
    const rows = tables[table];
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: string; value?: Row; ignore?: boolean } = { kind: "select" };
    const q: Record<string, unknown> = {};
    const run = () => {
      if (op.kind === "upsert" || op.kind === "insert") {
        const v = op.value!;
        const clash =
          table === "payment_licenses"
            ? rows.find((r) => r.payment_id === v.payment_id)
            : rows.find((r) => r.payment_gateway === v.payment_gateway && r.gateway_ref === v.gateway_ref);
        if (clash) return op.ignore ? { data: [], error: null } : { data: null, error: { code: "23505", message: "duplicate key" } };
        const row = { id: `id${++n}`, invoice_number: `INV-${n}`, issued_at: new Date(Date.now() + n).toISOString(), ...v };
        rows.push(row);
        return { data: [row], error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op.kind === "delete") {
        for (const r of hit) rows.splice(rows.indexOf(r), 1);
        return { data: null, error: null };
      }
      return { data: hit, error: null };
    };
    Object.assign(q, {
      select: () => q,
      upsert: (value: Row, o: { ignoreDuplicates?: boolean }) => ((op = { kind: "upsert", value, ignore: o?.ignoreDuplicates }), q),
      insert: (value: Row) => ((op = { kind: "insert", value }), q),
      delete: () => ((op = { kind: "delete" }), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      not: (k: string, _op: string, pat: string) => {
        const prefix = pat.replace(/\\_%$/, "_").replace(/%$/, "");
        filters.push((r) => !String(r[k]).startsWith(prefix));
        return q;
      },
      order: () => q,
      limit: () => q,
      maybeSingle: async () => { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
      single: async () => { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    });
    return q;
  }
  return { db: { from } as never, tables };
}

const PAY = { payment_id: "pay_TtgciSxOM0", user_id: "u1", product_id: "plus_monthly", tier: "plus", amount_paise: 14900, currency: "INR" };
const TOKEN = "t".repeat(120); // a Play purchase token is a long opaque string

beforeEach(() => { grants.length = 0; });

describe("one claim per payment", () => {
  it("three reports of one payment, at once ⇒ exactly ONE winner", async () => {
    const { db } = fakeDb();
    const out = await Promise.all([claimPayment(db, PAY), claimPayment(db, PAY), claimPayment(db, PAY)]);
    expect(out.filter((x) => x === "won")).toHaveLength(1);
    expect(out.filter((x) => x === "taken")).toHaveLength(2);
  });

  it("a released claim can be won again (a failed grant must stay retryable)", async () => {
    const { db } = fakeDb();
    expect(await claimPayment(db, PAY)).toBe("won");
    await releasePayment(db, PAY.payment_id);
    expect(await claimPayment(db, PAY)).toBe("won");
  });

  it("a database that does not answer is an ERROR, never a win", async () => {
    const broken = { from: () => ({ upsert: () => ({ select: async () => ({ data: null, error: { message: "down" } }) }) }) } as never;
    expect(await claimPayment(broken, PAY)).toBe("error");
  });
});

describe("one invoice per payment", () => {
  it("the same payment invoiced three times ⇒ one row, the same number every time", async () => {
    const { db, tables } = fakeDb();
    const inv = { userId: "u1", productId: "plus_monthly", description: "Plus", paymentGateway: "razorpay" as const, gatewayRef: "pay_X", amountPaise: 14900, currency: "INR" };
    const a = await createInvoice(db, inv);
    const b = await createInvoice(db, inv);
    const c = await createInvoice(db, inv);
    expect(tables.payment_invoices).toHaveLength(1);
    expect(b?.invoiceNumber).toBe(a?.invoiceNumber);
    expect(c?.invoiceNumber).toBe(a?.invoiceNumber);
  });

  it("a different payment still gets its own invoice", async () => {
    const { db, tables } = fakeDb();
    const base = { userId: "u1", productId: "plus_monthly", description: "Plus", paymentGateway: "razorpay" as const, amountPaise: 14900, currency: "INR" };
    await createInvoice(db, { ...base, gatewayRef: "pay_A" });
    await createInvoice(db, { ...base, gatewayRef: "pay_B" });
    expect(tables.payment_invoices).toHaveLength(2);
  });
});

describe("Play renewals", () => {
  it("the sweep extends an active subscription to GOOGLE'S expiry, for the token's owner", async () => {
    const { db, tables } = fakeDb();
    tables.payment_licenses.push({ payment_id: TOKEN, user_id: "owner", product_id: "plus_monthly", tier: "plus" });
    const out = await sweepPlayRenewals(db, { verify: async () => ({ valid: true, expiresAt: "2027-01-06T00:00:00.000Z", orderId: "GPA.1-1..1" }) });
    expect(out).toMatchObject({ checked: 1, extended: 1 });
    expect(grants).toEqual([{ user: "owner", product: "plus_monthly", expiry: "2027-01-06T00:00:00.000Z" }]);
    expect(tables.payment_invoices).toHaveLength(1);
  });

  it("a lapsed subscription is left alone — never extended, never cut short", async () => {
    const { db, tables } = fakeDb();
    tables.payment_licenses.push({ payment_id: TOKEN, user_id: "owner", product_id: "plus_monthly", tier: "plus" });
    const out = await sweepPlayRenewals(db, { verify: async () => ({ valid: false }) });
    expect(out.extended).toBe(0);
    expect(grants).toHaveLength(0);
  });

  it("Razorpay and Apple rows are not sent to Google", async () => {
    const { db, tables } = fakeDb();
    tables.payment_licenses.push(
      { payment_id: "pay_ABC", user_id: "u", product_id: "plus_monthly", tier: "plus" },
      { payment_id: "2000000912345678", user_id: "u", product_id: "plus_monthly", tier: "plus" },
      { payment_id: TOKEN, user_id: "u", product_id: "plus_monthly", tier: "pending" },
    );
    const verify = vi.fn(async () => ({ valid: true, expiresAt: "2027-01-01T00:00:00Z" }));
    const out = await sweepPlayRenewals(db, { verify });
    expect(out.checked).toBe(0);
    expect(verify).not.toHaveBeenCalled();
  });

  it("⛔ someone else posting the owner's token extends NOTHING", async () => {
    const { db, tables } = fakeDb();
    tables.payment_licenses.push({ payment_id: TOKEN, user_id: "owner", product_id: "plus_monthly", tier: "plus" });
    const res = await renewPlaySubscription(db, "stranger", "plus_monthly" as never, TOKEN, { valid: true, expiresAt: "2027-01-06T00:00:00Z" });
    expect(res.status).toBe(409);
    expect(grants).toHaveLength(0);
  });

  it("the owner re-sending their token after a renewal IS extended", async () => {
    const { db, tables } = fakeDb();
    tables.payment_licenses.push({ payment_id: TOKEN, user_id: "owner", product_id: "plus_monthly", tier: "plus" });
    const res = await renewPlaySubscription(db, "owner", "plus_monthly" as never, TOKEN, { valid: true, expiresAt: "2027-01-06T00:00:00Z" });
    expect(res.status).toBe(200);
    expect(grants).toHaveLength(1);
  });
});

describe("the routes use the claim — and nothing asks-then-grants any more", () => {
  const src = (p: string) => readFileSync(p, "utf8");
  it.each([
    "src/app/api/license/verify-payment/route.ts",
    "src/app/api/payments/razorpay/webhook/route.ts",
    "src/app/api/payments/google-play/verify/route.ts",
  ])("%s claims before it grants, and releases on a failed grant", (p) => {
    const s = src(p);
    expect(s).toMatch(/claimPayment\(/);
    expect(s).toMatch(/releasePayment\(/);
    const licenceBranch = p.includes("webhook") ? s.slice(s.indexOf('purpose === "imotara_license"')) : s;
    expect(licenceBranch.indexOf("await claimPayment(")).toBeGreaterThan(-1);
    expect(licenceBranch.indexOf("await claimPayment(")).toBeLessThan(licenceBranch.indexOf("await grantLicense("));
  });

  it("the Play route treats a known SUBSCRIPTION token as a renewal, not 'already processed'", () => {
    const s = src("src/app/api/payments/google-play/verify/route.ts");
    expect(s).toMatch(/if \(!isSubscription\) return NextResponse\.json\(\{ ok: true, message: "already_processed" \}\)/);
    expect(s).toMatch(/renewPlaySubscription\(/);
  });
});
