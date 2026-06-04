// src/app/api/admin/auth/reset-password/route.ts
// GET  /api/admin/auth/reset-password?token= — validate token (returns admin name)
// POST /api/admin/auth/reset-password       — submit new password

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashSessionToken, hashPassword, checkPasswordComplexity } from "@/lib/imotara/adminCrypto";

// ── GET — validate token, return admin name ───────────────────────────────────
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const tokenHash = hashSessionToken(token);
  const admin     = getSupabaseAdmin();

  const { data: reset } = await admin
    .from("admin_password_resets")
    .select("id, admin_id, expires_at, used_at, super_admins(name, email)")
    .eq("token_hash", tokenHash)
    .single();

  if (!reset)                                  return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 404 });
  if (reset.used_at)                           return NextResponse.json({ error: "This reset link has already been used." }, { status: 410 });
  if (new Date(reset.expires_at) < new Date()) return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 410 });

  const sa = reset.super_admins as unknown as { name: string; email: string } | null;
  return NextResponse.json({ valid: true, name: sa?.name, email: sa?.email });
}

// ── POST — set new password ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { token: string; password: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.token || !body.password) {
    return NextResponse.json({ error: "token and password required" }, { status: 400 });
  }

  const pwCheck = checkPasswordComplexity(body.password);
  if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.reason }, { status: 400 });

  const tokenHash = hashSessionToken(body.token);
  const admin     = getSupabaseAdmin();

  const { data: reset } = await admin
    .from("admin_password_resets")
    .select("id, admin_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!reset || reset.used_at)                 return NextResponse.json({ error: "Invalid or already used reset link." }, { status: 410 });
  if (new Date(reset.expires_at) < new Date()) return NextResponse.json({ error: "Reset link has expired." }, { status: 410 });

  // Mark token as used FIRST (prevent replay)
  await admin.from("admin_password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", reset.id);

  // Update password
  const { error } = await admin.from("super_admins").update({
    password_hash:   hashPassword(body.password),
    failed_attempts: 0,
    locked_until:    null,
  }).eq("id", reset.admin_id);

  if (error) return NextResponse.json({ error: "Failed to update password." }, { status: 500 });

  // Revoke all existing sessions (force re-login everywhere)
  await admin.from("admin_sessions").delete().eq("admin_id", reset.admin_id);

  return NextResponse.json({ ok: true, message: "Password updated. Please sign in with your new password." });
}
