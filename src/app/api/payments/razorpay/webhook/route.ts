// src/app/api/payments/razorpay/webhook/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { logDonation } from "@/lib/donations/logDonation";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { grantLicense, isValidProductId } from "@/lib/imotara/grantLicense";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

/**
 * Razorpay sends a signature in header: x-razorpay-signature
 * We verify HMAC SHA256 of the raw request body using WEBHOOK_SECRET.
 */
function verifySignature(rawBody: string, signature: string): boolean {
    if (!WEBHOOK_SECRET) return false;

    const expected = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

    // timing-safe compare
    const a = Buffer.from(expected);
    const b = Buffer.from(signature || "");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
    try {
        const signature = req.headers.get("x-razorpay-signature") || "";

        // IMPORTANT: verify against RAW body (not parsed JSON)
        const rawBody = await req.text();

        if (!signature) {
            return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
        }

        if (!verifySignature(rawBody, signature)) {
            console.error("[razorpay/webhook] signature mismatch — possible spoofing attempt");
            return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
        }

        // Safe to parse after signature verification
        const event = JSON.parse(rawBody) as any;

        const eventType = event?.event;

        if (eventType === "payment.captured" || eventType === "order.paid") {
            const payment: any =
                event?.payload?.payment?.entity ||
                event?.payload?.order?.entity;

            const notes    = payment?.notes ?? {};
            const purpose  = String(notes?.purpose ?? "");
            const productId = String(notes?.productId ?? "").trim();
            const userId    = String(notes?.userId ?? "").trim();

            if (purpose === "imotara_license" && isValidProductId(productId) && userId) {
                // ---- LIC-5: license payment — grant tier / top up tokens ----
                try {
                    await grantLicense(userId, productId, getSupabaseAdmin());
                } catch (e) {
                    console.error("[razorpay/webhook] grantLicense failed:", e);
                }
            } else {
                // ---- Donation receipt logging (existing flow) ----
                if (payment?.id && payment?.amount) {
                    await logDonation({
                        paymentId: payment.id,
                        orderId: payment.order_id,
                        amount: payment.amount,
                        currency: payment.currency || "INR",
                        status: eventType === "payment.captured" ? "captured" : "paid",
                        createdAt: (payment.created_at || event.created_at) * 1000,
                        source: "razorpay",
                        rawEvent: event,
                    });
                }
            }
        }

        const PROD = process.env.NODE_ENV === "production";
        const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

        // Dev-only: minimal verification log (no raw payload)
        if (SHOULD_LOG) {
            console.warn("✅ Razorpay webhook verified:", {
                event: event?.event,
                created_at: event?.created_at,
                payloadKeys: event?.payload ? Object.keys(event.payload) : [],
            });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        const PROD = process.env.NODE_ENV === "production";
        const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

        if (SHOULD_LOG) {
            console.warn("razorpay webhook error:", String(err));
        }

        return NextResponse.json(
            { ok: false, error: "Webhook handler error" },
            { status: 500 }
        );
    }
}
