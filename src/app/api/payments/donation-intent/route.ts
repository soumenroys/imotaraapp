// src/app/api/payments/donation-intent/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

// Read at runtime inside handler — do NOT hoist to module level
// (Next.js webpack may inline module-level process.env at build time)
function getRuntimeConfig() {
    return {
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
        DONATION_ENABLED: (process.env.IMOTARA_DONATION_ENABLED || "").toLowerCase() === "true",
    };
}

type Body = {
    presetId: "inr_49" | "inr_99" | "inr_199" | "inr_499" | "inr_999";
    purpose?: string;
    platform?: "mobile" | "web";
};

export async function POST(req: Request) {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, DONATION_ENABLED } = getRuntimeConfig();

    function assertEnv() {
        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            throw new Error("Missing Razorpay keys in environment.");
        }
    }

    try {
        if (!DONATION_ENABLED) {
            return NextResponse.json(
                { ok: false, error: "Donations are disabled on server." },
                { status: 403 }
            );
        }

        assertEnv();

        // ✅ Server-authoritative donation presets (paise)
        // Accepts both web format ("inr_49") and mobile format ("d-49")
        const DONATION_PRESETS: Record<string, number> = {
            inr_49: 4900,  "d-49": 4900,
            inr_99: 9900,  "d-99": 9900,
            inr_199: 19900, "d-199": 19900,
            inr_499: 49900, "d-499": 49900,
            inr_999: 99900, "d-999": 99900,
        };

        const body = (await req.json().catch(() => ({} as any))) as Partial<Body>;

        const presetId = body?.presetId as string | undefined;
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
        const PROD = process.env.NODE_ENV === "production";
        const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

        if (SHOULD_LOG) {
            console.warn("donation-intent error:", String(err));
        }

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
