// src/lib/imotara/playRenewal.ts
// Google Play subscription RENEWALS.
//
// 🔴 FOUND 6 Nov 2026: nothing ever extended an Android subscription. A Play
// subscription keeps ONE purchase token for its whole life; the verify route
// answered a known token "already_processed", Real-time developer
// notifications are OFF in Play Console, and the app only re-sends a token
// when someone opens the upgrade sheet. ⇒ every Android Plus subscriber would
// have dropped to Free at the end of the first period while still paying.
//
// ✅ Two ways in, one rule:
//  • the app re-sends a token (verify route, claim "taken") ⇒ extend;
//  • a daily sweep (/api/cron/store-renewals) asks Google about every Play
//    subscription we hold ⇒ extend.
// Extending = grantLicense with GOOGLE'S expiry, which never shortens and adds
// no tokens ⇒ running it twice changes nothing.
//
// ⛔ The token belongs to whoever FIRST redeemed it (payment_licenses.user_id).
// Someone else posting it extends nothing.

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { grantLicense, PRODUCT_CATALOG, type LicenseProductId } from "@/lib/imotara/grantLicense";
import { createInvoice, getProductDescription } from "@/lib/imotara/invoiceUtils";
import type { GooglePlayPurchaseResult } from "@/lib/googlePlay";

export const PLAY_SUBSCRIPTION_SKUS = ["plus_monthly", "plus_annual", "pro_monthly", "pro_annual"] as const;

type Verified = Pick<GooglePlayPurchaseResult, "valid" | "expiresAt" | "orderId">;

/** Extend the token's OWNER to Google's expiry; one invoice per Google order (a renewal has a new order id). */
export async function extendPlayGrant(
  admin: SupabaseClient,
  ownerId: string,
  productId: LicenseProductId,
  verification: Verified,
): Promise<{ ok: true; tier: string; tokenBalance: number; expiresAt: string | null } | { ok: false; error: string }> {
  if (!verification.valid || !verification.expiresAt) return { ok: false, error: "not active at Google" };
  const result = await grantLicense(ownerId, productId, admin, "google_play", verification.expiresAt);
  if (!result.ok) return { ok: false, error: result.error ?? "grant failed" };
  if (verification.orderId) {
    await createInvoice(admin, {
      userId: ownerId,
      productId,
      tier: result.tier,
      description: getProductDescription(productId),
      paymentGateway: "google_play",
      gatewayRef: verification.orderId,
      amountPaise: 0,
      currency: "USD",
      periodStart: new Date().toISOString(),
      periodEnd: result.expiresAt ?? verification.expiresAt,
    }).catch((err: unknown) => console.error("[playRenewal] invoice failed:", err));
  }
  return { ok: true, tier: result.tier ?? "free", tokenBalance: result.tokenBalance ?? 0, expiresAt: result.expiresAt ?? null };
}

/** The verify route's renewal answer: a token it has seen before. */
export async function renewPlaySubscription(
  admin: SupabaseClient,
  requesterId: string,
  productId: LicenseProductId,
  purchaseToken: string,
  verification: Verified,
): Promise<NextResponse> {
  const { data: row } = await admin
    .from("payment_licenses")
    .select("user_id")
    .eq("payment_id", purchaseToken)
    .maybeSingle();
  if (!row || row.user_id !== requesterId) {
    // ⛔ Not theirs: say nothing about whose it is.
    return NextResponse.json({ ok: false, error: "purchase belongs to another account" }, { status: 409 });
  }
  const r = await extendPlayGrant(admin, requesterId, productId, verification);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, renewed: true, tier: r.tier, tokenBalance: r.tokenBalance, expiresAt: r.expiresAt });
}

export type PlaySweepDeps = {
  verify: (productId: string, token: string) => Promise<Verified>;
};

/**
 * The daily sweep: every Play subscription token we have granted. Google is
 * the judge — active ⇒ extend to its expiry; anything else ⇒ leave it, the
 * licence lapses on its own date (we never cut a grant short here).
 */
export async function sweepPlayRenewals(admin: SupabaseClient, deps: PlaySweepDeps) {
  const { data, error } = await admin
    .from("payment_licenses")
    .select("payment_id, user_id, product_id, tier")
    .in("product_id", PLAY_SUBSCRIPTION_SKUS as unknown as string[])
    .neq("tier", "pending")
    // Play tokens are long opaque strings; Razorpay ids start pay_/order_, Apple ids are digits.
    .not("payment_id", "like", "pay\\_%")
    .not("payment_id", "like", "order\\_%");
  if (error) return { checked: 0, extended: 0, errors: [error.message] };

  const rows = (data ?? []).filter((r) => !/^\d+$/.test(String(r.payment_id)) && String(r.payment_id).length > 40);
  let extended = 0;
  const errors: string[] = [];
  for (const r of rows) {
    if (!(r.product_id in PRODUCT_CATALOG)) continue;
    try {
      const v = await deps.verify(r.product_id, r.payment_id);
      if (!v.valid) continue;
      const out = await extendPlayGrant(admin, r.user_id, r.product_id as LicenseProductId, v);
      if (out.ok) extended++;
      else errors.push(out.error);
    } catch (e) {
      errors.push(String(e));
    }
  }
  return { checked: rows.length, extended, errors };
}
