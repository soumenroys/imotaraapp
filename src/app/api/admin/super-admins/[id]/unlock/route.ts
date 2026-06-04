// src/app/api/admin/super-admins/[id]/unlock/route.ts
// POST — unlock a locked super-admin account (owner only)

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role !== "owner") {
    return NextResponse.json({ error: "Owner role required." }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await getSupabaseAdmin()
    .from("super_admins")
    .update({ failed_attempts: 0, locked_until: null, last_failed_at: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
