// src/app/api/org/dashboard/settings/route.ts
// GET   /api/org/dashboard/settings — org settings (read)
// PATCH /api/org/dashboard/settings — update name only (tier/seats = Imotara admin only)

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org, error } = await getSupabaseAdmin()
    .from("organizations")
    .select("id, name, slug, billing_type, tier, status, seats_purchased, seats_used, expires_at, created_at, org_settings")
    .eq("id", auth.orgId)
    .single();

  if (error) return NextResponse.json({ error: "org not found" }, { status: 404 });
  return NextResponse.json({ org });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { name?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  // Org admins can only update name — all other fields controlled by Imotara admin
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("organizations")
    .update({ name: body.name.trim(), updated_at: new Date().toISOString() })
    .eq("id", auth.orgId)
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org: data });
}
