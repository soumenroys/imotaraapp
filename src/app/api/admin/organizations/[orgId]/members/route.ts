// src/app/api/admin/organizations/[orgId]/members/route.ts
// POST   — add an existing Imotara user to the org directly by email (super-admin),
//          OR with { action: "create_and_invite" } — create a brand-new account
//          (or re-invite an existing one) and email a credentialed invite link.
//          Option A only: the link lets the recipient set their own password —
//          never a plaintext password in the email. Super-admin only in v1;
//          org owner/admin self-service is a deliberate later phase, not this.
// PATCH  — change member role AND/OR override license tier AND/OR suspend/restore account access (super-admin)
// DELETE — remove a member from the org

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized, requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { revokeOrgLicense, assignOrgLicense, releasePriorOrgMembership } from "@/lib/imotara/org";
import { sendOrgInviteEmail } from "@/lib/connect/mailer";
import { checkIpRateLimit } from "@/lib/imotara/ipRateLimit";

type Params = { params: Promise<{ orgId: string }> };

// Provisioning is already gated behind a super-admin session — this is a
// safety net against accidental double-submits or a compromised admin
// session being used to mass-create accounts, not a defense against
// anonymous abuse (there's no anonymous path to this branch at all).
const PROVISION_LIMIT     = 20;
const PROVISION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");
const ACCEPT_REDIRECT = `${SITE_URL}/auth/accept`;

// Support-workflow gap: previously superadmin could only manage members who
// already joined via invite/self-serve/domain-join — there was no way to add
// someone directly (e.g. "I never got my invite email, can you just add me").
export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  let body: { email: string; role?: string; action?: string };
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

  if (body.action === "create_and_invite") {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.response;
    if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    if (!checkIpRateLimit(`provision:${auth.admin.id}`, PROVISION_LIMIT, PROVISION_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many provisioning requests — please wait and try again." }, { status: 429 });
    }

    return createAndInvite(orgId, email, role, auth.admin);
  }

  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

// Creates a brand-new Imotara account (or reuses an existing one, e.g. someone
// who previously signed in with Google) and emails a credentialed invite —
// Option A: the email contains a set-password link only, never a password.
// Idempotent: re-invoking for the same email re-issues the link without
// duplicating the org_members row or double-granting the license.
async function createAndInvite(
  orgId: string,
  email: string,
  role: string,
  actor: { id: string; email: string },
) {
  const admin = getSupabaseAdmin();

  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const { data: users } = await admin.auth.admin.listUsers();
  let match = users?.users?.find((u) => u.email?.toLowerCase() === email);

  // "invite" for brand-new accounts (no password, unconfirmed). "recovery"
  // for accounts that already exist under any provider — it lets them set a
  // password for the first time without touching however they signed in
  // before (e.g. Google).
  let linkType: "invite" | "recovery" = "invite";
  let wasNewUser = false;

  if (!match) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message ?? "failed to create account" }, { status: 500 });
    }
    match = created.user;
    wasNewUser = true;
  } else {
    linkType = "recovery";
  }

  const { data: existingMember } = await admin
    .from("org_members")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("user_id", match.id)
    .maybeSingle();

  if (existingMember?.status === "active") {
    return NextResponse.json({ error: "This user is already a member of this organisation." }, { status: 409 });
  }

  await releasePriorOrgMembership(match.id, orgId);

  // invited_by references auth.users(id) — actor.id here is a super_admins.id
  // (or the literal "legacy" sentinel for the ADMIN_SECRET fallback), neither of
  // which is a valid auth.users row, so this must always be null. "Who
  // provisioned this" is already captured below via the org_audit_log insert
  // (actor_id/actor_email/actor_role), which is the correct place for it.
  const { error: memberErr } = await admin.from("org_members").upsert({
    org_id:     orgId,
    user_id:    match.id,
    role,
    status:     "active",
    invited_by: null,
    joined_at:  new Date().toISOString(),
  }, { onConflict: "org_id,user_id" });

  if (memberErr) {
    if (wasNewUser) {
      await admin.auth.admin.deleteUser(match.id);
    }
    return NextResponse.json({ error: `Failed to add member: ${memberErr.message}` }, { status: 500 });
  }

  const licResult = await assignOrgLicense(match.id, orgId, undefined, "imotara_admin");
  if (!licResult.ok) {
    await admin.from("org_members").delete().eq("org_id", orgId).eq("user_id", match.id);
    return NextResponse.json({ error: licResult.error }, { status: 409 });
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:    linkType,
    email,
    options: { redirectTo: ACCEPT_REDIRECT },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    // Don't leave a member active with a seat/license consumed but no way to ever
    // log in — roll back everything this call did, mirroring the license-failure
    // branch above. If this call created the auth user, remove it too so a retry
    // doesn't get stuck treating it as a pre-existing account.
    await admin.from("org_members").delete().eq("org_id", orgId).eq("user_id", match.id);
    await revokeOrgLicense(match.id, orgId, undefined, "imotara_admin");
    if (wasNewUser) {
      await admin.auth.admin.deleteUser(match.id);
    }
    return NextResponse.json({ error: linkErr?.message ?? "failed to generate invite link" }, { status: 500 });
  }

  await sendOrgInviteEmail({
    to:        email,
    orgName:   org.name,
    role,
    acceptUrl: linkData.properties.action_link,
  });

  await admin.from("org_audit_log").insert({
    org_id:         orgId,
    actor_id:       actor.id === "legacy" ? null : actor.id,
    actor_email:    actor.email,
    actor_role:     "imotara_admin",
    action:         "member_provisioned",
    target_email:   email,
    target_user_id: match.id,
    changes:        { role },
  });

  return NextResponse.json({
    ok:             true,
    userId:         match.id,
    email,
    role,
    accountExisted: linkType === "recovery",
  });
}
