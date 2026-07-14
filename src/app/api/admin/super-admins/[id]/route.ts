// src/app/api/admin/super-admins/[id]/route.ts
// PATCH  — update name / role / reset password / active status (owner only)
// DELETE — permanently remove an admin account (owner only, cannot self-delete,
//          target must already be inactive). Audit history (admin_login_audit,
//          admin_license_history) has no FK to super_admins and stores actor
//          name/email as denormalized text, so it survives this untouched.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashPassword, checkPasswordComplexity } from "@/lib/imotara/adminCrypto";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role !== "owner") return NextResponse.json({ error: "Owner role required" }, { status: 403 });

  const { id } = await params;
  let body: { name?: string; role?: string; password?: string; active?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (body.active === false && id === auth.admin.id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 409 });
  }

  const update: Record<string, unknown> = {};
  if (body.name)     update.name = body.name.trim();
  if (body.role && ["owner","admin"].includes(body.role)) update.role = body.role;
  if (typeof body.active === "boolean") update.active = body.active;
  if (body.password) {
    const pwCheck = checkPasswordComplexity(body.password);
    if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.reason }, { status: 400 });
    update.password_hash = hashPassword(body.password);
  }

  const { error } = await getSupabaseAdmin().from("super_admins").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role !== "owner") return NextResponse.json({ error: "Owner role required" }, { status: 403 });

  const { id } = await params;
  if (id === auth.admin.id) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 409 });

  const admin = getSupabaseAdmin();

  // Require the target to already be deactivated before a permanent delete —
  // matches the UI (Delete only ever shown for inactive rows) and guards
  // against an active admin being removed by a direct API call.
  const { data: target, error: fetchErr } = await admin
    .from("super_admins")
    .select("active")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  if (target.active) return NextResponse.json({ error: "Deactivate this admin before deleting" }, { status: 409 });

  const { error } = await admin.from("super_admins").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
