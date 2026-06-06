// GET /api/admin/test-email
// Admin only. Sends a test email to verify SMTP config. Remove after confirming emails work.

import { NextRequest, NextResponse } from "next/server";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";
import nodemailer from "nodemailer";

export async function GET(req: NextRequest) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const gmailUser = process.env.ALERT_GMAIL_USER?.trim();
  const gmailPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();

  if (!gmailUser || !gmailPass) {
    return NextResponse.json({
      ok: false,
      error: "Env vars not set",
      ALERT_GMAIL_USER: gmailUser ? "set" : "MISSING",
      ALERT_GMAIL_APP_PASSWORD: gmailPass ? "set" : "MISSING",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.verify();

    await transporter.sendMail({
      from:    `"Imotara Connect" <${gmailUser}>`,
      to:      "publisher@imotara.com",
      subject: "[Imotara] SMTP test — email is working",
      text:    `This is a test email sent at ${new Date().toISOString()}.\n\nIf you see this, SMTP is correctly configured.`,
    });

    return NextResponse.json({ ok: true, message: "Test email sent to publisher@imotara.com", from: gmailUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
