// GET /api/connect/wallet
// Auth required. Returns user's balance per consultant + consultant earnings if applicable.
// Query param: consultant_id — filter balance to a specific consultant

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const consultantId = req.nextUrl.searchParams.get("consultant_id");
  const supabase = getSupabaseAdmin();

  // Compute balance: total credited - total used (per consultant if filtered)
  let rechargeQuery = supabase
    .from("connect_recharges")
    .select("consultant_id, minutes_credited, currency_code")
    .eq("user_id", user.id)
    .eq("status", "completed");

  let sessionQuery = supabase
    .from("connect_sessions")
    .select("consultant_id, minutes_used")
    .eq("user_id", user.id)
    .in("status", ["completed", "active"]);

  if (consultantId) {
    rechargeQuery = rechargeQuery.eq("consultant_id", consultantId);
    sessionQuery  = sessionQuery.eq("consultant_id", consultantId);
  }

  const [{ data: recharges }, { data: sessions }] = await Promise.all([
    rechargeQuery,
    sessionQuery,
  ]);

  // Group by consultant
  const balanceByConsultant: Record<string, { minutes: number; currency: string }> = {};

  for (const r of recharges ?? []) {
    const cid = r.consultant_id;
    if (!balanceByConsultant[cid]) {
      balanceByConsultant[cid] = { minutes: 0, currency: r.currency_code };
    }
    balanceByConsultant[cid].minutes += Number(r.minutes_credited);
  }
  for (const s of sessions ?? []) {
    const cid = s.consultant_id;
    if (balanceByConsultant[cid]) {
      balanceByConsultant[cid].minutes -= Number(s.minutes_used);
    }
  }

  // Consultant earnings (if this user is a consultant)
  const { data: wallet } = await supabase
    .from("connect_wallet")
    .select("earned_amount, earned_currency, pending_payout")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    ok: true,
    balances: balanceByConsultant,
    earned_amount:  wallet?.earned_amount  ?? 0,
    earned_currency: wallet?.earned_currency ?? "INR",
    pending_payout: wallet?.pending_payout  ?? 0,
  });
}
