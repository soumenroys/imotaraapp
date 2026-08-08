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
        subject: `Imotara Wallet: Your balance of ${bal} — a note about ${expDate}`,
        text: [
          `Dear Imotara user,`,
          ``,
          `You have an Imotara Wallet balance of ${bal}. Imotara Wallet no longer accepts`,
          `new top-ups, so this balance simply sits untouched until you request a refund —`,
          `there's nothing you need to do to "use" or "keep" it.`,
          ``,
          `As a record-keeping matter, an inactive balance is marked "dormant" after 2 years —`,
          `for you, that would be ${expDate}. This is just a status label: your balance is`,
          `never reduced, and it remains fully refundable both before and after that date.`,
          ``,
          `If you'd rather have the money back now instead of waiting, you can request a`,
          `refund at any time: ${WALLET_URL}`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "90d_warning":
      return {
        subject: `Imotara Wallet: Your balance of ${bal} — ${expDate} is about 3 months away`,
        text: [
          `Dear Imotara user,`,
          ``,
          `This is a courtesy update on your Imotara Wallet balance of ${bal}. It will be`,
          `marked "dormant" on ${expDate} (in about 3 months) as a record-keeping status —`,
          `not a loss of funds. Your balance is never reduced, and stays fully refundable`,
          `whether it's active or dormant.`,
          ``,
          `Imotara Wallet no longer accepts new top-ups, so there's no action needed on`,
          `your part. If you'd like a refund now rather than later, you can request one`,
          `anytime: ${WALLET_URL}`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "30d_warning":
      return {
        subject: `Imotara Wallet: Your balance of ${bal} goes dormant on ${expDate} (30 days)`,
        text: [
          `Dear Imotara user,`,
          ``,
          `Your Imotara Wallet balance of ${bal} will be marked "dormant" on ${expDate} —`,
          `30 days from now. This is a status label only: your balance is never reduced,`,
          `and remains fully refundable before or after that date.`,
          ``,
          `Imotara Wallet no longer accepts new top-ups, so there's nothing you need to do`,
          `to keep this balance safe — it already is. If you'd prefer a refund now instead`,
          `of waiting, you can request one anytime: ${WALLET_URL}`,
          ``,
          `After dormancy, you'll still have a 1-year grace period to request a full refund`,
          `by emailing ${SUPPORT} with subject "Wallet Refund Request".`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "14d_warning":
      return {
        subject: `Imotara Wallet: Your balance of ${bal} goes dormant on ${expDate} (14 days)`,
        text: [
          `Dear Imotara user,`,
          ``,
          `Your Imotara Wallet balance of ${bal} will be marked "dormant" on ${expDate} —`,
          `14 days from now. This is a status label only; your balance is never reduced`,
          `and stays fully refundable either way.`,
          ``,
          `This is reminder 4 of 6 (you previously received notices at 6 months, 3 months,`,
          `and 30 days before this date).`,
          ``,
          `Imotara Wallet no longer accepts new top-ups — no action is needed on your part.`,
          `If you'd like a refund now, you can request one anytime: ${WALLET_URL}`,
          ``,
          `After dormancy, you'll still have a 1-year grace period to claim a full refund.`,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "7d_warning":
      return {
        subject: `Imotara Wallet: Your balance of ${bal} goes dormant on ${expDate} (7 days)`,
        text: [
          `Dear Imotara user,`,
          ``,
          `Your Imotara Wallet balance of ${bal} will be marked "dormant" on ${expDate} —`,
          `just 7 days away. This is reminder 5 of 6.`,
          ``,
          `To be clear: this is a status label, not a loss of funds. Your balance is never`,
          `reduced, and it remains fully refundable whether it's active or dormant.`,
          ``,
          `Imotara Wallet no longer accepts new top-ups, so no action is needed. If you'd`,
          `like your money back now rather than later, request a refund anytime:`,
          `${WALLET_URL}`,
          ``,
          `After dormancy, you'll still have a 1-year grace period to request a full refund`,
          `by emailing ${SUPPORT}.`,
          ``,
          `View full wallet policy: ${TERMS_URL}`,
          footer(),
        ].join("\n"),
      };

    case "1d_warning":
      return {
        subject: `Imotara Wallet: Your balance of ${bal} goes dormant tomorrow (${expDate})`,
        text: [
          `Dear Imotara user,`,
          ``,
          `Your Imotara Wallet balance of ${bal} will be marked "dormant" tomorrow`,
          `(${expDate}). This is your final reminder (6 of 6).`,
          ``,
          `This is only a status change — your balance will not be reduced, and it stays`,
          `fully refundable, with a 1-year grace period after dormancy to request a full`,
          `refund. There is nothing you need to do; Imotara Wallet no longer accepts new`,
          `top-ups, so no action can or needs to be taken to "keep it active."`,
          ``,
          `If you'd like a refund now instead of waiting, you can request one anytime:`,
          `${WALLET_URL}`,
          ``,
          `Current balance: ${bal}`,
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
          `Current balance:      ${bal}`,
          `Dormant status date:  ${expDate}`,
          ``,
          `Imotara Wallet no longer accepts new top-ups. Your balance simply sits untouched`,
          `— it is never reduced, whether active or dormant — until you request a refund.`,
          ``,
          `To request a refund, visit: ${WALLET_URL}`,
          ``,
          `WALLET POLICY SUMMARY:`,
          `• Balance is never reduced by inactivity, active or dormant`,
          `• Marked "dormant" as a record-keeping status 2 years after last activity`,
          `• You receive 6 email reminders before that date (at 180, 90, 30, 14, 7, 1 days)`,
          `• Refundable at any time, and for 1 year after dormancy specifically`,
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
