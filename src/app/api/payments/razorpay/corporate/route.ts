// src/app/api/payments/razorpay/corporate/route.ts
// POST /api/payments/razorpay/corporate
// Creates a Razorpay order for a corporate seat purchase.
// Auth: Supabase cookie (web only — this page is web-only).
//
// Body: { orgType: "commercial"|"ngo"|"edu"|"govt", seats: number }
// Response: { ok: true, razorpay: { orderId, keyId, amount, currency }, orgType, seats, tier }

export const preferredRegion = ["sin1"];

import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";

// Per-seat annual price in paise (INR × 100)
const PER_SEAT_PAISE: Record<string, number> = {
    commercial: 199_900,  // ₹1,999/seat/year
    govt:       199_900,  // ₹1,999/seat/year
    ngo:         79_900,  // ₹799/seat/year  (60% off)
    edu:         99_900,  // ₹999/seat/year  (50% off)
};

const VALID_ORG_TYPES = new Set(["commercial", "ngo", "edu", "govt"]);
const VALID_SEAT_COUNTS = new Set([10, 50, 100, 500]);

function tierForSeats(seats: number, orgType: string): string {
    if (orgType === "edu") return "edu";
    if (seats >= 100) return "enterprise";
    return "plus";
}

function getRzpConfig() {
    return {
        keyId:     process.env.RAZORPAY_KEY_ID     ?? "",
        keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    };
}

export async function POST(req: Request) {
    const { keyId, keySecret } = getRzpConfig();
    if (!keyId || !keySecret) {
        return NextResponse.json({ ok: false, error: "Payment not configured" }, { status: 503 });
    }

    // Auth (web cookie)
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
        const supabase = await getSupabaseUserServerClient();
        const { data } = await supabase.auth.getUser();
        userId    = data?.user?.id    ?? null;
        userEmail = data?.user?.email ?? null;
    } catch { /* unauthenticated */ }

    // Also accept Bearer token
    if (!userId) {
        const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (bearer) {
            const { data } = await getSupabaseAdmin().auth.getUser(bearer);
            userId    = data?.user?.id    ?? null;
            userEmail = data?.user?.email ?? null;
        }
    }

    if (!userId) {
        return NextResponse.json({ ok: false, error: "Sign in to continue" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { orgType?: string; seats?: number };
    const orgType = String(body?.orgType ?? "").toLowerCase();
    const seats   = Number(body?.seats ?? 0);

    if (!VALID_ORG_TYPES.has(orgType)) {
        return NextResponse.json({ ok: false, error: "Invalid org type" }, { status: 400 });
    }
    if (!VALID_SEAT_COUNTS.has(seats)) {
        return NextResponse.json({ ok: false, error: "Invalid seat count" }, { status: 400 });
    }

    const perSeatPaise = PER_SEAT_PAISE[orgType];
    const totalPaise   = perSeatPaise * seats;
    const tier         = tierForSeats(seats, orgType);

    const creds    = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            amount:   totalPaise,
            currency: "INR",
            receipt:  `imotara_corp_${Date.now()}`,
            notes: {
                purpose:  "imotara_corporate",
                orgType,
                seats:    String(seats),
                tier,
                userId,
                userEmail: userEmail ?? "",
            },
        }),
    });

    if (!orderRes.ok) {
        const txt = await orderRes.text();
        console.error("[razorpay/corporate] order failed:", txt);
        return NextResponse.json({ ok: false, error: "Payment order creation failed" }, { status: 500 });
    }

    const order = await orderRes.json() as { id: string; amount: number; currency: string };

    const res = NextResponse.json({
        ok: true,
        razorpay: { orderId: order.id, keyId, amount: order.amount, currency: order.currency },
        orgType,
        seats,
        tier,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
}
