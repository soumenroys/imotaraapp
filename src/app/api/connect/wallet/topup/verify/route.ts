// POST /api/connect/wallet/topup/verify
// Auth required. Verifies Razorpay signature and credits the Imotara wallet.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

export const preferredRegion = ["sin1"];
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import { updateWalletActivity } from "@/lib/wallet/activity";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!RAZORPAY_KEY_SECRET) return false;
  const payload  = `${orderId}|${paymentId}`;
  const expected = createHmac("sha256", RAZORPAY_KEY_SECRET).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ ok: false, error: "Missing payment fields" }, { status: 400 });
  }

  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    console.error("[wallet/topup/verify] signature mismatch");
    return NextResponse.json({ ok: false, error: "Payment verification failed" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: order, error: orderErr } = await supabase
    .from("imotara_wallet_orders")
    .select("id, user_id, amount, currency_code, status")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

  if (orderErr) {
    console.error("[wallet/topup/verify] order lookup failed:", orderErr.message, "order:", razorpay_order_id);
    return NextResponse.json({ ok: false, error: "Payment verification failed. Please try again." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (order.status === "completed") {
    // Idempotent — already processed
    const { data: wallet } = await supabase
      .from("imotara_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();
    return NextResponse.json({ ok: true, amount_credited: order.amount, new_balance: wallet?.balance ?? 0 });
  }
  if (order.status !== "pending") {
    // Order is in a terminal non-completable state (failed, expired, etc.)
    return NextResponse.json({ ok: false, error: "Order cannot be verified" }, { status: 409 });
  }

  // Mark order completed — .eq("status","pending") is the atomic idempotency gate:
  // only the first concurrent verify request wins; the second matches 0 rows and is ignored.
  const { data: markedRows, error: markError } = await supabase
    .from("imotara_wallet_orders")
    .update({ razorpay_payment_id, status: "completed" })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");

  if (markError) {
    console.error("[wallet/topup/verify] order mark failed:", markError.message);
    return NextResponse.json({ ok: false, error: "Payment verification failed. Please contact support." }, { status: 500 });
  }
  if (!markedRows || markedRows.length === 0) {
    // Another concurrent request already completed this order — return idempotent response
    const { data: wallet } = await supabase
      .from("imotara_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();
    return NextResponse.json({ ok: true, amount_credited: order.amount, new_balance: wallet?.balance ?? 0 });
  }

  // Atomic credit via RPC to prevent the race where two different top-up orders complete
  // simultaneously, both reading the same balance and one overwriting the other's credit.
  // credit_imotara_wallet uses INSERT … ON CONFLICT DO UPDATE SET balance += p_amount.
  const { error: creditErr } = await supabase.rpc("credit_imotara_wallet", {
    p_user_id:  user.id,
    p_amount:   Number(order.amount),
    p_currency: order.currency_code,
  });
  if (creditErr) {
    console.error("[wallet/topup/verify] CRITICAL: credit_imotara_wallet failed for order", order.id, creditErr.message);
    return NextResponse.json({ ok: false, error: "Payment received but wallet credit failed. Please contact support@imotara.com with your payment ID." }, { status: 500 });
  }

  // Read back the new balance for the response
  const { data: credited } = await supabase
    .from("imotara_wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();
  const newBalance = Number(credited?.balance ?? 0);

  // Log transaction — non-critical but required for audit/reconciliation
  const { error: txErr } = await supabase.from("imotara_wallet_transactions").insert({
    user_id:             user.id,
    type:                "topup",
    amount:              Number(order.amount),
    currency_code:       order.currency_code,
    description:         `Wallet top-up via Razorpay`,
    razorpay_payment_id,
    razorpay_order_id,
  });
  if (txErr) console.error("[wallet/topup/verify] transaction log insert failed:", txErr.message, "order:", order.id, "payment:", razorpay_payment_id);

  // Reset inactivity clock — balance is now active for another 2 years
  await updateWalletActivity(user.id);

  return NextResponse.json({ ok: true, amount_credited: order.amount, new_balance: newBalance });
}
