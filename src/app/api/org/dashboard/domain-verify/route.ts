// src/app/api/org/dashboard/domain-verify/route.ts
// GET  — get configured email domains (org-admin only)
// POST — set allowed email domains for auto-join (NGO/EDU: staff/students auto-approved by domain)
//
// The actual public-facing "does this email qualify" + join flow lives in
// /api/org/join-by-domain — a durable, repeatable link org admins share
// (see /org/join/[slug]), rather than piggybacking on a single invite token.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org } = await getSupabaseAdmin()
    .from("organizations")
    .select("billing_type, org_settings")
    .eq("id", auth.orgId)
    .single();

  const settings = (org?.org_settings ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    allowedDomains:      (settings.allowed_email_domains as string[]) ?? [],
    autoJoinEnabled:     settings.auto_join_by_domain ?? false,
    academicYearStart:   settings.academic_year_start ?? null, // e.g. "08-01" (Aug 1)
    academicYearEnd:     settings.academic_year_end   ?? null, // e.g. "07-31" (Jul 31)
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { allowedDomains: string[]; autoJoinEnabled?: boolean; academicYearStart?: string; academicYearEnd?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const domains = (body.allowedDomains ?? [])
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter((d) => d.includes("."));

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("org_settings").eq("id", auth.orgId).single();
  const settings = (org?.org_settings ?? {}) as Record<string, unknown>;

  const updated = {
    ...settings,
    allowed_email_domains: domains,
    auto_join_by_domain:   body.autoJoinEnabled ?? false,
    academic_year_start:   body.academicYearStart ?? settings.academic_year_start ?? null,
    academic_year_end:     body.academicYearEnd   ?? settings.academic_year_end   ?? null,
  };

  await admin.from("organizations").update({ org_settings: updated, updated_at: new Date().toISOString() }).eq("id", auth.orgId);
  return NextResponse.json({ ok: true, allowedDomains: domains });
}
