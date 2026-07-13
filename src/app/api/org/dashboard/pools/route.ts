// src/app/api/org/dashboard/pools/route.ts
// GET  — org admin views their license pools + current assignments
// POST — assign a pool license to a user
// DELETE ?assignmentId= — withdraw a pool license

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// ── GET — pools + assignments ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  // All active pools for this org
  const { data: pools } = await admin
    .from("org_license_pools")
    .select("id, tier, quantity_total, quantity_used, label, expires_at, issued_by, notes, created_at")
    .eq("org_id", auth.orgId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  // All active assignments for this org
  const { data: assignments } = await admin
    .from("org_license_assignments")
    .select("id, pool_id, user_id, tier, assigned_at, assigned_by")
    .eq("org_id", auth.orgId)
    .is("withdrawn_at", null)
    .order("assigned_at", { ascending: false });

  // Enrich assignments with email
  const userIds = [...new Set((assignments ?? []).map((a) => a.user_id))];
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  authUsers?.users?.filter((u) => userIds.includes(u.id)).forEach((u) => {
    emailMap[u.id] = u.email ?? "—";
  });

  const enrichedAssignments = (assignments ?? []).map((a) => ({
    ...a, email: emailMap[a.user_id] ?? "—",
  }));

  return NextResponse.json({
    pools:       pools ?? [],
    assignments: enrichedAssignments,
    summary: {
      totalLicenses:  (pools ?? []).reduce((s, p) => s + p.quantity_total, 0),
      usedLicenses:   (pools ?? []).reduce((s, p) => s + p.quantity_used, 0),
      availableLicenses: (pools ?? []).reduce((s, p) => s + (p.quantity_total - p.quantity_used), 0),
    },
  });
}

// ── POST — assign from pool ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { poolId: string; userId: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.poolId || !body.userId) {
    return NextResponse.json({ error: "poolId and userId required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Verify pool belongs to this org
  const { data: pool } = await admin
    .from("org_license_pools")
    .select("org_id, active")
    .eq("id", body.poolId)
    .single();

  if (!pool || pool.org_id !== auth.orgId || !pool.active) {
    return NextResponse.json({ error: "Pool not found or not active" }, { status: 404 });
  }

  // Verify the target user is an active member of this org — without this,
  // an org-admin could assign a paid license entitlement to an arbitrary
  // Supabase user id outside their own org.
  const { data: targetMember } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", auth.orgId)
    .eq("user_id", body.userId)
    .eq("status", "active")
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "user is not an active org member" }, { status: 409 });
  }

  // Call DB function
  const { data: assignmentId, error } = await admin.rpc("assign_pool_license", {
    p_pool_id:     body.poolId,
    p_user_id:     body.userId,
    p_assigned_by: auth.userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assignmentId }, { status: 201 });
}

// ── DELETE — withdraw from pool ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const assignmentId = req.nextUrl.searchParams.get("assignmentId");
  const note         = req.nextUrl.searchParams.get("note") ?? "Withdrawn by org admin";
  if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });

  // Verify assignment belongs to this org
  const admin = getSupabaseAdmin();
  const { data: asgn } = await admin
    .from("org_license_assignments")
    .select("org_id")
    .eq("id", assignmentId)
    .is("withdrawn_at", null)
    .single();

  if (!asgn || asgn.org_id !== auth.orgId) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { error } = await admin.rpc("withdraw_pool_license", {
    p_assignment_id: assignmentId,
    p_withdrawn_by:  auth.userId,
    p_note:          note,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
