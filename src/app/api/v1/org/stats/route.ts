// src/app/api/v1/org/stats/route.ts
// GET /api/v1/org/stats?days=30
// Aggregate org stats accessible via API key (scope: read:stats)
// Enterprise tier only.

import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/imotara/apiKeyAuth";
import { getOrgUsageStats } from "@/lib/imotara/org";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const ctx = await verifyApiKey(req);
  if (!ctx) return NextResponse.json({ error: "invalid or missing API key" }, { status: 401 });
  if (!ctx.scopes.includes("read:stats")) {
    return NextResponse.json({ error: "API key missing read:stats scope" }, { status: 403 });
  }
  if (ctx.orgTier !== "enterprise") {
    return NextResponse.json({ error: "REST API access requires Enterprise plan" }, { status: 403 });
  }

  const days = Math.min(180, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10));

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations")
    .select("name, seats_purchased, seats_used")
    .eq("id", ctx.orgId).single();

  const statsResult = await getOrgUsageStats(ctx.orgId, days);

  return NextResponse.json({
    org: { name: ctx.orgName, tier: ctx.orgTier, seats: { purchased: org?.seats_purchased, used: org?.seats_used } },
    days,
    stats: statsResult.ok ? statsResult.data : [],
  });
}
