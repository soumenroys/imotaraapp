// src/__tests__/payments/paymentsCannotBeForged.test.ts
//
// #172 security review (owner, 27 Nov 2026): "also check whether any vulnerabilities are there in
// payment gateway integration". Each block below is a hole that was open, and fails if it reopens.
//
//   1. web: the browser named the product and the amount was never checked ⇒ ₹49 bought Plus annual
//   2. web: a merely "authorized" payment was granted
//   3. webhook: notes the PAYER sets at checkout were believed (donation ⇒ corporate org / Plus)
//   4. Apple / Play: ids not format-checked ⇒ one purchase redeemable again and again
//   5. Apple: free sandbox credit packs unlimited; refunded purchases honoured
//   6. Play: a PENDING payment (UPI) answered "invalid" ⇒ paid-but-Free
//   7. Stripe: a repeated event stacked another grant
//   8. raw gateway errors shown to the person

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

const src = (p: string) => readFileSync(p, "utf8");

// ── Shared fakes ──────────────────────────────────────────────────────────────

const grants: { user: string; product: string }[] = [];
vi.mock("@/lib/imotara/grantLicense", () => {
    const PRODUCT_CATALOG = {
        plus_monthly: { type: "subscription", tier: "plus", days: 31, paise: 14900 },
        plus_annual:  { type: "subscription", tier: "plus", days: 366, paise: 149900 },
        tokens_100:   { type: "tokens", tokens: 100, paise: 4900 },
    };
    return {
        PRODUCT_CATALOG,
        isValidProductId: (id: string) => Object.prototype.hasOwnProperty.call(PRODUCT_CATALOG, id),
        grantLicense: vi.fn(async (user: string, product: string) => {
            grants.push({ user, product });
            return { ok: true, tier: "plus", tokenBalance: 0, expiresAt: null };
        }),
    };
});
vi.mock("@/lib/imotara/claimPayment", () => ({
    claimPayment: vi.fn(async () => "won"),
    releasePayment: vi.fn(async () => {}),
}));
vi.mock("@/lib/imotara/invoiceUtils", () => ({
    createInvoice: vi.fn(async () => ({})),
    getProductDescription: () => "Imotara Plus",
}));
let caller: { id: string; is_anonymous?: boolean } | null = { id: "u1" };
vi.mock("@/lib/supabaseServer", () => ({
    getSupabaseAdmin: () => ({
        auth: { getUser: async () => ({ data: { user: caller } }) },
        from: () => {
            const q: Record<string, unknown> = {};
            Object.assign(q, {
                select: () => q, eq: () => q, like: () => q, gte: () => q, update: () => q,
                maybeSingle: async () => ({ data: null, error: null }),
                then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(r),
            });
            return q;
        },
    }),
}));
vi.mock("@/lib/supabase/userServer", () => ({ supabaseUserServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));

import { licenseFromOrder, paymentMatchesOrder, orderNotes } from "@/lib/imotara/razorpayOrder";

const ORDER = { id: "order_A1", amount: 149900, currency: "INR", notes: { purpose: "imotara_license", productId: "plus_annual", userId: "u1" } };
const PAID = { id: "pay_P1", order_id: "order_A1", amount: 149900, currency: "INR", status: "captured" };

// ── 1–2: what a Razorpay payment buys is decided by the ORDER ────────────────

describe("licenseFromOrder — the order our server made decides, never the browser", () => {
    it("accepts the buyer's own, fully paid licence order", () => {
        expect(licenseFromOrder(ORDER, PAID, "u1")).toEqual({ ok: true, productId: "plus_annual", userId: "u1" });
    });
    it("⛔ a payment for a DIFFERENT (cheaper) order cannot buy this plan", () => {
        expect(licenseFromOrder(ORDER, { ...PAID, order_id: "order_CHEAP", amount: 4900 }, "u1")).toMatchObject({ ok: false, reason: "amount_mismatch" });
    });
    it("⛔ less money than the order asked for", () => {
        expect(licenseFromOrder(ORDER, { ...PAID, amount: 4900 }, "u1")).toMatchObject({ ok: false });
        expect(licenseFromOrder(ORDER, { ...PAID, currency: "USD" }, "u1")).toMatchObject({ ok: false });
    });
    it("⛔ someone else's order", () => {
        expect(licenseFromOrder(ORDER, PAID, "u2")).toMatchObject({ ok: false, reason: "other_buyer" });
    });
    it("⛔ a donation / Connect recharge / corporate order is not a licence", () => {
        for (const purpose of ["imotara_donation", "imotara_corporate", "", undefined]) {
            expect(licenseFromOrder({ ...ORDER, notes: { ...ORDER.notes, purpose } as never }, PAID, "u1").ok).toBe(false);
        }
    });
    it("⛔ an order with no buyer or an unknown product", () => {
        expect(licenseFromOrder({ ...ORDER, notes: { purpose: "imotara_license", productId: "plus_annual" } }, PAID, "u1")).toMatchObject({ reason: "no_buyer" });
        expect(licenseFromOrder({ ...ORDER, notes: { ...ORDER.notes, productId: "gold_forever" } }, PAID, "u1")).toMatchObject({ reason: "unknown_product" });
    });
    it("Razorpay's '[]' for no notes is read as no notes", () => {
        expect(orderNotes({ ...ORDER, notes: [] })).toEqual({});
        expect(paymentMatchesOrder(null, ORDER)).toBe(false);
    });
});

describe("verify-payment (the route)", () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        grants.length = 0;
        caller = { id: "u1" };
        vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_x");
        vi.stubEnv("RAZORPAY_KEY_SECRET", "s");
        vi.resetModules();
    });
    afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

    const route = async (payment: Record<string, unknown>, order: Record<string, unknown> | null, body: Record<string, unknown>) => {
        fetchMock = vi.fn(async (url: string) => {
            if (url.includes("/v1/payments/")) return new Response(JSON.stringify(payment), { status: 200 });
            if (url.includes("/v1/orders/")) return order ? new Response(JSON.stringify(order), { status: 200 }) : new Response("{}", { status: 404 });
            return new Response("{}", { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);
        const { POST } = await import("@/app/api/license/verify-payment/route");
        const req = new Request("https://x.test/api/license/verify-payment", {
            method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body),
        });
        return POST(req);
    };

    it("⛔ THE ATTACK: pay ₹49 for a credit pack, then name plus_annual ⇒ refused, nothing granted", async () => {
        const cheapOrder = { id: "order_C", amount: 4900, currency: "INR", notes: { purpose: "imotara_license", productId: "tokens_100", userId: "u1" } };
        const res = await route({ id: "pay_C1", order_id: "order_C", amount: 4900, currency: "INR", status: "captured" }, cheapOrder, { paymentId: "pay_C1", productId: "plus_annual" });
        expect(res.status).toBe(400);
        expect(grants).toEqual([]);
    });
    it("⛔ a ₹1 donation payment cannot be turned into Plus", async () => {
        const donation = { id: "order_D", amount: 100, currency: "INR", notes: { purpose: "imotara_donation" } };
        const res = await route({ id: "pay_D1", order_id: "order_D", amount: 100, currency: "INR", status: "captured" }, donation, { paymentId: "pay_D1", productId: "plus_monthly" });
        expect(res.status).toBe(400);
        expect(grants).toEqual([]);
    });
    it("⛔ another person's payment cannot be claimed", async () => {
        const res = await route(PAID, { ...ORDER, notes: { ...ORDER.notes, userId: "someone-else" } }, { paymentId: "pay_P1" });
        expect(res.status).toBe(400);
        expect(grants).toEqual([]);
    });
    it("⛔ only 'authorized' (not captured) ⇒ 202 'processing', nothing granted here", async () => {
        vi.useFakeTimers();
        const p = route({ ...PAID, status: "authorized" }, ORDER, { paymentId: "pay_P1", productId: "plus_annual" });
        await vi.runAllTimersAsync();
        const res = await p;
        vi.useRealTimers();
        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ ok: false, pending: true });
        expect(grants).toEqual([]);
    });
    it("✅ the honest purchase is granted — the ORDER's product", async () => {
        const res = await route(PAID, ORDER, { paymentId: "pay_P1", productId: "plus_annual" });
        expect(res.status).toBe(200);
        expect(grants).toEqual([{ user: "u1", product: "plus_annual" }]);
    });
    it("✅ an older page that sends no productId still works", async () => {
        const res = await route(PAID, ORDER, { paymentId: "pay_P1" });
        expect(res.status).toBe(200);
        expect(grants).toEqual([{ user: "u1", product: "plus_annual" }]);
    });
    it("⛔ the order cannot be read ⇒ not granted", async () => {
        const res = await route(PAID, null, { paymentId: "pay_P1" });
        expect(res.status).toBe(400);
        expect(grants).toEqual([]);
    });
});

