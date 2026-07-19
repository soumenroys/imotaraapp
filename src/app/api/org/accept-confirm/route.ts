// src/app/api/org/accept-confirm/route.ts
// POST — called once by src/app/auth/accept/page.tsx right after the user
// successfully sets a password, purely to write an audit trail entry. Not
// itself an authorization gate — the user is already fully active the
// moment createAndInvite() ran (see members/route.ts); this just closes the
// loop for support/audit visibility.
//
// /auth/accept is shared by two flows (first-time invite acceptance AND a
// later password reset via /auth/forgot-password) since both land the user
// on the same "you have a session now, set a password" screen. Distinguish
// them here so the audit log doesn't mislabel a reset as a new join:
// org_members.joined_at is set once at provisioning time and never touched
// again, so a join within the last few minutes is a genuine first accept;
// anything older means this call came from a reset on an already-active membership.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const RECENT_JOIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  const auth = await requireOrgMember(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const [{ data: user }, { data: member }] = await Promise.all([
    admin.auth.admin.getUserById(auth.userId),
    admin.from("org_members").select("joined_at").eq("org_id", auth.orgId).eq("user_id", auth.userId).maybeSingle(),
  ]);

  const joinedRecently = member?.joined_at
    ? Date.now() - new Date(member.joined_at).getTime() < RECENT_JOIN_WINDOW_MS
    : false;

  await admin.from("org_audit_log").insert({
    org_id:         auth.orgId,
    actor_id:       auth.userId,
    actor_email:    user?.user?.email ?? null,
    actor_role:     "system",
    action:         joinedRecently ? "member_joined" : "password_reset",
    target_email:   user?.user?.email ?? null,
    target_user_id: auth.userId,
    changes:        { role: auth.role },
    notes:          joinedRecently
      ? "Accepted admin-provisioned invite and set password."
      : "Reset password via /auth/forgot-password.",
  });

  return NextResponse.json({ ok: true });
}
