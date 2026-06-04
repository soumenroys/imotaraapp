// src/app/api/payments/stripe/checkout/route.ts
// POST /api/payments/stripe/checkout
// Two modes:
//   Individual: Plus/Pro subscriptions — uses pre-configured Stripe price IDs
//   Corporate:  Seat purchases — uses price_data (dynamic, no pre-configured IDs needed)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { getStripe, getStripePriceId } from "@/lib/stripeClient";
import { isValidProductId, PRODUCT_CATALOG } from "@/lib/imotara/grantLicense";

const SUBSCRIPTION_PRODUCTS = new Set(["plus_monthly","plus_annual","pro_monthly","pro_annual"]);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");

// Per-seat annual pricing in USD cents (before org-type discount)
const CORPORATE_BASE_USD_CENTS_PER_SEAT = 4900; // $49/seat/year

// Discount by org type
const ORG_DISCOUNTS: Record<string, number> = {
  commercial: 0,
  govt:       0,
  ngo:        0.6, // 60% off
  edu:        0.5, // 50% off
};

// Tier mapped from seat count
function tierForSeats(seats: number, orgType: string): string {
  if (orgType === "edu") return "edu";
  if (seats >= 100) return "enterprise";
  return "plus";
}

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

  let body: {
    productId?: string;
    currency?: string;
    orgType?: string;
    seats?: number;
    displayedAmountSmallestUnit?: number; // exact amount shown to user on pricing page
    displayedCurrency?: string;           // currency of that amount
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const { productId, orgType, seats } = body;
  const isCorporate = !!orgType && !!seats && seats > 0;

  const stripe = getStripe();

  // ── CORPORATE PURCHASE ────────────────────────────────────────────────────────
  if (isCorporate) {
    const orgTier  = tierForSeats(seats!, orgType!);
    const orgLabel = { commercial:"Company", ngo:"NGO / NPO", edu:"Educational", govt:"Government" }[orgType!] ?? orgType!;

    // Use the EXACT amount the user saw on the pricing page — prevents any discrepancy
    // between displayed price and charged amount.
    // Stripe requires smallest currency unit (cents for USD, paise for INR).
    // For INR, we must use Stripe's INR support or convert; Stripe Checkout supports INR.
    const chargeAmountUnit = body.displayedAmountSmallestUnit ?? 0;
    const chargeCurrency   = (body.displayedCurrency ?? "USD").toLowerCase();

    if (chargeAmountUnit <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency:     chargeCurrency,
            unit_amount:  chargeAmountUnit,
            product_data: {
              name:        `Imotara ${orgTier.charAt(0).toUpperCase() + orgTier.slice(1)} — ${seats} seats (${orgLabel})`,
              description: `Annual corporate licence · ${seats} users · ${orgLabel} organisation`,
            },
          },
          quantity: 1,
        }],
        customer_email:  userEmail ?? undefined,
        success_url:     `${SITE_URL}/org/new?stripe_paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:      `${SITE_URL}/pricing/corporate?stripe_cancelled=1`,
        metadata: {
          imotara_user_id: userId,
          purchase_type:   "corporate",
          org_type:        orgType!,
          seats:           String(seats!),
          org_tier:        orgTier,
        },
        payment_intent_data: {
          metadata: {
            imotara_user_id: userId,
            purchase_type:   "corporate",
            org_type:        orgType!,
            seats:           String(seats!),
            org_tier:        orgTier,
          },
        },
        allow_promotion_codes: true,
      });

      return NextResponse.json({ url: session.url, sessionId: session.id });
    } catch (err: unknown) {
      console.error("[stripe/checkout/corporate]", err);
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // ── INDIVIDUAL SUBSCRIPTION / TOKEN PACK ─────────────────────────────────────
  if (!productId || !isValidProductId(productId)) {
    return NextResponse.json({ error: "invalid productId" }, { status: 400 });
  }

  const priceId = getStripePriceId(productId);
  if (!priceId) {
    return NextResponse.json({
      error: `Stripe payment not configured for ${productId}. Use Razorpay for Indian payments, or contact support for international payments.`,
    }, { status: 503 });
  }

  const isSubscription = SUBSCRIPTION_PRODUCTS.has(productId);

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
      },
      subscription_data: isSubscription ? {
        metadata: { imotara_user_id: userId, imotara_product_id: productId },
      } : undefined,
      payment_intent_data: !isSubscription ? {
        metadata: { imotara_user_id: userId, imotara_product_id: productId },
      } : undefined,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
