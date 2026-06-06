// GET /api/admin/connect/earnings
// Returns all consultants with earnings, pending payouts, and recent payout history.
// Auth: connect_reviewer or higher.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  const admin = await connectAdminAuthorized(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data: consultants, error } = await supabase
    .from("connect_consultants")
    .select("id, user_id, display_name, photo_url, status, currency_code, rate_per_min, sessions_completed, rating_avg, created_at")
    .in("status", ["approved", "suspended"])
    .order("sessions_completed", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const userIds = (consultants ?? []).map((c) => c.user_id);

  // Fetch wallet data for all consultants in one query
  const { data: wallets } = await supabase
    .from("connect_wallet")
    .select("user_id, earned_amount, earned_currency, pending_payout")
    .in("user_id", userIds);

  // Fetch recent payouts
  const { data: payouts } = await supabase
    .from("connect_payouts")
    .select("id, consultant_user_id, amount, currency_code, payout_method, status, admin_note, created_at, processed_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const walletMap = Object.fromEntries((wallets ?? []).map((w) => [w.user_id, w]));

  const enriched = (consultants ?? []).map((c) => ({
    ...c,
    earned_amount:  Number(walletMap[c.user_id]?.earned_amount ?? 0),
    pending_payout: Number(walletMap[c.user_id]?.pending_payout ?? 0),
    earned_currency: walletMap[c.user_id]?.earned_currency ?? c.currency_code,
  }));

  return NextResponse.json({ ok: true, consultants: enriched, payouts: payouts ?? [] });
}
