// src/app/api/admin/organizations/[orgId]/route.ts
// GET   /api/admin/organizations/:orgId   — org detail + members
// PATCH /api/admin/organizations/:orgId   — update org (tier, seats, status, etc.)
// Protected by ADMIN_SECRET Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getOrgMembers } from "@/lib/imotara/org";

// ── GET — org detail + member list ───────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const admin = getSupabaseAdmin();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgErr || !org) {
    return NextResponse.json({ error: "org not found" }, { status: 404 });
  }

  const membersResult = await getOrgMembers(orgId, 0, 100);
  const members = membersResult.ok ? membersResult.data : [];

  return NextResponse.json({ org, members }, { status: 200 });
}

// ── PATCH — update org fields ─────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  let body: Partial<{
    name:            string;
    billing_type:    string;
    tier:            string;
    status:          string;
    seats_purchased: number;
    expires_at:      string | null;
    notes:           string | null;
  }>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Build update payload — only include fields that were sent
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name            !== undefined) update.name            = body.name;
  if (body.billing_type    !== undefined) update.billing_type    = body.billing_type;
  if (body.tier            !== undefined) update.tier            = body.tier;
  if (body.status          !== undefined) update.status          = body.status;
  if (body.seats_purchased !== undefined) update.seats_purchased = body.seats_purchased;
  if (body.expires_at      !== undefined) update.expires_at      = body.expires_at;
  if (body.notes           !== undefined) update.notes           = body.notes;

  const { data, error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", orgId)
    .select("id, name, slug, tier, status, seats_purchased, seats_used, billing_type, expires_at, notes")
    .single();

  if (error) {
    console.error("[admin/organizations PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If tier changed, update all active org members' licenses
  if (body.tier) {
    await admin
      .from("licenses")
      .update({ tier: body.tier, updated_at: new Date().toISOString() })
      .eq("org_id", orgId);
  }

  return NextResponse.json({ org: data }, { status: 200 });
}
