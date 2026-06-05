// PATCH /api/admin/connect/[id]/approve
// Admin only. Approves or rejects a consultant application.
// Body: { action: "approve" | "reject", reason?: string }

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import nodemailer from "nodemailer";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await adminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ ok: false, error: "action must be approve or reject" }, { status: 400 });
  }

  const { action, reason } = body;

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
      await sendConsultantNotification({ email, name: consultant.display_name, action, reason });
    }
  } catch {
    // email failure is non-blocking
  }

  return NextResponse.json({ ok: true, status: newStatus });
}

async function sendConsultantNotification(data: {
  email: string; name: string; action: "approve" | "reject"; reason?: string;
}) {
  const gmailUser = process.env.ALERT_GMAIL_USER?.trim();
  const gmailPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) return;

  const subject = data.action === "approve"
    ? "[Imotara Connect] Your application has been approved!"
    : "[Imotara Connect] Application update";

  const text = data.action === "approve"
    ? [
        `Hi ${data.name},`,
        ``,
        `Congratulations! Your Imotara Connect application has been approved.`,
        `You can now log in, set your availability, and start receiving session requests.`,
        ``,
        `Log in at: https://imotara.com/connect`,
        ``,
        `— The Imotara Team`,
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
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: `"Imotara Connect" <${gmailUser}>`,
      to:   data.email,
      subject,
      text,
    });
  } catch {
    // non-blocking
  }
}
