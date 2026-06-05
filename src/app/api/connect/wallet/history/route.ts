// GET /api/connect/wallet/history
// Auth required. Returns the last 50 wallet transactions (recharges + session usage).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [{ data: recharges }, { data: sessions }] = await Promise.all([
    supabase
      .from("connect_recharges")
      .select("id, consultant_id, minutes_credited, currency_code, amount, created_at, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("connect_sessions")
      .select("id, consultant_id, minutes_used, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["completed", "active"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Enrich with consultant names
  const consultantIds = [...new Set([
    ...(recharges ?? []).map((r) => r.consultant_id),
    ...(sessions ?? []).map((s) => s.consultant_id),
  ])];

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
    ...(recharges ?? []).map((r) => ({
      id: r.id,
      type: "recharge" as const,
      consultant_name: nameMap[r.consultant_id] ?? "Companion",
      consultant_id: r.consultant_id,
      minutes: Number(r.minutes_credited),
      amount: Number(r.amount),
      currency_code: r.currency_code,
      created_at: r.created_at,
    })),
    ...(sessions ?? []).map((s) => ({
      id: s.id,
      type: "session" as const,
      consultant_name: nameMap[s.consultant_id] ?? "Companion",
      consultant_id: s.consultant_id,
      minutes: Number(s.minutes_used),
      amount: null,
      currency_code: null,
      created_at: s.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  return NextResponse.json({ ok: true, transactions });
}
