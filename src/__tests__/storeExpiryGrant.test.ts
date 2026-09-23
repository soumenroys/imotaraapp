/**
 * The store decides when a subscription ends — not our catalog.
 *
 * 🔴 WHY THIS EXISTS. `grantLicense` extended a subscription by `product.days`
 * (31 or 366) taken from PRODUCT_CATALOG. For Apple and Play that is a GUESS
 * about what the store did, and introductory offers make the guess wrong: a
 * 7-day free trial would have granted 31 DAYS of Plus. Cancel on day 2, keep 29
 * free days, once per account, repeatably.
 *
 * It cost nothing until now only because every purchase so far paid full price
 * for the full period, so the two agreed. The offers approved 2026-09-24 are
 * what pull them apart.
 *
 * Both stores were already telling us the truth and both routes discarded it:
 * Play's verifier computed `lineItems[0].expiryTime` and returned it; Apple's
 * parsed the signed JWS (which carries `expiresDate`) and returned only the
 * productId. These tests pin that the value now reaches the RPC.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// ── The RPC argument, which is what actually decides the expiry ──────────────

const rpc = vi.fn();
const admin = { rpc } as any;

vi.mock("@supabase/supabase-js", () => ({}));

beforeEach(() => {
    rpc.mockReset();
    rpc.mockReturnValue({
        single: async () => ({
            data: { out_tier: "plus", out_token_balance: 0, out_expires_at: "2026-10-02T00:00:00.000Z" },
            error: null,
        }),
    });
});

const argsOf = () => rpc.mock.calls[0][1];

describe("grantLicense passes the store's expiry through", () => {
    it("🔴 a store expiry is sent to the RPC, so a trial cannot grant a month", async () => {
        const { grantLicense } = await import("@/lib/imotara/grantLicense");
        const trialEnd = "2026-10-02T00:00:00.000Z"; // 7 days, not 31
        await grantLicense("u1", "plus_monthly", admin, "apple", trialEnd);
        expect(argsOf().p_expires_at).toBe(trialEnd);
    });

    it("🔴 gateway rails are UNCHANGED — no expiry, count the catalog's days", async () => {
        // Razorpay and Stripe have no store. This is the regression guard for
        // the paying users who exist today.
        const { grantLicense } = await import("@/lib/imotara/grantLicense");
        await grantLicense("u1", "plus_monthly", admin, "razorpay");
        expect(argsOf().p_expires_at).toBeNull();
        expect(argsOf().p_days).toBe(31);
    });

    it("the catalog's day count is still sent alongside, as the fallback", async () => {
        const { grantLicense } = await import("@/lib/imotara/grantLicense");
        await grantLicense("u1", "plus_annual", admin, "google_play", "2027-09-25T00:00:00.000Z");
        expect(argsOf().p_days).toBe(366);
    });

    it("a token pack never carries an expiry, whatever the caller passes", async () => {
        const { grantLicense } = await import("@/lib/imotara/grantLicense");
        await grantLicense("u1", "tokens_250", admin, "apple", "2026-10-02T00:00:00.000Z");
        expect(argsOf().p_expires_at).toBeNull();
        expect(argsOf().p_is_subscription).toBe(false);
    });

    it("an explicit null is as good as omitting it", async () => {
        const { grantLicense } = await import("@/lib/imotara/grantLicense");
        await grantLicense("u1", "plus_monthly", admin, "google_play", null);
        expect(argsOf().p_expires_at).toBeNull();
    });
});

// ── The call sites, which is where the value used to be dropped ──────────────

describe("both store routes actually pass it", () => {
    it("🔴 Play's verify route stops discarding lineItems[0].expiryTime", () => {
        const route = read("src/app/api/payments/google-play/verify/route.ts");
        const call = /const result = await grantLicense\([\s\S]{0,300}?\);/.exec(route)?.[0] ?? "";
        expect(call).toContain("verification.expiresAt");
    });

    it("🔴 Apple's verifier returns expiresDate, not just the productId", () => {
        const route = read("src/app/api/license/verify-apple-purchase/route.ts");
        expect(route).toContain("txPayload.expiresDate");
        // Apple sends milliseconds since the epoch; a raw number would be a
        // 1970 date and would expire every subscription instantly.
        expect(route).toMatch(/new Date\(rawExpiry\)\.toISOString\(\)/);
    });

    it("🔴 BOTH Apple grant paths pass it — including the failed-grant recovery", () => {
        // The recovery path runs before the main verification and was the easy
        // one to miss; it would have reintroduced the bug for exactly the users
        // whose first grant had already failed once.
        const route = read("src/app/api/license/verify-apple-purchase/route.ts");
        const calls = route.match(/grantLicense\(\s*\n?[\s\S]{0,260}?\);/g) ?? [];
        expect(calls.length).toBeGreaterThanOrEqual(2);
        for (const c of calls) expect(c).toMatch(/expiresAt/);
    });

    it("Razorpay and Stripe are left alone", () => {
        for (const rel of [
            "src/app/api/payments/razorpay/webhook/route.ts",
            "src/app/api/payments/stripe/webhook/route.ts",
            "src/app/api/license/verify-payment/route.ts",
        ]) {
            for (const c of read(rel).match(/grantLicense\([^;]*\);/g) ?? []) {
                expect(c).not.toMatch(/expiresAt/);
            }
        }
    });
});

// ── The SQL, which is the half that cannot be unit-tested from here ──────────

describe("the migration", () => {
    const sql = read("docs/sql/grant_license_store_expiry.sql");

    it("🔴 never shortens an entitlement the user already holds", () => {
        // Someone on a Razorpay licence until 2027 who starts an Apple trial
        // must not be cut back to the trial's end date.
        expect(sql).toMatch(/GREATEST\(COALESCE\(licenses\.expires_at, now\(\)\), p_expires_at\)/);
    });

    it("🔴 keeps the exact day-counting branch for rails with no store", () => {
        expect(sql).toMatch(/ELSE GREATEST\(COALESCE\(licenses\.expires_at, now\(\)\), now\(\)\) \+ make_interval\(days => p_days\)/);
    });

    it("🔴 the new argument has NO default, so live 6-arg traffic stays unambiguous", () => {
        // A default would make the old call ambiguous between two overloads and
        // Postgres would reject it — breaking grants during the deploy window.
        expect(sql).toMatch(/p_expires_at\s+timestamptz\s+--/);
        expect(sql).not.toMatch(/p_expires_at\s+timestamptz\s+DEFAULT/i);
    });

    it("grants EXECUTE on the new signature", () => {
        expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]{0,160}timestamptz\)\s*\n?\s*TO service_role/);
    });

    it("the old overload is dropped only as a documented step 3, not inline", () => {
        // Dropping it in the same file would break every in-flight request from
        // the currently deployed code.
        const live = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
        expect(live).not.toMatch(/DROP FUNCTION/);
        expect(sql).toMatch(/DROP FUNCTION IF EXISTS/); // present, commented, as the runbook
    });
});
