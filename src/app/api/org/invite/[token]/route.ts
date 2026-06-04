// src/app/api/org/invite/[token]/route.ts
// GET  /api/org/invite/[token] — fetch invite details (public — no auth required)
// POST /api/org/invite/[token] — accept invite (requires auth)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { assignOrgLicense } from "@/lib/imotara/org";

type Params = { params: Promise<{ token: string }> };

// ── GET — invite details (for the acceptance page) ────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const admin = getSupabaseAdmin();

  const { data: invite, error } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, expires_at, accepted_at, organizations(name, billing_type, tier)")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "invite not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "invite already accepted" }, { status: 409 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "invite expired" }, { status: 410 });
  }

  return NextResponse.json({
    invite: {
      email:     invite.email,
      role:      invite.role,
      expiresAt: invite.expires_at,
      org:       invite.organizations,
    },
  });
}

// ── POST — accept invite ──────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const admin = getSupabaseAdmin();

  // Resolve authenticated user
  let userId: string | null = null;
  let userEmail: string | null = null;

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }
  if (!userId) {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Fetch and validate invite
  const { data: invite, error: invErr } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .single();

  if (invErr || !invite) return NextResponse.json({ error: "invite not found" }, { status: 404 });
  if (invite.accepted_at)  return NextResponse.json({ error: "already accepted" }, { status: 409 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 });

  // Email match check — enforce if invite has a specific email
  if (invite.email && userEmail) {
    const inviteEmail = invite.email.toLowerCase();
    const currentEmail = userEmail.toLowerCase();
    if (inviteEmail !== currentEmail) {
      // Check if org has auto_join_by_domain enabled and user's domain matches
      const { data: orgData } = await admin.from("organizations").select("org_settings").eq("id", invite.org_id).single();
      const settings = (orgData?.org_settings ?? {}) as Record<string, unknown>;
      const allowedDomains = (settings.allowed_email_domains as string[] | null) ?? [];
      const autoJoin = settings.auto_join_by_domain as boolean | null;
      const userDomain = currentEmail.split("@")[1] ?? "";
      const domainMatches = autoJoin && allowedDomains.some((d) => userDomain === d || userDomain.endsWith("." + d));

      if (!domainMatches) {
        return NextResponse.json(
          { error: `This invite was sent to ${invite.email}. Please sign in with that email.` },
          { status: 403 },
        );
      }
      // Domain matches — user can join even without explicit invite to their email
    }
  }

  // Check not already a member
  const { data: existing } = await admin
    .from("org_members")
    .select("id, status")
    .eq("org_id", invite.org_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "You are already a member of this organisation" }, { status: 409 });
  }

  // Add to org_members
  await admin.from("org_members").upsert({
    org_id:     invite.org_id,
    user_id:    userId,
    role:       invite.role,
    status:     "active",
    invited_by: null,
    joined_at:  new Date().toISOString(),
  }, { onConflict: "org_id,user_id" });

  // Assign org license (may throw if seats full — propagate error)
  const licResult = await assignOrgLicense(userId, invite.org_id, undefined, "invite_accept");
  if (!licResult.ok) {
    // Rollback member insert
    await admin.from("org_members").delete().eq("org_id", invite.org_id).eq("user_id", userId);
    return NextResponse.json({ error: licResult.error }, { status: 409 });
  }

  // Mark invite as accepted
  await admin.from("org_invites").update({ accepted_at: new Date().toISOString() }).eq("token", token);

  return NextResponse.json({ ok: true, orgId: invite.org_id, role: invite.role });
}
