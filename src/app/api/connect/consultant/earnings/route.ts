export const preferredRegion = ["sin1"];

// GET /api/connect/consultant/earnings
// Auth required. Returns consultant's earnings summary and recent sessions.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, rate_per_min, currency_code, status, sessions_completed")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Consultant profile not found" }, { status: 404 });
  }

  const { data: wallet } = await supabase
    .from("connect_wallet")
    .select("earned_amount, earned_currency, pending_payout")
    .eq("user_id", user.id)
    .single();

  // Recent completed sessions for this consultant.
  // rate_per_min is locked at session creation — use it, not the consultant's current rate.
  const { data: sessions } = await supabase
    .from("connect_sessions")
    .select("id, user_id, started_at, ended_at, minutes_used, rate_per_min, amount_charged, rating, created_at")
    .eq("consultant_id", consultant.id)
    .eq("status", "completed")
    .order("ended_at", { ascending: false })
    .limit(20);

  const sessionsWithEarnings = (sessions ?? []).map((s) => {
    // Prefer the locked session rate; fall back to current consultant rate only for legacy rows
    // that pre-date the rate_per_min column migration (rate_per_min would be null/0).
    const lockedRate = Number(s.rate_per_min) > 0
      ? Number(s.rate_per_min)
      : Number(consultant.rate_per_min);
    return {
      ...s,
      earnings: Number(s.minutes_used) * lockedRate * 0.80,
      currency:  consultant.currency_code,
    };
  });

  return NextResponse.json({
    ok: true,
    earned_amount:      wallet?.earned_amount  ?? 0,
    earned_currency:    wallet?.earned_currency ?? consultant.currency_code,
    pending_payout:     wallet?.pending_payout  ?? 0,
    sessions_completed: consultant.sessions_completed,
    rate_per_min:       consultant.rate_per_min,
    sessions:           sessionsWithEarnings,
  });
}
