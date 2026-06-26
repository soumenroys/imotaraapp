// POST /api/connect/wallet/recharge/create
// Auth required. Creates a Razorpay order for recharging the Connect wallet.
// Body: { consultant_id, minutes, currency_code? }
// Returns: { razorpay_order_id, amount_paise, amount, currency, minutes, breakdown }

export const preferredRegion = ["sin1"];
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

// Hardcoded fallback exchange rates to INR (updated daily via cron)
const FALLBACK_RATES: Record<string, number> = {
  INR: 1, USD: 83.5, EUR: 90.2, GBP: 105.8, AED: 22.7, SGD: 61.9, AUD: 54.3,
};

async function getExchangeRates(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "exchange_rates")
      .single();
    if (data?.value) return data.value as Record<string, number>;
  } catch {
    // fall through to defaults
  }
  return FALLBACK_RATES;
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const { consultant_id, minutes } = body;

  if (!consultant_id) {
    return NextResponse.json({ ok: false, error: "consultant_id required" }, { status: 400 });
  }
  const minutesNum = Number(minutes);
  if (!Number.isFinite(minutesNum) || !Number.isInteger(minutesNum) || minutesNum < 1 || minutesNum > 1000) {
    return NextResponse.json({ ok: false, error: "minutes must be a whole number between 1 and 1000" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, rate_per_min, currency_code, display_name")
    .eq("id", consultant_id)
    .eq("status", "approved")
    .single();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  const rates = await getExchangeRates(supabase);
  const ratePerMin   = Number(consultant.rate_per_min);
  const currency     = consultant.currency_code;

  // Total amount user pays (consultant currency)
  const totalAmount  = ratePerMin * Number(minutes);
  // 20% platform fee, 80% consultant credit
  const platformFee       = totalAmount * 0.20;
  const consultantCredit  = totalAmount * 0.80;

  // Convert to INR for Razorpay (which only accepts INR for domestic).
  // Do NOT fall back to 1 for unknown currencies — a 1:1 rate would silently undercharge
  // users for non-INR consultants (e.g. USD treated as INR = 83x undercharge).
  const rateToINR = rates[currency] ?? FALLBACK_RATES[currency];
  if (!rateToINR || rateToINR <= 0) {
    console.error("[recharge/create] no exchange rate for currency:", currency);
    return NextResponse.json({ ok: false, error: "Exchange rate temporarily unavailable. Please try again." }, { status: 503 });
  }
  const amountINR    = totalAmount * rateToINR;
  const amountPaise  = Math.round(amountINR * 100); // Razorpay uses paise

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ ok: false, error: "Payment gateway not configured" }, { status: 503 });
  }

  if (amountPaise < 100) {
    return NextResponse.json({ ok: false, error: "Minimum payment amount is ₹1. Please check the consultant's rate and try again." }, { status: 400 });
  }

  // Razorpay domestic transactions are capped at ₹5,00,000 per order. Guard here to
  // return a friendly 400 instead of a cryptic Razorpay 4xx at order creation time.
  const RAZORPAY_MAX_PAISE = 50_000_000; // ₹5,00,000
  if (amountPaise > RAZORPAY_MAX_PAISE) {
    return NextResponse.json(
      { ok: false, error: "Maximum single recharge is ₹5,00,000. Please reduce the number of minutes." },
      { status: 400 }
    );
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const receipt = `connect_${user.id.slice(0, 8)}_${Date.now()}`;

  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount:   amountPaise,
      currency: "INR",
      receipt,
      notes:    { consultant_id, user_id: user.id, minutes: String(minutes) },
    }),
  });

  if (!orderRes.ok) {
    const txt = await orderRes.text();
    console.error("[recharge/create] Razorpay error:", txt);
    return NextResponse.json({ ok: false, error: "Payment processing failed. Please try again." }, { status: 502 });
  }

  const order = await orderRes.json();

  // Persist pending recharge — must succeed before returning order to client
  const { error: insertError } = await supabase.from("connect_recharges").insert({
    user_id:             user.id,
    consultant_id,
    razorpay_order_id:   order.id,
    amount:              totalAmount,
    currency_code:       currency,
    amount_inr:          +amountINR.toFixed(4), // INR equivalent at order-creation time — used by verify for invoice
    minutes_credited:    Number(minutes),
    platform_fee:        platformFee,
    consultant_credit:   consultantCredit,
    status:              "pending",
  });
  if (insertError) {
    // 23505: partial unique index uq_connect_recharges_user_consultant_pending prevented this insert.
    // Another recharge is already pending for this user+consultant pair — prevent double-payment.
    if (insertError.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "A recharge is already in progress for this companion. Please complete or cancel it first." },
        { status: 409 }
      );
    }
    console.error("[recharge/create] insert failed:", insertError.message);
    return NextResponse.json({ ok: false, error: "Failed to create recharge record. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    razorpay_order_id:   order.id,
    razorpay_key_id:     RAZORPAY_KEY_ID,
    amount_paise:        amountPaise,
    amount:              totalAmount,
    currency:            currency,
    minutes:             Number(minutes),
    breakdown: {
      consultant_name:  consultant.display_name,
      rate_per_min:     ratePerMin,
      currency,
      minutes:          Number(minutes),
      consultant_credit: consultantCredit,
      platform_fee:     platformFee,
      total:            totalAmount,
    },
  });
}
