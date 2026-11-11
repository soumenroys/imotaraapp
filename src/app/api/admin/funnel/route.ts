// GET /api/admin/funnel?days=30 — #129 (11 Nov 2026): the anonymous funnel for Admin → Analytics.
// ⛔ Admin only. Reads visit_tallies (kind 'funnel'): daily counts per step, nothing about who.
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { summariseFunnel, type FunnelRow } from "@/lib/analytics/funnelSummary";

export async function GET(req: NextRequest) {
  if (!(await adminAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10) || 30));
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await getSupabaseAdmin()
    .from("visit_tallies")
    .select("platform, bucket, hits")
    .eq("kind", "funnel")
    .gte("day", since);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, days, since, ...summariseFunnel((data ?? []) as FunnelRow[]) });
}
