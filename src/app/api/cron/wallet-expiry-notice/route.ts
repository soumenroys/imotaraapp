// GET /api/cron/wallet-expiry-notice
// Vercel Cron — runs daily at 08:00 IST (02:30 UTC).
// Finds wallets expiring within the next 30 days that have not yet received a notice,
// sends a 30-day warning email to each user, and marks expiry_notified_at.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import nodemailer from "nodemailer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const SMTP_HOST   = process.env.SMTP_HOST   ?? "smtp.hostinger.com";
const GMAIL_USER  = process.env.ALERT_GMAIL_USER     ?? "";
const GMAIL_PASS  = process.env.ALERT_GMAIL_APP_PASSWORD ?? "";

function buildNoticeEmail(email: string, balance: number, expiresAt: string): string {
  const expDate = new Date(expiresAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
  return [
    `Dear Imotara user,`,
    ``,
    `This is a reminder that your Imotara Wallet balance of ₹${balance.toFixed(2)} will expire on ${expDate}.`,
    ``,
    `Your balance expires after 2 years of inactivity. To reset this timer and keep your balance active,`,
    `simply top up any amount or book a session before the expiry date.`,
    ``,
    `If your balance expires, you have a 6-month grace period to contact us at support@imotara.com`,
    `to request a refund — we will credit it back to your bank account.`,
    ``,
    `To add balance now, visit: https://imotara.com/connect?tab=wallet`,
    ``,
    `Thank you for being part of Imotara.`,
    ``,
    `— The Imotara Team`,
    ``,
    `--`,
    `This is an automated message. Balance expiry is governed by Imotara's Terms of Service.`,
    `Unused balances that are not claimed within the grace period may be treated as revenue`,
    `in accordance with Indian consumer protection law.`,
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Find active wallets expiring within 30 days that haven't been notified yet
  const now          = new Date();
  const in30Days     = new Date(now.getTime() + 30 * 86_400_000).toISOString();

  const { data: wallets, error } = await supabase
    .from("imotara_wallets")
    .select("user_id, balance, expires_at")
    .eq("status", "active")
    .gt("balance", 0)
    .lte("expires_at", in30Days)
    .is("expiry_notified_at", null);

  if (error) {
    console.error("[wallet-expiry-notice] query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!wallets || wallets.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  // Fetch user emails from auth.users via admin API
  const userIds = wallets.map((w) => w.user_id);
  const emailMap: Record<string, string> = {};

  for (const uid of userIds) {
    const { data: { user } } = await supabase.auth.admin.getUserById(uid);
    if (user?.email) emailMap[uid] = user.email;
  }

  // Send emails
  let transporter: nodemailer.Transporter | null = null;
  if (GMAIL_USER && GMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: 465, secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
  }

  let notified = 0;
  for (const wallet of wallets) {
    const email = emailMap[wallet.user_id];
    if (!email) continue;

    if (transporter) {
      try {
        await transporter.sendMail({
          from:    `"Imotara" <${GMAIL_USER}>`,
          to:      email,
          subject: `⚠️ Your Imotara Wallet balance of ₹${Number(wallet.balance).toFixed(2)} is expiring soon`,
          text:    buildNoticeEmail(email, Number(wallet.balance), wallet.expires_at),
        });
      } catch (err) {
        console.error(`[wallet-expiry-notice] email failed for ${wallet.user_id}:`, err);
        continue;
      }
    }

    // Mark as notified even if email fails (to avoid repeat spamming in test mode)
    await supabase
      .from("imotara_wallets")
      .update({ expiry_notified_at: now.toISOString() })
      .eq("user_id", wallet.user_id);

    notified++;
  }

  console.log(`[wallet-expiry-notice] notified ${notified} users`);
  return NextResponse.json({ ok: true, notified });
}
