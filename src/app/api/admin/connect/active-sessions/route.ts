// GET /api/admin/connect/active-sessions
// Returns currently active and recent Connect sessions for monitoring.
// Auth: connect_reviewer or higher.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  const admin = await connectAdminAuthorized(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Active sessions + last 50 completed
  const { data: sessions, error } = await supabase
    .from("connect_sessions")
    .select(
      "id, type, status, started_at, ended_at, minutes_used, amount_charged, currency_code, " +
      "rate_per_min, created_at, user_timezone, consultant_timezone, " +
      "connect_consultants!inner(display_name, photo_url, currency_code)"
    )
    .in("status", ["pending", "active", "completed"])
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sessions: sessions ?? [] });
}
