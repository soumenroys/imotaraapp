// src/app/api/org/dashboard/referrals/route.ts
// NGO revenue sharing — referral code management
// GET    — list org's referral codes with attribution stats
// POST   — create a new referral code
// DELETE ?codeId= — deactivate a code

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

function slugify(text: string): string {
  return text.toUpperCase().trim().replace(/[^A-Z0-9]/g, "-").replace(/-+/g, "-").slice(0, 20);
}

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  const { data: codes, error } = await admin
    .from("referral_codes")
    .select("id, code, description, commission_rate, uses_count, active, expires_at, created_at")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get total commissions earned per code
  const codeIds = (codes ?? []).map((c) => c.id);
  const { data: attrs } = await admin
    .from("referral_attributions")
    .select("referral_code_id, commission_paise")
    .in("referral_code_id", codeIds);

  const commissionMap: Record<string, number> = {};
  (attrs ?? []).forEach(({ referral_code_id, commission_paise }) => {
    commissionMap[referral_code_id] = (commissionMap[referral_code_id] ?? 0) + commission_paise;
  });

  return NextResponse.json({
    codes: (codes ?? []).map((c) => ({
      ...c,
      totalCommissionPaise: commissionMap[c.id] ?? 0,
      totalCommissionInr:   ((commissionMap[c.id] ?? 0) / 100).toFixed(2),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { description?: string; commission_rate?: number; expires_at?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  // Auto-generate a unique code from org slug
  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("slug, name").eq("id", auth.orgId).single();
  const base = slugify(org?.name ?? auth.orgId.slice(0, 8));
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `${base}-${suffix}`;

  const { data, error } = await admin
    .from("referral_codes")
    .insert({
      org_id:          auth.orgId,
      code,
      description:     body.description?.trim()   ?? null,
      commission_rate: body.commission_rate        ?? 10,
      expires_at:      body.expires_at             ?? null,
      created_by:      auth.userId,
    })
    .select("id, code, description, commission_rate, active, expires_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code: { ...data, uses_count: 0, totalCommissionInr: "0.00" } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const codeId = req.nextUrl.searchParams.get("codeId");
  if (!codeId) return NextResponse.json({ error: "codeId required" }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("referral_codes")
    .update({ active: false })
    .eq("id", codeId)
    .eq("org_id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