// ── 3: the webhook reads the ORDER's notes only ──────────────────────────────

describe("razorpay webhook — payer-set notes are never believed", () => {
    const wh = src("src/app/api/payments/razorpay/webhook/route.ts");
    it("notes come from the order (fetched when the event lacks it), never from the payment", () => {
        expect(wh).toMatch(/const notes = orderNotes\(order\);/);
        expect(wh).not.toMatch(/paymentNotes\?\.productId \|\| paymentNotes\?\.purpose/);
        expect(wh).toMatch(/order = await fetchRzpOrder\(paymentOrderId\);/);
        expect(wh).toMatch(/if \(!order\) return NextResponse\.json\(\{ ok: false, error: "order lookup failed" \}, \{ status: 503 \}\);/);
    });
    it("licence and corporate grants require the payment to match its order", () => {
        expect(wh).toMatch(/const paidInFull = paymentMatchesOrder\(paymentEntity, order\);/);
        expect(wh).toMatch(/purpose === "imotara_corporate" && userId && !paidInFull/);
        expect(wh).toMatch(/purpose === "imotara_license" && isValidProductId\(productId\) && userId && !paidInFull/);
        // the not-paid branches come FIRST, so the granting branches only run when paid in full
        expect(wh.indexOf('purpose === "imotara_corporate" && userId && !paidInFull')).toBeLessThan(wh.indexOf('} else if (purpose === "imotara_corporate" && userId) {'));
        expect(wh.indexOf('isValidProductId(productId) && userId && !paidInFull')).toBeLessThan(wh.indexOf('} else if (purpose === "imotara_license" && isValidProductId(productId) && userId) {'));
    });
});

