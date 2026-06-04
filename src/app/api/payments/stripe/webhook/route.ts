// src/app/api/payments/stripe/webhook/route.ts
// POST /api/payments/stripe/webhook
// Handles Stripe webhook events — grants license and creates invoice on payment.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import nodemailer from "nodemailer";
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
      // One-time payment (token packs or corporate)
      case "payment_intent.succeeded": {
        const pi   = event.data.object as Stripe.PaymentIntent;
        const { userId, productId } = getMeta(pi);
        if (!userId) break;

        // Corporate purchase — notify admin and auto-create org
        if (pi.metadata?.purchase_type === "corporate" && userId) {
          const orgType   = pi.metadata.org_type  ?? "commercial";
          const seats     = parseInt(pi.metadata.seats ?? "10", 10);
          const tierMap: Record<string, string> = { commercial:"enterprise", ngo:"enterprise", edu:"edu", govt:"enterprise" };
          const tier      = tierMap[orgType] ?? "enterprise";
          const authUser  = await admin.auth.admin.getUserById(userId);
          const userEmail = authUser.data?.user?.email ?? "unknown";

          // Auto-create org in pending state (admin activates with seats)
          const slug = `stripe-${userId.slice(0,8)}-${Date.now()}`;
          const { data: org } = await admin.from("organizations").insert({
            name: `${orgType.charAt(0).toUpperCase() + orgType.slice(1)} Organisation (via Stripe)`,
            slug,
            billing_type: orgType,
            tier,
            status: "pending",
            seats_purchased: seats,
            owner_user_id: userId,
            notes: `Stripe payment: ${pi.id} · ${seats} seats · Activate from /admin`,
          }).select("id, name").single();

          if (org) {
            await admin.from("org_members").insert({ org_id: org.id, user_id: userId, role: "owner", status: "active" });
            await admin.from("licenses").upsert({ user_id: userId, tier: "free", status: "valid", org_id: org.id, source: "org", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
          }

          // Alert admin to activate
          const smtpUser = process.env.ALERT_GMAIL_USER?.trim();
          const smtpPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
          if (smtpUser && smtpPass) {
            nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } })
              .sendMail({
                from: `"Imotara" <${smtpUser}>`,
                to:   "publisher@imotara.com",
                subject: `[Corporate Purchase] ${orgType} org, ${seats} seats — ACTIVATE NOW`,
                text: `Stripe payment received.\n\nUser: ${userEmail}\nOrg type: ${orgType}\nSeats: ${seats}\nPayment: ${pi.id}\nAmount: ${(pi.amount_received/100).toFixed(2)} ${pi.currency?.toUpperCase()}\n\nActivate at /admin → Organizations → find "${slug}"`,
              }).catch(() => {});
          }

          // Create invoice for corporate purchase
          if (userId && pi.amount_received) {
            void createInvoice(admin, {
              userId,
              productId: `corporate_${orgType}_${seats}`,
              description: `Imotara ${tier.charAt(0).toUpperCase()+tier.slice(1)} · ${seats} seats (${orgType})`,
              paymentGateway: "stripe",
              gatewayRef: pi.id,
              amountPaise: Math.round(pi.amount_received * 83),
              currency: pi.currency?.toUpperCase() ?? "USD",
            });
          }
          break;
        }

        if (!productId || !isValidProductId(productId)) break;
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
        // Revert to free tier — clear stripe subscription
        await admin.from("licenses")
          .update({
            tier:       "free",
            status:     "valid",
            expires_at: null,
            source:     "manual",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("source", "stripe");
        console.log("[stripe/webhook] subscription cancelled, reverted to free:", userId);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] processing error:", event.type, err);
  }

  return NextResponse.json({ received: true });
}
