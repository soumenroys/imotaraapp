// src/lib/connect/mailer.ts
// Transactional email sender for Imotara Connect — recharge invoices and session notifications.

import "server-only";
import nodemailer from "nodemailer";

const SMTP_HOST      = process.env.SMTP_HOST                ?? "smtp.hostinger.com";
const FROM_USER      = process.env.ALERT_GMAIL_USER?.trim() ?? "";
const FROM_PASS      = process.env.ALERT_GMAIL_APP_PASSWORD?.trim() ?? "";
const FROM_LABEL     = `"Imotara Connect" <${FROM_USER}>`;
const SUPPORT        = "support@imotara.com";
const CONNECT_URL    = "https://imotara.com/connect";
// Internal address that receives platform revenue notifications after every session.
const PLATFORM_EMAIL = process.env.CONNECT_PLATFORM_EMAIL ?? "publisher@imotara.com";

function makeTransporter() {
  if (!FROM_USER || !FROM_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST, port: 465, secure: true,
    auth: { user: FROM_USER, pass: FROM_PASS },
  });
}

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function footer() {
  return [
    ``,
    `──────────────────────────────────────────`,
    `Questions? Contact us at ${SUPPORT}`,
    `Imotara Connect · imotara.com`,
  ].join("\n");
}

async function send(to: string, subject: string, text: string, html?: string) {
  const t = makeTransporter();
  if (!t) {
    console.warn("[connect/mailer] SMTP not configured — email skipped:", subject);
    return;
  }
  try {
    await t.sendMail({ from: FROM_LABEL, to, subject, text, html });
  } catch (err) {
    console.error("[connect/mailer] send failed:", subject, err);
  }
}

/**
 * Invoice email to user after a successful Connect session recharge.
 */
export async function sendRechargeInvoiceEmail(data: {
  userEmail:       string;
  userName?:       string | null;
  consultantName:  string;
  minutesCredited: number;
  amount:          number;
  currency:        string;
  paymentId:       string;
  invoiceNumber?:  string;
}) {
  const greet  = data.userName ? `Hi ${data.userName},` : "Hi,";
  const amtStr = fmt(data.amount, data.currency);
  const subject = `Imotara Connect — Payment Receipt (${amtStr})`;
  const text = [
    greet,
    ``,
    `Your payment has been received. Here are your receipt details:`,
    ``,
    `  Companion:        ${data.consultantName}`,
    `  Minutes credited: ${data.minutesCredited} min`,
    `  Amount paid:      ${amtStr}`,
    `  Payment ref:      ${data.paymentId}`,
    data.invoiceNumber ? `  Invoice number:   ${data.invoiceNumber}` : "",
    ``,
    `Your session minutes are now available. Visit Imotara Connect to start your session:`,
    `${CONNECT_URL}`,
    footer(),
  ].filter((l) => l !== "").join("\n");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f9fafb;padding:24px;margin:0}
