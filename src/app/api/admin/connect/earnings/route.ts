// GET /api/admin/connect/earnings
// Returns all consultants with earnings, pending payouts, recent payout history,
// and aggregate revenue totals (optionally filtered by date range).
// Query params: from (ISO date), to (ISO date)
// Auth: connect_reviewer or higher.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  const admin = await connectAdminAuthorized(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from"); // e.g. "2026-06-01"
  const to   = searchParams.get("to");   // e.g. "2026-06-30"

  const supabase = getSupabaseAdmin();

  const [
    { data: consultants, error },
    { data: wallets },
    { data: payouts },
    { data: sessions },
  ] = await Promise.all([
    supabase
      .from("connect_consultants")
      .select("id, user_id, display_name, photo_url, status, currency_code, rate_per_min, sessions_completed, rating_avg, created_at")
      .in("status", ["approved", "suspended"])
      .order("sessions_completed", { ascending: false }),

    supabase
      .from("connect_wallet")
      .select("user_id, earned_amount, earned_currency, pending_payout"),

    supabase
      .from("connect_payouts")
      .select("id, consultant_user_id, amount, currency_code, payout_method, status, admin_note, created_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(100),

    // Aggregate sessions for platform revenue totals
    (() => {
      let q = supabase
        .from("connect_sessions")
        .select("amount_charged, consultant_credited, platform_fee")
        .eq("status", "completed");
      if (from) q = q.gte("ended_at", new Date(from).toISOString());
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1); // inclusive end-of-day
        q = q.lt("ended_at", toDate.toISOString());
      }
      return q;
    })(),
  ]);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const walletMap = Object.fromEntries((wallets ?? []).map((w) => [w.user_id, w]));

  const enriched = (consultants ?? []).map((c) => ({
    ...c,
    earned_amount:   Number(walletMap[c.user_id]?.earned_amount ?? 0),
    pending_payout:  Number(walletMap[c.user_id]?.pending_payout ?? 0),
    earned_currency: walletMap[c.user_id]?.earned_currency ?? c.currency_code,
  }));

  // Aggregate revenue totals across all completed sessions in the date range
  let total_charged = 0;
  let total_platform_fee = 0;
  let total_consultant_credited = 0;
  let total_sessions = 0;

  for (const s of sessions ?? []) {
    total_charged             += Number(s.amount_charged ?? 0);
    total_platform_fee        += Number(s.platform_fee ?? 0);
    total_consultant_credited += Number(s.consultant_credited ?? 0);
    total_sessions++;
  }

  return NextResponse.json({
    ok: true,
    consultants: enriched,
    payouts: payouts ?? [],
    totals: {
      total_sessions,
      total_charged:             Math.round(total_charged * 100) / 100,
      total_platform_fee:        Math.round(total_platform_fee * 100) / 100,
      total_consultant_credited: Math.round(total_consultant_credited * 100) / 100,
      from: from ?? null,
      to:   to   ?? null,
    },
  });
}
