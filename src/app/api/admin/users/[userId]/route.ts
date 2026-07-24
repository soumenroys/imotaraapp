// src/app/api/admin/users/[userId]/route.ts
// DELETE — permanently delete a user's Imotara account (owner only).
//
// Same underlying data cleanup as the self-service /api/account/delete, plus
// org-membership cleanup that self-service delete doesn't have to worry
// about: org_members.user_id is `on delete set null` (not cascade), so
// deleting the auth user first would leave a ghost org_members row with a
// null user_id that still silently counts toward the org's seats_used. This
// releases any active org membership properly (revokeOrgLicense, which
// correctly decrements seats_used) before the account itself goes.
//
// Deliberately separate from, and unrelated to, org deletion: deleting an
// org does NOT delete its members' accounts (releases their org license to
// free, keeps their account/history intact — see Admin-Guide-Super-Admin.md
// §10.6). This is the other direction: an explicit, standalone "delete this
// specific person's account" action, independent of any org.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { revokeOrgLicense } from "@/lib/imotara/org";
import nodemailer from "nodemailer";

type Params = { params: Promise<{ userId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role !== "owner") {
    return NextResponse.json({ error: "Only the Imotara owner role can delete user accounts" }, { status: 403 });
  }

  const { userId } = await params;

  let body: { confirmEmail?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const admin = getSupabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const email = userData.user.email ?? "";

  if (!email || body.confirmEmail?.trim().toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Type the account's exact email to confirm deletion" }, { status: 400 });
  }

  const errors: string[] = [];

  // Release any active org membership first (seat-accurate), so it doesn't
  // become an orphaned ghost row once user_id is nulled out below.
  const { data: activeMemberships } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active");
  // actor.id is the literal sentinel "legacy" for the ADMIN_SECRET bearer
  // fallback, not a real super_admins/auth.users row — revoke_org_license's
  // p_actor_id column is a real uuid, so that sentinel must become null
  // here (same handling as elsewhere in the org-provisioning code).
  const actorId = auth.admin.id === "legacy" ? undefined : auth.admin.id;
  for (const m of activeMemberships ?? []) {
    const result = await revokeOrgLicense(
      userId, m.org_id, actorId, "imotara_admin",
      "Account permanently deleted by superadmin",
    );
    if (!result.ok) errors.push(`org membership (${m.org_id}): ${result.error}`);
  }

  // Same data cleanup as the self-service /api/account/delete pipeline.
  try {
    const { error } = await admin.from("imotara_history").delete().like("id", `${userId}:%`);
    if (error) errors.push(`history: ${error.message}`);
  } catch (e) { errors.push(`history: ${String(e)}`); }

  try {
    const { error } = await admin.from("user_memory").delete().eq("user_id", userId);
    if (error) errors.push(`memory: ${error.message}`);
  } catch (e) { errors.push(`memory: ${String(e)}`); }

  try {
    const { error } = await admin.from("licenses").delete().eq("user_id", userId);
    if (error) errors.push(`licenses: ${error.message}`);
  } catch (e) { errors.push(`licenses: ${String(e)}`); }

  try {
    const { error } = await admin.from("payment_licenses").delete().eq("user_id", userId);
    if (error) errors.push(`payment_licenses: ${error.message}`);
  } catch (e) { errors.push(`payment_licenses: ${String(e)}`); }

  try {
    const { error } = await admin.from("usage_events").delete().eq("user_id", userId);
    if (error) errors.push(`usage_events: ${error.message}`);
  } catch (e) { errors.push(`usage_events: ${String(e)}`); }

  // Delete the auth user last.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json(
      { error: "failed_to_delete_auth_user", detail: authError.message, partialErrors: errors },
      { status: 500 },
    );
  }

  void sendAdminUserDeletionAlert({ deletedEmail: email, userId, deletedByAdminEmail: auth.admin.email });

  return NextResponse.json({
    ok: true,
    deletedAt: new Date().toISOString(),
    partialErrors: errors.length > 0 ? errors : undefined,
  });
}

async function sendAdminUserDeletionAlert(data: { deletedEmail: string; userId: string; deletedByAdminEmail: string }) {
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
      subject: `[Account Deleted by Superadmin] ${data.deletedEmail}`,
      text: `Imotara account "${data.deletedEmail}" (${data.userId}) was permanently deleted via the admin panel by owner ${data.deletedByAdminEmail}.\n\nAll chat history, memories, licenses, and org membership for this account are gone.`,
    });
  } catch (err) {
    console.error("[admin/users DELETE] alert email failed:", err);
  }
}
