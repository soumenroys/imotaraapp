// src/app/api/license/verify-payment/route.ts
// LIC-5: Called after a Razorpay payment succeeds (mobile direct call or web confirm).
export const maxDuration = 30;
// Verifies the payment with Razorpay, then grants license via grantLicense().
// Auth: Bearer token (mobile) or Supabase cookie (web).
//
// POST { paymentId: string, productId?: string }   (productId is only a cross-check — the ORDER decides)
// → { ok: true, tier: string, tokenBalance: number, expiresAt: string | null }

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import {
    grantLicense,
    PRODUCT_CATALOG,
    type LicenseProductId,
} from "@/lib/imotara/grantLicense";
import { createInvoice, getProductDescription } from "@/lib/imotara/invoiceUtils";
import { claimPayment, releasePayment } from "@/lib/imotara/claimPayment";
import { fetchRzpOrder, licenseFromOrder } from "@/lib/imotara/razorpayOrder";

const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID     ?? "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

type RzpPayment = { id: string; amount: number; status: string; currency: string; order_id?: string | null; notes?: Record<string, string> };

async function fetchRzpPayment(paymentId: string): Promise<RzpPayment | null> {
    if (!RZP_KEY_ID || !RZP_KEY_SECRET) return null;
    const creds = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
    try {
        const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Basic ${creds}` },
        });
        if (!res.ok) return null;
        return res.json() as Promise<RzpPayment>;
    } catch {
        return null;
    }
}

/**
 * Polls Razorpay until the payment is captured (or fails).
 * UPI mandate payments are first "authorized", then auto-captured within seconds.
 * We retry up to 5 times (10s total) before giving up and granting on "authorized".
 */
async function fetchRzpPaymentCaptured(paymentId: string): Promise<RzpPayment | null> {
    const POLL_ATTEMPTS = 5;
    const POLL_DELAY_MS = 2000;
    let payment: RzpPayment | null = null;

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        payment = await fetchRzpPayment(paymentId);
        if (!payment) break;
        if (payment.status === "captured") return payment;
        // "authorized" = bank approved, Razorpay auto-captures shortly (UPI mandate, etc.)
        if (payment.status === "authorized") {
            if (attempt < POLL_ATTEMPTS - 1) {
                await new Promise(r => setTimeout(r, POLL_DELAY_MS));
                continue;
            }
            // #172 (27 Nov 2026): still only authorized ⇒ NOT granted here. An authorization can
            // still be voided; the webhook grants on payment.captured (from the order's notes).
            console.warn(`[verify-payment] payment ${paymentId} still "authorized" after ${POLL_ATTEMPTS} polls — webhook will grant on capture`);
            return payment;
        }
        // Any other status (failed, refunded, etc.) — stop retrying
        break;
    }
    return payment;
}

async function resolveUserId(req: Request): Promise<string | null> {
    const auth = req.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
        const token = auth.slice(7).trim();
        const { data } = await getSupabaseAdmin().auth.getUser(token);
        return data?.user?.id ?? null;
    }
    try {
        const client = await supabaseUserServer();
        const { data } = await client.auth.getUser();
        return data?.user?.id ?? null;
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body      = await req.json().catch(() => ({}));
        const paymentId = String(body?.paymentId ?? "").trim();
        const bodyPid   = String(body?.productId ?? "").trim();

        if (!paymentId) {
            return NextResponse.json({ ok: false, error: "paymentId required" }, { status: 400 });
        }
        // Interpolated unencoded into the Razorpay API URL below — restrict to
        // Razorpay's real payment-ID shape so a crafted value can't redirect
        // the server-to-server request elsewhere in Razorpay's API namespace.
        if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
            return NextResponse.json({ ok: false, error: "Invalid paymentId format" }, { status: 400 });
        }

        // Verify with Razorpay — polls for capture (handles UPI mandate "authorized" delay)
        const payment = await fetchRzpPaymentCaptured(paymentId);

        if (!payment) {
            return NextResponse.json({ ok: false, error: "Payment verification failed" }, { status: 400 });
        }

        // #172 (27 Nov 2026): only a CAPTURED payment is granted here. "authorized" (bank said
        // yes, capture still to come) ⇒ the webhook grants on capture; the page already says
        // "your plan will activate within a minute" for this answer.
        if (payment.status === "authorized") {
            const res = NextResponse.json({ ok: false, pending: true, error: "payment_processing" }, { status: 202 });
            res.headers.set("Cache-Control", "no-store");
            return res;
        }
        if (payment.status !== "captured") {
            return NextResponse.json({ ok: false, error: "Payment not completed" }, { status: 400 });
        }

        // 🔴 #172 (27 Nov 2026): WHAT was bought — and by WHOM — comes from the order our server
        // created (order-intent), never from the browser. The payment must belong to that order,
        // be this caller's, and have paid the order's full amount. ⇒ lib/imotara/razorpayOrder.ts
        const order = await fetchRzpOrder(payment.order_id);
        const decided = licenseFromOrder(order, payment, userId);
        if (!decided.ok) {
            console.warn(`[verify-payment] refused ${paymentId}: ${decided.reason}`);
            return NextResponse.json({ ok: false, error: "This payment can't be used for this plan" }, { status: 400 });
        }
        const productId: LicenseProductId = decided.productId;
        // The page names what it sold; a different name means a tampered request.
        if (bodyPid && bodyPid !== productId) {
            console.warn(`[verify-payment] refused ${paymentId}: body product ${bodyPid} ≠ order product ${productId}`);
            return NextResponse.json({ ok: false, error: "This payment can't be used for this plan" }, { status: 400 });
        }

        const admin = getSupabaseAdmin();

        // 🔴 ONE grant per payment ⇒ lib/imotara/claimPayment.ts (3 grants per payment until 6 Nov 2026).
        const product = PRODUCT_CATALOG[productId as LicenseProductId];
        const claim = await claimPayment(admin, {
            payment_id:   paymentId,
            user_id:      userId,
            product_id:   productId,
            tier:         product.type === "subscription" ? product.tier : "free",
            amount_paise: payment.amount,
            currency:     payment.currency ?? "INR",
        });
        if (claim === "error") {
            return NextResponse.json({ ok: false, error: "Could not record the payment — please retry" }, { status: 503 });
        }

        if (claim === "taken") {
            const { data: lic } = await admin
                .from("licenses")
                .select("tier, token_balance, expires_at")
                .eq("user_id", userId)
                .maybeSingle();
            const res = NextResponse.json({
                ok: true,
                tier:         lic?.tier         ?? "free",
                tokenBalance: lic?.token_balance ?? 0,
                expiresAt:    lic?.expires_at    ?? null,
            });
            res.headers.set("Cache-Control", "no-store");
            return res;
        }


        const result = await grantLicense(userId, productId, admin, "razorpay");

        if (!result.ok) {
            // Nothing was granted ⇒ give the claim back, or the paid retry would be told "already done".
            await releasePayment(admin, paymentId);
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

        // Create invoice (non-blocking)
        createInvoice(admin, {
            userId,
            productId,
            tier:           result.tier,
            description:    getProductDescription(productId),
            paymentGateway: "razorpay",
            gatewayRef:     paymentId,
            amountPaise:    payment.amount,
            currency:       payment.currency ?? "INR",
            periodStart:    new Date().toISOString(),
            periodEnd:      result.expiresAt ?? undefined,
        }).catch((err: unknown) => console.error("[verify-payment] invoice creation failed:", err));

        const res = NextResponse.json({
            ok: true,
            tier:         result.tier,
            tokenBalance: result.tokenBalance,
            expiresAt:    result.expiresAt,
        });
        res.headers.set("Cache-Control", "no-store");
        return res;
    } catch (err: any) {
        if (process.env.NODE_ENV !== "production") console.warn("[verify-payment]", String(err));
        return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
