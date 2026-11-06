// src/lib/imotara/claimPayment.ts
// ONE grant per payment, however many times the payment is reported.
//
// 🔴 MEASURED 6 Nov 2026: every Razorpay payment was granted THREE times — a
// ₹149 Plus month gave 3 months (pay_Ttgci…: expiry 28 Feb ⇒ 31 Mar ⇒ 1 May
// 2027) and wrote 3 invoices. The browser's verify-payment and the webhook's
// two events (payment.captured, order.paid) arrive within ~15 s of each other,
// and each one ASKED "already processed?" and then granted. Every caller
// passed the question before any of them wrote the answer.
//
// ✅ The question and the answer are now one statement: insert the payment row
// unless it exists, and report whether THIS call inserted it. Only the winner
// grants. payment_licenses.payment_id is the primary key, so Postgres settles
// the race, not our code.
//
// ⛔ Never go back to select-then-insert here, however tidy it looks.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentRow = {
  payment_id: string;
  user_id: string;
  product_id: string;
  tier: string;
  amount_paise: number;
  currency: string;
  granted_at?: string;
};

/**
 * "won"    ⇒ this caller recorded the payment first ⇒ it grants.
 * "taken"  ⇒ someone already did ⇒ grant NOTHING.
 * "error"  ⇒ the database did not answer ⇒ grant nothing, and let the caller
 *            fail loudly so the sender retries (a retry is safe; a guess is not).
 */
export async function claimPayment(admin: SupabaseClient, row: PaymentRow): Promise<"won" | "taken" | "error"> {
  const { data, error } = await admin
    .from("payment_licenses")
    .upsert({ granted_at: new Date().toISOString(), ...row }, { onConflict: "payment_id", ignoreDuplicates: true })
    .select("payment_id");
  if (error) {
    console.error("[claimPayment]", row.payment_id, error.message);
    return "error";
  }
  return Array.isArray(data) && data.length > 0 ? "won" : "taken";
}

/**
 * The winner's grant FAILED ⇒ hand the claim back, so the next report of the
 * same payment (a webhook retry, the user pressing retry) can grant it.
 * Without this, someone who paid would be told "already processed" forever.
 */
export async function releasePayment(admin: SupabaseClient, paymentId: string): Promise<void> {
  const { error } = await admin.from("payment_licenses").delete().eq("payment_id", paymentId);
  if (error) console.error("[releasePayment]", paymentId, error.message);
}
