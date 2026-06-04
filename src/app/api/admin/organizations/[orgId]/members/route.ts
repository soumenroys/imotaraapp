// src/app/api/admin/organizations/[orgId]/members/route.ts
// PATCH — change member role AND/OR override license tier (super-admin)
// DELETE — remove a member from the org

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { revokeOrgLicense } from "@/lib/imotara/org";

type Params = { params: Promise<{ orgId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId } = await params;
  let body: { userId: string; role?: string; overrideTier?: string | null };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const memberUpdate: Record<string, unknown> = {};

  // Role change
  if (body.role !== undefined) {
    if (!["owner","admin","member"].includes(body.role)) {
      return NextResponse.json({ error: "role must be owner|admin|member" }, { status: 400 });
    }
    memberUpdate.role = body.role;
  }

  // Per-member license tier override
  if (body.overrideTier !== undefined) {
    const VALID = ["free","plus","pro","family","edu","enterprise",null];
    if (!VALID.includes(body.overrideTier)) {
      return NextResponse.json({ error: "invalid overrideTier" }, { status: 400 });
    }
    memberUpdate.override_tier = body.overrideTier ?? null;

    // Sync licenses table so tier resolves immediately
    if (body.overrideTier) {
      const { data: org } = await admin.from("organizations").select("expires_at").eq("id", orgId).single();
      await admin.from("licenses").upsert({
        user_id:    body.userId,
        tier:       body.overrideTier,
        status:     "valid",
        expires_at: org?.expires_at ?? null,
        org_id:     orgId,
        source:     "org",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
  }

  if (Object.keys(memberUpdate).length === 0) {
    return NextResponse.json({ error: "nothing to update — provide role or overrideTier" }, { status: 400 });
  }

  const { error } = await admin
    .from("org_members")
    .update(memberUpdate)
    .eq("org_id", orgId)
    .eq("user_id", body.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const result = await revokeOrgLicense(userId, orgId, undefined, "imotara_admin");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
