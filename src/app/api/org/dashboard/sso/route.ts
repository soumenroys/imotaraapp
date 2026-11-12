// src/app/api/org/dashboard/sso/route.ts
// GET   — the org's SSO setup + the values their IT team needs (Imotara's service-provider details)
// PATCH — save their identity provider's metadata (URL or XML) and email domain(s) ⇒ `pending`
//
// 12 Nov 2026 (owner: "take care of company sign-in now"): this used to store loose fields
// (entity id, SSO URL, certificate) that nothing ever used. Supabase registers a SAML provider from
// its METADATA, so that is what we take; Imotara's owner activates it from /admin
// (⇒ api/admin/organizations/[orgId]/sso). ⇒ lib/auth/companySso.ts

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  cleanMetadataUrl, domainProblem, looksLikeMetadataXml, normalizeDomain, serviceProviderDetails, type OrgSaml,
} from "@/lib/auth/companySso";

const SSO_TIERS = new Set(["edu", "enterprise"]); // same as the settings page shows it to

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org } = await getSupabaseAdmin()
    .from("organizations")
    .select("tier, org_settings")
    .eq("id", auth.orgId)
    .single();

  const saml = ((org?.org_settings as Record<string, unknown>)?.saml ?? null) as OrgSaml | null;
  return NextResponse.json({
    saml: saml ? { ...saml, metadata_xml: saml.metadata_xml ? "(saved)" : null } : null,
    tier: org?.tier,
    serviceProvider: serviceProviderDetails(),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { metadata_url?: string | null; metadata_xml?: string | null; domains?: string[] | string | null };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const metadataUrl = cleanMetadataUrl(body.metadata_url);
  const metadataXml = (body.metadata_xml ?? "").trim();
  if (body.metadata_url && !metadataUrl) {
    return NextResponse.json({ error: "The metadata link must be a full https:// address." }, { status: 400 });
  }
  if (metadataXml && metadataXml !== "(saved)" && !looksLikeMetadataXml(metadataXml)) {
    return NextResponse.json({ error: "That doesn't look like SAML identity-provider metadata (an EntityDescriptor with an IDPSSODescriptor)." }, { status: 400 });
  }

  const rawDomains = Array.isArray(body.domains) ? body.domains : String(body.domains ?? "").split(/[\s,;]+/);
  const domains: string[] = [];
  for (const raw of rawDomains) {
    if (!raw.trim()) continue;
    const d = normalizeDomain(raw);
    if (!d) return NextResponse.json({ error: `"${raw.trim()}" is not a domain like yourorg.org.` }, { status: 400 });
    const problem = domainProblem(d);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (!domains.includes(d)) domains.push(d);
  }
  if (domains.length === 0) return NextResponse.json({ error: "Add at least one email domain your members use, e.g. yourorg.org." }, { status: 400 });
  if (domains.length > 10) return NextResponse.json({ error: "Up to 10 domains." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("tier, org_settings").eq("id", auth.orgId).single();
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (!SSO_TIERS.has(String(org.tier))) {
    return NextResponse.json({ error: "Single sign-on is part of the Education and Enterprise plans. Write to info@imotara.com to add it." }, { status: 403 });
  }

  const current = (org.org_settings ?? {}) as Record<string, unknown>;
  const prev = (current.saml ?? {}) as OrgSaml;
  const keepXml = metadataXml === "(saved)" ? prev.metadata_xml ?? null : null;
  if (!metadataUrl && !metadataXml) {
    return NextResponse.json({ error: "Add your identity provider's metadata link (or paste its metadata XML)." }, { status: 400 });
  }

  const saml: OrgSaml = {
    ...prev,
    metadata_url: metadataUrl,
    metadata_xml: metadataUrl ? null : (keepXml ?? metadataXml),
    domains,
    // Any change needs Imotara's owner to (re)activate it — a live provider keeps working until then.
    status: "pending",
    requested_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("organizations")
    .update({ org_settings: { ...current, saml }, updated_at: new Date().toISOString() })
    .eq("id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saml: { ...saml, metadata_xml: saml.metadata_xml ? "(saved)" : null } });
}
