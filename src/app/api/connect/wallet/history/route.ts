// GET /api/connect/wallet/history
// Auth required. Returns the last 50 wallet transactions (topups + session usage).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [{ data: topups }, { data: sessions }] = await Promise.all([
    supabase
      .from("imotara_wallet_transactions")
      .select("id, type, amount, currency_code, description, razorpay_payment_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("connect_sessions")
      .select("id, consultant_id, minutes_used, amount_charged, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["completed", "active"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Enrich sessions with consultant names
  const consultantIds = [...new Set((sessions ?? []).map((s) => s.consultant_id))];
  const nameMap: Record<string, string> = {};
  if (consultantIds.length > 0) {
    const { data: consultants } = await supabase
      .from("connect_consultants")
      .select("id, display_name")
      .in("id", consultantIds);
    for (const c of consultants ?? []) {
      nameMap[c.id] = c.display_name;
    }
  }

  const transactions = [
    ...(topups ?? []).map((t) => ({
      id:              t.id,
      type:            t.type as "topup" | "deduction" | "refund",
      consultant_name: null,
      minutes:         null,
      amount:          Number(t.amount),
      currency_code:   t.currency_code,
      description:     t.description ?? "Wallet top-up",
      created_at:      t.created_at,
    })),
    ...(sessions ?? []).map((s) => ({
      id:              s.id,
      type:            "session" as const,
      consultant_name: nameMap[s.consultant_id] ?? "Companion",
      minutes:         Number(s.minutes_used),
      amount:          s.amount_charged != null ? Number(s.amount_charged) : null,
      currency_code:   "INR",
      description:     `Session with ${nameMap[s.consultant_id] ?? "Companion"}`,
      created_at:      s.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  return NextResponse.json({ ok: true, transactions });
}
