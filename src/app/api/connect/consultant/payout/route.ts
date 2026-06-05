// POST /api/connect/consultant/payout
// Auth required. Consultant requests a payout.
// Body: { amount, currency_code, payout_method, payout_details }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import nodemailer from "nodemailer";

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
  if (!["upi", "bank", "paypal"].includes(payout_method)) {
    return NextResponse.json({ ok: false, error: "payout_method must be upi, bank, or paypal" }, { status: 400 });
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

  const { data: payout, error } = await supabase
    .from("connect_payouts")
    .insert({
      consultant_user_id: user.id,
      amount:             Number(amount),
      currency_code:      currency_code ?? "INR",
      payout_method,
      payout_details:     payout_details ?? null,
      status:             "pending",
    })
    .select("id")
    .single();

  if (error || !payout) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  // Update pending_payout
  await supabase
    .from("connect_wallet")
    .update({ pending_payout: Number(wallet?.pending_payout ?? 0) + Number(amount) })
    .eq("user_id", user.id);

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
      host: "smtp.gmail.com", port: 465, secure: true,
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
