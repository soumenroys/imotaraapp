// src/app/api/admin/organizations/[orgId]/analytics/route.ts
// GET /api/admin/organizations/:orgId/analytics?days=30 — super-admin
// aggregate-only usage view. Deliberately mirrors the org-admin-facing
// /api/org/dashboard/analytics route's summary numbers only (WAU, avg
// session length, check-in rate) — no emotion-trend breakdown and no
// individual member data. Previously superadmin had no usage visibility
// into any org anywhere in /admin, aggregate or otherwise.

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getOrgUsageStats } from "@/lib/imotara/org";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const days = Math.min(180, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10));

  const result = await getOrgUsageStats(orgId, days);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  const stats = result.data;
  const totalEvents = stats.reduce((s, r) => s + r.totalEvents, 0);
  const uniqueDays  = stats.filter((r) => r.activeUsers > 0).length;
  const avgWAU      = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + r.activeUsers, 0) / stats.length)
    : 0;
  const avgSession  = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + r.avgSessionMins, 0) / stats.length * 10) / 10
    : 0;

  return NextResponse.json({
    days,
    summary: { totalEvents, uniqueDays, avgWAU, avgSessionMins: avgSession },
    daily:   stats,
  });
}
