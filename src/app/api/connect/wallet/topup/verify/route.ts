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

  const { data: order } = await supabase
    .from("imotara_wallet_orders")
    .select("id, user_id, amount, currency_code, status")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

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
  const { data: markedRows } = await supabase
    .from("imotara_wallet_orders")
    .update({ razorpay_payment_id, status: "completed" })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");

  if (!markedRows || markedRows.length === 0) {
    // Another concurrent request already completed this order — return idempotent response
    const { data: wallet } = await supabase
      .from("imotara_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();
    return NextResponse.json({ ok: true, amount_credited: order.amount, new_balance: wallet?.balance ?? 0 });
  }

  // Credit wallet — safe to read-modify-write now because only one request reaches this point
  // (the .eq("status","pending") predicate above serialises concurrent requests at the DB level)
  const { data: existing } = await supabase
    .from("imotara_wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const currentBalance = Number(existing?.balance ?? 0);
  const newBalance     = currentBalance + Number(order.amount);

  await supabase.from("imotara_wallets").upsert(
    { user_id: user.id, balance: newBalance, currency_code: order.currency_code, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  // Log transaction
  await supabase.from("imotara_wallet_transactions").insert({
    user_id:             user.id,
    type:                "topup",
    amount:              Number(order.amount),
    currency_code:       order.currency_code,
    description:         `Wallet top-up via Razorpay`,
    razorpay_payment_id,
    razorpay_order_id,
  });

  // Reset inactivity clock — balance is now active for another 2 years
  await updateWalletActivity(user.id);

  return NextResponse.json({ ok: true, amount_credited: order.amount, new_balance: newBalance });
}
