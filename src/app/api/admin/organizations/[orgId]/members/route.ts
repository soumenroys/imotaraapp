// src/app/api/admin/organizations/[orgId]/members/route.ts
// PATCH — change a member's role in the org (super-admin can override)
// DELETE — remove a member from the org (super-admin override)

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { revokeOrgLicense } from "@/lib/imotara/org";

type Params = { params: Promise<{ orgId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId } = await params;
  let body: { userId: string; role: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.userId || !["owner","admin","member"].includes(body.role)) {
    return NextResponse.json({ error: "userId and role (owner|admin|member) required" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("org_members")
    .update({ role: body.role })
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
