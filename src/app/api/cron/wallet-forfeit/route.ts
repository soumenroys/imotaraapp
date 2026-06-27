export const preferredRegion = ["sin1"];
export const maxDuration = 60;

// GET /api/cron/wallet-forfeit
// Vercel Cron — runs daily at 09:00 IST (03:30 UTC).
// Finds active wallets whose expires_at has passed and forfeits their balance:
//   1. Logs a 'forfeiture' transaction
//   2. Sets balance = 0, status = 'forfeited', forfeited_at = now()
//
// Policy: 2-year inactivity → expire. After forfeiture, user still has 6 months
// to contact support@imotara.com for a refund (handled manually via support ticket).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import nodemailer from "nodemailer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const SMTP_HOST   = process.env.SMTP_HOST   ?? "smtp.hostinger.com";
const GMAIL_USER  = process.env.ALERT_GMAIL_USER          ?? "";
const GMAIL_PASS  = process.env.ALERT_GMAIL_APP_PASSWORD  ?? "";

// Grace-period refund deadline — 6 months from forfeiture date
function graceDeadline(forfeitedAt: Date): string {
  const d = new Date(forfeitedAt.getTime() + 180 * 86_400_000);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function buildForfeitEmail(balance: number, forfeitedAt: Date): string {
  return [
    `Dear Imotara user,`,
    ``,
    `Your Imotara Wallet balance of ₹${balance.toFixed(2)} has expired due to 2 years of inactivity.`,
    ``,
    `As per our Wallet Terms, balances that remain unused for 2 years are forfeited.`,
    `We sent you a 30-day advance notice before this expiry.`,
    ``,
    `GRACE PERIOD — REFUND REQUEST WINDOW`,
    `You have until ${graceDeadline(forfeitedAt)} (6 months from today) to request a refund.`,
    `To claim your refund, please email us at support@imotara.com with the subject:`,
    `  "Wallet Refund Request — [your registered email]"`,
    ``,
    `We will verify your identity and credit the amount to your bank account within 7 business days.`,
    ``,
    `After ${graceDeadline(forfeitedAt)}, balances cannot be recovered.`,
    ``,
    `— The Imotara Team`,
    ``,
    `--`,
    `This is an automated message in compliance with the Consumer Protection Act 2019 (India).`,
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();

  // Find active wallets with a positive balance that have expired
  const { data: wallets, error } = await supabase
    .from("imotara_wallets")
    .select("user_id, balance, currency_code, expires_at")
    .eq("status", "active")
    .gt("balance", 0)
    .lt("expires_at", now.toISOString());

  if (error) {
    console.error("[wallet-forfeit] query error:", error.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  if (!wallets || wallets.length === 0) {
    return NextResponse.json({ ok: true, forfeited: 0 });
  }

  // Fetch user emails
  const emailMap: Record<string, string> = {};
  for (const w of wallets) {
    const { data: { user } } = await supabase.auth.admin.getUserById(w.user_id);
    if (user?.email) emailMap[w.user_id] = user.email;
  }

  let transporter: nodemailer.Transporter | null = null;
  if (GMAIL_USER && GMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: 465, secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
  }

  let forfeited = 0;
  for (const wallet of wallets) {
    const amount = Number(wallet.balance);

    // Log forfeiture transaction BEFORE zeroing balance
    await supabase.from("imotara_wallet_transactions").insert({
      user_id:       wallet.user_id,
      type:          "forfeiture",
      amount,
      currency_code: wallet.currency_code ?? "INR",
      description:   "Balance forfeited after 2 years of inactivity",
    });

    // Zero out the wallet and mark forfeited
    await supabase
      .from("imotara_wallets")
      .update({
        balance:          0,
        status:           "forfeited",
        forfeited_at:     now.toISOString(),
        forfeited_amount: amount,
      })
      .eq("user_id", wallet.user_id);

    // Send forfeiture notification email
    const email = emailMap[wallet.user_id];
    if (email && transporter) {
      try {
        await transporter.sendMail({
          from:    `"Imotara" <${GMAIL_USER}>`,
          to:      email,
          subject: `Important: Your Imotara Wallet balance has expired — refund window open`,
          text:    buildForfeitEmail(amount, now),
        });
      } catch (err) {
        console.error(`[wallet-forfeit] email failed for ${wallet.user_id}:`, err);
      }
    }

    forfeited++;
    console.log(`[wallet-forfeit] forfeited ₹${amount} for user ${wallet.user_id}`);
  }

  return NextResponse.json({ ok: true, forfeited });
}
