// src/lib/auth/codeMailer.ts — #134 (12 Nov 2026): the sign-in code email, sent from OUR mailbox.
//
// ⛔ No outside mail service (owner, 12 Nov): the same Hostinger SMTP account every org invite and
// Connect mail already uses (lib/connect/mailer.ts) — imotara.com's own mailbox host.
// ⛔ A CODE, not a link: mail scanners open links and used them up (the July "session expired" bug);
// nobody can spend a code by opening an email.
import "server-only";
import nodemailer from "nodemailer";

// `||` not `??`: an EMPTY SMTP_HOST (as in .env.local) must fall back too ⇒ trap_nullish_coalescing_cannot_see_an_empty_default
const SMTP_HOST = process.env.SMTP_HOST?.trim() || "smtp.hostinger.com";
const FROM_USER = process.env.ALERT_GMAIL_USER?.trim() ?? "";
const FROM_PASS = process.env.ALERT_GMAIL_APP_PASSWORD?.trim() ?? "";

export type CodePurpose = "signin" | "reset";

/** Pure — tested. The words of the email. */
export function signInCodeEmail(code: string, purpose: CodePurpose): { subject: string; text: string; html: string } {
  const why = purpose === "reset" ? "to set a new password" : "to sign in";
  const subject = `${code} is your Imotara code`;
  const text = [
    `Your Imotara code ${why}:`,
    ``,
    `    ${code}`,
    ``,
    `Type it where you asked for it. It works once and expires within an hour.`,
    ``,
    `If you didn't ask for this, you can ignore this email — nobody can get in without the code.`,
    ``,
    `Imotara · imotara.com`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
<div style="max-width:440px;margin:24px auto;background:#fff;border-radius:14px;padding:28px">
<p style="margin:0 0 6px;font-size:15px">Your Imotara code ${why}:</p>
<p style="margin:12px 0 18px;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
<p style="margin:0 0 10px;font-size:13px;color:#52525b">Type it where you asked for it. It works once and expires within an hour.</p>
<p style="margin:0;font-size:13px;color:#52525b">If you didn't ask for this, you can ignore this email — nobody can get in without the code.</p>
<p style="margin:22px 0 0;font-size:12px;color:#a1a1aa">Imotara · imotara.com</p>
</div></body></html>`;
  return { subject, text, html };
}

/** Returns false when mail is not configured or the server refused it — the caller says so. */
export async function sendSignInCodeEmail(to: string, code: string, purpose: CodePurpose): Promise<boolean> {
  if (!FROM_USER || !FROM_PASS) return false;
  const { subject, text, html } = signInCodeEmail(code, purpose);
  try {
    const t = nodemailer.createTransport({ host: SMTP_HOST, port: 465, secure: true, auth: { user: FROM_USER, pass: FROM_PASS } });
    await t.sendMail({ from: `"Imotara" <${FROM_USER}>`, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[auth/codeMailer] send failed:", (err as Error).message);
    return false;
  }
}
