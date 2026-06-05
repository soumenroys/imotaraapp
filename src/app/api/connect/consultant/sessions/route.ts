// GET /api/connect/consultant/sessions
// Returns sessions assigned to the authenticated consultant.
// Query params: ?status=pending|active|history|all (default: pending+active)
// history → completed+declined+cancelled (last 50)
// Auto-expires pending sessions older than 5 minutes on every call.

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

  // Auto-expire pending sessions older than 5 minutes (P4)
  if (statusParam !== "history") {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from("connect_sessions")
      .update({ status: "cancelled" })
      .eq("consultant_id", consultant.id)
      .eq("status", "pending")
      .lt("created_at", fiveMinutesAgo);
  }

  const statusFilter =
    statusParam === "all"
      ? ["pending", "active", "completed", "declined", "cancelled"]
      : statusParam === "history"
      ? ["completed", "declined", "cancelled"]
      : statusParam === "active"
      ? ["active"]
      : ["pending", "active"]; // default: actionable sessions

  const { data, error } = await supabase
    .from("connect_sessions")
    .select(
      "id, user_id, type, status, scheduled_note, started_at, ended_at, " +
      "minutes_used, rating, review_text, created_at"
    )
    .eq("consultant_id", consultant.id)
    .in("status", statusFilter)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessions: data ?? [], consultant_id: consultant.id });
}
