// src/app/api/admin/organizations/[orgId]/members/route.ts
// POST   — add an existing Imotara user to the org directly by email (super-admin)
// PATCH  — change member role AND/OR override license tier AND/OR suspend/restore account access (super-admin)
// DELETE — remove a member from the org

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { revokeOrgLicense, assignOrgLicense, releasePriorOrgMembership } from "@/lib/imotara/org";

type Params = { params: Promise<{ orgId: string }> };

// Support-workflow gap: previously superadmin could only manage members who
// already joined via invite/self-serve/domain-join — there was no way to add
// someone directly (e.g. "I never got my invite email, can you just add me").
export async function POST(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId } = await params;
  let body: { email: string; role?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "a valid email is required" }, { status: 400 });
  }
  const role = body.role ?? "member";
  if (!["owner","admin","member"].includes(role)) {
    return NextResponse.json({ error: "role must be owner|admin|member" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Same email->user_id resolution pattern used by org creation (POST /api/admin/organizations)
  const { data: users } = await admin.auth.admin.listUsers();
  const match = users?.users?.find((u) => u.email?.toLowerCase() === email);
  if (!match) {
    return NextResponse.json({ error: "No Imotara account found with that email — they need to sign up first." }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("org_members")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("user_id", match.id)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "This user is already a member of this organisation." }, { status: 409 });
  }

  // Release any different active org membership first — a user can only
  // occupy one paid org seat at a time (see releasePriorOrgMembership).
  await releasePriorOrgMembership(match.id, orgId);

  await admin.from("org_members").upsert({
    org_id:     orgId,
    user_id:    match.id,
    role,
    status:     "active",
    invited_by: null,
    joined_at:  new Date().toISOString(),
  }, { onConflict: "org_id,user_id" });

  // assign_org_license() enforces seat availability + org active/expiry itself (row-locked)
  const licResult = await assignOrgLicense(match.id, orgId, undefined, "imotara_admin");
  if (!licResult.ok) {
    await admin.from("org_members").delete().eq("org_id", orgId).eq("user_id", match.id);
    return NextResponse.json({ error: licResult.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, userId: match.id, email: match.email, role });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId } = await params;
  let body: { userId: string; role?: string; overrideTier?: string | null; suspendAccess?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Suspend/restore account access. Supabase has no "kill this session right
  // now" endpoint reachable without the user's own live access token — the
  // real mechanism is banning the account, which blocks new sign-ins and
  // refresh-token use immediately, but an already-issued access token can
  // stay valid for up to its own lifetime (~1h) until it needs to refresh.
  // Framed as "suspend/restore access," not "force sign out," to not
  // overclaim instant session termination.
  if (body.suspendAccess !== undefined) {
    const { error: banError } = await admin.auth.admin.updateUserById(body.userId, {
      ban_duration: body.suspendAccess ? "876000h" : "none", // ~100 years = effectively indefinite, vs unban
    });
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 });
    if (body.role === undefined && body.overrideTier === undefined) {
      return NextResponse.json({ ok: true });
    }
  }

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
