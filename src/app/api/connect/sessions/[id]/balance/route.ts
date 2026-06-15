// GET /api/connect/sessions/[id]/balance
// Auth required. Returns remaining session minutes and total credited minutes.
// Accessible to both the session user and the consultant — both need live balance info.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, status, minutes_used, rate_per_min, currency_code, amount_charged")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  // Auth: caller must be the session user OR the consultant
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, display_name")
    .eq("id", session.consultant_id)
    .limit(1)
    .maybeSingle();

  const isSessionUser = session.user_id === user.id;
  const isConsultant  = consultant?.user_id === user.id;

  if (!isSessionUser && !isConsultant) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Total minutes credited to this user for this consultant (all completed recharges)
  const { data: recharges } = await supabase
    .from("connect_recharges")
    .select("minutes_credited")
    .eq("user_id", session.user_id)
    .eq("consultant_id", session.consultant_id)
    .eq("status", "completed");

  // Total minutes used by this user with this consultant (all completed + current active sessions)
  const { data: usedSessions } = await supabase
    .from("connect_sessions")
    .select("minutes_used")
    .eq("user_id", session.user_id)
    .eq("consultant_id", session.consultant_id)
    .in("status", ["completed", "active"]);

  const totalCredited  = (recharges ?? []).reduce((s, r) => s + Number(r.minutes_credited), 0);
  const totalUsed      = (usedSessions ?? []).reduce((s, r) => s + Number(r.minutes_used), 0);
  const remainingMin   = Math.max(0, totalCredited - totalUsed);
  const ratePerMin     = Number(session.rate_per_min ?? 0);
  const remainingAmt   = remainingMin * ratePerMin;
  const amountCharged  = Number(session.amount_charged ?? 0);

  return NextResponse.json({
    ok:                    true,
    session_id:            sessionId,
    status:                session.status,
    remaining_minutes:     remainingMin,
    remaining_amount:      remainingAmt,
    total_credited_minutes: totalCredited,
    minutes_used:          Number(session.minutes_used ?? 0),
    amount_charged:        amountCharged,
    rate_per_min:          ratePerMin,
    currency_code:         session.currency_code ?? "INR",
    consultant_name:       consultant?.display_name ?? null,
  });
}
