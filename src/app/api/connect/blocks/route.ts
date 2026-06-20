export const preferredRegion = ["sin1"];

// POST   /api/connect/blocks  — consultant blocks a user  { blocked_user_id, reason? }
// DELETE /api/connect/blocks  — unblock                   { blocked_user_id }
// GET    /api/connect/blocks  — list blocked user IDs (consultant only)
// Auth required (consultant only for POST/DELETE/GET).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

async function resolveConsultant(supabase: ReturnType<typeof import("@/lib/supabaseServer").getSupabaseAdmin>, userId: string) {
  const { data } = await supabase
    .from("connect_consultants")
    .select("id")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const consultant = await resolveConsultant(supabase, user.id);
  if (!consultant) return NextResponse.json({ ok: false, error: "Not a consultant" }, { status: 403 });

  const { data, error } = await supabase
    .from("connect_blocks")
    .select("blocked_user_id, reason, created_at")
    .eq("consultant_id", consultant.id)
    .limit(100);

  if (error) {
    console.error("[blocks/GET] query error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not load blocked users. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, blocked: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { blocked_user_id, reason } = body ?? {};
  if (!blocked_user_id) return NextResponse.json({ ok: false, error: "blocked_user_id required" }, { status: 400 });
  if (blocked_user_id === user.id) return NextResponse.json({ ok: false, error: "You cannot block yourself." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const consultant = await resolveConsultant(supabase, user.id);
  if (!consultant) return NextResponse.json({ ok: false, error: "Not a consultant" }, { status: 403 });

  const { error } = await supabase
    .from("connect_blocks")
    .upsert(
      { consultant_id: consultant.id, blocked_user_id, reason: reason ?? null },
      { onConflict: "consultant_id,blocked_user_id", ignoreDuplicates: false }
    );

  if (error) {
    console.error("[blocks] DB error:", error.message);
    return NextResponse.json({ ok: false, error: "Operation failed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { blocked_user_id } = body ?? {};
  if (!blocked_user_id) return NextResponse.json({ ok: false, error: "blocked_user_id required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const consultant = await resolveConsultant(supabase, user.id);
  if (!consultant) return NextResponse.json({ ok: false, error: "Not a consultant" }, { status: 403 });

  const { error } = await supabase
    .from("connect_blocks")
    .delete()
    .eq("consultant_id", consultant.id)
    .eq("blocked_user_id", blocked_user_id);

  if (error) {
    console.error("[blocks] DB error:", error.message);
    return NextResponse.json({ ok: false, error: "Operation failed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
