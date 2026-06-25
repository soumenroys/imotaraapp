// GET   /api/connect/sessions/[id]
// PATCH /api/connect/sessions/[id]
// Auth required. Session participants read or update session status.
// PATCH body: { action: "accept" | "decline" | "complete" | "cancel" }
// On "complete": credits consultant for minutes_used at 80% of rate.

export const preferredRegion = ["sin1"];

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

const VALID_ACTIONS = ["accept", "decline", "complete", "cancel", "userEnd"] as const;
type Action = typeof VALID_ACTIONS[number];

const TRANSITIONS: Record<Action, { from: string[]; to: string; consultantOnly?: boolean; userOnly?: boolean }> = {
  accept:   { from: ["pending"],  to: "active",    consultantOnly: true },
  decline:  { from: ["pending"],  to: "declined",  consultantOnly: true },
  complete: { from: ["active"],   to: "completed", consultantOnly: true },
  cancel:   { from: ["pending"],  to: "cancelled", userOnly: true },
  userEnd:  { from: ["active"],   to: "completed", userOnly: true },
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
    .select("id, user_id, display_name, rate_per_min, sessions_completed, is_busy")
    .eq("id", session.consultant_id)
    .single();

  const isConsultant = consultant?.user_id === user.id;
  const isUser       = session.user_id === user.id;

  if (!isConsultant && !isUser) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (action === "accept" && consultant?.is_busy) {
    return NextResponse.json(
      { ok: false, error: "Cannot accept: already in an active session." },
      { status: 409 }
    );
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
  if (transition.userOnly && !isUser) {
    return NextResponse.json({ ok: false, error: "Only the session requester can perform this action" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = { status: transition.to };
  if (action === "accept") {
    updatePayload.started_at = new Date().toISOString();
    const rawCtz = typeof body?.consultant_timezone === "string" ? body.consultant_timezone : "";
    updatePayload.consultant_timezone = rawCtz.length > 0 && rawCtz.length <= 64
      && /^[A-Za-z0-9/_+\-]{1,64}$/.test(rawCtz) ? rawCtz : "Asia/Kolkata";
  }
  if (action === "complete" || action === "decline" || action === "cancel" || action === "userEnd") { updatePayload.ended_at = new Date().toISOString(); }

  // Atomic status predicate prevents TOCTOU: if status changed between read and write
  // (e.g. concurrent tick completed the session), the update matches 0 rows and we 409.
  // We return minutes_used so that amount_charged can be set from the DB's actual value
  // (a concurrent tick may have incremented it between our read and this write).
  const { data: updatedRows, error } = await supabase
    .from("connect_sessions")
    .update(updatePayload)
    .eq("id", id)
    .eq("status", session.status)
    .select("id, minutes_used");

  if (error) {
    // 23505 = unique_violation: the partial unique index uq_connect_sessions_consultant_active
    // (WHERE status='active') rejected this accept because another concurrent accept of a
    // different session already made this consultant active.
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "Companion is already in another active session." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: "Could not update session" }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { ok: false, error: `Session status has changed — cannot ${action}` },
      { status: 409 }
    );
  }

  // Set consultant is_busy=true on accept, clear on complete/decline/cancel
  if (consultant) {
    if (action === "accept") {
      await supabase.from("connect_consultants").update({ is_busy: true }).eq("id", consultant.id);

      // Notify the session user that their request was accepted (email + push, non-blocking)
      void supabase.auth.admin.getUserById(session.user_id).then(({ data: uAuth }) => {
        const userEmail    = uAuth?.user?.email;
        const consultantName = consultant.display_name ?? "Your companion";
        const userPushToken  = uAuth?.user?.user_metadata?.expo_connect_push_token as string | undefined;

        const jobs: Promise<unknown>[] = [];

        if (userEmail) {
          jobs.push(sendSessionAcceptedEmail({
            userEmail, consultantName, sessionId: id,
          }).catch((e) => console.error("[sessions/accept] email error:", e)));
        }

        if (userPushToken) {
          jobs.push(fetch("https://exp.host/--/api/v2/push/send", {
            method:  "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              to:    userPushToken,
              sound: "default",
              title: "Session Accepted!",
              body:  `${consultantName} has accepted your request. Join now.`,
              data:  { session_id: id, type: "session_accepted" },
            }),
          }).catch((e) => console.error("[sessions/accept] push error:", e)));
        }

        return Promise.all(jobs);
      }).catch((e) => console.error("[sessions/accept] notify error:", e));

    } else if (action === "complete" || action === "userEnd") {
      // Only clear is_busy when an active session ends. "decline" and "cancel" operate on
      // pending sessions which never set is_busy=true; clearing it here would unblock a
      // consultant who is legitimately busy with a separate active session.
      await supabase.from("connect_consultants").update({ is_busy: false }).eq("id", consultant.id);

    } else if (action === "decline") {
      // Notify the session user their request was declined (best-effort push, non-blocking).
      // NOTE: decline acts on a pending session — is_busy was never set, so no clear needed.
      void supabase.auth.admin.getUserById(session.user_id).then(({ data: uAuth }) => {
        const pushToken = uAuth?.user?.user_metadata?.expo_connect_push_token as string | undefined;
        if (!pushToken) return;
        return fetch("https://exp.host/--/api/v2/push/send", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            to:    pushToken,
            sound: "default",
            title: "Session Request Declined",
            body:  "The companion is unavailable right now. Try another or check back later.",
            data:  { session_id: id, type: "session_declined" },
          }),
        });
      }).catch((e) => console.error("[sessions/decline] push error:", e));
    }
  }

  // Credit consultant earnings on manual completion (minutes_used > 0).
  // Use the fresh minutes_used from the RETURNING clause — the DB's actual value at the moment
  // the status was locked to "completed". This is always >= session.minutes_used read above
  // (a concurrent tick may have incremented it between our read and this write).
  const freshMinutes = Number(updatedRows?.[0]?.minutes_used ?? session.minutes_used);
  if ((action === "complete" || action === "userEnd") && consultant && freshMinutes > 0) {
    const lockedRate     = Number(session.rate_per_min) > 0 ? Number(session.rate_per_min) : Number(consultant.rate_per_min);
    const amountCharged   = freshMinutes * lockedRate;
    const sessionEarnings = amountCharged * 0.80;

    const { error: walletErr } = await supabase
      .from("connect_wallet")
      .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });
    if (walletErr) {
      console.error("[sessions/complete] CRITICAL: wallet upsert failed — earnings not credited:", walletErr.message, "session:", id, "consultant user_id:", consultant.user_id);
      // Write billing amounts but NOT consultant_credited — the earnings were never actually
      // credited. A non-zero consultant_credited with no corresponding wallet entry would be
      // a false audit record. The discrepancy surfaces in the earnings dashboard logs.
      await supabase.from("connect_sessions")
        .update({ amount_charged: amountCharged, platform_fee: +(amountCharged * 0.20).toFixed(4) })
        .eq("id", id).eq("status", "completed");
    } else {
      // Atomic increment — avoids read-modify-write race condition on concurrent completes
      const { error: earningsErr } = await supabase.rpc("increment_wallet_earnings", {
        p_user_id: consultant.user_id,
        p_amount:  sessionEarnings,
      });
      if (earningsErr) console.error("[sessions/complete] CRITICAL: increment_wallet_earnings failed:", earningsErr.message, "session:", id);

      // Write receipt columns only when the wallet was actually credited so that
      // consultant_credited in the session row is an accurate audit record.
      const { error: acErr } = await supabase.from("connect_sessions")
        .update({
          amount_charged:      amountCharged,
          platform_fee:        +(amountCharged * 0.20).toFixed(4),
          consultant_credited: +sessionEarnings.toFixed(4),
        })
        .eq("id", id)
        .eq("status", "completed");
      if (acErr) console.error("[sessions/complete] amount_charged update failed:", acErr.message, "session:", id);
    }

    const { error: scErr } = await supabase.rpc("increment_sessions_completed", {
      p_consultant_id: consultant.id,
    });
    if (scErr) {
      // Do NOT fall back to read-modify-write — the stale value from the pre-request
      // SELECT would produce a lost update under concurrent completions. The RPC is
      // atomic and has been deployed since v15. Log CRITICAL for manual correction.
      console.error("[sessions/complete] CRITICAL: increment_sessions_completed RPC failed — sessions_completed NOT incremented. Manual correction needed. Error:", scErr.message, "session:", id);
    }

    const currency        = session.currency_code ?? "INR";
    const consultantName  = consultant.display_name ?? "Companion";
    const minutesUsed     = freshMinutes;
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
