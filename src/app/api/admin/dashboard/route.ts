// src/app/api/admin/dashboard/route.ts
// GET /api/admin/dashboard — aggregate stats across all orgs

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const [orgsRes, membersRes, poolsRes, assignmentsRes, auditRes, superAdminsRes] = await Promise.all([
    // Org counts by status
    admin.from("organizations").select("status"),
    // Total org members
    admin.from("org_members").select("role, org_id, override_tier").eq("status", "active"),
    // All license pools
    admin.from("org_license_pools").select("tier, quantity_total, quantity_used, active, org_id"),
    // Active pool assignments
    admin.from("org_license_assignments").select("tier, org_id").is("withdrawn_at", null),
    // Recent audit events
    admin.from("org_audit_log").select("action, org_id, created_at, actor_role").order("created_at", { ascending: false }).limit(10),
    // Super-admin count
    admin.from("super_admins").select("role, active"),
  ]);

  // Org stats
  const orgs = orgsRes.data ?? [];
  const orgStats = {
    total:     orgs.length,
    active:    orgs.filter((o) => o.status === "active").length,
    pending:   orgs.filter((o) => o.status === "pending").length,
    suspended: orgs.filter((o) => o.status === "suspended").length,
  };

  // Member stats
  const members = membersRes.data ?? [];
  const memberStats = {
    total:  members.length,
    admins: members.filter((m) => m.role === "admin" || m.role === "owner").length,
    users:  members.filter((m) => m.role === "member").length,
  };

  // Pool stats
  const pools       = poolsRes.data ?? [];
  const activePools = pools.filter((p) => p.active);
  const poolStats   = {
    totalPools:      pools.length,
    activePools:     activePools.length,
    totalIssued:     activePools.reduce((s, p) => s + p.quantity_total, 0),
    totalAssigned:   activePools.reduce((s, p) => s + p.quantity_used, 0),
    totalAvailable:  activePools.reduce((s, p) => s + (p.quantity_total - p.quantity_used), 0),
    byTier:          activePools.reduce((acc, p) => {
      acc[p.tier] = (acc[p.tier] ?? { issued: 0, assigned: 0 });
      acc[p.tier].issued   += p.quantity_total;
      acc[p.tier].assigned += p.quantity_used;
      return acc;
    }, {} as Record<string, { issued: number; assigned: number }>),
  };

  // Per-org breakdown
  const orgIds = [...new Set(pools.map((p) => p.org_id))];
  const { data: orgDetails } = await admin
    .from("organizations")
    .select("id, name, slug, billing_type, tier, status, seats_purchased, seats_used")
    .in("id", orgIds.length > 0 ? orgIds : ["00000000-0000-0000-0000-000000000000"]);

  const orgBreakdown = (orgDetails ?? []).map((org) => {
    const orgPools  = activePools.filter((p) => p.org_id === org.id);
    const orgMembers = members.filter((m) => m.org_id === org.id);
    return {
      orgId:          org.id,
      name:           org.name,
      billingType:    org.billing_type,
      tier:           org.tier,
      status:         org.status,
      seatsPurchased: org.seats_purchased,
      seatsUsed:      org.seats_used,
      memberCount:    orgMembers.length,
      poolLicenses: {
        issued:    orgPools.reduce((s, p) => s + p.quantity_total, 0),
        assigned:  orgPools.reduce((s, p) => s + p.quantity_used, 0),
        available: orgPools.reduce((s, p) => s + (p.quantity_total - p.quantity_used), 0),
      },
    };
  });

  // Super-admin stats
  const sas = superAdminsRes.data ?? [];
  const saStats = {
    total:   sas.length,
    owners:  sas.filter((s) => s.role === "owner" && s.active).length,
    admins:  sas.filter((s) => s.role === "admin" && s.active).length,
    inactive: sas.filter((s) => !s.active).length,
  };

  return NextResponse.json({
    orgs:         orgStats,
    members:      memberStats,
    pools:        poolStats,
    orgBreakdown: orgBreakdown.sort((a, b) => b.memberCount - a.memberCount),
    superAdmins:  saStats,
    recentAudit:  auditRes.data ?? [],
  });
}
