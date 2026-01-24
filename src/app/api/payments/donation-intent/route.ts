// src/app/api/payments/donation-intent/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const DONATION_ENABLED =
    (process.env.IMOTARA_DONATION_ENABLED || "").toLowerCase() === "true";

type Body = {
    presetId: "inr_49" | "inr_99" | "inr_199" | "inr_499" | "inr_999";
    purpose?: string;
    platform?: "mobile" | "web";
};

function assertEnv() {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new Error("Missing Razorpay keys in environment.");
    }
}

export async function POST(req: Request) {
    try {
        if (!DONATION_ENABLED) {
            return NextResponse.json(
                { ok: false, error: "Donations are disabled on server." },
                { status: 403 }
            );
        }

        assertEnv();

        // ✅ Server-authoritative donation presets (paise)
        const DONATION_PRESETS: Record<Body["presetId"], number> = {
            inr_49: 4900,
            inr_99: 9900,
            inr_199: 19900,
            inr_499: 49900,
            inr_999: 99900,
        };

        const body = (await req.json().catch(() => ({} as any))) as Partial<Body>;

        const presetId = body?.presetId as Body["presetId"] | undefined;
        const amount = presetId ? DONATION_PRESETS[presetId] : undefined;

        if (!presetId || typeof amount !== "number") {
            return NextResponse.json(
                { ok: false, error: "Invalid donation preset." },
                { status: 400 }
            );
        }

        // Razorpay Orders API
        const auth = Buffer.from(
            `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
        ).toString("base64");

        const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount,
                currency: "INR",
                receipt: `imotara_donation_${Date.now()}`,
                notes: {
                    purpose: body?.purpose || "imotara_donation",
                    platform: body?.platform || "mobile",
                },
            }),
        });

        if (!orderRes.ok) {
            const txt = await orderRes.text();
            throw new Error(`Razorpay order failed: ${txt}`);
        }

        const order = await orderRes.json();

        /**
         * IMPORTANT:
         * We return data in a Stripe-like shape so mobile code
         * does not need to change yet.
         */
        return NextResponse.json({
            ok: true,
            razorpay: {
                orderId: order.id,
                keyId: RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
            },
        });
    } catch (err: any) {
        console.error("donation-intent error:", err);
        return NextResponse.json(
            {
                ok: false,
                error:
                    err?.message ||
                    "Unable to create donation order. Please try again.",
            },
            { status: 500 }
        );
    }
}
