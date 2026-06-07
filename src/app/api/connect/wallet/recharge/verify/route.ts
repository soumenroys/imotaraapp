// POST /api/connect/wallet/recharge/verify
// Auth required. Verifies Razorpay payment signature and activates the recharge.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

export const preferredRegion = ["sin1"];
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!RAZORPAY_KEY_SECRET) return false;
  const payload = `${orderId}|${paymentId}`;
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

  if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    console.error("[connect/recharge/verify] signature mismatch — possible spoofing attempt");
    return NextResponse.json({ ok: false, error: "Payment verification failed" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch the pending recharge
  const { data: recharge } = await supabase
    .from("connect_recharges")
    .select("id, user_id, consultant_id, minutes_credited, consultant_credit, status")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

  if (!recharge) {
    return NextResponse.json({ ok: false, error: "Recharge record not found" }, { status: 404 });
  }
  if (recharge.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (recharge.status === "completed") {
    // Idempotent — already processed
    return NextResponse.json({ ok: true, minutes_credited: recharge.minutes_credited });
  }

  // Mark recharge completed
  const { error: updateError } = await supabase
    .from("connect_recharges")
    .update({
      razorpay_payment_id,
      status: "completed",
    })
    .eq("id", recharge.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  // Ensure wallet row exists for user
  await supabase
    .from("connect_wallet")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  return NextResponse.json({ ok: true, minutes_credited: recharge.minutes_credited });
}
