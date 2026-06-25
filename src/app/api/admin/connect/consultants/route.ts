// GET   /api/admin/connect/consultants — list all (all statuses)
// PATCH /api/admin/connect/consultants — suspend / reinstate / reject a consultant
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { connectAdminAuthorized, requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("connect_consultants")
    .select(
      "id, user_id, display_name, gender, photo_url, status, bio, expertise_tags, " +
      "languages, rate_per_min, currency_code, is_online, rating_avg, " +
      "sessions_completed, availability_note, availability_windows, " +
      "contact_email, contact_phone, website_url, social_links, " +
      "payout_info, digital_signature, rejection_reason, approval_note, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[admin/connect/consultants GET] query failed:", error.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  function maskPayout(info: Record<string, string> | null): Record<string, string> | null {
    if (!info) return null;
    const masked = { ...info };
    for (const key of ["account_number", "iban", "swift_code", "routing_number", "upi_id"]) {
      if (masked[key]) {
        const v = String(masked[key]);
        masked[key] = v.length > 4 ? `${"*".repeat(v.length - 4)}${v.slice(-4)}` : "****";
      }
    }
    return masked;
  }

  type ConsultantRow = Record<string, unknown> & { payout_info?: Record<string, string> | null };
  const consultants = ((data ?? []) as unknown as ConsultantRow[]).map((c) => ({
    ...c,
    payout_info: maskPayout(c.payout_info ?? null),
  }));

  return NextResponse.json({ ok: true, consultants });
}

export async function PATCH(req: NextRequest) {
  // Suspend / reinstate / reject requires owner or admin — connect_reviewer is read-only.
  const authResult = await requireSuperAdmin(req);
  if (!authResult.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (authResult.admin.role === "connect_reviewer") {
    return NextResponse.json({ ok: false, error: "Insufficient privileges to change consultant status" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.id || !body.action) {
    return NextResponse.json({ ok: false, error: "id and action required" }, { status: 400 });
  }

  const { id, action, reason } = body;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
    return NextResponse.json({ ok: false, error: "Invalid consultant id" }, { status: 400 });
  }
  const VALID_ACTIONS = ["suspend", "reinstate", "reject"];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "action must be suspend, reinstate, or reject" }, { status: 400 });
  }

  const statusMap: Record<string, string> = {
    suspend:   "suspended",
    reinstate: "approved",
    reject:    "rejected",
  };

  const supabase = getSupabaseAdmin();

  // Fetch before update so we have user_id and display_name for notification email.
  const { data: consultantRow } = await supabase
    .from("connect_consultants")
    .select("id, user_id, display_name")
    .eq("id", id)
    .single();

  // Build update object conditionally — passing `undefined` as a value causes the Supabase
  // client to serialise it as JSON null, which would silently overwrite is_online to NULL
  // and break availability checks for reinstated consultants.
  const updatePayload: Record<string, unknown> = {
    status:           statusMap[action],
    rejection_reason: reason?.trim() ?? null,
  };
  if (action !== "reinstate") updatePayload.is_online = false;

  const { error } = await supabase
    .from("connect_consultants")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("[admin/connect/consultants PATCH] DB update failed:", error.message, "id:", id);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  // Notify the consultant of their status change — non-blocking.
  if (consultantRow?.user_id) {
    void supabase.auth.admin.getUserById(consultantRow.user_id).then(({ data: authUser }) => {
      const email = authUser?.user?.email;
      if (!email) return;
      return sendStatusChangeEmail({ email, name: consultantRow.display_name ?? "Companion", action: action as "suspend" | "reinstate" | "reject", reason });
    }).catch((e) => console.error("[admin/connect/consultants PATCH] notify error:", e));
  }

  return NextResponse.json({ ok: true, status: statusMap[action] });
}

async function sendStatusChangeEmail(data: {
  email: string; name: string; action: "suspend" | "reinstate" | "reject"; reason?: string;
}) {
  const gmailUser = process.env.ALERT_GMAIL_USER?.trim();
  const gmailPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) return;

  const subjectMap = {
    suspend:   "[Imotara Connect] Your account has been suspended",
    reinstate: "[Imotara Connect] Your account has been reinstated",
    reject:    "[Imotara Connect] Application update",
  };
  const bodyMap = {
    suspend: [
      `Hi ${data.name},`,
      ``,
      `Your Imotara Connect companion account has been temporarily suspended by our moderation team.`,
      data.reason ? `Reason: ${data.reason}` : null,
      ``,
      `If you believe this is a mistake, please reply to this email or contact support@imotara.com.`,
      ``,
      `— The Imotara Team`,
    ].filter((l) => l !== null).join("\n"),
    reinstate: [
      `Hi ${data.name},`,
      ``,
      `Good news — your Imotara Connect companion account has been reinstated. You can log in and resume accepting sessions.`,
      ``,
      `Thank you for your patience.`,
      ``,
      `— The Imotara Team`,
    ].join("\n"),
    reject: [
      `Hi ${data.name},`,
      ``,
      `Thank you for applying to Imotara Connect.`,
      `After review, we are unable to approve your application at this time.`,
      ``,
      data.reason ? `Reason: ${data.reason}` : null,
      ``,
      `If you believe this is a mistake, please reply to this email.`,
      ``,
      `— The Imotara Team`,
    ].filter((l) => l !== null).join("\n"),
  };

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from:    `"Imotara Connect" <${gmailUser}>`,
      to:      data.email,
      subject: subjectMap[data.action],
      text:    bodyMap[data.action],
    });
  } catch (err) {
    console.error("[Connect email] Failed to send status change notification:", err);
  }
}
