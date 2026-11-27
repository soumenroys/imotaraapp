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
  PLAY_PURCHASE_TOKEN,
} from "@/lib/googlePlay";
import { grantLicense, isValidProductId } from "@/lib/imotara/grantLicense";
import type { LicenseProductId } from "@/lib/imotara/grantLicense";
import { createInvoice, getProductDescription } from "@/lib/imotara/invoiceUtils";
import { claimPayment, releasePayment } from "@/lib/imotara/claimPayment";
import { renewPlaySubscription } from "@/lib/imotara/playRenewal";
import { markGranted, reportedPlayPrice, settleRepeatedPack } from "@/lib/imotara/playPackSettle";

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
  // ⛔ A purchase never lands on a GUEST identity (25 Oct 2026): it vanishes on reinstall,
  //    and with it the plan someone paid for. The app now asks a guest to sign in first;
  //    this is the backstop. Unacknowledged, the purchase stays restorable after sign-in.
  if (authData?.user?.is_anonymous) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 403 });

  let body: { productId: string; purchaseToken: string; orderId?: string; paidMicros?: unknown; paidCurrency?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }

  const { productId, purchaseToken } = body;

  if (!productId || !purchaseToken) {
    return NextResponse.json({ ok: false, error: "productId and purchaseToken required" }, { status: 400 });
  }
  if (!isValidProductId(productId)) {
    return NextResponse.json({ ok: false, error: "Unknown product" }, { status: 400 });
  }
  // 🔴 #172 (27 Nov 2026): strict token shape — see PLAY_PURCHASE_TOKEN (replay via URL suffixes).
  if (typeof purchaseToken !== "string" || !PLAY_PURCHASE_TOKEN.test(purchaseToken)) {
    return NextResponse.json({ ok: false, error: "productId and purchaseToken required" }, { status: 400 });
  }

  const admin          = getSupabaseAdmin();
  const isSubscription = SUBSCRIPTION_SKUS.has(productId);

  // Verify with Google Play FIRST — a renewal and a first purchase both need Google's word.
  const verification = isSubscription
    ? await verifyGooglePlaySubscription(PACKAGE_NAME, productId, purchaseToken)
    : await verifyGooglePlayProduct(PACKAGE_NAME, productId, purchaseToken);

  // #172 (27 Nov 2026): PENDING (UPI / cash still completing) is not "invalid". It used to answer
  // 400 and the app said "Verification failed" to someone who HAD paid. 202 + pending ⇒ the app
  // leaves the purchase unfinished and retries; Google completes it within minutes or cancels it.
  if (verification.pending) {
    // `error` is SHOWN by app ≤1.7.3 (it alerts data.error) ⇒ plain words, not a code. Newer apps
    // read `pending: true` / 202 and show their own translated message.
    return NextResponse.json(
      { ok: false, pending: true, error: "Your payment is still being completed. Once Google confirms it, tap Restore purchases to activate." },
      { status: 202 },
    );
  }
  if (!verification.valid) {
    // Google's own error text stays in our logs, not in the app.
    console.warn("[google-play/verify] not valid:", productId, verification.state ?? "", verification.error ?? "");
    return NextResponse.json({ ok: false, error: "Purchase not valid" }, { status: 400 });
  }

  const paid = reportedPlayPrice(body.paidMicros, body.paidCurrency);

  // 🔴 ONE grant per purchase ⇒ lib/imotara/claimPayment.ts (6 Nov 2026).
  const claim = await claimPayment(admin, {
    payment_id:   purchaseToken,
    user_id:      userId,
    product_id:   productId,
    tier:         "pending", // updated below after grant
    // #44 (27 Nov 2026): Google's purchase API carries NO price. This used to write a false
    // "USD" for everyone; now it is what the app reports from the store (records only — never
    // used to grant anything), else "XXX" (ISO 4217: not reported).
    amount_paise: verification.isTest ? 0 : paid.minor,
    // 28 Nov 2026: a licence-tester purchase is marked like Apple's test store.
    currency:     verification.isTest ? "SANDBOX" : paid.currency,
  });
  if (claim === "error") {
    return NextResponse.json({ ok: false, error: "Could not record the purchase — please retry" }, { status: 503 });
  }

  if (claim === "taken") {
    // 🔑 A Play SUBSCRIPTION keeps ONE purchase token across every renewal.
    // Until 6 Nov 2026 a known token was answered "already_processed" — so a
    // renewal could never extend Plus, and every Android subscriber would have
    // lost it after the first period. ⇒ a known subscription token is a
    // RENEWAL: extend to Google's own expiry (grant never shortens, adds no
    // tokens ⇒ safe to repeat). A token pack is genuinely done.
    if (!isSubscription) return settleRepeatedPack(admin, userId, productId as LicenseProductId, purchaseToken);
    return renewPlaySubscription(admin, userId, productId as LicenseProductId, purchaseToken, verification);
  }

  // Acknowledge (required within 3 days or Google refunds automatically)
  void acknowledgeGooglePlayPurchase(PACKAGE_NAME, productId, purchaseToken, isSubscription);

  // Grant license
  // 🔴 Pass Play's OWN expiry, not the catalog's day count. verification
  // already carries lineItems[0].expiryTime and this route used to discard it,
  // so a 7-day free trial granted 31 days of Plus. One-time token packs have no
  // expiry and ignore the argument.
  const result = await grantLicense(
    userId, productId as LicenseProductId, admin, "google_play",
    isSubscription ? verification.expiresAt : null,
  );
  if (!result.ok) {
    await releasePayment(admin, purchaseToken);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  // Update with real tier — AWAITED (#44): "pending" is how a later report knows the grant
  // never finished (settleRepeatedPack), so this mark must really be written.
  await markGranted(admin, purchaseToken, result.tier);

  // Create invoice — never for a licence-tester (free test) purchase (28 Nov 2026).
  if (!verification.isTest) createInvoice(admin, {
    userId,
    productId,
    tier:           result.tier,
    description:    getProductDescription(productId),
    paymentGateway: "google_play",
    gatewayRef:     verification.orderId ?? purchaseToken.slice(0, 40),
    amountPaise:    paid.minor,    // #44: app-reported store price, else 0
    currency:       paid.currency, // #44: else "XXX" (not reported) — never a false "USD"
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