.card{background:#fff;border-radius:12px;max-width:560px;margin:auto;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.07)}
.hdr{background:linear-gradient(135deg,#4f46e5,#0ea5e9);padding:28px 36px;color:#fff}
.hdr-title{font-size:20px;font-weight:700}.hdr-sub{font-size:12px;opacity:.8;margin-top:4px}
.body{padding:32px 36px}
.row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px}
.lbl{color:#6b7280}.val{font-weight:500}
.amt{background:#f5f3ff;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
.amt-lbl{font-size:13px;color:#4f46e5;font-weight:600}.amt-val{font-size:22px;font-weight:700;color:#312e81}
.cta{display:block;margin:24px auto 0;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;padding:12px 24px;text-align:center;font-weight:600;font-size:14px;max-width:200px}
.ftr{background:#f9fafb;padding:16px 36px;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="hdr-title">Payment Receipt</div><div class="hdr-sub">Imotara Connect</div></div>
  <div class="body">
    <div class="row"><span class="lbl">Companion</span><span class="val">${data.consultantName}</span></div>
    <div class="row"><span class="lbl">Minutes credited</span><span class="val">${data.minutesCredited} min</span></div>
    <div class="row"><span class="lbl">Payment reference</span><span class="val" style="font-family:monospace;font-size:12px">${data.paymentId}</span></div>
    ${data.invoiceNumber ? `<div class="row"><span class="lbl">Invoice number</span><span class="val">${data.invoiceNumber}</span></div>` : ""}
    <div class="amt"><span class="amt-lbl">Total paid</span><span class="amt-val">${amtStr}</span></div>
    <a href="${CONNECT_URL}" class="cta">Start Your Session</a>
  </div>
  <div class="ftr">Questions? Contact us at ${SUPPORT}<br/>Imotara Connect · imotara.com</div>
</div>
</body></html>`;

  await send(data.userEmail, subject, text, html);
}

/**
 * Session completion summary to user — shows what was charged from their pre-paid balance.
 */
export async function sendSessionSummaryEmail(data: {
  userEmail:       string;
  userName?:       string | null;
  consultantName:  string;
  minutesUsed:     number;
  amountCharged:   number;
  currency:        string;
  sessionId:       string;
  invoiceNumber?:  string;
}) {
  const greet  = data.userName ? `Hi ${data.userName},` : "Hi,";
  const amtStr = fmt(data.amountCharged, data.currency);
  const subject = `Session complete — ${amtStr} charged | ${data.consultantName}`;
  const historyUrl = `${CONNECT_URL}?tab=sessions`;
  const text = [
    greet,
    ``,
    `Your session on Imotara Connect has completed. Here is your session statement:`,
    ``,
    `  Companion:       ${data.consultantName}`,
    `  Duration:        ${data.minutesUsed} min`,
    `  Amount charged:  ${amtStr}   (deducted from your pre-paid balance)`,
    `  Session ref:     ${data.sessionId}`,
    data.invoiceNumber ? `  Invoice ref:     ${data.invoiceNumber}` : "",
    ``,
    `View your full session history at:`,
    historyUrl,
    ``,
    `To book another session: ${CONNECT_URL}`,
    footer(),
  ].filter((l) => l !== "").join("\n");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f9fafb;padding:24px;margin:0}
.card{background:#fff;border-radius:12px;max-width:560px;margin:auto;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.07)}
.hdr{background:linear-gradient(135deg,#4f46e5,#0ea5e9);padding:28px 36px;color:#fff}
.hdr-title{font-size:20px;font-weight:700}.hdr-sub{font-size:12px;opacity:.8;margin-top:4px}
.body{padding:32px 36px}
.row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px}
.lbl{color:#6b7280}.val{font-weight:500}
.amt{background:#ecfdf5;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
.amt-lbl{font-size:13px;color:#059669;font-weight:600}.amt-val{font-size:22px;font-weight:700;color:#065f46}
.cta{display:block;margin:24px auto 0;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;padding:12px 24px;text-align:center;font-weight:600;font-size:14px;max-width:200px}
.ftr{background:#f9fafb;padding:16px 36px;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="hdr-title">Session Statement</div><div class="hdr-sub">Imotara Connect</div></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;margin-bottom:20px">Your session has completed. The following amount was deducted from your pre-paid balance.</p>
    <div class="row"><span class="lbl">Companion</span><span class="val">${data.consultantName}</span></div>
    <div class="row"><span class="lbl">Duration</span><span class="val">${data.minutesUsed} min</span></div>
    <div class="row"><span class="lbl">Session reference</span><span class="val" style="font-family:monospace;font-size:12px">${data.sessionId}</span></div>
    ${data.invoiceNumber ? `<div class="row"><span class="lbl">Invoice reference</span><span class="val">${data.invoiceNumber}</span></div>` : ""}
    <div class="amt"><span class="amt-lbl">Amount charged</span><span class="amt-val">${amtStr}</span></div>
    <a href="${historyUrl}" class="cta">View Session History</a>
    <p style="text-align:center;margin-top:12px;font-size:12px;color:#6b7280">
      <a href="${CONNECT_URL}" style="color:#4f46e5;text-decoration:none">Book another session →</a>
    </p>
  </div>
  <div class="ftr">Questions? Contact us at ${SUPPORT}<br/>Imotara Connect · imotara.com</div>
</div>
</body></html>`;

  await send(data.userEmail, subject, text, html);
}

/**
 * Earnings statement to consultant when a session completes — shows their 80% share
 * alongside the full 3-way split so they know exactly where the money went.
 */
export async function sendConsultantEarningsEmail(data: {
  consultantEmail:  string;
  consultantName:   string;
  minutesUsed:      number;
  earnedAmount:     number;   // 80%
  platformFee:      number;   // 20%
  totalCharged:     number;   // 100%
  currency:         string;
  sessionId:        string;
  userEmail?:       string;
}) {
  const earnedStr  = fmt(data.earnedAmount, data.currency);
  const feeStr     = fmt(data.platformFee, data.currency);
  const totalStr   = fmt(data.totalCharged, data.currency);
  const subject    = `Earnings credited — ${earnedStr} from ${data.minutesUsed}-min session`;

  const text = [
    `Hi ${data.consultantName},`,
    ``,
    `A session has completed and your earnings have been credited to your Connect wallet.`,
    ``,
    `  Session duration:          ${data.minutesUsed} min`,
    `  Total charged to user:     ${totalStr}  (100%)`,
    `  Your earnings (80%):       ${earnedStr}  ← credited to your wallet`,
    `  Imotara platform fee (20%): ${feeStr}`,
    `  Session ref:               ${data.sessionId}`,
    data.userEmail ? `  User:                      ${data.userEmail}` : "",
    ``,
    `Your updated earnings balance is available in your Connect dashboard:`,
    `${CONNECT_URL}?tab=earnings`,
    ``,
    `Payouts are processed weekly. Questions? ${SUPPORT}`,
    footer(),
  ].filter((l) => l !== "").join("\n");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f9fafb;padding:24px;margin:0}
.card{background:#fff;border-radius:12px;max-width:580px;margin:auto;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.07)}
.hdr{background:linear-gradient(135deg,#059669,#0ea5e9);padding:28px 36px;color:#fff}
.hdr-title{font-size:20px;font-weight:700}.hdr-sub{font-size:12px;opacity:.8;margin-top:4px}
.body{padding:32px 36px}
.row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px}
.lbl{color:#6b7280}.val{font-weight:500}
.split{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-top:16px}
.split-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:12px}
.split-row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px}
.split-row:last-child{margin-bottom:0}
.earn-row{display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#059669;margin-bottom:8px}
.amt{background:#ecfdf5;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
.amt-lbl{font-size:13px;color:#059669;font-weight:600}.amt-val{font-size:22px;font-weight:700;color:#065f46}
.cta{display:block;margin:24px auto 0;background:#059669;color:#fff;text-decoration:none;border-radius:8px;padding:12px 24px;text-align:center;font-weight:600;font-size:14px;max-width:240px}
.ftr{background:#f9fafb;padding:16px 36px;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="hdr-title">Earnings Credited</div><div class="hdr-sub">Imotara Connect · Session Statement</div></div>
  <div class="body">
    <div class="row"><span class="lbl">Session duration</span><span class="val">${data.minutesUsed} min</span></div>
    <div class="row"><span class="lbl">Session reference</span><span class="val" style="font-family:monospace;font-size:12px">${data.sessionId}</span></div>
    ${data.userEmail ? `<div class="row"><span class="lbl">User</span><span class="val">${data.userEmail}</span></div>` : ""}
    <div class="split">
      <div class="split-title">Payment breakdown</div>
      <div class="split-row"><span style="color:#374151">Total charged to user (100%)</span><span style="font-weight:600">${totalStr}</span></div>
      <div class="earn-row"><span>Your earnings (80%) ✓</span><span>${earnedStr}</span></div>
      <div class="split-row"><span style="color:#9ca3af">Imotara platform fee (20%)</span><span style="color:#9ca3af">${feeStr}</span></div>
    </div>
    <div class="amt"><span class="amt-lbl">Credited to your wallet</span><span class="amt-val">${earnedStr}</span></div>
    <a href="${CONNECT_URL}?tab=earnings" class="cta">View Earnings Dashboard</a>
  </div>
  <div class="ftr">Payouts processed weekly · Questions? ${SUPPORT}<br/>Imotara Connect · imotara.com</div>
</div>
</body></html>`;

  await send(data.consultantEmail, subject, text, html);
}

/**
 * Internal platform revenue notification to Imotara after every session completion.
 * Recipient: CONNECT_PLATFORM_EMAIL env var (default: publisher@imotara.com).
 * Shows the full 3-way split so the team has a complete audit trail per session.
 */
export async function sendPlatformRevenueEmail(data: {
  sessionId:      string;
  userEmail:      string;
  consultantName: string;
  minutesUsed:    number;
  totalCharged:   number;   // 100% — what user's balance was debited
  platformFee:    number;   // 20% — Imotara's share
  consultantEarned: number; // 80% — consultant's share
  currency:       string;
  invoiceNumber?: string;
}) {
  const totalStr   = fmt(data.totalCharged, data.currency);
  const feeStr     = fmt(data.platformFee, data.currency);
  const earnedStr  = fmt(data.consultantEarned, data.currency);
  const now        = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  const subject    = `[Connect Revenue] ${feeStr} platform fee — ${data.consultantName} · ${data.minutesUsed} min`;

  const text = [
    `Imotara Connect — Session Revenue Notification`,
    `══════════════════════════════════════════════`,
    ``,
    `A Connect session has completed.`,
    ``,
    `  Session ref:              ${data.sessionId}`,
    data.invoiceNumber ? `  Invoice:                  ${data.invoiceNumber}` : "",
    `  Completed at:             ${now} IST`,
    `  Duration:                 ${data.minutesUsed} min`,
    `  User:                     ${data.userEmail}`,
    `  Companion:                ${data.consultantName}`,
    ``,
    `Payment breakdown`,
    `─────────────────`,
    `  Total charged to user:    ${totalStr}  (100%)`,
    `  Imotara platform fee:     ${feeStr}  (20%) ← your revenue`,
    `  Consultant credited:      ${earnedStr}  (80%) ← their wallet`,
    ``,
    `Verify in Supabase: connect_sessions where id = ${data.sessionId}`,
  ].filter((l) => l !== "").join("\n");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f9fafb;padding:24px;margin:0}
.card{background:#fff;border-radius:12px;max-width:600px;margin:auto;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.07)}
.hdr{background:linear-gradient(135deg,#1e1b4b,#312e81);padding:28px 36px;color:#fff}
.hdr-title{font-size:18px;font-weight:700}.hdr-sub{font-size:12px;opacity:.7;margin-top:4px}
.body{padding:32px 36px}
.row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px}
.lbl{color:#6b7280}.val{font-weight:500}
.split{border:2px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-top:20px}
.split-hdr{background:#f5f3ff;padding:10px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6d28d9}
.split-body{padding:16px 18px}
.srow{display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid #f3f4f6}
.srow:last-child{border-bottom:none}
.rev{font-weight:700;color:#4f46e5}
.dim{color:#9ca3af}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
.badge-rev{background:#ede9fe;color:#4f46e5}
.ftr{background:#f9fafb;padding:16px 36px;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="card">
  <div class="hdr">
    <div class="hdr-title">Connect Revenue Notification</div>
    <div class="hdr-sub">Imotara Internal · ${now} IST</div>
  </div>
  <div class="body">
    <div class="row"><span class="lbl">Session ref</span><span class="val" style="font-family:monospace;font-size:12px">${data.sessionId}</span></div>
    ${data.invoiceNumber ? `<div class="row"><span class="lbl">Invoice</span><span class="val">${data.invoiceNumber}</span></div>` : ""}
    <div class="row"><span class="lbl">Duration</span><span class="val">${data.minutesUsed} min</span></div>
    <div class="row"><span class="lbl">User</span><span class="val">${data.userEmail}</span></div>
    <div class="row"><span class="lbl">Companion</span><span class="val">${data.consultantName}</span></div>
    <div class="split">
      <div class="split-hdr">3-Way Payment Breakdown</div>
      <div class="split-body">
        <div class="srow">
          <span>Total charged to user</span>
          <span style="font-weight:600">${totalStr} <span style="color:#9ca3af;font-size:12px">(100%)</span></span>
        </div>
        <div class="srow">
          <span class="rev">Imotara platform fee <span class="badge badge-rev">YOUR REVENUE</span></span>
          <span class="rev">${feeStr} <span style="font-size:12px;font-weight:400">(20%)</span></span>
        </div>
        <div class="srow">
          <span class="dim">Consultant credited</span>
          <span class="dim">${earnedStr} <span style="font-size:12px">(80%)</span></span>
        </div>
      </div>
    </div>
  </div>
  <div class="ftr">Imotara Connect internal notification · Not for distribution</div>
</div>
</body></html>`;

  await send(PLATFORM_EMAIL, subject, text, html);
}

/**
 * Confirmation email to user when their session request has been submitted.
 */
export async function sendSessionRequestEmail(data: {
  userEmail:      string;
  userName?:      string | null;
  consultantName: string;
  sessionType:    "instant" | "scheduled";
  sessionId:      string;
}) {
  const greet   = data.userName ? `Hi ${data.userName},` : "Hi,";
  const typeStr = data.sessionType === "instant" ? "instant" : "scheduled";
  const subject = `Imotara Connect — Session request sent to ${data.consultantName}`;
  const text = [
    greet,
    ``,
    `Your ${typeStr} session request has been sent to ${data.consultantName}.`,
    ``,
    `What happens next?`,
    data.sessionType === "instant"
      ? `  Your companion has been notified and will accept or decline your request shortly.`
      : `  Your companion will review your request and accept or decline it soon.`,
    ``,
    `  Session ref: ${data.sessionId}`,
    ``,
    `Once accepted, head to Imotara Connect to start your session:`,
    `${CONNECT_URL}`,
    footer(),
  ].join("\n");

  await send(data.userEmail, subject, text);
}

/**
 * Notification email to user when a consultant accepts their session.
 */
export async function sendSessionAcceptedEmail(data: {
  userEmail:      string;
  userName?:      string | null;
  consultantName: string;
  sessionId:      string;
}) {
  const greet   = data.userName ? `Hi ${data.userName},` : "Hi,";
  const subject = `Imotara Connect — ${data.consultantName} accepted your session request`;
  const text = [
    greet,
    ``,
    `Great news! ${data.consultantName} has accepted your session request.`,
    ``,
    `Your session is now active. Head to Imotara Connect to start chatting:`,
    `${CONNECT_URL}`,
    ``,
    `  Session ref: ${data.sessionId}`,
    footer(),
  ].join("\n");

  await send(data.userEmail, subject, text);
}

/**
 * Bug #34 fix: Welcome email sent to org owner when admin creates a new organization.
 */
export async function sendOrgWelcomeEmail(data: {
  ownerEmail: string;
  ownerName?: string | null;
  orgName:    string;
  orgSlug:    string;
}) {
  const APP_URL = "https://imotara.com";
  const ORG_URL = `${APP_URL}/org`;
  const greet   = data.ownerName ? `Hi ${data.ownerName},` : "Hi,";
  const subject = `Welcome to Imotara — Your organization "${data.orgName}" is ready`;

  const text = [
    greet,
    ``,
    `Your Imotara organization has been set up by the Imotara team.`,
    ``,
    `  Organization: ${data.orgName}`,
    `  Slug:         ${data.orgSlug}`,
    ``,
    `To access your organization dashboard, sign in to Imotara and visit:`,
    `${ORG_URL}`,
    ``,
    `You can manage members, invite your team, and view usage from the organization panel.`,
    ``,
    `If you have any questions, reach us at ${SUPPORT}.`,
    ``,
    `Welcome aboard,`,
    `The Imotara Team`,
    footer(),
  ].join("\n");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f9fafb;padding:24px;margin:0}
.card{background:#fff;border-radius:12px;max-width:560px;margin:auto;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.07)}
.hdr{background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 36px;color:#fff}
.hdr-title{font-size:20px;font-weight:700}.hdr-sub{font-size:13px;opacity:.8;margin-top:4px}
.body{padding:32px 36px}.detail{background:#f5f3ff;border-radius:10px;padding:16px 20px;margin:20px 0}
.detail p{margin:4px 0;font-size:14px;color:#374151}.detail strong{color:#7c3aed}
.cta{display:inline-block;margin-top:20px;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px}
.footer{font-size:11px;color:#9ca3af;padding:16px 36px;border-top:1px solid #f3f4f6}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="hdr-title">Welcome to Imotara</div><div class="hdr-sub">Your organization is ready</div></div>
  <div class="body">
    <p>${greet}</p>
    <p>Your Imotara organization has been set up. You can now invite your team and manage everything from the organization dashboard.</p>
    <div class="detail">
      <p><strong>Organization:</strong> ${data.orgName}</p>
      <p><strong>Slug:</strong> ${data.orgSlug}</p>
    </div>
    <p>Sign in to Imotara with your Google or Apple account to access your dashboard:</p>
    <a href="${ORG_URL}" class="cta">Open Organization Dashboard →</a>
    <p style="margin-top:24px;font-size:13px;color:#6b7280">Questions? Contact us at <a href="mailto:${SUPPORT}">${SUPPORT}</a></p>
  </div>
  <div class="footer">Imotara · <a href="${APP_URL}">${APP_URL}</a></div>
</div></body></html>`;

  await send(data.ownerEmail, subject, text, html);
}
