// src/app/api/admin/auth/forgot-password/route.ts
// POST /api/admin/auth/forgot-password
// Generates a 15-minute reset token and emails it.
// Always returns 200 regardless of whether email exists (prevents enumeration).
// Rate-limited: max 3 requests per admin per hour.

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { generateSessionToken } from "@/lib/imotara/adminCrypto";

const RESET_TTL_MINUTES = 15;
const MAX_RESETS_PER_HOUR = 3;

export async function POST(req: NextRequest) {
  let body: { email: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");
  const admin   = getSupabaseAdmin();

  // Fetch the admin — if not found, still return 200 to prevent email enumeration
  const { data: superAdmin } = await admin
    .from("super_admins")
    .select("id, name, active")
    .eq("email", email)
    .single();

  const OK_RESPONSE = NextResponse.json({
    ok: true,
    message: "If that email belongs to a super-admin account, a reset link has been sent.",
  });

  if (!superAdmin || !superAdmin.active) return OK_RESPONSE;

  // Rate limit: max 3 reset requests per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("admin_password_resets")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", superAdmin.id)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_RESETS_PER_HOUR) return OK_RESPONSE; // silently rate-limit

  // Invalidate any previous unused tokens
  await admin.from("admin_password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("admin_id", superAdmin.id)
    .is("used_at", null);

  // Generate new token
  const { token, tokenHash } = generateSessionToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString();

  await admin.from("admin_password_resets").insert({
    admin_id:   superAdmin.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  // Send reset email
  const resetUrl = `${siteUrl}/admin?reset_token=${token}`;
  const smtpUser = process.env.ALERT_GMAIL_USER?.trim();
  const smtpPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", port: 465, secure: true,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from:    `"Imotara Admin" <${smtpUser}>`,
        to:      email,
        subject: "Reset your Imotara admin password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
            <h2 style="color:#312e81">Admin password reset</h2>
            <p>Hi ${superAdmin.name},</p>
            <p>Click the link below to reset your Imotara admin password. This link expires in <strong>${RESET_TTL_MINUTES} minutes</strong>.</p>
            <p style="margin:24px 0">
              <a href="${resetUrl}"
                 style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                Reset my password →
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email — your password will not change.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
            <p style="color:#9ca3af;font-size:12px">Imotara Admin Panel · imotara.com</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("[forgot-password] email failed:", err);
    }
  }

  return OK_RESPONSE;
}
