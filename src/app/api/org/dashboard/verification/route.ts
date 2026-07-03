// src/app/api/org/dashboard/verification/route.ts
// GET  — get verification status
// POST — submit verification document URL (NGO 80G/FCRA, EDU affiliation letter)
// Org admin only.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import nodemailer from "nodemailer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: org } = await getSupabaseAdmin()
    .from("organizations")
    .select("name, billing_type, org_settings")
    .eq("id", auth.orgId)
    .single();

  const settings = (org?.org_settings ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    billingType:          org?.billing_type,
    verificationStatus:   settings.verification_status ?? "unverified",
    verificationDocUrl:   settings.verification_doc_url ?? null,
    verificationNote:     settings.verification_note ?? null,
    submittedAt:          settings.verification_submitted_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { documentUrl: string; documentType?: string; notes?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.documentUrl?.trim()) {
    return NextResponse.json({ error: "documentUrl required (public URL to verification document)" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("name, billing_type, org_settings").eq("id", auth.orgId).single();
  const settings = (org?.org_settings ?? {}) as Record<string, unknown>;

  const updated = {
    ...settings,
    verification_status:       "pending_review",
    verification_doc_url:      body.documentUrl.trim(),
    verification_doc_type:     body.documentType ?? null,
    verification_note:         body.notes?.trim() ?? null,
    verification_submitted_at: new Date().toISOString(),
  };

  await admin.from("organizations").update({ org_settings: updated, updated_at: new Date().toISOString() }).eq("id", auth.orgId);

  // Alert Imotara admin
  const smtpUser = process.env.ALERT_GMAIL_USER?.trim();
  const smtpPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (smtpUser && smtpPass) {
    nodemailer.createTransport({ host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } })
      .sendMail({
        from: `"Imotara Alerts" <${smtpUser}>`,
        to:   "info@imotara.com",
        subject: `[Verification] ${org?.name} (${org?.billing_type}) submitted verification docs`,
        text: `Org: ${org?.name}\nType: ${org?.billing_type}\nDoc URL: ${body.documentUrl}\nNotes: ${body.notes ?? "none"}\n\nReview at /admin → Organizations`,
      }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status: "pending_review" });
}
