// src/app/api/payments/stripe/checkout/route.ts
// POST /api/payments/stripe/checkout
// Creates a Stripe Checkout Session for Plus/Pro subscriptions.
// Returns { url } — redirect user to Stripe hosted checkout page.
// Works for international cards (USD/EUR) that Razorpay doesn't support.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { getStripe, getStripePriceId } from "@/lib/stripeClient";
import { isValidProductId, PRODUCT_CATALOG } from "@/lib/imotara/grantLicense";

const SUBSCRIPTION_PRODUCTS = new Set(["plus_monthly","plus_annual","pro_monthly","pro_annual"]);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  // Auth
  let userId: string | null = null;
  let userEmail: string | null = null;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await getSupabaseAdmin().auth.getUser(bearer);
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }
  if (!userId) {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { productId: string; currency?: string; orgType?: string; seats?: number; purchaseType?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const { productId, orgType, seats } = body;
  const isCorporate = !!orgType && !!seats;
  if (!productId || !isValidProductId(productId)) {
    return NextResponse.json({ error: "invalid productId" }, { status: 400 });
  }

  const priceId = getStripePriceId(productId);
  if (!priceId) {
    return NextResponse.json({ error: `Stripe price not configured for ${productId}. Set STRIPE_PRICE_${productId.toUpperCase()} env var.` }, { status: 503 });
  }

  const isSubscription = SUBSCRIPTION_PRODUCTS.has(productId);
  const stripe = getStripe();
  const product = PRODUCT_CATALOG[productId];
  const amountUsd = Math.round(("paise" in product ? product.paise : 0) / 83); // rough INR→USD (for display only)

  try {
    const session = await stripe.checkout.sessions.create({
      mode:       isSubscription ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email:  userEmail ?? undefined,
      success_url:     `${SITE_URL}/settings?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:      `${SITE_URL}/upgrade?stripe_cancelled=1`,
      metadata: {
        imotara_user_id:    userId,
        imotara_product_id: productId,
        // Corporate purchase metadata — passed to webhook to trigger org creation
        ...(isCorporate ? {
          purchase_type:  "corporate",
          org_type:       orgType ?? "",
          seats:          String(seats ?? 0),
        } : {}),
      },
      subscription_data: isSubscription ? {
        metadata: {
          imotara_user_id: userId, imotara_product_id: productId,
          ...(isCorporate ? { purchase_type: "corporate", org_type: orgType ?? "", seats: String(seats ?? 0) } : {}),
        },
      } : undefined,
      payment_intent_data: !isSubscription ? {
        metadata: {
          imotara_user_id: userId, imotara_product_id: productId,
          ...(isCorporate ? { purchase_type: "corporate", org_type: orgType ?? "", seats: String(seats ?? 0) } : {}),
        },
      } : undefined,
      // For corporate: custom description
      ...(isCorporate ? {
        custom_text: {
          submit: { message: `Activating ${seats} seats for ${orgType} organisation. You'll receive setup instructions by email within 24 hours.` },
        },
      } : {}),
      allow_promotion_codes: true, // enables NGO/EDU coupon codes
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
