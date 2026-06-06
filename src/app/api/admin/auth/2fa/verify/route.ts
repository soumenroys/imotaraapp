// POST /api/admin/auth/2fa/verify
// Verifies a TOTP code and, if correct, enables 2FA on the account.
// Also used during login to complete 2FA challenge.
// Body: { code: string; loginToken?: string }
// Auth: session cookie (setup flow) OR loginToken (login flow).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { verify as totpVerify } from "otplib";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code: string = body?.code?.trim() ?? "";
  const loginToken: string = body?.loginToken ?? "";

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Enter the 6-digit code from your authenticator app" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Two modes: setup verification (session) or login challenge (loginToken)
  let adminId: string | null = null;

  if (loginToken) {
    // Login challenge: find pending session by token
    const { data: session } = await supabase
      .from("admin_sessions")
      .select("admin_id, expires_at, two_fa_verified")
      .eq("token_hash", hashToken(loginToken))
      .single();
    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "Invalid or expired session" }, { status: 401 });
    }
    adminId = session.admin_id;
  } else {
    const result = await requireSuperAdmin(req);
    if (!result.ok) return result.response;
    adminId = result.admin.id;
  }

  const { data: row } = await supabase
    .from("super_admins")
    .select("id, totp_secret, totp_enabled")
    .eq("id", adminId)
    .single();

  if (!row?.totp_secret) {
    return NextResponse.json({ ok: false, error: "2FA not set up — call /setup first" }, { status: 400 });
  }

  const verifyResult = await totpVerify({ token: code, secret: row.totp_secret });
  if (!verifyResult.valid) {
    return NextResponse.json({ ok: false, error: "Incorrect code — try again" }, { status: 400 });
  }

  if (!row.totp_enabled) {
    // First verification: enable 2FA + generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
    );
    await supabase
      .from("super_admins")
      .update({ totp_enabled: true, totp_backup_codes: backupCodes })
      .eq("id", adminId);
    return NextResponse.json({ ok: true, enabled: true, backupCodes });
  }

  // Login challenge: mark session as 2FA verified
  if (loginToken) {
    await supabase
      .from("admin_sessions")
      .update({ two_fa_verified: true })
      .eq("token_hash", hashToken(loginToken));
  }

  return NextResponse.json({ ok: true, verified: true });
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
