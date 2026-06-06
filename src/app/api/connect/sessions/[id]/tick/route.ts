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
    .select("id, user_id, consultant_id, status, minutes_used, amount_charged, currency_code, rate_per_min")
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

  // Use locked rate from session (falls back to consultant if migration not yet applied)
  const ratePerMin = Number(session.rate_per_min) > 0
    ? Number(session.rate_per_min)
    : await fetchConsultantRate(supabase, session.consultant_id);

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
  const now           = new Date().toISOString();

  if (balanceBefore <= 0) {
    // Auto-complete: no balance remaining
    await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        last_tick_at:   now,
        amount_charged: Number(session.amount_charged ?? 0),
      })
      .eq("id", sessionId);

    await creditConsultant(supabase, session.consultant_id, session.minutes_used);

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  // Deduct 1 minute
  const newMinutesUsed   = Number(session.minutes_used) + 1;
  const newAmountCharged = newMinutesUsed * ratePerMin;
  const remaining        = balanceBefore - 1;

  // Auto-complete when balance hits zero
  if (remaining <= 0) {
    await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        minutes_used:   newMinutesUsed,
        amount_charged: newAmountCharged,
        last_tick_at:   now,
      })
      .eq("id", sessionId);

    await creditConsultant(supabase, session.consultant_id, newMinutesUsed);

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  // Optimistic lock: only write if minutes_used hasn't changed since we read it.
  // Prevents double-deduction if two tick requests race each other.
  const { data: updated } = await supabase
    .from("connect_sessions")
    .update({
      minutes_used:   newMinutesUsed,
      amount_charged: newAmountCharged,
      last_tick_at:   now,
    })
    .eq("id", sessionId)
    .eq("minutes_used", Number(session.minutes_used))
    .select("id");

  if (!updated || updated.length === 0) {
    // Another concurrent tick already wrote — return current state without double-counting
    return NextResponse.json({ ok: true, status: "active", remaining_minutes: remaining });
  }

  return NextResponse.json({ ok: true, status: "active", remaining_minutes: remaining });
}

async function fetchConsultantRate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  consultantId: string
): Promise<number> {
  const { data } = await supabase
    .from("connect_consultants")
    .select("rate_per_min")
    .eq("id", consultantId)
    .single();
  return Number(data?.rate_per_min ?? 0);
}

async function creditConsultant(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  consultantId: string,
  minutesUsed: number
) {
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, rate_per_min, sessions_completed")
    .eq("id", consultantId)
    .single();

  if (!consultant) return;

  const sessionEarnings = Number(minutesUsed) * Number(consultant.rate_per_min) * 0.80;

  await supabase
    .from("connect_wallet")
    .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: wallet } = await supabase
    .from("connect_wallet")
    .select("earned_amount")
    .eq("user_id", consultant.user_id)
    .single();

  await supabase
    .from("connect_wallet")
    .update({
      earned_amount: (Number(wallet?.earned_amount ?? 0) + sessionEarnings),
      updated_at:    new Date().toISOString(),
    })
    .eq("user_id", consultant.user_id);

  await supabase
    .from("connect_consultants")
    .update({ sessions_completed: (consultant.sessions_completed ?? 0) + 1, is_busy: false })
    .eq("id", consultant.id);
}
