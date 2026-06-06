// POST   /api/admin/users/[userId]/ban   — ban a user
// DELETE /api/admin/users/[userId]/ban   — unban a user
// Body (POST): { reason: string }
// Auth: admin or owner.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/app/api/admin/_auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const result = await requireSuperAdmin(req);
  if (!result.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (result.admin.role === "connect_reviewer") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const reason: string = body?.reason?.trim() ?? "";
  if (!reason) return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("user_bans")
    .upsert({
      user_id:     userId,
      banned_by:   result.admin.email,
      reason,
      banned_at:   new Date().toISOString(),
      unbanned_at: null,
    }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "User banned" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const result = await requireSuperAdmin(req);
  if (!result.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("user_bans")
    .update({ unbanned_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("unbanned_at", null);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "User unbanned" });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const result = await requireSuperAdmin(req);
  if (!result.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("user_bans")
    .select("user_id, banned_by, reason, banned_at, unbanned_at")
    .eq("user_id", userId)
    .is("unbanned_at", null)
    .maybeSingle();

  return NextResponse.json({ ok: true, banned: !!data, ban: data ?? null });
}
