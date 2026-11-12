// src/app/api/admin/organizations/[orgId]/sso/route.ts — Imotara's owner turns an organisation's
// company single sign-on ON or OFF (12 Nov 2026). ⇒ lib/auth/companySso.ts
//
// POST   — register (or update) the org's SAML provider with Supabase from the metadata + domains
//          the org saved, then mark it `active`.
// DELETE — remove the provider from Supabase (its users are signed out at once) and mark it `off`.
//
// 🔑 Needs SUPABASE_ACCESS_TOKEN (a Supabase personal access token with write access to the
//    project) — Supabase registers SSO providers only through its Management API / CLI.
// ⛔ Super admin only: activating SSO hands sign-in for a whole email domain to that org's IdP.
//    The person pressing it confirms the org really owns the domain(s).

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { domainProblem, projectRef, type OrgSaml } from "@/lib/auth/companySso";

const MGMT = "https://api.supabase.com/v1";

function mgmt(): { ref: string; token: string } | null {
  const ref = projectRef();
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  return ref && token ? { ref, token } : null;
}

async function loadSaml(orgId: string) {
  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("id, name, org_settings").eq("id", orgId).maybeSingle();
  const settings = (org?.org_settings ?? {}) as Record<string, unknown>;
  return { admin, org, settings, saml: (settings.saml ?? null) as OrgSaml | null };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  const { orgId } = await params;

  const m = mgmt();
  if (!m) return NextResponse.json({ error: "SUPABASE_ACCESS_TOKEN is not set on the server — add it in Vercel first." }, { status: 503 });

  const { admin, org, settings, saml } = await loadSaml(orgId);
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (!saml || !(saml.metadata_url || saml.metadata_xml)) return NextResponse.json({ error: "This organisation has not saved its identity-provider metadata yet." }, { status: 400 });
  const domains = Array.isArray(saml.domains) ? saml.domains : [];
  if (domains.length === 0) return NextResponse.json({ error: "No email domains saved." }, { status: 400 });
  for (const d of domains) {
    const p = domainProblem(d);
    if (p) return NextResponse.json({ error: p }, { status: 400 });
  }

  const body: Record<string, unknown> = { type: "saml", domains, attribute_mapping: { keys: { email: { name: "email" } } } };
  if (saml.metadata_url) body.metadata_url = saml.metadata_url; else body.metadata_xml = saml.metadata_xml;

  const url = saml.provider_id
    ? `${MGMT}/projects/${m.ref}/config/auth/sso/providers/${saml.provider_id}`
    : `${MGMT}/projects/${m.ref}/config/auth/sso/providers`;
  const res = await fetch(url, {
    method: saml.provider_id ? "PUT" : "POST",
    headers: { Authorization: `Bearer ${m.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(saml.provider_id ? { ...body, type: undefined } : body),
  });
  const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
  if (!res.ok || (!saml.provider_id && !j.id)) {
    const why = j.message || j.error || `Supabase answered ${res.status}`;
    console.error("[admin/sso] register failed:", res.status, why);
    return NextResponse.json({ error: `Supabase refused the provider: ${why}` }, { status: 502 });
  }

  const next: OrgSaml = { ...saml, status: "active", provider_id: saml.provider_id ?? j.id ?? null, activated_at: new Date().toISOString() };
  const { error } = await admin.from("organizations").update({ org_settings: { ...settings, saml: next }, updated_at: new Date().toISOString() }).eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, provider_id: next.provider_id, domains });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  const { orgId } = await params;

  const m = mgmt();
  if (!m) return NextResponse.json({ error: "SUPABASE_ACCESS_TOKEN is not set on the server — add it in Vercel first." }, { status: 503 });

  const { admin, org, settings, saml } = await loadSaml(orgId);
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (saml?.provider_id) {
    const res = await fetch(`${MGMT}/projects/${m.ref}/config/auth/sso/providers/${saml.provider_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${m.token}` },
    });
    if (!res.ok && res.status !== 404) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json({ error: `Supabase refused: ${j.message ?? res.status}` }, { status: 502 });
    }
  }

  const next: OrgSaml = { ...(saml ?? {}), status: "off", provider_id: null };
  const { error } = await admin.from("organizations").update({ org_settings: { ...settings, saml: next }, updated_at: new Date().toISOString() }).eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
