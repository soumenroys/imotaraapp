// POST /api/connect/wallet/topup/create
// Auth required. Creates a Razorpay order to top up the Imotara wallet.
// Body: { amount: number, terms_accepted: true }
// Consent is recorded here (before payment) so there is an irrefutable audit record.

export const preferredRegion = ["sin1"];
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import { recordWalletConsent } from "@/lib/wallet/mailer";

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  if (!body.terms_accepted) {
    return NextResponse.json(
      { ok: false, error: "You must accept the Wallet Terms to proceed" },
      { status: 400 }
    );
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
    return NextResponse.json({ ok: false, error: "Amount must be between ₹1 and ₹50,000" }, { status: 400 });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ ok: false, error: "Payment gateway not configured" }, { status: 503 });
  }

  const amountPaise = Math.round(amount * 100);
  const receipt     = `wallet_${user.id.slice(0, 8)}_${Date.now()}`;
  const auth        = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method:  "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount:   amountPaise,
      currency: "INR",
      receipt,
      notes:    { user_id: user.id, type: "wallet_topup" },
    }),
  });

  if (!orderRes.ok) {
    const txt = await orderRes.text();
    console.error("[topup/create] Razorpay error:", txt);
    return NextResponse.json({ ok: false, error: "Payment processing failed. Please try again." }, { status: 502 });
  }

  const order = await orderRes.json();
  const supabase = getSupabaseAdmin();

  await supabase.from("imotara_wallet_orders").insert({
    user_id:           user.id,
    razorpay_order_id: order.id,
    amount,
    currency_code:     "INR",
    status:            "pending",
  });

  // Record consent BEFORE payment — legally irrefutable audit record.
  await recordWalletConsent({
    userId:          user.id,
    amount,
    razorpayOrderId: order.id,
    ipAddress:       req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
    userAgent:       req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    ok:                true,
    razorpay_key_id:   RAZORPAY_KEY_ID,
    razorpay_order_id: order.id,
    amount_paise:      amountPaise,
    amount,
  });
}
