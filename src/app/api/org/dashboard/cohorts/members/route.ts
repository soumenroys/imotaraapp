// src/app/api/org/dashboard/cohorts/members/route.ts
// GET    ?cohortId= — list members of a cohort
// POST              — add user to cohort { cohortId, userId }
// DELETE ?cohortId=&userId= — remove user from cohort

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const cohortId = req.nextUrl.searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Verify cohort belongs to this org
  const { data: cohort } = await admin.from("cohorts").select("id").eq("id", cohortId).eq("org_id", auth.orgId).single();
  if (!cohort) return NextResponse.json({ error: "cohort not found" }, { status: 404 });

  const { data: members } = await admin
    .from("cohort_members")
    .select("user_id, added_at")
    .eq("cohort_id", cohortId);

  // Enrich with email from org_members
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: orgMembers } = await admin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", auth.orgId)
    .in("user_id", userIds);

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  authUsers?.users?.forEach((u) => { if (u.email) emailMap[u.id] = u.email; });
  const roleMap: Record<string, string> = {};
  (orgMembers ?? []).forEach((m) => { roleMap[m.user_id] = m.role; });

  return NextResponse.json({
    members: (members ?? []).map((m) => ({
      userId:   m.user_id,
      email:    emailMap[m.user_id] ?? "—",
      role:     roleMap[m.user_id]  ?? "member",
      addedAt:  m.added_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { cohortId: string; userId: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const admin = getSupabaseAdmin();

  // Verify cohort is in this org
  const { data: cohort } = await admin.from("cohorts").select("id").eq("id", body.cohortId).eq("org_id", auth.orgId).single();
  if (!cohort) return NextResponse.json({ error: "cohort not found" }, { status: 404 });

  // Verify user is an active org member
  const { data: member } = await admin.from("org_members").select("user_id").eq("org_id", auth.orgId).eq("user_id", body.userId).eq("status", "active").single();
  if (!member) return NextResponse.json({ error: "user is not an active org member" }, { status: 409 });

  const { error } = await admin.from("cohort_members").upsert({
    cohort_id: body.cohortId, user_id: body.userId, added_by: auth.userId,
  }, { onConflict: "cohort_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const cohortId = req.nextUrl.searchParams.get("cohortId");
  const userId   = req.nextUrl.searchParams.get("userId");
  if (!cohortId || !userId) return NextResponse.json({ error: "cohortId and userId required" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Verify cohort belongs to this org — same check GET/POST already do.
  // Without it, any org-admin (of ANY org) can delete another org's
  // cohort_members rows by guessing/enumerating cohortId/userId.
  const { data: cohort } = await admin.from("cohorts").select("id").eq("id", cohortId).eq("org_id", auth.orgId).single();
  if (!cohort) return NextResponse.json({ error: "cohort not found" }, { status: 404 });

  await admin.from("cohort_members").delete().eq("cohort_id", cohortId).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
