// GET   /api/connect/sessions/[id]
// PATCH /api/connect/sessions/[id]
// Auth required. Session participants read or update session status.
// PATCH body: { action: "accept" | "decline" | "complete" | "cancel" }
// On "complete": credits consultant for minutes_used at 80% of rate.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import {
  sendSessionSummaryEmail,
  sendConsultantEarningsEmail,
  sendPlatformRevenueEmail,
  sendSessionAcceptedEmail,
} from "@/lib/connect/mailer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: sessionRaw, error } = await supabase
    .from("connect_sessions")
    .select(
      "id, user_id, consultant_id, type, status, scheduled_note, scheduled_at, scheduled_duration_min, " +
      "started_at, ended_at, minutes_used, amount_charged, currency_code, rate_per_min, base_rate_per_min, " +
      "translation_enabled, user_lang, consultant_lang, " +
      "rating, review_text, review_submitted_at, created_at, last_tick_at, " +
      "connect_consultants(display_name, photo_url, gender, rate_per_min, preferred_lang)"
    )
    .eq("id", id)
    .single();

  if (error || !sessionRaw) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  const session = sessionRaw as unknown as {
    id: string; user_id: string; consultant_id: string; [key: string]: unknown;
  };

  // Only the session user or the consultant may read the session
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("user_id")
    .eq("id", session.consultant_id)
    .single();

  const isConsultant = consultant?.user_id === user.id;
  const isUser       = session.user_id === user.id;
  if (!isConsultant && !isUser) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, session });
}

const VALID_ACTIONS = ["accept", "decline", "complete", "cancel"] as const;
type Action = typeof VALID_ACTIONS[number];

