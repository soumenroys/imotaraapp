// src/app/api/org/dashboard/members/route.ts
// GET    /api/org/dashboard/members         — list active members
// POST   /api/org/dashboard/members/invite  — send single invite
// PATCH  /api/org/dashboard/members/:userId — change role
// DELETE /api/org/dashboard/members/:userId — remove member

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireOrgAdmin, requireOrgMember } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getOrgMembers, checkOrgSeatAvailable, revokeOrgLicense } from "@/lib/imotara/org";

// ── GET — list members ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireOrgMember(req);
  if (!auth.ok) return auth.response;

  const page  = parseInt(req.nextUrl.searchParams.get("page")  ?? "0", 10);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);

  const result = await getOrgMembers(auth.orgId, page, limit);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  // Also return pending invites for admins
  let invites: unknown[] = [];
  if (auth.role === "owner" || auth.role === "admin") {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("org_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("org_id", auth.orgId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    invites = data ?? [];
  }

  return NextResponse.json({ members: result.data, invites });
}

// ── POST — invite a member by email ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { email: string; role?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const role = body.role === "admin" ? "admin" : "member";

  // Check seat availability
  const hasSeats = await checkOrgSeatAvailable(auth.orgId);
  if (!hasSeats) {
    return NextResponse.json({ error: "No seats available. Contact Imotara to increase your seat limit." }, { status: 409 });
  }

  const admin = getSupabaseAdmin();

  // Get org name for email
  const { data: org } = await admin.from("organizations").select("name").eq("id", auth.orgId).single();

  // Upsert invite (reset if expired)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: invErr } = await admin.from("org_invites").upsert({
    org_id:      auth.orgId,
    email,
    role,
    token,
    invited_by:  auth.userId,
    expires_at:  expiresAt,
    accepted_at: null,
  }, { onConflict: "org_id,email" });

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  // Send invite email
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");
  const inviteUrl = `${siteUrl}/org/invite/${token}`;
  void sendInviteEmail({ to: email, orgName: org?.name ?? "your organisation", inviteUrl, role });

  return NextResponse.json({ ok: true, email, role, expiresAt });
}

// ── DELETE — remove member ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Prevent removing the owner
  const admin = getSupabaseAdmin();
  const { data: target } = await admin
    .from("org_members").select("role").eq("org_id", auth.orgId).eq("user_id", targetUserId).single();

  if (target?.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the org owner" }, { status: 403 });
  }

  const result = await revokeOrgLicense(targetUserId, auth.orgId, auth.userId, "org_admin", "Removed by org admin");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// ── PATCH — change member role ────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { userId: string; role: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.userId || !["admin","member"].includes(body.role)) {
    return NextResponse.json({ error: "userId and role (admin|member) required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Prevent changing owner's role
  const { data: target } = await admin
    .from("org_members").select("role").eq("org_id", auth.orgId).eq("user_id", body.userId).single();
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 403 });
  }

  const { error } = await admin
    .from("org_members")
    .update({ role: body.role })
    .eq("org_id", auth.orgId)
    .eq("user_id", body.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Email helper ──────────────────────────────────────────────────────────────
async function sendInviteEmail({ to, orgName, inviteUrl, role }: {
  to: string; orgName: string; inviteUrl: string; role: string;
}) {
  const user = process.env.ALERT_GMAIL_USER?.trim();
  const pass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) return;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
    });
    await transporter.sendMail({
      from:    `"Imotara" <${user}>`,
      to,
      subject: `You've been invited to join ${orgName} on Imotara`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
          <h2 style="color:#312e81">You're invited!</h2>
          <p>You've been invited to join <strong>${orgName}</strong> on Imotara as a <strong>${role}</strong>.</p>
          <p style="margin:24px 0">
            <a href="${inviteUrl}"
               style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Accept invitation →
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">This link expires in 7 days. If you didn't expect this invite, you can ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">Imotara — Your Private Emotional Companion</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[org/members invite email]", err);
  }
}
