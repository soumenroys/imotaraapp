// src/app/api/org/dashboard/branding/route.ts
// GET   /api/org/dashboard/branding — read current branding settings
// PATCH /api/org/dashboard/branding — update logo_url, accent_color, brand_name
// EDU and Enterprise tiers. Requires org admin role.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

interface BrandingSettings {
  logo_url?:    string | null;
  accent_color?: string | null;  // hex e.g. "#4f46e5"
  brand_name?:  string | null;   // replaces "Imotara" in header
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org } = await getSupabaseAdmin()
    .from("organizations")
    .select("tier, org_settings")
    .eq("id", auth.orgId)
    .single();

  const branding: BrandingSettings = {
    logo_url:    org?.org_settings?.logo_url    ?? null,
    accent_color: org?.org_settings?.accent_color ?? null,
    brand_name:  org?.org_settings?.brand_name  ?? null,
  };

  return NextResponse.json({ branding, tier: org?.tier });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: BrandingSettings;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  // Validate accent_color if provided
  if (body.accent_color && !HEX_RE.test(body.accent_color)) {
    return NextResponse.json({ error: "accent_color must be a hex colour e.g. #4f46e5" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Read current org_settings, merge branding fields
  const { data: org } = await admin
    .from("organizations")
    .select("org_settings")
    .eq("id", auth.orgId)
    .single();

  const current = (org?.org_settings ?? {}) as Record<string, unknown>;

  const updated = {
    ...current,
    ...(body.logo_url    !== undefined ? { logo_url:    body.logo_url    ?? null } : {}),
    ...(body.accent_color !== undefined ? { accent_color: body.accent_color ?? null } : {}),
    ...(body.brand_name  !== undefined ? { brand_name:  body.brand_name  ?? null } : {}),
  };

  const { error } = await admin
    .from("organizations")
    .update({ org_settings: updated, updated_at: new Date().toISOString() })
    .eq("id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    branding: {
      logo_url:    updated.logo_url    ?? null,
      accent_color: updated.accent_color ?? null,
      brand_name:  updated.brand_name  ?? null,
    },
  });
}
