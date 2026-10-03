// src/app/api/payments/donation-intent/route.ts
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { bandForCountry, donationPaise, tierForPresetId } from "@/lib/imotara/pricingBands";
import crypto from "crypto";

// Read at runtime inside handler — do NOT hoist to module level
// (Next.js webpack may inline module-level process.env at build time)
function getRuntimeConfig() {
    return {
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
        DONATION_ENABLED: (process.env.IMOTARA_DONATION_ENABLED || "").trim().toLowerCase() === "true",
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

        const body = (await req.json().catch(() => ({} as any))) as Partial<Body>;

        // ✅ Server-authoritative: the AMOUNT is derived here from (band, tier).
        // The client sends only which preset was tapped — never a price. A page
        // showing stale or tampered figures still gets charged this.
        //
        // 🔴 The band comes from Vercel's edge geo header, NOT from the body.
        // A client-supplied country would let anyone claim India's price.
        const presetId = body?.presetId as string | undefined;
        const tier = tierForPresetId(presetId);
        const band = bandForCountry(req.headers.get("x-vercel-ip-country"));
        const amount = tier ? donationPaise(band, tier) : undefined;

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
                    // 🔑 Recorded so a settlement can be traced back to the band
                    // that produced it — otherwise two ₹199 donations from
                    // different countries are indistinguishable afterwards.
                    band: String(band),
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
