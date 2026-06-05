// GET /api/connect/consultant/sessions
// Returns sessions assigned to the authenticated consultant.
// Query params: ?status=pending|active|all (default: pending,active)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Resolve consultant id from authenticated user
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Not a registered consultant" }, { status: 404 });
  }

  const statusParam = req.nextUrl.searchParams.get("status") ?? "incoming";
  const statusFilter =
    statusParam === "all"
      ? ["pending", "active", "completed", "declined", "cancelled"]
      : statusParam === "active"
      ? ["active"]
      : ["pending", "active"]; // default: show actionable sessions

  const { data, error } = await supabase
    .from("connect_sessions")
    .select("id, user_id, type, status, scheduled_note, started_at, minutes_used, created_at")
    .eq("consultant_id", consultant.id)
    .in("status", statusFilter)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessions: data ?? [], consultant_id: consultant.id });
}
