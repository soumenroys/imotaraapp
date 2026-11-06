// POST /api/license/verify-apple-purchase
// Called after a successful Apple IAP purchase on iOS.
// Auth: Bearer token.
// Body: { productId: string, transactionId: string }
// → { ok, tier, tokenBalance, expiresAt }
//
// Idempotent: re-running with the same transactionId returns current license state.
// Verifies the transaction with Apple App Store Server API before granting.

import { NextResponse } from "next/server";
import { createInvoice, getProductDescription } from "@/lib/imotara/invoiceUtils";
import { verifyAppleTransaction, APPLE_BUNDLE_ID } from "@/lib/apple/storeServer";
import { claimPayment, releasePayment } from "@/lib/imotara/claimPayment";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
    grantLicense,
    isValidProductId,
    PRODUCT_CATALOG,
    type LicenseProductId,
} from "@/lib/imotara/grantLicense";

// ── Auth ──────────────────────────────────────────────────────────────────────

async function resolveUserId(req: Request): Promise<string | null> {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    const { data } = await getSupabaseAdmin().auth.getUser(token);
    // ⛔ A purchase never lands on a GUEST identity (25 Oct 2026) — it vanishes on
    //    reinstall, and the plan with it. Treated as signed out; the app asks them to sign in.
    if (data?.user?.is_anonymous) return null;
    return data?.user?.id ?? null;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const userId = await resolveUserId(req);
        if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const body          = await req.json().catch(() => ({}));
        const productId     = String(body?.productId     ?? "").trim();
        const transactionId = String(body?.transactionId ?? "").trim();

        console.log(`[verify-apple-purchase] userId=${userId} productId=${productId} transactionId=${transactionId}`);

        if (!isValidProductId(productId)) {
            return NextResponse.json({ ok: false, error: "Invalid productId" }, { status: 400 });
        }
        if (!transactionId) {
            return NextResponse.json({ ok: false, error: "transactionId required" }, { status: 400 });
        }

        const admin = getSupabaseAdmin();

        // Idempotency — if this transactionId was already processed, return current license.
        // Also select tier so we can detect a prior failed grantLicense and recover.
        const { data: existingPayment } = await admin
            .from("payment_licenses")
            .select("payment_id, tier, user_id")
            .eq("payment_id", transactionId)
            .maybeSingle();

        // ⛔ 6 Nov 2026: a known transaction re-granted Plus to WHOEVER sent it.
        // It belongs to the account that first redeemed it — say nothing more.
        if (existingPayment && existingPayment.user_id && existingPayment.user_id !== userId) {
            return NextResponse.json({ ok: false, error: "This purchase belongs to another account." }, { status: 409 });
        }

        if (existingPayment) {
            const { data: lic } = await admin
                .from("licenses")
                .select("tier, token_balance, expires_at")
                .eq("user_id", userId)
                .maybeSingle();

            const currentTier = (lic?.tier ?? "free") as string;
            const paymentTier = (existingPayment.tier ?? "free") as string;

            // If the payment was for a subscription tier but the license row still shows
            // "free", the previous grantLicense call must have failed after the payment
            // record was written. Re-run the grant now so the user's purchase is honoured.
            if (paymentTier !== "free" && currentTier === "free") {
                // This runs BEFORE the verification below, so ask Apple for the
                // expiry here too — otherwise the recovery path reintroduces the
                // catalog-days bug (a 7-day trial granted as 31 days) for exactly
                // the users whose first grant already failed once.
                //
                // 🔑 A failure here does NOT block the grant. They have paid and
                // the payment is recorded; Apple being unreachable must not cost
                // them the purchase. Falling back to null restores the previous
                // day-counting behaviour, which is the safe direction.
                const reVerify = await verifyAppleTransaction(transactionId);
                const reGrant = await grantLicense(
                    userId, productId as LicenseProductId, admin, "apple",
                    reVerify.ok ? reVerify.expiresAt : null,
                );
                if (!reGrant.ok) {
                    return NextResponse.json({ ok: false, error: reGrant.error }, { status: 500 });
                }
                const res = NextResponse.json({
                    ok:           true,
                    tier:         reGrant.tier,
                    tokenBalance: reGrant.tokenBalance,
                    expiresAt:    reGrant.expiresAt,
                });
                res.headers.set("Cache-Control", "no-store");
                return res;
            }

            const res = NextResponse.json({
                ok: true,
                tier:         currentTier,
                tokenBalance: lic?.token_balance ?? 0,
                expiresAt:    lic?.expires_at    ?? null,
            });
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        // Verify with Apple App Store Server API.
        // Fail closed if credentials are missing — never silently grant an
        // unverified license (matches the Google Play verify route's behavior).
        const hasAppleCredentials =
            process.env.APPLE_IAP_ISSUER_ID &&
            process.env.APPLE_IAP_KEY_ID &&
            process.env.APPLE_IAP_PRIVATE_KEY;

        if (!hasAppleCredentials) {
            console.error("[verify-apple-purchase] CRITICAL: Apple IAP credentials not configured — refusing to grant an unverified license.");
            return NextResponse.json(
                { ok: false, error: "Apple purchase verification is temporarily unavailable. Please try again shortly or contact support." },
                { status: 503 },
            );
        }

        const verification = await verifyAppleTransaction(transactionId);
        if (!verification.ok) {
            return NextResponse.json(
                { ok: false, error: `Apple verification failed: ${verification.error}` },
                { status: 400 },
            );
        }
        // Confirm Apple's productId matches what the client claimed.
        // App Store Connect stores the full bundle-prefixed SKU (e.g.
        // "com.imotara.imotara.plus_monthly"), but the client sends the
        // short catalog key ("plus_monthly"). Strip the bundle prefix
        // before comparing so both forms match correctly.
        if (verification.appleProductId) {
            const normalizedAppleId = verification.appleProductId.startsWith(`${APPLE_BUNDLE_ID}.`)
                ? verification.appleProductId.slice(`${APPLE_BUNDLE_ID}.`.length)
                : verification.appleProductId;
            if (normalizedAppleId !== productId) {
                return NextResponse.json(
                    { ok: false, error: "productId mismatch with Apple transaction" },
                    { status: 400 },
                );
            }
        }

        // 🔴 ONE grant per transaction ⇒ lib/imotara/claimPayment.ts. This used to
        // ask "seen it?" above and record it here, so two reports of one token
        // pack (purchase listener + restore) arriving together granted twice.
        const product = PRODUCT_CATALOG[productId as LicenseProductId];
        const claim = await claimPayment(admin, {
            payment_id:   transactionId,
            user_id:      userId,
            product_id:   productId,
            tier:         product.type === "subscription" ? product.tier : "free",
            amount_paise: product.paise, // INR paise (App Store pricing set per country by App Store Connect)
            currency:     "INR",         // Indian pricing basis; App Store handles local currency per region
        });
        if (claim === "error") {
            return NextResponse.json({ ok: false, error: "Could not record transaction" }, { status: 503 });
        }
        if (claim === "taken") {
            const { data: lic } = await admin.from("licenses").select("tier, token_balance, expires_at").eq("user_id", userId).maybeSingle();
            const res = NextResponse.json({ ok: true, tier: lic?.tier ?? "free", tokenBalance: lic?.token_balance ?? 0, expiresAt: lic?.expires_at ?? null });
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        // 🔴 Apple's expiry wins over the catalog's day count — see
        // docs/sql/grant_license_store_expiry.sql. Null (a token pack, or a
        // payload without expiresDate) keeps the previous behaviour.
        const result = await grantLicense(
            userId, productId as LicenseProductId, admin, "apple",
            verification.expiresAt,
        );
        if (!result.ok) {
            await releasePayment(admin, transactionId);
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

        // Create invoice record (non-blocking — errors logged)
        createInvoice(admin, {
          userId,
          productId,
          tier:           result.tier,
          description:    getProductDescription(productId),
          paymentGateway: "apple",
          gatewayRef:     transactionId as string,
          amountPaise:    0, // Apple IAP amount not available server-side
          currency:       "USD",
          periodStart:    new Date().toISOString(),
          periodEnd:      result.expiresAt ?? undefined,
        }).catch((err: unknown) => console.error("[apple-iap] invoice creation failed:", err));

        const res = NextResponse.json({
            ok:           true,
            tier:         result.tier,
            tokenBalance: result.tokenBalance,
            expiresAt:    result.expiresAt,
        });
        res.headers.set("Cache-Control", "no-store");
        return res;
    } catch (err: any) {
        console.error("[verify-apple-purchase]", String(err));
        return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
