// DELETE /api/admin/auth/2fa/disable
// Disables 2FA on the current admin account.
// Body: { code: string } — must provide current TOTP code to confirm.
// Auth: session cookie required.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { verify as totpVerify } from "otplib";

export async function DELETE(req: NextRequest) {
  const result = await requireSuperAdmin(req);
  if (!result.ok) return result.response;

  const body = await req.json().catch(() => null);
  const code: string = body?.code?.trim() ?? "";

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Provide your current 6-digit code to disable 2FA" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("super_admins")
    .select("totp_secret, totp_enabled")
    .eq("id", result.admin.id)
    .single();

  if (!row?.totp_enabled) {
    return NextResponse.json({ ok: false, error: "2FA is not enabled on this account" }, { status: 400 });
  }

  const verifyResult = await totpVerify({ token: code, secret: row.totp_secret! });
  if (!verifyResult.valid) {
    return NextResponse.json({ ok: false, error: "Incorrect code" }, { status: 400 });
  }

  await supabase
    .from("super_admins")
    .update({ totp_secret: null, totp_enabled: false, totp_backup_codes: null })
    .eq("id", result.admin.id);

  return NextResponse.json({ ok: true, message: "2FA disabled" });
}
