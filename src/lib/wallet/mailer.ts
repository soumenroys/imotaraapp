// Wallet notification mailer — sends all wallet-related emails and logs them.

import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const SMTP_HOST  = process.env.SMTP_HOST              ?? "smtp.hostinger.com";
const GMAIL_USER = process.env.ALERT_GMAIL_USER        ?? "";
const GMAIL_PASS = process.env.ALERT_GMAIL_APP_PASSWORD ?? "";
const TERMS_URL  = "https://imotara.com/connect/wallet-terms";
const WALLET_URL = "https://imotara.com/connect?tab=wallet";
const SUPPORT    = "support@imotara.com";

export type NotificationType =
  | "180d_warning"
  | "90d_warning"
  | "30d_warning"
  | "14d_warning"
  | "7d_warning"
  | "1d_warning"
  | "dormant_notice"
  | "annual_statement";

function fmt(n: number)  { return `₹${n.toFixed(2)}`; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function footer() {
  return [
    ``,
    `──────────────────────────────────────────`,
    `This is an automated message from Imotara.`,
    `Wallet policy: ${TERMS_URL}`,
    `For help, contact: ${SUPPORT}`,
    `Imotara Wellness Pvt. Ltd. | India`,
  ].join("\n");
}

function buildEmail(
  type: NotificationType,
  balance: number,
  expiresAt: string,
): { subject: string; text: string } {
  const expDate  = fmtDate(expiresAt);
  const bal      = fmt(balance);

  switch (type) {
    case "180d_warning":
      return {
        subject: `Imotara Wallet: Your balance of ${bal} is valid for 6 more months`,
        text: [
          `Dear Imotara user,`,
          ``,
          `Your Imotara Wallet balance of ${bal} is currently active.`,
          ``,
          `As a courtesy reminder: your balance will expire on ${expDate} if no top-up`,
          `or session is used before that date. This is 6 months away — plenty of time.`,
          ``,
          `To keep your balance active beyond ${expDate}, simply top up any amount`,
          `or book a session before that date.`,
          ``,
          `Current balance: ${bal}`,
          `Expires on:      ${expDate}`,
          ``,
          `Add money or book a session: ${WALLET_URL}`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "90d_warning":
      return {
        subject: `Imotara Wallet: 3 months left — your balance of ${bal} expires on ${expDate}`,
        text: [
          `Dear Imotara user,`,
          ``,
          `This is a reminder that your Imotara Wallet balance of ${bal} will expire`,
          `on ${expDate} (in approximately 3 months) due to inactivity.`,
          ``,
          `To reset the 2-year inactivity clock and keep your balance active,`,
          `simply top up any amount or use a session before ${expDate}.`,
          ``,
          `Current balance: ${bal}`,
          `Expires on:      ${expDate}`,
          ``,
          `Add money or book a session: ${WALLET_URL}`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "30d_warning":
      return {
        subject: `⚠️ Imotara Wallet: 30 days left — ${bal} expires on ${expDate}`,
        text: [
          `Dear Imotara user,`,
          ``,
          `IMPORTANT: Your Imotara Wallet balance of ${bal} will expire on ${expDate}`,
          `(30 days from now) due to 2 years of inactivity.`,
          ``,
          `ACTION REQUIRED:`,
          `To keep your balance, top up any amount or book a session before ${expDate}.`,
          ``,
          `Even adding the minimum amount will reset your balance validity for another 2 years.`,
          ``,
          `Current balance: ${bal}`,
          `Expires on:      ${expDate}`,
          ``,
          `Add money now: ${WALLET_URL}`,
          ``,
          `If you do not take action, your balance will go dormant on ${expDate}.`,
          `After dormancy, you will have a 1-year grace period to request a full refund`,
          `by emailing ${SUPPORT} with subject "Wallet Refund Request".`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "14d_warning":
      return {
        subject: `⚠️ Urgent: Imotara Wallet balance of ${bal} expires in 14 days (${expDate})`,
        text: [
          `Dear Imotara user,`,
          ``,
          `URGENT REMINDER: Your Imotara Wallet balance of ${bal} will expire`,
          `on ${expDate} — just 14 days away.`,
          ``,
          `To prevent your balance from going dormant, please add money or`,
          `book a session before ${expDate}.`,
          ``,
          `This is reminder 4 of 6. You previously received notices at 6 months,`,
          `3 months, and 1 month before this date.`,
          ``,
          `Current balance: ${bal}`,
          `Expires on:      ${expDate}`,
          ``,
          `Add money now: ${WALLET_URL}`,
          ``,
          `After dormancy, you will have a 1-year grace period to claim a full refund.`,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "7d_warning":
      return {
        subject: `🚨 7 days left: Imotara Wallet balance of ${bal} expires on ${expDate}`,
        text: [
          `Dear Imotara user,`,
          ``,
          `FINAL WEEK WARNING: Your Imotara Wallet balance of ${bal} expires`,
          `on ${expDate} — only 7 days remaining.`,
          ``,
          `This is reminder 5 of 6. Act now to keep your balance active.`,
          `Simply top up any amount or book a session before ${expDate}.`,
          ``,
          `Current balance: ${bal}`,
          `Expires on:      ${expDate}`,
          ``,
          `Add money now: ${WALLET_URL}`,
          ``,
          `After expiry, your balance goes dormant. You will still be able to request`,
          `a full refund within 1 year by emailing ${SUPPORT}.`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "1d_warning":
      return {
        subject: `🚨 TOMORROW: Imotara Wallet balance of ${bal} expires on ${expDate}`,
        text: [
          `Dear Imotara user,`,
          ``,
          `LAST CHANCE: Your Imotara Wallet balance of ${bal} expires TOMORROW`,
          `(${expDate}).`,
          ``,
          `This is your final reminder (6 of 6). After tomorrow, your balance will`,
          `go dormant. You will NOT lose access to a refund immediately — you will`,
          `have 1 year to request a full refund — but your balance will no longer`,
          `be available for sessions.`,
          ``,
          `To keep your balance active for another 2 years, add money now:`,
          `${WALLET_URL}`,
          ``,
          `Current balance: ${bal}`,
          `Expires on:      ${expDate}`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "dormant_notice":
      return {
        subject: `Imotara Wallet: Your balance of ${bal} is now dormant — refund available for 1 year`,
        text: [
          `Dear Imotara user,`,
          ``,
          `Your Imotara Wallet balance of ${bal} has gone dormant today (${expDate})`,
          `after 2 years of inactivity.`,
          ``,
          `WHAT THIS MEANS:`,
          `Your balance is preserved but no longer available for sessions.`,
          ``,
          `YOUR REFUND RIGHTS (1-YEAR GRACE PERIOD):`,
          `You have exactly 1 year from today to claim a full refund.`,
          ``,
          `To request your refund:`,
          `  Option 1 (easiest): Use the "Request Refund" button in the wallet tab: ${WALLET_URL}`,
          `  Option 2: Email ${SUPPORT} with subject "Wallet Refund Request — [your email]"`,
          `            Include: your bank account number, IFSC code, and account holder name.`,
          ``,
          `We will process your refund within 7 business days and confirm via email.`,
          ``,
          `You sent 6 reminder emails before today (at 180, 90, 30, 14, 7, and 1 day`,
          `before dormancy). This notice is your official dormancy confirmation.`,
          ``,
          `Reference: Wallet policy in accordance with Consumer Protection Act, 2019 (India).`,
          `Full policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "annual_statement":
      return {
        subject: `Imotara Wallet Annual Statement — Balance: ${bal}`,
        text: [
          `Dear Imotara user,`,
          ``,
          `This is your annual Imotara Wallet balance statement.`,
          ``,
          `Current balance:  ${bal}`,
          `Balance valid until: ${expDate}`,
          ``,
          `Your balance remains active as long as you top up or use a session`,
          `at least once every 2 years.`,
          ``,
          `To use your balance, visit: ${WALLET_URL}`,
          ``,
          `WALLET POLICY SUMMARY:`,
          `• Balance valid for 2 years from last activity`,
          `• You receive 6 email reminders before dormancy (at 180, 90, 30, 14, 7, 1 days)`,
          `• After dormancy: 1-year grace period to request a full refund`,
          `• Full policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };
  }
}

interface SendResult {
  sent: boolean;
  error?: string;
}

async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn("[wallet/mailer] SMTP not configured — email skipped");
    return { sent: false, error: "SMTP not configured" };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: 465, secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
    await transporter.sendMail({ from: `"Imotara" <${GMAIL_USER}>`, to, subject, text });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Main export: send a wallet notification email and log it in imotara_wallet_notifications.
export async function sendWalletNotification({
  userId,
  email,
  type,
  balance,
  expiresAt,
}: {
  userId:    string;
  email:     string;
  type:      NotificationType;
  balance:   number;
  expiresAt: string;
}): Promise<void> {
  const { subject, text } = buildEmail(type, balance, expiresAt);
  const result = await sendEmail(email, subject, text);

  const supabase = getSupabaseAdmin();
  await supabase.from("imotara_wallet_notifications").insert({
    user_id:           userId,
    notification_type: type,
    email_to:          email,
    subject,
    wallet_balance:    balance,
    expires_at:        expiresAt,
    delivery_status:   result.sent ? "sent" : "failed",
  });

  if (!result.sent) {
    console.error(`[wallet/mailer] failed to send ${type} to ${email}:`, result.error);
  }
}

// Record consent for wallet terms at the point of top-up.
export async function recordWalletConsent({
  userId,
  amount,
  razorpayOrderId,
  ipAddress,
  userAgent,
}: {
  userId:          string;
  amount:          number;
  razorpayOrderId: string;
  ipAddress?:      string;
  userAgent?:      string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("imotara_wallet_consents").insert({
    user_id:           userId,
    terms_version:     "v1.0",
    top_up_amount:     amount,
    razorpay_order_id: razorpayOrderId,
    ip_address:        ipAddress ?? null,
    user_agent:        userAgent ?? null,
  });
}
