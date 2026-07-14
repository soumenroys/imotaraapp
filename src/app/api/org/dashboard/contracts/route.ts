// src/app/api/org/dashboard/contracts/route.ts
// GET  — list org's contracts/SLAs
// POST — upload new contract (via URL — admin pastes URL after uploading elsewhere)
// Org admin + super-admin only.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// org_contracts stored as JSONB array in org_settings.contracts
// Each entry: { id, type, label, file_url, signed_at, valid_until, uploaded_by, created_at }

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org } = await getSupabaseAdmin()
    .from("organizations")
    .select("org_settings")
    .eq("id", auth.orgId)
    .single();

  const settings  = (org?.org_settings ?? {}) as Record<string, unknown>;
  const contracts = (settings.contracts as unknown[]) ?? [];
  return NextResponse.json({ contracts });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { type: string; label: string; file_url: string; signed_at?: string; valid_until?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.file_url?.trim() || !body.label?.trim()) {
    return NextResponse.json({ error: "file_url and label required" }, { status: 400 });
  }

  // file_url is rendered as a raw <a href> in the dashboard — reject anything
  // that isn't http(s) so a javascript:/data: URI can't be stored and later
  // executed in another viewer's session.
  try {
    const parsed = new URL(body.file_url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "file_url must be an http(s) link" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "file_url must be a valid URL" }, { status: 400 });
  }

  const admin    = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("org_settings").eq("id", auth.orgId).single();
  const settings = (org?.org_settings ?? {}) as Record<string, unknown>;
  const contracts = ((settings.contracts as unknown[]) ?? []) as object[];

  const newContract = {
    id:          crypto.randomUUID(),
    type:        body.type ?? "contract",
    label:       body.label.trim(),
    file_url:    body.file_url.trim(),
    signed_at:   body.signed_at ?? null,
    valid_until: body.valid_until ?? null,
    uploaded_by: auth.userId,
    created_at:  new Date().toISOString(),
  };

  const updated = { ...settings, contracts: [...contracts, newContract] };
  await admin.from("organizations").update({ org_settings: updated, updated_at: new Date().toISOString() }).eq("id", auth.orgId);

  return NextResponse.json({ ok: true, contract: newContract }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const contractId = req.nextUrl.searchParams.get("contractId");
  if (!contractId) return NextResponse.json({ error: "contractId required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("org_settings").eq("id", auth.orgId).single();
  const settings  = (org?.org_settings ?? {}) as Record<string, unknown>;
  const contracts = ((settings.contracts as unknown[]) ?? []) as { id: string }[];

  const updated = { ...settings, contracts: contracts.filter((c) => c.id !== contractId) };
  await admin.from("organizations").update({ org_settings: updated, updated_at: new Date().toISOString() }).eq("id", auth.orgId);

  return NextResponse.json({ ok: true });
}
