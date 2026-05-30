// src/app/api/license/verify-payment/route.ts
// LIC-5: Called after a Razorpay payment succeeds (mobile direct call or web confirm).
// Verifies the payment with Razorpay, then grants license via grantLicense().
// Auth: Bearer token (mobile) or Supabase cookie (web).
//
// POST { paymentId: string, productId?: string }
// → { ok: true, tier: string, tokenBalance: number, expiresAt: string | null }

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import {
    grantLicense,
    isValidProductId,
    PRODUCT_CATALOG,
    type LicenseProductId,
} from "@/lib/imotara/grantLicense";

const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID     ?? "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

type RzpPayment = { id: string; amount: number; status: string; currency: string; notes?: Record<string, string> };

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
            // Still authorized after all retries — grant license anyway.
            // The webhook will fire payment.captured within seconds and is idempotent.
            console.warn(`[verify-payment] payment ${paymentId} still "authorized" after ${POLL_ATTEMPTS} polls — granting license; webhook will confirm`);
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

/** Derive productId from Razorpay payment amount as a best-effort fallback. */
function inferProductId(amountPaise: number, notes?: Record<string, string>): LicenseProductId | null {
    // Prefer explicit notes field set at order creation
    const fromNotes = String(notes?.productId ?? "").trim();
    if (isValidProductId(fromNotes)) return fromNotes;

    // Amount-based fallback (backward compat with older clients)
    for (const [id, def] of Object.entries(PRODUCT_CATALOG)) {
        if (def.paise === amountPaise) return id as LicenseProductId;
    }
    return null;
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

        // Verify with Razorpay — polls for capture (handles UPI mandate "authorized" delay)
        const payment = await fetchRzpPaymentCaptured(paymentId);

        if (!payment && process.env.NODE_ENV === "production") {
            return NextResponse.json({ ok: false, error: "Payment verification failed" }, { status: 400 });
        }

        // Accept "captured" (normal) or "authorized" (UPI mandate pre-capture).
        // Reject everything else: failed, refunded, expired.
        if (payment && payment.status !== "captured" && payment.status !== "authorized") {
            return NextResponse.json({ ok: false, error: `Payment not completed (status: ${payment.status})` }, { status: 400 });
        }

        // Resolve productId (body → payment notes → amount-based fallback)
        const productId: LicenseProductId | null =
            isValidProductId(bodyPid)
                ? (bodyPid as LicenseProductId)
                : inferProductId(payment?.amount ?? 0, payment?.notes);

        if (!productId) {
            return NextResponse.json({ ok: false, error: "Could not resolve product" }, { status: 400 });
        }

        const admin = getSupabaseAdmin();

        // Idempotency — if this paymentId was already processed, return current license
        const { data: existingPayment } = await admin
            .from("payment_licenses")
            .select("payment_id")
            .eq("payment_id", paymentId)
            .maybeSingle();

        if (existingPayment) {
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

        // Record payment first to prevent double-grant on concurrent retries
        const product = PRODUCT_CATALOG[productId as LicenseProductId];
        await admin.from("payment_licenses").upsert({
            payment_id:   paymentId,
            user_id:      userId,
            product_id:   productId,
            tier:         product.type === "subscription" ? product.tier : "free",
            amount_paise: payment?.amount ?? product.paise,
            currency:     payment?.currency ?? "INR",
        }, { onConflict: "payment_id", ignoreDuplicates: true });

        const result = await grantLicense(userId, productId, admin, "razorpay");

        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

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
