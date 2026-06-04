// src/app/api/admin/organizations/[orgId]/pools/route.ts
// GET  — list license pools for an org (super-admin)
// POST — issue a new license pool to an org (super-admin)
// PATCH ?poolId= — modify quantity or deactivate (super-admin)

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { orgId } = await params;

  const { data, error } = await getSupabaseAdmin()
    .from("org_license_pools")
    .select("id, tier, quantity_total, quantity_used, label, expires_at, active, issued_by, notes, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pools: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { orgId } = await params;

  let body: { tier: string; quantity: number; label?: string; expires_at?: string; notes?: string; issued_by?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.tier || !body.quantity || body.quantity < 1) {
    return NextResponse.json({ error: "tier and quantity (≥1) required" }, { status: 400 });
  }

  const VALID_TIERS = ["free","plus","pro","edu","enterprise"];
  if (!VALID_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: `tier must be one of: ${VALID_TIERS.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("org_license_pools")
    .insert({
      org_id:         orgId,
      tier:           body.tier,
      quantity_total: body.quantity,
      quantity_used:  0,
      label:          body.label?.trim()      ?? null,
      expires_at:     body.expires_at         ?? null,
      notes:          body.notes?.trim()      ?? null,
      issued_by:      body.issued_by?.trim()  ?? "super-admin",
      active:         true,
    })
    .select("id, tier, quantity_total, quantity_used, label, expires_at, active, issued_by, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to org audit
  await getSupabaseAdmin().from("org_audit_log").insert({
    org_id:     orgId,
    actor_role: "imotara_admin",
    action:     "pool_issued",
    changes:    { tier: body.tier, quantity: body.quantity, label: body.label },
  });

  return NextResponse.json({ pool: data }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { orgId } = await params;
  const poolId = req.nextUrl.searchParams.get("poolId");
  if (!poolId) return NextResponse.json({ error: "poolId required" }, { status: 400 });

  let body: { quantity_total?: number; active?: boolean; expires_at?: string | null; notes?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.quantity_total !== undefined) update.quantity_total = body.quantity_total;
  if (body.active         !== undefined) update.active         = body.active;
  if (body.expires_at     !== undefined) update.expires_at     = body.expires_at;
  if (body.notes          !== undefined) update.notes          = body.notes;

  const { error } = await getSupabaseAdmin()
    .from("org_license_pools")
    .update(update)
    .eq("id", poolId)
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
