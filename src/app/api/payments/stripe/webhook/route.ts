// src/app/api/payments/stripe/webhook/route.ts
// POST /api/payments/stripe/webhook
// Handles Stripe webhook events — grants license and creates invoice on payment.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripeClient";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { grantLicense, isValidProductId } from "@/lib/imotara/grantLicense";
import type { LicenseProductId } from "@/lib/imotara/grantLicense";
import { createInvoice, getProductDescription } from "@/lib/imotara/invoiceUtils";

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const secret    = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Helper to extract metadata from various event types
  function getMeta(obj: { metadata?: Record<string, string> | null } | null): { userId?: string; productId?: string } {
    return {
      userId:    obj?.metadata?.imotara_user_id,
      productId: obj?.metadata?.imotara_product_id,
    };
  }

  try {
    switch (event.type) {
      // One-time payment (token packs)
      case "payment_intent.succeeded": {
        const pi   = event.data.object as Stripe.PaymentIntent;
        const { userId, productId } = getMeta(pi);
        if (!userId || !productId || !isValidProductId(productId)) break;

        const result = await grantLicense(userId, productId as LicenseProductId, admin, "stripe");
        if (result.ok) {
          void createInvoice(admin, {
            userId, productId,
            tier: result.tier,
            description: getProductDescription(productId),
            paymentGateway: "stripe",
            gatewayRef: pi.id,
            amountPaise: Math.round((pi.amount_received ?? 0) * 83), // USD→INR approximate
            currency: pi.currency?.toUpperCase() ?? "USD",
          });
        }
        break;
      }

      // Subscription payment
      case "invoice.payment_succeeded": {
        const inv        = event.data.object as Stripe.Invoice & { subscription?: string | null };
        const sub        = inv.subscription;
        if (!sub || typeof sub !== "string") break;
        const subscription = await getStripe().subscriptions.retrieve(sub);
        const { userId, productId } = getMeta(subscription);
        if (!userId || !productId || !isValidProductId(productId)) break;

        const result = await grantLicense(userId, productId as LicenseProductId, admin, "stripe");
        if (result.ok) {
          void createInvoice(admin, {
            userId, productId,
            tier: result.tier,
            description: getProductDescription(productId),
            paymentGateway: "stripe",
            gatewayRef: inv.id,
            amountPaise: Math.round((inv.amount_paid ?? 0) * 83),
            currency: (inv.currency ?? "USD").toUpperCase(),
            periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : undefined,
            periodEnd:   inv.period_end   ? new Date(inv.period_end   * 1000).toISOString() : undefined,
          });
        }
        break;
      }

      // Subscription cancelled / lapsed
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { userId } = getMeta(sub);
        if (!userId) break;
        // Mark license as expired
        await admin.from("licenses")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("source", "stripe");
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] processing error:", event.type, err);
  }

  return NextResponse.json({ received: true });
}
