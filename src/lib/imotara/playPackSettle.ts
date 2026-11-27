// src/lib/imotara/playPackSettle.ts
// #44 (27 Nov 2026) — Google Play token packs: what to answer when a purchase token we have
// ALREADY claimed is reported again, and the price the app reports (Play's API has none).
// Moved out of the route so it can be tested (a Next route file may export only handlers).

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantLicense } from "@/lib/imotara/grantLicense";
import type { LicenseProductId } from "@/lib/imotara/grantLicense";

type SupabaseAdmin = SupabaseClient;

/** #44: the store price the APP reports (Play's server API has none). Records only. */
export function reportedPlayPrice(micros: unknown, currency: unknown): { minor: number; currency: string } {
  const m = typeof micros === "number" ? micros : Number(micros);
  const c = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  if (Number.isInteger(m) && m > 0 && m < 1e13 && /^[A-Z]{3}$/.test(c)) {
    return { minor: Math.round(m / 10_000), currency: c }; // micros ⇒ hundredths
  }
  return { minor: 0, currency: "XXX" };
}

export async function markGranted(admin: SupabaseAdmin, purchaseToken: string, tier: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await admin.from("payment_licenses").update({ tier }).eq("payment_id", purchaseToken);
    if (!error) return;
    console.error("[google-play/verify] could not mark granted", attempt, error.message);
  }
}

/** A claim older than this that still says "pending" ⇒ the grant that claimed it died. */
export const STALE_PENDING_MS = 2 * 60_000;
/**
 * ⛔ Claims made BEFORE the "granted" mark was awaited may say "pending" although their credits
 * WERE given (the mark was fire-and-forget). Those are never re-granted — only claims from
 * this change on, where "pending" really means "not granted".
 */
export const RECOVERY_FROM = Date.parse("2026-11-28T00:00:00Z");

/**
 * 🔴 #44 (27 Nov 2026): a token-pack token we have ALREADY claimed. It used to answer
 * "already_processed" (ok) unconditionally — so if the first attempt died between the claim
 * and the grant (timeout, crash), the buyer's app was told "done" and the credits were never
 * given. Now:
 *  · another account's purchase ⇒ refused (never "ok" for credits this account did not get);
 *  · granted ⇒ already_processed, as before;
 *  · still "pending" and fresh ⇒ the first attempt is mid-grant ⇒ 202 pending (app retries);
 *  · still "pending" and stale ⇒ take the claim over (pending → granting, only one caller can)
 *    and grant now.
 */
export async function settleRepeatedPack(
  admin: SupabaseAdmin,
  userId: string,
  productId: LicenseProductId,
  purchaseToken: string,
): Promise<NextResponse> {
  const { data: row, error } = await admin
    .from("payment_licenses")
    .select("user_id, tier, granted_at")
    .eq("payment_id", purchaseToken)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: "Could not check this purchase — please retry" }, { status: 503 });
  }
  if (row.user_id !== userId) {
    return NextResponse.json({ ok: false, error: "This purchase was already used on another account. Please contact support." }, { status: 409 });
  }
  const unfinished = row.tier === "pending" || row.tier === "granting";
  const claimedAt = new Date(String(row.granted_at ?? 0)).getTime();
  if (!unfinished || !(claimedAt >= RECOVERY_FROM)) return NextResponse.json({ ok: true, message: "already_processed" });

  const age = Date.now() - claimedAt;
  if (!(age > STALE_PENDING_MS)) {
    return NextResponse.json(
      { ok: false, pending: true, error: "Your purchase is still being processed. Please try Restore purchases in a minute." },
      { status: 202 },
    );
  }

  // Take the claim over — only the caller whose update matches "pending" wins.
  const { data: taken } = await admin
    .from("payment_licenses")
    .update({ tier: "granting", granted_at: new Date().toISOString() })
    .eq("payment_id", purchaseToken)
    .eq("tier", row.tier)
    .eq("granted_at", row.granted_at)
    .select("payment_id");
  if (!Array.isArray(taken) || taken.length === 0) {
    return NextResponse.json({ ok: true, message: "already_processed" });
  }

  const result = await grantLicense(userId, productId, admin, "google_play", null);
  if (!result.ok) {
    await admin.from("payment_licenses").update({ tier: "pending" }).eq("payment_id", purchaseToken);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  await markGranted(admin, purchaseToken, result.tier);
  console.warn("[google-play/verify] finished a grant that an earlier attempt claimed but never completed", productId);
  return NextResponse.json({ ok: true, tier: result.tier, tokenBalance: result.tokenBalance, expiresAt: result.expiresAt });
}