// ── 4–5: Apple ───────────────────────────────────────────────────────────────

describe("Apple purchases", () => {
    it("transaction ids are digits only — suffix tricks are refused before Apple is asked", async () => {
        const { APPLE_TRANSACTION_ID } = await import("@/lib/apple/storeServer");
        expect(APPLE_TRANSACTION_ID.test("2000001176663118")).toBe(true);
        for (const bad of ["2000001176663118#1", "x/../2000001176663118", "2000001176663118?a=1", "2000001176663118%23", "", "abc"]) {
            expect(APPLE_TRANSACTION_ID.test(bad)).toBe(false);
        }
    });
    const apple = src("src/app/api/license/verify-apple-purchase/route.ts");
    const store = src("src/lib/apple/storeServer.ts");
    it("the route refuses a malformed id, and the helper checks it too", () => {
        expect(apple).toMatch(/if \(!APPLE_TRANSACTION_ID\.test\(transactionId\)\) \{/);
        expect(store).toMatch(/if \(!APPLE_TRANSACTION_ID\.test\(transactionId\)\) return \{ ok: false, error: "Invalid transaction id" \};/);
    });
    it("Apple's signed payload must be THIS transaction of THIS app; refunds are refused", () => {
        expect(store).toMatch(/if \(signedId !== transactionId\) return \{ ok: false, error: "Transaction id mismatch" \};/);
        expect(store).toMatch(/if \(String\(txPayload\.bundleId \?\? ""\) !== APPLE_BUNDLE_ID\) return \{ ok: false, error: "Wrong app" \};/);
        expect(store).toMatch(/revoked: txPayload\.revocationDate != null,/);
        expect(apple).toMatch(/if \(verification\.revoked\) \{/);
        expect(apple).toMatch(/if \(reVerify\.ok && reVerify\.revoked\) \{/);
    });
    it("free test-store (sandbox) credit packs: at most one per account per day, marked SANDBOX", () => {
        expect(apple).toMatch(/const isSandbox = verification\.environment === "sandbox";/);
        expect(apple).toMatch(/if \(isSandbox && product\.type !== "subscription"\) \{/);
        expect(apple).toMatch(/\.eq\("currency", SANDBOX_CURRENCY\)/);
        expect(apple).toMatch(/currency:\s+isSandbox \? SANDBOX_CURRENCY : "INR",/);
    });
    it("the recovery path grants the RECORDED product, not the one the request names", () => {
        expect(apple).toMatch(/const recordedProduct = String\(existingPayment\.product_id \?\? ""\);/);
        expect(apple).toMatch(/userId, recordedProduct as LicenseProductId, admin, "apple",/);
    });
    it("no transaction id next to the person in the logs; Apple's error text not shown to them", () => {
        expect(apple).not.toMatch(/userId=\$\{userId\}.*transactionId=\$\{transactionId\}/);
        expect(apple).not.toMatch(/Apple verification failed: \$\{verification\.error\}/);
    });
});

// ── 4 + 6: Google Play ───────────────────────────────────────────────────────

describe("Google Play purchases", () => {
    it("purchase tokens are URL-safe text only", async () => {
        const { PLAY_PURCHASE_TOKEN } = await import("@/lib/googlePlay");
        expect(PLAY_PURCHASE_TOKEN.test("bgpnjdcfepfffikgkepdkpcf.AO-J1Oxfb0OfWxvGpbTlEwKfRY7oDEGuAQyyGcehY3Rnsyy")).toBe(true);
        for (const bad of ["tok#1".padEnd(30, "x"), "a/../b".padEnd(30, "x"), "a?b=c".padEnd(30, "x"), "a%2F".padEnd(30, "x"), "short"]) {
            expect(PLAY_PURCHASE_TOKEN.test(bad)).toBe(false);
        }
    });
    const gp = src("src/lib/googlePlay.ts");
    const route = src("src/app/api/payments/google-play/verify/route.ts");
    it("both Google checks refuse a malformed token before calling Google", () => {
        expect(gp.match(/if \(!PLAY_PURCHASE_TOKEN\.test\(purchaseToken\)\) return \{ valid: false, error: "Invalid purchase token" \};/g)?.length).toBe(2);
        expect(route).toMatch(/!PLAY_PURCHASE_TOKEN\.test\(purchaseToken\)/);
    });
    it("a subscription token must be FOR the claimed product", () => {
        expect(gp).toMatch(/if \(!items\.some\(\(li\) => li\?\.productId === productId\)\) \{/);
    });
    it("PENDING (UPI still completing) ⇒ 202 pending, not 'invalid'", () => {
        expect(gp).toMatch(/pending:\s+state === "SUBSCRIPTION_STATE_PENDING",/);
        expect(gp).toMatch(/pending: data\.purchaseState === 2,/);
        expect(route).toMatch(/if \(verification\.pending\) \{\s*return NextResponse\.json\(\{ ok: false, pending: true, error: "payment_pending" \}, \{ status: 202 \}\);/);
        // pending is decided BEFORE invalid
        expect(route.indexOf("if (verification.pending)")).toBeLessThan(route.indexOf("if (!verification.valid)"));
    });
});

// ── 7: Stripe ────────────────────────────────────────────────────────────────

describe("Stripe — one grant per payment / invoice", () => {
    const st = src("src/app/api/payments/stripe/webhook/route.ts");
    it("claims before granting, on both paths, and gives the claim back on failure", () => {
        expect(st).toMatch(/const piClaim = await claimPayment\(admin, \{\s*payment_id: pi\.id,/);
        expect(st).toMatch(/if \(piClaim === "taken"\) break;/);
        expect(st).toMatch(/const invClaim = await claimPayment\(admin, \{\s*payment_id: inv\.id,/);
        expect(st).toMatch(/if \(invClaim === "taken"\) break;/);
        expect(st.match(/await releasePayment\(admin, (pi|inv)\.id\)/g)?.length).toBe(2);
        expect(st.indexOf("const piClaim")).toBeLessThan(st.indexOf('const result = await grantLicense(userId, productId as LicenseProductId, admin, "stripe");'));
    });
});

// ── 8: raw gateway errors ────────────────────────────────────────────────────

describe("gateway error text stays in our logs", () => {
    it("order-intent", () => {
        const oi = src("src/app/api/license/order-intent/route.ts");
        expect(oi).not.toMatch(/error: err\?\.message \?\? "Server error"/);
        expect(oi).toMatch(/console\.error\("\[order-intent\]", String\(err\)\);/);
    });
    it("google-play/verify", () => {
        expect(src("src/app/api/payments/google-play/verify/route.ts")).not.toMatch(/error: verification\.error \?\? "Purchase not valid"/);
    });
});
