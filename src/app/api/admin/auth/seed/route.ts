// src/app/api/admin/auth/seed/route.ts
// POST /api/admin/auth/seed — create first owner super-admin
// ONLY works when super_admins table is empty. Returns 409 after that.
// Call once after running the super_admins.sql migration.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashPassword, checkPasswordComplexity } from "@/lib/imotara/adminCrypto";

export async function POST(req: NextRequest) {
  let body: { email: string; name: string; password: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.email?.trim() || !body.name?.trim() || !body.password) {
    return NextResponse.json({ error: "email, name, and password required" }, { status: 400 });
  }
  const pwCheck = checkPasswordComplexity(body.password);
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.reason }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Check table exists and is empty
  const { count, error: countErr } = await admin
    .from("super_admins")
    .select("id", { count: "exact", head: true });

  if (countErr) {
    return NextResponse.json({ error: "super_admins table not found — run super_admins.sql migration first" }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Seed already done — super_admins table is not empty" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("super_admins")
    .insert({
      email:         body.email.trim().toLowerCase(),
      name:          body.name.trim(),
      password_hash: hashPassword(body.password),
      role:          "owner",
      active:        true,
    })
    .select("id, email, name, role")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:      true,
    message: "Owner super-admin created. You can now log in at /admin.",
    admin:   data,
  }, { status: 201 });
}
