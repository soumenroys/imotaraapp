// POST /api/connect/wallet/recharge/verify
// Auth required. Verifies Razorpay payment signature and activates the recharge.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

export const preferredRegion = ["sin1"];
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import { createInvoice } from "@/lib/imotara/invoiceUtils";
import { sendRechargeInvoiceEmail } from "@/lib/connect/mailer";

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
    .select("id, user_id, consultant_id, minutes_credited, consultant_credit, amount, currency_code, status")
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
  if (recharge.status !== "pending") {
    // Recharge is in a terminal non-completable state (failed, expired, etc.)
    return NextResponse.json({ ok: false, error: "Recharge cannot be verified" }, { status: 409 });
  }

  // Mark recharge completed — .eq("status","pending") is the atomic idempotency gate:
  // only the first concurrent verify request wins; the second matches 0 rows and is ignored.
  const { data: markedRows, error: updateError } = await supabase
    .from("connect_recharges")
    .update({
      razorpay_payment_id,
      status: "completed",
    })
    .eq("id", recharge.id)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }
  if (!markedRows || markedRows.length === 0) {
    // Another concurrent request already completed this recharge
    return NextResponse.json({ ok: true, minutes_credited: recharge.minutes_credited });
  }

  // Note: connect_wallet is the consultant earnings ledger — do NOT create rows for regular users.
  // The paying user's balance is tracked via connect_recharges, not connect_wallet.

  // Fetch consultant name for invoice and email
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("display_name")
    .eq("id", recharge.consultant_id)
    .limit(1)
    .maybeSingle();

  const consultantName = consultant?.display_name ?? "Companion";
  const amount         = Number(recharge.amount ?? 0);
  const currency       = recharge.currency_code ?? "INR";
  const minutes        = Number(recharge.minutes_credited ?? 0);

  // Create invoice record
  const invoice = await createInvoice(supabase, {
    userId:         user.id,
    productId:      "connect_session_minutes",
    description:    `Imotara Connect · Session with ${consultantName} · ${minutes} min`,
    paymentGateway: "razorpay",
    gatewayRef:     razorpay_payment_id,
    amountPaise:    Math.round(amount * 100),
    currency,
  });

  // Send invoice email to user (non-blocking)
  if (user.email) {
    sendRechargeInvoiceEmail({
      userEmail:       user.email,
      consultantName,
      minutesCredited: minutes,
      amount,
      currency,
      paymentId:       razorpay_payment_id,
      invoiceNumber:   invoice?.invoiceNumber,
    }).catch((err) => console.error("[connect/recharge/verify] email error:", err));
  }

  return NextResponse.json({ ok: true, minutes_credited: recharge.minutes_credited });
}
