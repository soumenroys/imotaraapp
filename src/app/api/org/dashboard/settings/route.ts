// src/app/api/org/dashboard/settings/route.ts
// GET    /api/org/dashboard/settings — org settings (read)
// PATCH  /api/org/dashboard/settings — update name only (tier/seats = Imotara admin only)
// DELETE /api/org/dashboard/settings — permanently delete the org. Owner only,
//        not reachable by Imotara superadmin (org_audit_log cascades away on
//        delete — superadmin deletion was deliberately never built because of
//        that history loss; here it's the owner's own informed choice about
//        their own org, a different consent context).

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import nodemailer from "nodemailer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org, error } = await getSupabaseAdmin()
    .from("organizations")
    .select("id, name, slug, billing_type, tier, status, seats_purchased, seats_used, expires_at, created_at, org_settings")
    .eq("id", auth.orgId)
    .single();

  if (error) return NextResponse.json({ error: "org not found" }, { status: 404 });
  return NextResponse.json({ org, role: auth.role });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { name?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  // Org admins can only update name — all other fields controlled by Imotara admin
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("organizations")
    .update({ name: body.name.trim(), updated_at: new Date().toISOString() })
    .eq("id", auth.orgId)
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  if (auth.role !== "owner") {
    return NextResponse.json({ error: "Only the organisation owner can delete it" }, { status: 403 });
  }

  let body: { confirmName?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("name").eq("id", auth.orgId).single();
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  // Require the org's exact name as a confirmation — same safeguard pattern
  // as any other irreversible, no-undo action in the product.
  if (body.confirmName?.trim() !== org.name) {
    return NextResponse.json({ error: "Type the organisation's exact name to confirm deletion" }, { status: 400 });
  }

  // Member licenses are reset by a DB trigger (see
  // docs/sql/org_delete_license_release_trigger.sql) that fires on any
  // organizations delete, not just this route — guaranteed regardless of
  // what triggers the deletion.

  // Alert Imotara so there's a record this happened — org_audit_log itself
  // cascades away with the delete below, so this email is the only trace
  // left afterward.
  void sendDeletionAlert({ orgName: org.name, orgId: auth.orgId, deletedBy: auth.userId });

  // Deletes the org row; org_members, org_audit_log, api_keys,
  // org_license_pools/assignments, org_invites, cohorts/cohort_members all
  // cascade-delete automatically via their existing FK constraints, and the
  // trigger above releases member licenses in the same transaction.
  const { error } = await admin.from("organizations").delete().eq("id", auth.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

async function sendDeletionAlert(data: { orgName: string; orgId: string; deletedBy: string }) {
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
      subject: `[Org Deleted] ${data.orgName}`,
      text: `Organisation "${data.orgName}" (${data.orgId}) was permanently deleted by its owner (user ${data.deletedBy}).\n\nAll members, licenses, pools, API keys, and audit history for this org are gone.`,
    });
  } catch (err) {
    console.error("[org/settings DELETE] admin alert email failed:", err);
  }
}
