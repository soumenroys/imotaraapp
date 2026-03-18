// src/app/api/license/verify-payment/route.ts
//
// Called by the mobile app after a successful Razorpay payment.
// Verifies the payment with Razorpay, then grants PREMIUM license
// keyed by chatLinkKey (anonymous cross-device identifier).
//
// POST { paymentId: string, chatLinkKey?: string }
// → { ok: true, tier: "PREMIUM" | "FREE" }

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

// Amount thresholds in paise (₹199 = 19900 paise → PREMIUM)
const PREMIUM_THRESHOLD_PAISE = 19900;

async function fetchRazorpayPayment(paymentId: string) {
    if (!RZP_KEY_ID || !RZP_KEY_SECRET) return null;
    const creds = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${creds}` },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ id: string; amount: number; status: string; currency: string }>;
}

export async function POST(req: Request) {
    try {
        // Require a valid Supabase Bearer token from mobile app
        const authHeader = req.headers.get("authorization") ?? "";
        const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
        if (!bearerToken) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const { data: tokenData } = await supabaseServer.auth.getUser(bearerToken);
        if (!tokenData?.user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const userId = tokenData.user.id;

        const body = await req.json();
        const paymentId: string = String(body?.paymentId ?? "").trim();
        const chatLinkKey: string = String(body?.chatLinkKey ?? "").trim();

        if (!paymentId) {
            return NextResponse.json({ ok: false, error: "paymentId required" }, { status: 400 });
        }

        // 1. Verify payment with Razorpay
        const payment = await fetchRazorpayPayment(paymentId);

        if (!payment) {
            // If no Razorpay credentials configured (dev), grant based on trust
            // In production this will always require real credentials.
            const IS_DEV = process.env.NODE_ENV !== "production";
            if (!IS_DEV) {
                return NextResponse.json({ ok: false, error: "Payment verification failed" }, { status: 400 });
            }
            // Dev-only: pass through without verification
        }

        if (payment && payment.status !== "captured") {
            return NextResponse.json({ ok: false, error: `Payment status: ${payment.status}` }, { status: 400 });
        }

        // 2. Determine tier from amount
        const amountPaise = payment?.amount ?? PREMIUM_THRESHOLD_PAISE;
        const tier = amountPaise >= PREMIUM_THRESHOLD_PAISE ? "PREMIUM" : "FREE";

        // 3. Persist to Supabase (keyed by chatLinkKey or paymentId)
        // Table: payment_licenses (payment_id text PK, chat_link_key text, tier text, granted_at timestamptz)
        // Falls back gracefully if table doesn't exist.
        try {
            const supabase = supabaseServer;
            await supabase.from("payment_licenses").upsert({
                payment_id: paymentId,
                user_id: userId,
                chat_link_key: chatLinkKey || null,
                tier,
                amount_paise: amountPaise,
                currency: payment?.currency ?? "INR",
                granted_at: new Date().toISOString(),
            }, { onConflict: "payment_id" });
        } catch {
            // Non-fatal — mobile side will still get the tier in the response
        }

        return NextResponse.json({ ok: true, tier, paymentId });
    } catch (err: any) {
        const IS_PROD = process.env.NODE_ENV === "production";
        if (!IS_PROD) console.warn("verify-payment error:", String(err));
        return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
