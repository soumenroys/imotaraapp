// src/app/api/org/dashboard/analytics/route.ts
// GET /api/org/dashboard/analytics?days=30
// EDU/NGO billing_type only — aggregate anonymized usage stats

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getOrgUsageStats } from "@/lib/imotara/org";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  // Verify org has analytics access (EDU or NGO billing_type)
  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("billing_type, name")
    .eq("id", auth.orgId)
    .single();

  const analyticsAllowed = ["edu", "ngo"].includes(org?.billing_type ?? "");
  if (!analyticsAllowed) {
    return NextResponse.json({ error: "Analytics available for EDU and NGO accounts only" }, { status: 403 });
  }

  const days = Math.min(180, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10));

  const result = await getOrgUsageStats(auth.orgId, days);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  // Compute summary stats
  const stats = result.data;
  const totalEvents  = stats.reduce((s, r) => s + r.totalEvents, 0);
  const uniqueDays   = stats.filter((r) => r.activeUsers > 0).length;
  const avgWAU       = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + r.activeUsers, 0) / stats.length)
    : 0;
  const avgSession   = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + r.avgSessionMins, 0) / stats.length * 10) / 10
    : 0;

  // Emotion trend breakdown — aggregate count per emotion label across the period
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: emotionRows } = await admin
    .from("usage_events")
    .select("emotion")
    .not("emotion", "is", null)
    .gte("created_at", cutoff)
    .in("user_id",
      (await admin.from("org_members").select("user_id").eq("org_id", auth.orgId).eq("status","active")).data?.map((m) => m.user_id) ?? []
    );

  const emotionCounts: Record<string, number> = {};
  (emotionRows ?? []).forEach(({ emotion }) => {
    if (emotion) emotionCounts[emotion] = (emotionCounts[emotion] ?? 0) + 1;
  });
  const emotionTrends = Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([emotion, count]) => ({ emotion, count }));

  return NextResponse.json({
    orgName:    org?.name,
    days,
    summary: { totalEvents, uniqueDays, avgWAU, avgSessionMins: avgSession },
    daily:   stats,
    emotionTrends,
  });
}
