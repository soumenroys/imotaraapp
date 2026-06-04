// src/app/api/payments/razorpay/webhook/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { logDonation } from "@/lib/donations/logDonation";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { grantLicense, isValidProductId, PRODUCT_CATALOG } from "@/lib/imotara/grantLicense";
import { createInvoice, getProductDescription } from "@/lib/imotara/invoiceUtils";

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
            const paymentEntity: any = event?.payload?.payment?.entity;
            const orderEntity: any   = event?.payload?.order?.entity;

            // Notes live on the ORDER (set at creation) and are copied to the payment
            // by Razorpay. Read from payment first; fall back to order entity.
            // This handles both payment.captured and order.paid correctly.
            const paymentNotes = paymentEntity?.notes ?? {};
            const orderNotes   = orderEntity?.notes ?? {};
            const notes = (paymentNotes?.productId || paymentNotes?.purpose)
                ? paymentNotes
                : orderNotes;

            const purpose   = String(notes?.purpose  ?? "");
            const productId = String(notes?.productId ?? "").trim();
            const userId    = String(notes?.userId    ?? "").trim();

            console.log("[razorpay/webhook] event:", eventType, "purpose:", purpose, "productId:", productId, "userId:", userId ? "present" : "missing");

            if (purpose === "imotara_license" && isValidProductId(productId) && userId) {
                // ---- LIC-5: license payment — grant tier / top up tokens ----
                try {
                    const result = await grantLicense(userId, productId, getSupabaseAdmin(), "webhook");
                    console.log("[razorpay/webhook] grantLicense OK:", productId, "user:", userId);

                    // Create invoice record
                    const product = PRODUCT_CATALOG[productId];
                    const amountPaise = paymentEntity?.amount ?? (product && "paise" in product ? (product as { paise: number }).paise : 0);
                    void createInvoice(getSupabaseAdmin(), {
                      userId,
                      productId,
                      tier:            result.ok ? result.tier : undefined,
                      description:     getProductDescription(productId),
                      paymentGateway:  "razorpay",
                      gatewayRef:      paymentEntity?.id ?? orderEntity?.id ?? "unknown",
                      amountPaise:     typeof amountPaise === "number" ? amountPaise : 0,
                      currency:        paymentEntity?.currency ?? "INR",
                      periodStart:     new Date().toISOString(),
                      periodEnd:       result.ok ? result.expiresAt ?? undefined : undefined,
                    });
                } catch (e) {
                    console.error("[razorpay/webhook] grantLicense failed:", e);
                }
            } else {
                // ---- Donation receipt logging (existing flow) ----
                const donationPayment = paymentEntity;
                if (donationPayment?.id && donationPayment?.amount) {
                    await logDonation({
                        paymentId: donationPayment.id,
                        orderId: donationPayment.order_id,
                        amount: donationPayment.amount,
                        currency: donationPayment.currency || "INR",
                        status: eventType === "payment.captured" ? "captured" : "paid",
                        createdAt: (donationPayment.created_at || event.created_at) * 1000,
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
