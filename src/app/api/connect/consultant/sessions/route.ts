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

  // Cleanup stale sessions whenever the consultant fetches their session list.
  if (statusParam !== "history") {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Auto-expire pending sessions with no response for 5+ minutes.
    await supabase
      .from("connect_sessions")
      .update({ status: "cancelled" })
      .eq("consultant_id", consultant.id)
      .eq("status", "pending")
      .lt("created_at", fiveMinutesAgo);

    // Auto-complete active sessions whose client has disconnected (no billing tick for 5+ min).
    // last_tick_at is set by the tick endpoint; null means the session went active but never
    // received a tick — use started_at as the staleness reference in that case.
    const { data: staleSessions } = await supabase
      .from("connect_sessions")
      .select("id, minutes_used, rate_per_min, amount_charged")
      .eq("consultant_id", consultant.id)
      .eq("status", "active")
      .or(`last_tick_at.lt.${fiveMinutesAgo},and(last_tick_at.is.null,started_at.lt.${fiveMinutesAgo})`);

    if (staleSessions && staleSessions.length > 0) {
      const now = new Date().toISOString();
      for (const stale of staleSessions) {
        await supabase
          .from("connect_sessions")
          .update({ status: "completed", ended_at: now })
          .eq("id", stale.id);
      }
      // Clear is_busy — no active sessions remain for this consultant.
      await supabase
        .from("connect_consultants")
        .update({ is_busy: false })
        .eq("id", consultant.id);
    }
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
      "id, user_id, type, status, scheduled_note, scheduled_at, started_at, ended_at, " +
      "minutes_used, rate_per_min, amount_charged, rating, review_text, created_at"
    )
    .eq("consultant_id", consultant.id)
    .in("status", statusFilter)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  type SessionRow = {
    id: string; user_id: string; type: string; status: string;
    scheduled_note: string | null; scheduled_at: string | null;
    started_at: string | null; ended_at: string | null;
    minutes_used: number; rating: number | null;
    review_text: string | null; created_at: string;
  };

  // Enrich pending/active sessions with minimal user profile for preview card
  const sessions = (data ?? []) as unknown as SessionRow[];
  const previewUserIds = sessions
    .filter((s) => s.status === "pending" || s.status === "active")
    .map((s) => s.user_id);

  const userPreviewMap: Record<string, { email: string }> = {};
  if (previewUserIds.length > 0) {
    for (const uid of previewUserIds) {
      try {
        const { data: u } = await supabase.auth.admin.getUserById(uid);
        if (u?.user?.email) userPreviewMap[uid] = { email: u.user.email };
      } catch { /* non-critical */ }
    }
  }

  const enriched = sessions.map((s) => ({
    ...s,
    user_preview: userPreviewMap[s.user_id] ?? null,
  }));

  return NextResponse.json({ ok: true, sessions: enriched, consultant_id: consultant.id });
}
