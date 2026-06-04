// src/app/api/org/dashboard/sso/route.ts
// GET   — read SSO configuration from org_settings
// PATCH — update SSO configuration (store IdP metadata)
// Note: actual SAML authentication flow requires Supabase dashboard configuration.
//       This endpoint stores the config; Imotara support activates it.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org } = await getSupabaseAdmin()
    .from("organizations")
    .select("tier, org_settings")
    .eq("id", auth.orgId)
    .single();

  const saml = (org?.org_settings as Record<string, unknown>)?.saml ?? null;
  return NextResponse.json({ saml, tier: org?.tier });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: {
    entity_id?:    string | null;
    sso_url?:      string | null;
    certificate?:  string | null;
    email_domain?: string | null;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("org_settings").eq("id", auth.orgId).single();
  const current = (org?.org_settings ?? {}) as Record<string, unknown>;

  const updatedSaml = {
    ...(current.saml as Record<string, unknown> ?? {}),
    ...(body.entity_id    !== undefined ? { entity_id:    body.entity_id    } : {}),
    ...(body.sso_url      !== undefined ? { sso_url:      body.sso_url      } : {}),
    ...(body.certificate  !== undefined ? { certificate:  body.certificate  } : {}),
    ...(body.email_domain !== undefined ? { email_domain: body.email_domain } : {}),
    status: "pending", // requires Imotara support to activate
  };

  const { error } = await admin
    .from("organizations")
    .update({ org_settings: { ...current, saml: updatedSaml }, updated_at: new Date().toISOString() })
    .eq("id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saml: updatedSaml });
}
