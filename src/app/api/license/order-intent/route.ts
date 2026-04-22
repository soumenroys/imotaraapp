// src/app/api/license/order-intent/route.ts
// LIC-5: Create a Razorpay order for a license purchase (subscription or token pack).
// Auth: Bearer token (mobile) or Supabase cookie (web).
// POST { productId: LicenseProductId }
// → { ok: true, productId, razorpay: { orderId, keyId, amount, currency } }

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { PRODUCT_CATALOG, isValidProductId, type LicenseProductId } from "@/lib/imotara/grantLicense";

function getRzpConfig() {
    return {
        keyId:     process.env.RAZORPAY_KEY_ID     ?? "",
        keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    };
}

async function resolveUserId(req: Request): Promise<string | null> {
    // Bearer token (mobile)
    const auth = req.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
        const token = auth.slice(7).trim();
        const { data } = await getSupabaseAdmin().auth.getUser(token);
        return data?.user?.id ?? null;
    }
    // Cookie auth (web)
    try {
        const client = await supabaseUserServer();
        const { data } = await client.auth.getUser();
        return data?.user?.id ?? null;
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    const { keyId, keySecret } = getRzpConfig();

    if (!keyId || !keySecret) {
        return NextResponse.json({ ok: false, error: "Payment not configured" }, { status: 503 });
    }

    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ ok: false, error: "Sign in to subscribe" }, { status: 401 });
        }

        const body      = await req.json().catch(() => ({}));
        const productId = String(body?.productId ?? "").trim();

        if (!isValidProductId(productId)) {
            return NextResponse.json({ ok: false, error: "Invalid productId" }, { status: 400 });
        }

        const product = PRODUCT_CATALOG[productId as LicenseProductId];
        const creds   = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

        const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                amount:   product.paise,
                currency: "INR",
                receipt:  `imotara_lic_${Date.now()}`,
                notes:    { purpose: "imotara_license", productId, userId },
            }),
        });

        if (!orderRes.ok) {
            throw new Error(`Razorpay order error: ${await orderRes.text()}`);
        }

        const order = await orderRes.json();

        const res = NextResponse.json({
            ok: true,
            productId,
            razorpay: { orderId: order.id, keyId, amount: order.amount, currency: order.currency },
        });
        res.headers.set("Cache-Control", "no-store");
        return res;
    } catch (err: any) {
        if (process.env.NODE_ENV !== "production") console.warn("[order-intent]", String(err));
        return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
    }
}
