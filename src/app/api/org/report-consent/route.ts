// src/app/api/org/report-consent/route.ts
// GET   — does this user have an org membership, and is individual reporting on?
// PATCH — the member turns their own consent on or off.
//
// This backs the single Settings checkbox in the owner's spec (2026-10-05):
//   "there will be one check box in the settings page and if user is using
//    organisational account then the option will be on, otherwise it will be off"
//
// 🔑 THE CHECKBOX IS THE MEMBER'S, NOT THE ADMIN'S. Only the member themselves
// may read or change it here. An org admin can see WHO consented (as a count,
// via member-trends) but cannot set it for anybody — a consent an administrator
// can switch on for you is not consent.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

/** Resolve the caller from their bearer token. Returns null when signed out. */
async function callerId(req: NextRequest): Promise<string | null> {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;
  const { data } = await getSupabaseAdmin().auth.getUser(token);
  // ⛔ An anonymous identity is not a person who can give consent.
  if (data?.user?.is_anonymous) return null;
  return data?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await callerId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: membership } = await getSupabaseAdmin()
    .from("org_members")
    .select("org_id, report_consent, organizations(name, billing_type)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  // No active membership ⇒ the checkbox is OFF and not applicable, exactly as
  // specified. A personal user is never individually visible to anyone.
  if (!membership) {
    return NextResponse.json({
      applicable: false,
      consent: false,
      orgName: null,
    });
  }

  const org = membership.organizations as unknown as
    { name?: string; billing_type?: string } | null;

  return NextResponse.json({
    // Only EDU/NGO orgs have individual reporting at all, so only they should
    // show a control that claims to govern it.
    applicable: ["edu", "ngo"].includes(org?.billing_type ?? ""),
    consent: membership.report_consent !== false,
    orgName: org?.name ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const userId = await callerId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { consent?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (typeof body.consent !== "boolean") {
    return NextResponse.json({ error: "consent must be true or false" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Scoped to THIS user's own active membership. There is deliberately no
  // userId parameter — see the note at the top of this file.
  const { data: membership } = await admin
    .from("org_members")
    .select("id, org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "no active organisation membership" },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("org_members")
    .update({ report_consent: body.consent })
    .eq("id", membership.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audited: a change to who can see someone's wellbeing data should leave a
  // trace, and the actor is the member themselves.
  await admin.from("org_audit_log").insert({
    org_id:         membership.org_id,
    actor_id:       userId,
    actor_role:     "member",
    action:         body.consent ? "report_consent_granted" : "report_consent_withdrawn",
    target_user_id: userId,
    changes:        { report_consent: body.consent },
  }).then(() => {}, () => {});   // never fail the user's own setting on an audit write

  return NextResponse.json({ ok: true, consent: body.consent });
}
