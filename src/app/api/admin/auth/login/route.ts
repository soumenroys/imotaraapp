// src/app/api/admin/auth/login/route.ts
// POST /api/admin/auth/login — email + password → httpOnly session cookie
// Rate-limiting note: add Upstash rate limiter before production rollout.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  verifyPassword, generateSessionToken,
  SESSION_COOKIE, SESSION_TTL_MS,
} from "@/lib/imotara/adminCrypto";

export async function POST(req: NextRequest) {
  let body: { email: string; password: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const email    = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch admin user
  const { data: superAdmin } = await admin
    .from("super_admins")
    .select("id, email, name, role, password_hash, active")
    .eq("email", email)
    .single();

  // Always run password check to prevent timing attacks even when user not found
  const dummyHash = "deadbeef:" + "0".repeat(128);
  const storedHash = superAdmin?.password_hash ?? dummyHash;
  const valid = verifyPassword(password, storedHash);

  if (!superAdmin || !valid || !superAdmin.active) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Create session
  const { token, tokenHash } = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error: sessionErr } = await admin.from("admin_sessions").insert({
    admin_id:   superAdmin.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (sessionErr) {
    return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
  }

  // Update last_login_at
  void admin.from("super_admins").update({ last_login_at: new Date().toISOString() }).eq("id", superAdmin.id);

  const res = NextResponse.json({
    ok:   true,
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
