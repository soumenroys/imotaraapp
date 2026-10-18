// src/app/api/admin/auth/login/route.ts
// POST /api/admin/auth/login — email + password → httpOnly session cookie
// Security: account lockout after 5 failures (15 min), full audit log.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  verifyPassword, generateSessionToken,
  SESSION_COOKIE, SESSION_TTL_MS,
  MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS,
  isAccountLocked, lockoutSecondsRemaining,
} from "@/lib/imotara/adminCrypto";

async function logAttempt(
  email: string, success: boolean, reason: string | null,
  ip: string | null, ua: string | null
) {
  void getSupabaseAdmin().from("admin_login_audit").insert({
    email, ip_address: ip, user_agent: ua, success, failure_reason: reason,
  }); // fire-and-forget — never block login on audit failure
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
           ?? req.headers.get("x-real-ip")
           ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  let body: { email: string; password: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const email    = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch admin — always, even if not found, to prevent timing-based enumeration
  const { data: superAdmin } = await admin
    .from("super_admins")
    // ⚠️ totp_enabled is in this list because the second-factor decision below
    // reads it. Leaving it out does not fail — it reads `undefined`, decides no
    // second factor is needed, and silently signs an enrolled admin straight
    // in. A guard that is skipped is indistinguishable from one that passed.
    .select("id, email, name, role, password_hash, active, failed_attempts, locked_until, totp_enabled")
    .eq("email", email)
    .single();

  // ── Account lockout check ─────────────────────────────────────────────────
  if (superAdmin && isAccountLocked(superAdmin.locked_until ?? null)) {
    const secs = lockoutSecondsRemaining(superAdmin.locked_until ?? null);
    const mins = Math.ceil(secs / 60);
    await logAttempt(email, false, "account_locked", ip, ua);
    return NextResponse.json({
      error: `Account is temporarily locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
      locked: true,
      retryAfterSeconds: secs,
    }, { status: 429 });
  }

  // ── Password verification (always run to prevent timing attacks) ───────────
  const dummyHash = "deadbeef:" + "0".repeat(128);
  const stored    = superAdmin?.password_hash ?? dummyHash;
  const valid     = verifyPassword(password, stored);

  // ── Failure path ──────────────────────────────────────────────────────────
  if (!superAdmin || !valid || !superAdmin.active) {
    const reason = !superAdmin ? "user_not_found"
                 : !superAdmin.active ? "account_inactive"
                 : "wrong_password";

    await logAttempt(email, false, reason, ip, ua);

    // Increment failed attempts and potentially lock (only if account exists)
    if (superAdmin && valid === false) {
      const newAttempts = (superAdmin.failed_attempts ?? 0) + 1;
      const shouldLock  = newAttempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
        : null;

      await admin.from("super_admins").update({
        failed_attempts: newAttempts,
        locked_until:    lockedUntil,
        last_failed_at:  new Date().toISOString(),
      }).eq("id", superAdmin.id);

      if (shouldLock) {
        return NextResponse.json({
          error: `Too many failed attempts. Account locked for 15 minutes.`,
          locked: true,
          retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        }, { status: 429 });
      }

      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      return NextResponse.json({
        error: `Invalid email or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before lockout.`,
      }, { status: 401 });
    }

    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // ── Success path ──────────────────────────────────────────────────────────
  // Reset lockout counters
  await admin.from("super_admins").update({
    failed_attempts: 0,
    locked_until:    null,
    last_failed_at:  null,
    last_login_at:   new Date().toISOString(),
  }).eq("id", superAdmin.id);

  // Clean up expired sessions for this admin (prevents accumulation)
  void admin.from("admin_sessions")
    .delete()
    .eq("admin_id", superAdmin.id)
    .lt("expires_at", new Date().toISOString());

  // Create session
  const { token, tokenHash } = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  /**
   * 🔴 THE SECOND FACTOR, WHICH USED TO BE ANNOUNCED AND NEVER ASKED FOR.
   *
   * Enrolment has always worked — QR code, verification, eight backup codes —
   * and the Admins screen said "2FA is enabled on your account". This route
   * never read `totp_enabled` and never issued the loginToken that
   * /2fa/verify's challenge branch waits for, so an enrolled admin was signed
   * in by password alone. A control that announces itself and does nothing is
   * worse than none, because somebody picks a weaker password on its strength.
   *
   * ⚠️ The session is still created and the cookie still set. It is simply
   * marked unverified, and requireSuperAdmin refuses everything until a code
   * arrives — which is also what lets the verify call authenticate itself.
   */
  const needsSecondFactor = superAdmin.totp_enabled === true;

  const sessionRow: Record<string, unknown> = {
    admin_id:     superAdmin.id,
    token_hash:   tokenHash,
    expires_at:   expiresAt,
    ip_address:   ip,
    user_agent:   ua,
    last_used_at: new Date().toISOString(),
    two_fa_verified: !needsSecondFactor,
  };

  let { error: sessionErr } = await admin.from("admin_sessions").insert(sessionRow);

  /**
   * ⛔ THE ONE WAY THIS COULD HAVE LOCKED EVERYBODY OUT. If
   * docs/sql/admin_session_two_fa.sql has not been run, inserting
   * `two_fa_verified` fails with 42703 — and a failed insert here is a failed
   * LOGIN, for every admin, including the person who would have to fix it.
   * ⇒ Retry once without the column. Enforcement is then simply not yet on,
   * which is exactly how yesterday behaved.
   */
  if (sessionErr && /two_fa_verified/.test(sessionErr.message ?? "")) {
    console.warn("[admin/login] admin_sessions.two_fa_verified missing — run docs/sql/admin_session_two_fa.sql. 2FA is NOT being enforced.");
    delete sessionRow.two_fa_verified;
    ({ error: sessionErr } = await admin.from("admin_sessions").insert(sessionRow));
  }

  if (sessionErr) {
    return NextResponse.json({ error: "Session creation failed." }, { status: 500 });
  }

  await logAttempt(email, true, null, ip, ua);

  const res = NextResponse.json({
    ok:    true,
    // ⚠️ The screen must not show the panel yet when this is true.
    requires2fa: needsSecondFactor,
    admin: { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name, role: superAdmin.role },
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   SESSION_TTL_MS / 1000,
  });

  return res;
}
