// src/app/api/admin/super-admins/[id]/route.ts
// PATCH — update name / role / reset password (owner only)
// DELETE — deactivate admin (owner only, cannot self-deactivate)

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
  let body: { name?: string; role?: string; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (body.name)     update.name = body.name.trim();
  if (body.role && ["owner","admin"].includes(body.role)) update.role = body.role;
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
  if (id === auth.admin.id) return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 409 });

  const { error } = await getSupabaseAdmin().from("super_admins").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
