// src/app/api/org/dashboard/route.ts
// GET /api/org/dashboard — org overview: details, seat counts, recent activity
// Requires: authenticated org member (any role)

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getOrgUsageStats } from "@/lib/imotara/org";

export async function GET(req: NextRequest) {
  const auth = await requireOrgMember(req);
  if (!auth.ok) return auth.response;

  const { orgId } = auth;
  const admin = getSupabaseAdmin();

  // Org details
  const { data: org, error } = await admin
    .from("organizations")
    .select("id, name, slug, billing_type, tier, status, seats_purchased, seats_used, expires_at, created_at")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: "org not found" }, { status: 404 });
  }

  // Member count by role
  const { data: roleCounts } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("status", "active");

  const counts = { owner: 0, admin: 0, member: 0 };
  (roleCounts ?? []).forEach((r) => {
    if (r.role in counts) counts[r.role as keyof typeof counts]++;
  });

  // Pending invites count
  const { count: pendingInvites } = await admin
    .from("org_invites")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());

  // Last 7 days WAU (quick stat for overview)
  const statsResult = await getOrgUsageStats(orgId, 7);
  const weeklyStats = statsResult.ok ? statsResult.data : [];
  const wau = weeklyStats.length > 0
    ? Math.max(...weeklyStats.map((s) => s.activeUsers))
    : 0;

  return NextResponse.json({
    org,
    members:       { total: (roleCounts ?? []).length, ...counts },
    pendingInvites: pendingInvites ?? 0,
    wau,
  });
}
