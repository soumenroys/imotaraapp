// src/app/api/admin/super-admins/route.ts
// GET  — list all super-admins (owner or admin)
// POST — create new super-admin (owner or admin; only owner may create owner-level accounts)

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashPassword, checkPasswordComplexity } from "@/lib/imotara/adminCrypto";

const ALLOWED_ROLES = ["owner", "admin", "connect_reviewer"] as const;
type AdminRole = typeof ALLOWED_ROLES[number];

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  // Bug #33 fix: both owner and admin may list admins; connect_reviewer may not
  if (!["owner", "admin"].includes(auth.admin.role)) {
    return NextResponse.json({ error: "Admin role or higher required" }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("super_admins")
    .select("id, email, name, role, active, last_login_at, created_at, failed_attempts, locked_until")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ admins: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  // Bug #33 fix: both owner and admin may create admins; connect_reviewer may not
  if (!["owner", "admin"].includes(auth.admin.role)) {
    return NextResponse.json({ error: "Admin role or higher required to manage team members" }, { status: 403 });
  }

  let body: { email: string; name: string; password: string; role?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.email?.trim() || !body.name?.trim() || !body.password) {
    return NextResponse.json({ error: "email, name, and password required" }, { status: 400 });
  }
  const pwCheck = checkPasswordComplexity(body.password);
  if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.reason }, { status: 400 });

  // Normalise the requested role
  const requestedRole = ALLOWED_ROLES.includes(body.role as AdminRole) ? (body.role as AdminRole) : "admin";

  // Only the owner may create another owner account
  if (requestedRole === "owner" && auth.admin.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can create another owner account" }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("super_admins")
    .insert({
      email:         body.email.trim().toLowerCase(),
      name:          body.name.trim(),
      password_hash: hashPassword(body.password),
      role:          requestedRole,
      // "legacy" is not a UUID — only set created_by for real session-based admins
      created_by:    auth.admin.id === "legacy" ? null : auth.admin.id,
    })
    .select("id, email, name, role, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ admin: data }, { status: 201 });
}
