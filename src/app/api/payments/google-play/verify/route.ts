// src/app/api/payments/google-play/verify/route.ts
// POST /api/payments/google-play/verify
// Verifies a Google Play purchase token and grants the corresponding license.
// Called from Android mobile app after a successful purchase via expo-iap.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  verifyGooglePlaySubscription,
  verifyGooglePlayProduct,
  acknowledgeGooglePlayPurchase,
} from "@/lib/googlePlay";
import { grantLicense, isValidProductId } from "@/lib/imotara/grantLicense";
import type { LicenseProductId } from "@/lib/imotara/grantLicense";
import { createInvoice, getProductDescription } from "@/lib/imotara/invoiceUtils";

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "com.imotara.imotara";

// Subscription product IDs
const SUBSCRIPTION_SKUS = new Set(["plus_monthly","plus_annual","pro_monthly","pro_annual"]);

export async function POST(req: NextRequest) {
  // Auth — Bearer token from mobile (Supabase session)
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const { data: authData } = await getSupabaseAdmin().auth.getUser(bearer);
  const userId = authData?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });

  let body: { productId: string; purchaseToken: string; orderId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }

  const { productId, purchaseToken } = body;

  if (!productId || !purchaseToken) {
    return NextResponse.json({ ok: false, error: "productId and purchaseToken required" }, { status: 400 });
  }
  if (!isValidProductId(productId)) {
    return NextResponse.json({ ok: false, error: `Unknown product: ${productId}` }, { status: 400 });
  }

  const admin          = getSupabaseAdmin();
  const isSubscription = SUBSCRIPTION_SKUS.has(productId);

  // Idempotency — check if already processed
  const { data: existing } = await admin
    .from("payment_licenses")
    .select("payment_id")
    .eq("payment_id", purchaseToken)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, message: "already_processed" });
  }

  // Verify with Google Play
  const verification = isSubscription
    ? await verifyGooglePlaySubscription(PACKAGE_NAME, productId, purchaseToken)
    : await verifyGooglePlayProduct(PACKAGE_NAME, productId, purchaseToken);

  if (!verification.valid) {
    return NextResponse.json({ ok: false, error: verification.error ?? "Purchase not valid" }, { status: 400 });
  }

  // Acknowledge (required within 3 days or Google refunds automatically)
  void acknowledgeGooglePlayPurchase(PACKAGE_NAME, productId, purchaseToken, isSubscription);

  // Insert idempotency record BEFORE granting (prevents double-grant if request retried)
  // Use token as payment_id; tier filled in after grant succeeds
  const { error: insertErr } = await admin.from("payment_licenses").insert({
    payment_id:   purchaseToken,
    user_id:      userId,
    product_id:   productId,
    tier:         "pending", // updated below after grant
    amount_paise: 0,
    currency:     "INR",
    granted_at:   new Date().toISOString(),
  });
  if (insertErr && !insertErr.message.includes("duplicate")) {
    console.error("[google-play/verify] payment_licenses insert failed:", insertErr.message);
  }

  // Grant license
  const result = await grantLicense(userId, productId as LicenseProductId, admin, "google_play");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  // Update with real tier
  void admin.from("payment_licenses").update({ tier: result.tier }).eq("payment_id", purchaseToken);

  // Create invoice
  createInvoice(admin, {
    userId,
    productId,
    tier:           result.tier,
    description:    getProductDescription(productId),
    paymentGateway: "google_play",
    gatewayRef:     verification.orderId ?? purchaseToken.slice(0, 40),
    amountPaise:    0,
    currency:       "INR",
    periodStart:    new Date().toISOString(),
    periodEnd:      result.expiresAt ?? verification.expiresAt ?? undefined,
  }).catch((err: unknown) => console.error("[google-play/verify] invoice creation failed:", err));

  return NextResponse.json({
    ok:           true,
    tier:         result.tier,
    tokenBalance: result.tokenBalance,
    expiresAt:    result.expiresAt,
  });
}
