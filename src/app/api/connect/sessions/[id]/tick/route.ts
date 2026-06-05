// POST /api/connect/sessions/[id]/tick
// Called every 60s by the client during an active session.
// Server-authoritative: deducts 1 minute from the user's recharge balance.
// Returns { ok, remaining_minutes, status }
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function POST(
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
    .select("id, user_id, consultant_id, status, minutes_used, amount_charged, currency_code")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }
  if (session.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ ok: false, status: session.status, remaining_minutes: 0 });
  }

  // Calculate available balance for this consultant
  const { data: recharges } = await supabase
    .from("connect_recharges")
    .select("minutes_credited")
    .eq("user_id", user.id)
    .eq("consultant_id", session.consultant_id)
    .eq("status", "completed");

  const { data: usedSessions } = await supabase
    .from("connect_sessions")
    .select("minutes_used")
    .eq("user_id", user.id)
    .eq("consultant_id", session.consultant_id)
    .in("status", ["completed", "active"]);

  const totalCredited = (recharges ?? []).reduce((s, r) => s + Number(r.minutes_credited), 0);
  const totalUsed     = (usedSessions ?? []).reduce((s, r) => s + Number(r.minutes_used), 0);
  const balanceBefore = totalCredited - totalUsed;

  if (balanceBefore <= 0) {
    // Auto-complete: no balance remaining
    await supabase
      .from("connect_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", sessionId);

    await creditConsultant(supabase, session);

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  // Deduct 1 minute
  const newMinutesUsed = Number(session.minutes_used) + 1;
  await supabase
    .from("connect_sessions")
    .update({ minutes_used: newMinutesUsed })
    .eq("id", sessionId);

  const remaining = balanceBefore - 1;

  // Auto-complete when balance hits zero
  if (remaining <= 0) {
    await supabase
      .from("connect_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString(), minutes_used: newMinutesUsed })
      .eq("id", sessionId);

    await creditConsultant(supabase, { ...session, minutes_used: newMinutesUsed });

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  return NextResponse.json({ ok: true, status: "active", remaining_minutes: remaining });
}

async function creditConsultant(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  session: { consultant_id: string; minutes_used: number }
) {
  // Get consultant rate to calculate credit amount
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("user_id, rate_per_min")
    .eq("id", session.consultant_id)
    .single();

  if (!consultant) return;

  const sessionEarnings = Number(session.minutes_used) * Number(consultant.rate_per_min) * 0.80;

  await supabase
    .from("connect_wallet")
    .upsert(
      { user_id: consultant.user_id },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  try {
    await supabase.rpc("increment_consultant_earnings", {
      p_user_id: consultant.user_id,
      p_amount:  sessionEarnings,
    });
  } catch {
    // RPC may not exist yet — non-blocking; earnings will be recalculated from sessions
  }
}
