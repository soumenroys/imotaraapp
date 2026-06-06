// src/app/api/org/dashboard/members/bulk/route.ts
// POST /api/org/dashboard/members/bulk
// Accepts array of { email, role } entries.
// For each: validates email, checks for duplicates/existing members,
// upserts org_invites row, sends invite email.
// Returns per-row result so UI can show exactly what succeeded / failed.
// Requires org admin role.

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

interface InviteEntry { email: string; role: string }
interface InviteResult extends InviteEntry {
  status: "invited" | "skipped" | "error";
  reason?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let entries: InviteEntry[];
  try {
    const body = await req.json();
    entries = body?.entries;
    if (!Array.isArray(entries) || entries.length === 0) throw new Error();
  } catch {
    return NextResponse.json({ error: "entries array required" }, { status: 400 });
  }

  if (entries.length > 500) {
    return NextResponse.json({ error: "Maximum 500 invites per batch" }, { status: 400 });
  }

  const admin       = getSupabaseAdmin();
  const { orgId }   = auth;

  // Fetch org for name + seat info
  const { data: org } = await admin
    .from("organizations")
    .select("name, seats_purchased, seats_used, status, expires_at")
    .eq("id", orgId)
    .single();

  if (!org || org.status !== "active") {
    return NextResponse.json({ error: "Organisation is not active" }, { status: 409 });
  }

  const seatsLeft = org.seats_purchased - org.seats_used;

  // Fetch existing member emails (to skip duplicates)
  const { data: existingMembers } = await admin
    .from("org_members")
    .select("user_id, status")
    .eq("org_id", orgId)
    .eq("status", "active");

  const existingUserIds = new Set((existingMembers ?? []).map((m) => m.user_id));

  // Fetch existing active invites for this org (to skip already-pending)
  const { data: existingInvites } = await admin
    .from("org_invites")
    .select("email")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());

  const pendingEmails = new Set((existingInvites ?? []).map((i) => i.email.toLowerCase()));

  // Fetch auth.users emails for existing members (to detect by email)
  const memberEmailSet = new Set<string>();
  if (existingUserIds.size > 0) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    users?.users
      ?.filter((u) => existingUserIds.has(u.id) && u.email)
      ?.forEach((u) => memberEmailSet.add(u.email!.toLowerCase()));
  }

  const results: InviteResult[] = [];
  let slotsUsed = 0;

  // Prepare nodemailer transporter (initialised once, reused per email)
  const smtpUser = process.env.ALERT_GMAIL_USER?.trim();
  const smtpPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  const siteUrl  = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");

  let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
  if (smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }

  for (const entry of entries) {
    const email = entry.email?.trim().toLowerCase();
    const role  = entry.role === "admin" ? "admin" : "member";

    // — Validate format
    if (!email || !EMAIL_RE.test(email)) {
      results.push({ email: entry.email, role, status: "error", reason: "Invalid email format" });
      continue;
    }

    // — Already an active member
    if (memberEmailSet.has(email)) {
      results.push({ email, role, status: "skipped", reason: "Already a member" });
      continue;
    }

    // — Already has a pending invite
    if (pendingEmails.has(email)) {
      results.push({ email, role, status: "skipped", reason: "Invite already pending" });
      continue;
    }

    // — No seats left
    if (slotsUsed >= seatsLeft) {
      results.push({ email, role, status: "error", reason: "No seats available" });
      continue;
    }

    // — Upsert invite row
    const token    = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertErr } = await admin.from("org_invites").upsert({
      org_id:      orgId,
      email,
      role,
      token,
      invited_by:  auth.userId,
      expires_at:  expiresAt,
      accepted_at: null,
    }, { onConflict: "org_id,email" });

    if (upsertErr) {
      results.push({ email, role, status: "error", reason: upsertErr.message });
      continue;
    }

    // — Send invite email (non-blocking per entry — log error but continue)
    if (transporter && smtpUser) {
      const inviteUrl = `${siteUrl}/org/invite/${token}`;
      transporter.sendMail({
        from:    `"Imotara" <${smtpUser}>`,
        to:      email,
        subject: `You've been invited to join ${org.name} on Imotara`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
            <h2 style="color:#312e81">You're invited!</h2>
            <p>You've been invited to join <strong>${org.name}</strong> on Imotara as a <strong>${role}</strong>.</p>
            <p style="margin:24px 0">
              <a href="${inviteUrl}"
                 style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                Accept invitation →
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px">This link expires in 7 days.</p>
          </div>
        `,
      }).catch((err) => console.error("[bulk invite email]", email, err));
    }

    slotsUsed++;
    pendingEmails.add(email); // prevent duplicates within the same batch
    results.push({ email, role, status: "invited" });
  }

  const summary = {
    total:   results.length,
    invited: results.filter((r) => r.status === "invited").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors:  results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ ok: true, summary, results });
}
