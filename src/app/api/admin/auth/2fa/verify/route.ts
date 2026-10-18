// POST /api/admin/auth/2fa/verify
//
// Two jobs, told apart by what the account already has:
//   • ENROLMENT — an admin with a secret but totp_enabled false is confirming
//     the authenticator works. Succeeds once, turns 2FA on, returns the eight
//     backup codes (shown only this once).
//   • THE LOGIN CHALLENGE — an enrolled admin has given their password and
//     holds a session marked unverified. A correct code marks it verified.
//
// 🔴 THE CHALLENGE HALF NEVER WORKED. It selected `two_fa_verified` from
// admin_sessions, a column that did not exist, so it answered 401 to
// everything — which nobody noticed, because the login route never called it.
//
// ⛔ AND THE BACKUP CODES WERE UNUSABLE. Eight are generated at enrolment and
// told to the admin to keep safe; nothing in this file ever compared one. They
// are the only way back in for somebody who loses their phone, so "generated,
// stored, never checked" is the worst of the three states.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { verify as totpVerify } from "otplib";
import crypto from "crypto";

const SESSION_COOKIE = "imotara_admin_session";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so a backup code cannot be guessed a character at a time. */
function sameCode(a: string, b: string): boolean {
  const x = Buffer.from(a.trim().toUpperCase());
  const y = Buffer.from(b.trim().toUpperCase());
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code: string = typeof body?.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Enter the 6-digit code from your authenticator app, or one of your backup codes" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  /**
   * ⚠️ THE SESSION IS READ HERE RATHER THAN THROUGH requireSuperAdmin, and it
   * has to be. That guard now refuses an unverified session — which is every
   * session reaching this route during a challenge. Using it would deadlock
   * the one endpoint that can end the deadlock.
   *
   * 🔑 This is not a hole: the cookie is still a real, unexpired, hashed
   * session token belonging to a real admin. All it buys without a correct
   * code is the ability to attempt one.
   */
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  if (!token) return NextResponse.json({ ok: false, error: "Sign in first" }, { status: 401 });

  const { data: session } = await supabase
    .from("admin_sessions")
    .select("*")
    .eq("token_hash", hashToken(token))
    .single();

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Invalid or expired session" }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("super_admins")
    .select("id, active, totp_secret, totp_enabled, totp_backup_codes")
    .eq("id", session.admin_id)
    .single();

  if (!row?.active) return NextResponse.json({ ok: false, error: "Invalid or expired session" }, { status: 401 });
  if (!row.totp_secret) {
    return NextResponse.json({ ok: false, error: "Two-step verification is not set up on this account" }, { status: 400 });
  }

  // ── Which kind of code is this? ────────────────────────────────────────────
  const looksLikeTotp = /^\d{6}$/.test(code);
  const storedBackup: string[] = Array.isArray(row.totp_backup_codes) ? row.totp_backup_codes : [];

  let accepted = false;
  let usedBackupCode = false;

  if (looksLikeTotp) {
    const result = await totpVerify({ token: code, secret: row.totp_secret });
    accepted = result.valid === true;
  }

  // ⚠️ Only once 2FA is actually ON. During enrolment there are no backup
  // codes yet, and accepting one would mean accepting a value from an empty
  // list — which must never match anything.
  if (!accepted && row.totp_enabled && storedBackup.length > 0) {
    const match = storedBackup.find((c) => sameCode(c, code));
    if (match) {
      accepted = true;
      usedBackupCode = true;
      // ⛔ ONE USE. A backup code that still works after being used is a
      // password written on a sticky note with extra steps.
      await supabase
        .from("super_admins")
        .update({ totp_backup_codes: storedBackup.filter((c) => c !== match) })
        .eq("id", row.id);
    }
  }

  if (!accepted) {
    return NextResponse.json(
      { ok: false, error: "That code was not right. Check your authenticator app, or use a backup code." },
      { status: 400 },
    );
  }

  // ── Enrolment: first successful verification turns 2FA on ──────────────────
  if (!row.totp_enabled) {
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
    );
    await supabase
      .from("super_admins")
      .update({ totp_enabled: true, totp_backup_codes: backupCodes })
      .eq("id", row.id);

    // 🔑 Enrolling counts as completing the challenge for this session, or the
    // admin would be locked out by the thing they just switched on.
    await markVerified(supabase, hashToken(token));
    return NextResponse.json({ ok: true, enabled: true, backupCodes });
  }

  // ── The login challenge ────────────────────────────────────────────────────
  const marked = await markVerified(supabase, hashToken(token));
  if (!marked) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The code was right, but this session could not be marked verified. " +
          "Run docs/sql/admin_session_two_fa.sql, then sign in again.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    verified: true,
    usedBackupCode,
    backupCodesLeft: usedBackupCode ? storedBackup.length - 1 : storedBackup.length,
  });
}

/** ⚠️ Returns false when the column is missing, so the caller can say which
 *  migration to run instead of reporting a success the session did not get. */
async function markVerified(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tokenHash: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("admin_sessions")
    .update({ two_fa_verified: true })
    .eq("token_hash", tokenHash);
  if (error) {
    console.error("[admin/2fa/verify] could not mark session verified:", error.message);
    return false;
  }
  return true;
}