const TRANSITIONS: Record<Action, { from: string[]; to: string; consultantOnly?: boolean }> = {
  accept:   { from: ["pending"],  to: "active",    consultantOnly: true },
  decline:  { from: ["pending"],  to: "declined",  consultantOnly: true },
  complete: { from: ["active"],   to: "completed" },
  cancel:   { from: ["pending"], to: "cancelled" },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action: Action | undefined = body?.action;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "action must be one of: " + VALID_ACTIONS.join(", ") }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, status, minutes_used, rate_per_min, currency_code")
    .eq("id", id)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  // Determine if caller is the consultant
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, display_name, rate_per_min, sessions_completed")
    .eq("id", session.consultant_id)
    .single();

  const isConsultant = consultant?.user_id === user.id;
  const isUser       = session.user_id === user.id;

  if (!isConsultant && !isUser) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const transition = TRANSITIONS[action];
  if (!transition.from.includes(session.status)) {
    return NextResponse.json(
      { ok: false, error: `Cannot ${action} a session in status "${session.status}"` },
      { status: 409 }
    );
  }
  if (transition.consultantOnly && !isConsultant) {
    return NextResponse.json({ ok: false, error: "Only the consultant can perform this action" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = { status: transition.to };
  if (action === "accept") {
    updatePayload.started_at = new Date().toISOString();
    const tz = typeof body?.consultant_timezone === "string" && body.consultant_timezone.length > 0
      ? body.consultant_timezone : "Asia/Kolkata";
    updatePayload.consultant_timezone = tz;
  }
  if (action === "complete") { updatePayload.ended_at = new Date().toISOString(); }
  if (action === "decline" || action === "cancel" || action === "complete") {
    // Will clear is_busy on consultant after status update
  }

  const { error } = await supabase
    .from("connect_sessions")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Set consultant is_busy=true on accept, clear on complete/decline/cancel
  if (consultant) {
    if (action === "accept") {
      await supabase.from("connect_consultants").update({ is_busy: true }).eq("id", consultant.id);

      // Notify the session user that their request was accepted (email + push, non-blocking)
      void supabase.auth.admin.getUserById(session.user_id).then(({ data: uAuth }) => {
        const userEmail = uAuth?.user?.email;
        const consultantName = consultant.display_name ?? "Your companion";

        const jobs: Promise<unknown>[] = [];

        if (userEmail) {
          jobs.push(sendSessionAcceptedEmail({
            userEmail, consultantName, sessionId: id,
          }).catch((e) => console.error("[sessions/accept] email error:", e)));
        }

        // Push notification to user if they have a token (via expo_push_token stored on their profile
        // — users don't have a connect_consultants row, so we look in a generic field on auth.users metadata)
        // Best-effort only; most users will receive the Supabase Realtime status update instead.
        return Promise.all(jobs);
      }).catch((e) => console.error("[sessions/accept] notify error:", e));

    } else if (action === "complete" || action === "decline" || action === "cancel") {
      await supabase.from("connect_consultants").update({ is_busy: false }).eq("id", consultant.id);
    }
  }

  // Credit consultant earnings on manual completion (minutes_used > 0)
  // Use rate locked in session row; fall back to current rate if not yet migrated.
  if (action === "complete" && consultant && Number(session.minutes_used) > 0) {
    const lockedRate     = Number(session.rate_per_min) > 0 ? Number(session.rate_per_min) : Number(consultant.rate_per_min);
    const sessionEarnings = Number(session.minutes_used) * lockedRate * 0.80;
    const amountCharged   = Number(session.minutes_used) * lockedRate;

    await supabase
      .from("connect_sessions")
      .update({ amount_charged: amountCharged })
      .eq("id", id);

    await supabase
      .from("connect_wallet")
      .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: wallet } = await supabase
      .from("connect_wallet")
      .select("earned_amount")
      .eq("user_id", consultant.user_id)
      .single();

    await supabase
      .from("connect_wallet")
      .update({
        earned_amount: (Number(wallet?.earned_amount ?? 0) + sessionEarnings),
        updated_at:    new Date().toISOString(),
      })
      .eq("user_id", consultant.user_id);

    await supabase
      .from("connect_consultants")
      .update({ sessions_completed: (consultant.sessions_completed ?? 0) + 1 })
      .eq("id", consultant.id);

    const currency        = session.currency_code ?? "INR";
    const consultantName  = consultant.display_name ?? "Companion";
    const minutesUsed     = Number(session.minutes_used);
    const platformFee     = amountCharged * 0.20;

    // Fire-and-forget: session statement (user), earnings (consultant), revenue (Imotara)
    Promise.all([
      // 1. Look up invoice and user email in parallel
      Promise.all([
        supabase.auth.admin.getUserById(session.user_id),
        supabase
          .from("payment_invoices")
          .select("invoice_number")
          .eq("user_id", session.user_id)
          .eq("product_id", "connect_session_minutes")
          .order("issued_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]).then(([{ data: uAuth }, { data: inv }]) => {
        const userEmail     = uAuth?.user?.email;
        const invoiceNumber = inv?.invoice_number ?? undefined;

        const jobs: Promise<unknown>[] = [];

        // User email
        if (userEmail) {
          jobs.push(sendSessionSummaryEmail({
            userEmail,
            consultantName,
            minutesUsed,
            amountCharged,
            currency,
            sessionId:    id,
            invoiceNumber,
          }));
        }

        // Imotara platform revenue email (always fires)
        jobs.push(sendPlatformRevenueEmail({
          sessionId:        id,
          userEmail:        userEmail ?? session.user_id,
          consultantName,
          minutesUsed,
          totalCharged:     amountCharged,
          platformFee,
          consultantEarned: sessionEarnings,
          currency,
          invoiceNumber,
        }));

        return Promise.all(jobs);
      }),

      // 2. Consultant earnings email
      supabase.auth.admin.getUserById(consultant.user_id).then(({ data }) => {
        const consultantEmail = data?.user?.email;
        if (consultantEmail) {
          return sendConsultantEarningsEmail({
            consultantEmail,
            consultantName,
            minutesUsed,
            earnedAmount:  sessionEarnings,
            platformFee,
            totalCharged:  amountCharged,
            currency,
            sessionId:     id,
          });
        }
      }),
    ]).catch((err) => console.error("[sessions/complete] email error:", err));
  }

  return NextResponse.json({ ok: true, status: transition.to });
}
