// PATCH /api/admin/connect/[id]/approve
// Admin only. Approves or rejects a consultant application.
// Body: { action: "approve" | "reject", reason?: string }

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import nodemailer from "nodemailer";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Approve/reject is owner or admin only — connect_reviewer cannot approve applications.
  const authResult = await requireSuperAdmin(req);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (authResult.admin.role === "connect_reviewer") {
    return NextResponse.json({ ok: false, error: "Insufficient privileges to approve consultants" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ ok: false, error: "action must be approve or reject" }, { status: 400 });
  }

  const { action, reason, approval_note } = body;

  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ ok: false, error: "reason required when rejecting" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, display_name, status")
    .eq("id", id)
    .single();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  const { error } = await supabase
    .from("connect_consultants")
    .update({
      status:           newStatus,
      rejection_reason: action === "reject" ? reason.trim() : null,
      approval_note:    action === "approve" ? (approval_note?.trim() ?? null) : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Get consultant's email and send notification
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(consultant.user_id);
    const email = authUser?.user?.email;
    if (email) {
      await sendConsultantNotification({ email, name: consultant.display_name, action, reason, approval_note });
    }
  } catch {
    // email failure is non-blocking
  }

  return NextResponse.json({ ok: true, status: newStatus });
}

async function sendConsultantNotification(data: {
  email: string; name: string; action: "approve" | "reject"; reason?: string; approval_note?: string;
}) {
  const gmailUser = process.env.ALERT_GMAIL_USER?.trim();
  const gmailPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) {
    console.error("[Connect email] ALERT_GMAIL_USER or ALERT_GMAIL_APP_PASSWORD env var not set — skipping approval email");
    return;
  }

  const subject = data.action === "approve"
    ? "[Imotara Connect] Your application has been approved!"
    : "[Imotara Connect] Application update";

  const text = data.action === "approve"
    ? [
        `Hi ${data.name},`,
        ``,
        `🎉 Wonderful news — your application to become a Wellness Companion on Imotara Connect has been approved!`,
        ``,
        `We are truly grateful that you have chosen to dedicate your time, empathy, and lived experience to support others on their emotional wellness journey. In a world where so many people are silently struggling, companions like you make an extraordinary difference.`,
        ``,
        `By joining Imotara Connect, you are becoming part of a compassionate movement — one that believes real human connection can heal, comfort, and inspire. We believe deeply in your ability to be that safe, non-judgmental presence for someone who needs it most.`,
        ...(data.approval_note ? [
          ``,
          `A personal note from the Imotara team:`,
          `"${data.approval_note}"`,
        ] : []),
        ``,
        `Your next steps:`,
        `  1. Log in to Imotara Connect at https://imotara.com/connect`,
        `  2. Set your availability so users can find you when you are ready`,
        `  3. Complete your profile so users can learn more about you`,
        `  4. Begin your first session — and make someone's day a little brighter`,
        ``,
        `Thank you for being part of this generous initiative. We are honoured to have you with us.`,
        ``,
        `With warmth and gratitude,`,
        `The Imotara Team`,
      ].join("\n")
    : [
        `Hi ${data.name},`,
        ``,
        `Thank you for applying to Imotara Connect.`,
        `After review, we're unable to approve your application at this time.`,
        ``,
        data.reason ? `Reason: ${data.reason}` : null,
        ``,
        `If you believe this is a mistake, please reply to this email.`,
        ``,
        `— The Imotara Team`,
      ].filter((l) => l !== null).join("\n");

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: `"Imotara Connect" <${gmailUser}>`,
      to:   data.email,
      subject,
      text,
    });
  } catch (err) {
    console.error("[Connect email] Failed to send approval/rejection notification:", err);
  }
}
