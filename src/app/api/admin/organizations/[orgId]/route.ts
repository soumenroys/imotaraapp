// src/app/api/admin/organizations/[orgId]/route.ts
// GET    /api/admin/organizations/:orgId   — org detail + members
// PATCH  /api/admin/organizations/:orgId   — update org (tier, seats, status, etc.)
// DELETE /api/admin/organizations/:orgId   — permanently delete the org. Imotara
//         owner role only (not admin, not connect_reviewer) — a deliberately
//         narrower reversal of "superadmin never deletes orgs," reserved for
//         the top platform tier, with the same typed-name confirmation used
//         on the org's own owner-initiated delete (org/dashboard/settings).
// Protected by ADMIN_SECRET Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized, requireSuperAdmin } from "@/app/api/admin/_auth";
import { getOrgMembers } from "@/lib/imotara/org";
import { sendOrgVerificationDecisionEmail } from "@/lib/connect/mailer";
import nodemailer from "nodemailer";

// ── GET — org detail + member list ───────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  if (!await adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const admin = getSupabaseAdmin();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgErr || !org) {
    return NextResponse.json({ error: "org not found" }, { status: 404 });
  }

  const membersResult = await getOrgMembers(orgId, 0, 100);
  const members = membersResult.ok ? membersResult.data : [];

  return NextResponse.json({ org, members }, { status: 200 });
}

// ── PATCH — update org fields ─────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  if (!await adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  let body: Partial<{
    name:                     string;
    billing_type:             string;
    tier:                     string;
    status:                   string;
    seats_purchased:          number;
    expires_at:               string | null;
    notes:                    string | null;
    // Verification review — the only way verification_status can ever move
    // past "pending_review" (see docs/org/dashboard/verification submit route).
    verification_decision:    "approved" | "rejected";
    verification_review_note: string | null;
  }>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (
    body.verification_decision !== undefined &&
    body.verification_decision !== "approved" &&
    body.verification_decision !== "rejected"
  ) {
    return NextResponse.json({ error: "verification_decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Build update payload — only include fields that were sent
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name            !== undefined) update.name            = body.name;
  if (body.billing_type    !== undefined) update.billing_type    = body.billing_type;
  if (body.tier            !== undefined) update.tier            = body.tier;
  if (body.status          !== undefined) update.status          = body.status;
  if (body.seats_purchased !== undefined) update.seats_purchased = body.seats_purchased;
  if (body.expires_at      !== undefined) update.expires_at      = body.expires_at;
  if (body.notes           !== undefined) update.notes           = body.notes;

  let orgSettingsForEmail: Record<string, unknown> | null = null;
  let ownerUserIdForEmail: string | null = null;
  let orgNameForEmail: string | null = null;

  if (body.verification_decision !== undefined) {
    const { data: existing } = await admin
      .from("organizations")
      .select("name, org_settings, owner_user_id")
      .eq("id", orgId)
      .single();

    const settings = (existing?.org_settings ?? {}) as Record<string, unknown>;
    orgSettingsForEmail = {
      ...settings,
      // "verified" (not "approved") — matches the value the org dashboard's
      // STATUS_LABELS map already expected before this fix existed.
      verification_status:      body.verification_decision === "approved" ? "verified" : "rejected",
      verification_review_note: body.verification_review_note?.trim() || null,
      verification_reviewed_at: new Date().toISOString(),
    };
    update.org_settings = orgSettingsForEmail;
    ownerUserIdForEmail  = existing?.owner_user_id ?? null;
    orgNameForEmail      = existing?.name ?? null;
  }

  const { data, error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", orgId)
    .select("id, name, slug, tier, status, seats_purchased, seats_used, billing_type, expires_at, notes")
    .single();

  if (error) {
    console.error("[admin/organizations PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the org owner of the verification decision (fire-and-forget).
  if (body.verification_decision !== undefined && ownerUserIdForEmail) {
    admin.auth.admin.getUserById(ownerUserIdForEmail).then(({ data: userData }) => {
      const email = userData?.user?.email;
      if (!email) return;
      void sendOrgVerificationDecisionEmail({
        ownerEmail:  email,
        ownerName:   (userData.user?.user_metadata?.full_name as string | undefined) ?? null,
        orgName:     orgNameForEmail ?? "your organization",
        approved:    body.verification_decision === "approved",
        reviewNote:  (orgSettingsForEmail?.verification_review_note as string | null) ?? null,
      }).catch((err) => console.error("[admin/organizations PATCH] verification email failed:", err));
    }).catch((err) => console.error("[admin/organizations PATCH] owner lookup failed:", err));
  }

  // If tier OR status changed to active, sync all active org members' licenses
  const tierChanged   = !!body.tier;
  const justActivated = body.status === "active";

  if (tierChanged || justActivated) {
    const newTier = data?.tier ?? body.tier;
    // Get all active org members
    const { data: members } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("status", "active");

    // Upsert a licenses row for each member — ensures resolve_user_tier works
    if (members && members.length > 0) {
      await admin.from("licenses").upsert(
        members.map((m) => ({
          user_id:    m.user_id,
          tier:       newTier,
          status:     "valid",
          expires_at: data?.expires_at ?? null,
          org_id:     orgId,
          source:     "org",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id" }
      );
    }
  }

  return NextResponse.json({ org: data }, { status: 200 });
}

// ── DELETE — permanently delete the org (Imotara owner role only) ────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role !== "owner") {
    return NextResponse.json({ error: "Only the Imotara owner role can delete organizations" }, { status: 403 });
  }

  const { orgId } = await params;

  let body: { confirmName?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (body.confirmName?.trim() !== org.name) {
    return NextResponse.json({ error: "Type the organisation's exact name to confirm deletion" }, { status: 400 });
  }

  // Member licenses are released automatically by the same DB trigger used
  // by the org's own owner-initiated delete — see
  // docs/sql/org_delete_license_release_trigger.sql.
  void sendAdminDeletionAlert({
    orgName:      org.name,
    orgId,
    deletedByAdminEmail: auth.admin.email,
  });

  const { error } = await admin.from("organizations").delete().eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

async function sendAdminDeletionAlert(data: { orgName: string; orgId: string; deletedByAdminEmail: string }) {
  const user = process.env.ALERT_GMAIL_USER?.trim();
  const pass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) return;
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true, auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"Imotara Alerts" <${user}>`,
      to: "info@imotara.com",
      subject: `[Org Deleted by Superadmin] ${data.orgName}`,
      text: `Organisation "${data.orgName}" (${data.orgId}) was permanently deleted via the admin panel by Imotara owner ${data.deletedByAdminEmail}.\n\nAll members, licenses, pools, API keys, and audit history for this org are gone.`,
    });
  } catch (err) {
    console.error("[admin/organizations DELETE] alert email failed:", err);
  }
}
