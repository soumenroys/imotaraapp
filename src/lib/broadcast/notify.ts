// src/lib/broadcast/notify.ts
// Tells the owner when something needs a person (G4).
//
// Sent over SMTP, deliberately NOT over Resend. The most important thing this
// ever has to report is "the run paused because Resend refused it" — and an
// alert that travels down the pipe that just broke is not an alert. The SMTP
// credentials are the ones already used for platform alerts elsewhere.

import "server-only";
import nodemailer from "nodemailer";

const HOST = process.env.SMTP_HOST ?? "smtp.hostinger.com";
const USER = process.env.ALERT_GMAIL_USER?.trim() ?? "";
const PASS = process.env.ALERT_GMAIL_APP_PASSWORD?.trim() ?? "";
const TO = process.env.BROADCAST_ALERT_EMAIL?.trim() || USER;

export function isNotifyConfigured(): boolean {
  return Boolean(USER && PASS && TO);
}

/**
 * Never throws and never blocks the caller's own work.
 *
 * A failed notification must not fail the send it was reporting on, and must
 * not fail the public form submission it was reporting either — the visitor
 * has done nothing wrong and should not see an error because our mail server
 * is down.
 */
export async function notifyOwner(subject: string, lines: string[]): Promise<void> {
  if (!isNotifyConfigured()) {
    console.warn("[broadcast/notify] SMTP not configured — not sent:", subject);
    return;
  }
  try {
    const t = nodemailer.createTransport({
      host: HOST, port: 465, secure: true, auth: { user: USER, pass: PASS },
    });
    await t.sendMail({
      from: `"Imotara Broadcast" <${USER}>`,
      to: TO,
      subject,
      text: [...lines, "", "— Imotara admin, www.imotara.com/admin"].join("\n"),
    });
  } catch (err) {
    console.error("[broadcast/notify] failed:", subject, err);
  }
}
