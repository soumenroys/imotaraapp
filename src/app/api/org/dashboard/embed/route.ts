// src/app/api/org/dashboard/embed/route.ts
// GET   — get embed config (key + allowed domains + embed URL)
// PATCH — update allowed domains list

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("slug, tier, org_settings")
    .eq("id", auth.orgId)
    .single();

  const settings  = (org?.org_settings ?? {}) as Record<string, unknown>;
  let embedKey    = settings.embed_key as string | null ?? null;

  // Auto-generate an embed key if none exists yet
  if (!embedKey) {
    embedKey = crypto.randomUUID();
    await admin.from("organizations").update({
      org_settings: { ...settings, embed_key: embedKey },
      updated_at: new Date().toISOString(),
    }).eq("id", auth.orgId);
  }

  const siteUrl  = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");
  const embedUrl = `${siteUrl}/embed/chat?org=${org?.slug}&key=${embedKey}`;

  return NextResponse.json({
    embedKey,
    embedUrl,
    allowedDomains: (settings.embed_allowed_domains as string[] | null) ?? [],
    tier: org?.tier,
    iframeSnippet: `<iframe src="${embedUrl}" width="400" height="600" frameborder="0" allow="microphone" title="Imotara Companion"></iframe>`,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { allowedDomains?: string[]; dataResidency?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("org_settings").eq("id", auth.orgId).single();
  const settings = (org?.org_settings ?? {}) as Record<string, unknown>;

  const updated: Record<string, unknown> = { ...settings };
  // Only touch this field when the caller actually sent it — the LMS embed
  // feature isn't built yet ("Coming soon" in the dashboard UI), and the
  // Data Residency form in the same section saves independently. Previously
  // that save always sent allowedDomains: [], silently wiping any
  // already-configured domains on every unrelated Data Residency save.
  if (body.allowedDomains !== undefined) {
    updated.embed_allowed_domains = body.allowedDomains.map((d) => d.trim()).filter(Boolean);
  }
  if (body.dataResidency !== undefined) updated.data_residency = body.dataResidency || null;

  const { error } = await admin.from("organizations").update({
    org_settings: updated, updated_at: new Date().toISOString(),
  }).eq("id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
