// src/app/api/org/dashboard/license-inventory/route.ts
// GET /api/org/dashboard/license-inventory
// Returns license breakdown + per-member enriched data with engagement stats.
// Org admin only.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  // Org details + license inventory breakdown
  const [orgResult, inventoryResult] = await Promise.all([
    admin.from("organizations").select("id,name,tier,billing_type,status,seats_purchased,seats_used,expires_at").eq("id", auth.orgId).single(),
    admin.rpc("get_org_license_inventory", { p_org_id: auth.orgId }),
  ]);

  // All active members with override_tier + engagement stats
  const [membersResult, statsResult] = await Promise.all([
    admin.from("org_members")
      .select("user_id, role, status, joined_at, override_tier")
      .eq("org_id", auth.orgId)
      .eq("status", "active")
      .order("joined_at", { ascending: true }),
    admin.rpc("get_org_member_stats", { p_org_id: auth.orgId, p_days_back: 30 }),
  ]);

  // Enrich with email from auth.users
  const userIds = (membersResult.data ?? []).map((m) => m.user_id);
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  const lastSignInMap: Record<string, string | null> = {};
  authUsers?.users?.forEach((u) => {
    if (userIds.includes(u.id)) {
      emailMap[u.id] = u.email ?? "—";
      lastSignInMap[u.id] = u.last_sign_in_at ?? null;
    }
  });

  // Engagement stats map
  const statsMap: Record<string, { sessions_count: number; last_active: string | null }> = {};
  (statsResult.data ?? []).forEach((s: { user_id: string; sessions_count: number; last_active: string }) => {
    statsMap[s.user_id] = { sessions_count: Number(s.sessions_count), last_active: s.last_active };
  });

  const orgTier = orgResult.data?.tier ?? "enterprise";

  const members = (membersResult.data ?? []).map((m) => ({
    userId:         m.user_id,
    email:          emailMap[m.user_id]     ?? "—",
    role:           m.role,
    joinedAt:       m.joined_at,
    lastSignIn:     lastSignInMap[m.user_id] ?? null,
    overrideTier:   m.override_tier         ?? null,
    effectiveTier:  m.override_tier         ?? orgTier,
    sessionsLast30: statsMap[m.user_id]?.sessions_count ?? 0,
    lastActive:     statsMap[m.user_id]?.last_active    ?? null,
    licenseStatus:  "active",  // all org members are active by definition
  }));

  const inventory = inventoryResult.data?.[0] ?? null;

  return NextResponse.json({
    org:       orgResult.data,
    inventory: {
      tier:           orgTier,
      seatsPurchased: orgResult.data?.seats_purchased ?? 0,
      seatsUsed:      orgResult.data?.seats_used      ?? 0,
      seatsAvailable: (orgResult.data?.seats_purchased ?? 0) - (orgResult.data?.seats_used ?? 0),
      expiresAt:      orgResult.data?.expires_at      ?? null,
      tierBreakdown:  (inventory as { tier_breakdown?: Record<string,number> } | null)?.tier_breakdown ?? {},
    },
    members,
  });
}
