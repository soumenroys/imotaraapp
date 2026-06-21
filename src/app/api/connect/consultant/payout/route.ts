export const preferredRegion = ["sin1"];

// GET  /api/connect/consultant/payout — list own payout history (last 50)
// POST /api/connect/consultant/payout — request a new payout
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import nodemailer from "nodemailer";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("connect_payouts")
    .select("id, amount, currency_code, payout_method, status, admin_note, created_at, processed_at")
    .eq("consultant_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[payout/GET] query error:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to fetch payouts. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, payouts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const { amount, currency_code, payout_method, payout_details } = body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ ok: false, error: "amount must be positive" }, { status: 400 });
  }

  const currency = (currency_code ?? "INR").toUpperCase();
  const minPayout = currency === "USD" ? 10 : 500;
  const minLabel  = currency === "USD" ? "$10" : "₹500";
  if (Number(amount) < minPayout) {
    return NextResponse.json(
      { ok: false, error: `Minimum payout is ${minLabel}. Please accumulate more earnings before requesting.` },
      { status: 400 }
    );
  }
  if (!["upi", "bank", "bank_in", "bank_int", "paypal"].includes(payout_method)) {
    return NextResponse.json({ ok: false, error: "payout_method must be upi, bank, bank_in, bank_int, or paypal" }, { status: 400 });
  }
  if (payout_details !== undefined && payout_details !== null) {
    const serialized = JSON.stringify(payout_details);
    if (serialized.length > 2000) {
      return NextResponse.json({ ok: false, error: "payout_details too large (max 2000 characters)" }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();

  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, display_name, status")
    .eq("user_id", user.id)
    .single();

  if (!consultant || consultant.status !== "approved") {
    return NextResponse.json({ ok: false, error: "Consultant account not approved" }, { status: 403 });
  }

  const { data: wallet } = await supabase
    .from("connect_wallet")
    .select("earned_amount, pending_payout")
    .eq("user_id", user.id)
    .single();

  const available = Number(wallet?.earned_amount ?? 0) - Number(wallet?.pending_payout ?? 0);
  if (Number(amount) > available) {
    return NextResponse.json(
      { ok: false, error: `Insufficient balance. Available: ${available.toFixed(2)}` },
      { status: 402 }
    );
  }

  // Guard against concurrent double-payout (two simultaneous requests both passing the
  // available-balance check). A pending payout existence check doesn't fully prevent the
  // race but makes it effectively impossible without true millisecond-concurrent requests.
  const { data: existingPayout } = await supabase
    .from("connect_payouts")
    .select("id")
    .eq("consultant_user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existingPayout) {
    return NextResponse.json(
      { ok: false, error: "You already have a pending payout request. Please wait for it to be processed." },
      { status: 400 }
    );
  }

  // Normalize bank_in / bank_int → "bank" for DB (CHECK constraint only allows upi/bank/paypal).
  // Preserve the original method type in payout_details for admin processing.
  const dbPayoutMethod = (payout_method === "bank_in" || payout_method === "bank_int") ? "bank" : payout_method;
  const detailsWithType = (payout_method === "bank_in" || payout_method === "bank_int")
    ? { ...(typeof payout_details === "object" && payout_details !== null ? payout_details : { raw: payout_details }), method_type: payout_method }
    : payout_details ?? null;

  const { data: payout, error } = await supabase
    .from("connect_payouts")
    .insert({
      consultant_user_id: user.id,
      amount:             Number(amount),
      currency_code:      currency_code ?? "INR",
      payout_method:      dbPayoutMethod,
      payout_details:     detailsWithType,
      status:             "pending",
    })
    .select("id")
    .single();

  if (error || !payout) {
    console.error("[payout] insert failed:", error?.message);
    return NextResponse.json({ ok: false, error: "Failed to submit payout request. Please try again." }, { status: 500 });
  }

  // Post-insert race detection: if two concurrent requests both passed the pending-payout guard,
  // both will have inserted rows. The one that now sees > 1 pending row loses and self-cancels.
  const { count: dupeCount } = await supabase
    .from("connect_payouts")
    .select("id", { count: "exact", head: true })
    .eq("consultant_user_id", user.id)
    .eq("status", "pending");
  if ((dupeCount ?? 0) > 1) {
    await supabase.from("connect_payouts").update({ status: "failed" }).eq("id", payout.id);
    return NextResponse.json(
      { ok: false, error: "You already have a pending payout request. Please wait for it to be processed." },
      { status: 409 }
    );
  }

  // Atomic increment prevents double-payout if two concurrent requests both
  // pass the available-balance check before either write completes.
  const { error: rpcErr } = await supabase.rpc("increment_pending_payout", {
    p_user_id: user.id,
    p_amount:  Number(amount),
  });
  if (rpcErr) {
    console.error("[payout] CRITICAL: increment_pending_payout failed for payout", payout.id, rpcErr.message);
    // Cancel the orphaned payout row so it doesn't block future requests
    const { error: cancelErr } = await supabase.from("connect_payouts").update({ status: "failed" }).eq("id", payout.id);
    if (cancelErr) console.error("[payout] CRITICAL: orphan cancel failed for payout", payout.id, "— consultant may be permanently blocked from future payouts:", cancelErr.message);
    return NextResponse.json({ ok: false, error: "Payout request failed. Please try again." }, { status: 500 });
  }

  // Notify admin
  await notifyAdminPayout({ name: consultant.display_name, amount: Number(amount), currency_code, payout_method });

  return NextResponse.json({ ok: true, payout_id: payout.id }, { status: 201 });
}

async function notifyAdminPayout(data: {
  name: string; amount: number; currency_code: string; payout_method: string;
}) {
  const gmailUser = process.env.ALERT_GMAIL_USER?.trim();
  const gmailPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) return;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from:    `"Imotara Alerts" <${gmailUser}>`,
      to:      "publisher@imotara.com",
      subject: `[Connect] Payout request — ${data.name}`,
      text: [
        `Consultant has requested a payout.`,
        `Name:    ${data.name}`,
        `Amount:  ${data.amount} ${data.currency_code}`,
        `Method:  ${data.payout_method}`,
        `Review at: https://imotara.com/admin → Connect tab`,
      ].join("\n"),
    });
  } catch {
    // non-blocking
  }
}
