// src/lib/stripeClient.ts
// Stripe SDK singleton — server-side only.
// Env vars required:
//   STRIPE_SECRET_KEY         — from Stripe dashboard (sk_live_... or sk_test_...)
//   STRIPE_WEBHOOK_SECRET     — from Stripe webhook endpoint settings (whsec_...)
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — for client-side Stripe.js

import "server-only";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Stripe Price IDs — create these in Stripe dashboard and add to env vars.
// Naming convention: STRIPE_PRICE_{PRODUCT_ID_UPPER}
// e.g. STRIPE_PRICE_PLUS_MONTHLY, STRIPE_PRICE_PRO_ANNUAL

export function getStripePriceId(productId: string): string | null {
  const envKey = `STRIPE_PRICE_${productId.toUpperCase().replace(/_/g, "_")}`;
  return process.env[envKey]?.trim() ?? null;
}

// Stripe product → Imotara product ID mapping
// Stored in Stripe price metadata: { imotara_product_id: 'plus_monthly' }
export function getImotaraProductId(price: Stripe.Price): string | null {
  return (price.metadata?.imotara_product_id as string | undefined) ?? null;
}
