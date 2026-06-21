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

            if (purpose === "imotara_corporate" && userId) {
                // ---- Corporate seat purchase — create org in pending state ----
                const orgType  = String(notes?.orgType  ?? "commercial");
                const seats    = parseInt(String(notes?.seats ?? "10"), 10) || 10;
                const tier     = String(notes?.tier ?? "plus");
                const userEmail = String(notes?.userEmail ?? "");

                const tierMap: Record<string, string> = { commercial:"enterprise", ngo:"enterprise", edu:"edu", govt:"enterprise" };
                const grantedTier = tierMap[orgType] ?? tier;

                const { data: existingOrg } = await getSupabaseAdmin()
                    .from("organizations")
                    .select("id, name")
                    .eq("owner_user_id", userId)
                    .single();

                if (!existingOrg) {
                    const slug = `rzp-${userId.slice(0,8)}-${Date.now()}`;
                    const orgLabel = { commercial:"Company", ngo:"NGO / NPO", edu:"Educational", govt:"Government" }[orgType] ?? orgType;
                    const { data: org } = await getSupabaseAdmin().from("organizations").insert({
                        name: `${orgLabel} — ${userEmail || userId} (via Razorpay)`,
                        slug,
                        billing_type: orgType,
                        tier: grantedTier,
                        status: "pending",
                        seats_purchased: seats,
                        owner_user_id: userId,
                        notes: `Razorpay payment: ${paymentEntity?.id ?? "?"} · ${seats} seats · Activate from /admin → Organizations`,
                    }).select("id").single();

                    if (org) {
                        await getSupabaseAdmin().from("org_members").insert({ org_id: org.id, user_id: userId, role: "owner", status: "active" });
                        await getSupabaseAdmin().from("licenses").upsert(
                            { user_id: userId, tier: "free", status: "valid", org_id: org.id, source: "org", updated_at: new Date().toISOString() },
                            { onConflict: "user_id" }
                        );
                    }
                    console.log("[razorpay/webhook] corporate org created:", slug, seats, "seats");
                } else {
                    console.log("[razorpay/webhook] corporate org already exists:", existingOrg.name);
                }
            } else if (purpose === "imotara_license" && isValidProductId(productId) && userId) {
                // ---- LIC-5: license payment — grant tier / top up tokens ----
                // Idempotency: verify-payment may have already processed this paymentId.
                // Skip if already in payment_licenses to prevent double-grant on token packs.
                const paymentRef = paymentEntity?.id ?? orderEntity?.id;
                if (paymentRef) {
                    const { data: already } = await getSupabaseAdmin()
                        .from("payment_licenses")
                        .select("payment_id")
                        .eq("payment_id", paymentRef)
                        .maybeSingle();
                    if (already) {
                        console.log("[razorpay/webhook] already processed:", paymentRef, "— skipping");
                        return NextResponse.json({ ok: true, skipped: "already_processed" });
                    }
                }

                try {
                    const result = await grantLicense(userId, productId, getSupabaseAdmin(), "razorpay");
                    console.log("[razorpay/webhook] grantLicense OK:", productId, "user:", userId);

                    // Record in payment_licenses so verify-payment also sees it as already processed
                    if (paymentRef) {
                        const product2 = PRODUCT_CATALOG[productId];
                        void getSupabaseAdmin().from("payment_licenses").upsert({
                            payment_id:   paymentRef,
                            user_id:      userId,
                            product_id:   productId,
                            tier:         result.ok ? result.tier ?? "free" : "free",
                            amount_paise: paymentEntity?.amount ?? (product2 && "paise" in product2 ? (product2 as { paise: number }).paise : 0),
                            currency:     paymentEntity?.currency ?? "INR",
                            granted_at:   new Date().toISOString(),
                        }, { onConflict: "payment_id", ignoreDuplicates: true });
                    }

                    // Create invoice record (await + log errors — non-blocking to payment flow)
                    const product = PRODUCT_CATALOG[productId];
                    const amountPaise = paymentEntity?.amount ?? (product && "paise" in product ? (product as { paise: number }).paise : 0);
                    createInvoice(getSupabaseAdmin(), {
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
                    }).catch((err: unknown) => console.error("[razorpay/webhook] invoice creation failed:", err));
                } catch (e) {
                    console.error("[razorpay/webhook] grantLicense failed:", e);
                }
            } else {
                // ---- Check if this is a Connect recharge (no purpose note set at order creation) ----
                // Covers the case where the user's browser crashes after payment but before /recharge/verify.
                // Without this handler, the recharge row stays "pending" forever and the user loses their money.
                const orderId = paymentEntity?.order_id ?? orderEntity?.id;
                const paymentId = paymentEntity?.id;
                if (orderId && paymentId) {
                    const supabase = getSupabaseAdmin();
                    const { data: recharge } = await supabase
                        .from("connect_recharges")
                        .select("id, status")
                        .eq("razorpay_order_id", orderId)
                        .maybeSingle();

                    if (recharge && recharge.status === "pending") {
                        const { data: markedRows } = await supabase
                            .from("connect_recharges")
                            .update({ razorpay_payment_id: paymentId, status: "completed" })
                            .eq("id", recharge.id)
                            .eq("status", "pending")
                            .select("id");
                        if (markedRows && markedRows.length > 0) {
                            console.log("[razorpay/webhook] Connect recharge auto-completed via webhook:", recharge.id);
                        }
                    } else {
                        // Not a Connect recharge — check if it is a wallet topup order.
                        // Topup orders use notes.type = "wallet_topup" (not notes.purpose),
                        // so they fall through to this else branch. Without this handler,
                        // a browser crash after payment leaves the wallet permanently uncredited.
                        const { data: topupOrder } = await supabase
                            .from("imotara_wallet_orders")
                            .select("id, user_id, amount, currency_code, status")
                            .eq("razorpay_order_id", orderId)
                            .maybeSingle();

                        if (topupOrder && topupOrder.status === "pending") {
                            const { data: markedTopup } = await supabase
                                .from("imotara_wallet_orders")
                                .update({ razorpay_payment_id: paymentId, status: "completed" })
                                .eq("id", topupOrder.id)
                                .eq("status", "pending")
                                .select("id");

                            if (markedTopup && markedTopup.length > 0) {
                                const { error: creditErr } = await supabase.rpc("credit_imotara_wallet", {
                                    p_user_id:  topupOrder.user_id,
                                    p_amount:   Number(topupOrder.amount),
                                    p_currency: topupOrder.currency_code ?? "INR",
                                });
                                if (creditErr) {
                                    console.error("[razorpay/webhook] CRITICAL: wallet topup credit failed for order:", topupOrder.id, creditErr.message);
                                } else {
                                    console.log("[razorpay/webhook] Wallet topup auto-completed via webhook:", topupOrder.id);
                                }
                            }
                        } else {
                            // Not a known order — log as donation (existing flow)
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
                } else {
                    // No order ID available — fall through to donation log
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
        }

        // ── Connect: payment failed ────────────────────────────────────────────
        if (eventType === "payment.failed") {
            const paymentEntity: any = event?.payload?.payment?.entity;
            const orderId = paymentEntity?.order_id ?? paymentEntity?.notes?.order_id;
            if (orderId) {
                const supabase = getSupabaseAdmin();
                const { data: recharge } = await supabase
                    .from("connect_recharges")
                    .select("id, status")
                    .eq("razorpay_order_id", orderId)
                    .maybeSingle();
                if (recharge && recharge.status === "pending") {
                    await supabase
                        .from("connect_recharges")
                        .update({ status: "failed" })
                        .eq("id", recharge.id);
                    console.log("[razorpay/webhook] Connect recharge marked failed:", recharge.id);
                }
            }
        }

        // ── Connect: refund processed ──────────────────────────────────────────
        if (eventType === "refund.processed") {
            const refundEntity: any = event?.payload?.refund?.entity;
            const paymentId = refundEntity?.payment_id;
            if (paymentId) {
                const supabase = getSupabaseAdmin();
                const { data: recharge } = await supabase
                    .from("connect_recharges")
                    .select("id, status")
                    .eq("razorpay_payment_id", paymentId)
                    .maybeSingle();
                if (recharge && recharge.status === "completed") {
                    await supabase
                        .from("connect_recharges")
                        .update({ status: "refunded" })
                        .eq("id", recharge.id);
                    console.log("[razorpay/webhook] Connect recharge marked refunded:", recharge.id);
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
