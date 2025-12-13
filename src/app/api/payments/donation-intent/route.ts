// src/app/api/payments/donation-intent/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const DONATION_ENABLED =
    (process.env.IMOTARA_DONATION_ENABLED || "").toLowerCase() === "true";

type Body = {
    amount: number; // paise
    currency: string; // "inr"
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

        const body = (await req.json()) as Body;
        const amount = body?.amount;
        const currency = (body?.currency || "inr").toLowerCase();

        if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return NextResponse.json(
                { ok: false, error: "Invalid amount." },
                { status: 400 }
            );
        }

        if (currency !== "inr") {
            return NextResponse.json(
                { ok: false, error: "Only INR is supported." },
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
