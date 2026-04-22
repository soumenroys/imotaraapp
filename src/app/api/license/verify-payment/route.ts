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

async function fetchRzpPayment(paymentId: string) {
    if (!RZP_KEY_ID || !RZP_KEY_SECRET) return null;
    const creds = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${creds}` },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
        id: string; amount: number; status: string; currency: string;
        notes?: Record<string, string>;
    }>;
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

        // Verify with Razorpay
        const payment = await fetchRzpPayment(paymentId);

        if (!payment && process.env.NODE_ENV === "production") {
            return NextResponse.json({ ok: false, error: "Payment verification failed" }, { status: 400 });
        }

        if (payment && payment.status !== "captured") {
            return NextResponse.json({ ok: false, error: `Payment status: ${payment.status}` }, { status: 400 });
        }

        // Resolve productId (body → payment notes → amount-based fallback)
        const productId: LicenseProductId | null =
            isValidProductId(bodyPid)
                ? (bodyPid as LicenseProductId)
                : inferProductId(payment?.amount ?? 0, payment?.notes);

        if (!productId) {
            return NextResponse.json({ ok: false, error: "Could not resolve product" }, { status: 400 });
        }

        const result = await grantLicense(userId, productId, getSupabaseAdmin());

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
