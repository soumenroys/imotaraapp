export const preferredRegion = ["sin1"];
export const maxDuration = 30;

// POST /api/connect/sessions/[id]/tick
// Called every 60s by the client during an active session.
// Server-authoritative: deducts 1 minute from the user's recharge balance.
// Returns { ok, remaining_minutes, status }
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import {
  sendSessionSummaryEmail,
  sendConsultantEarningsEmail,
  sendPlatformRevenueEmail,
} from "@/lib/connect/mailer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, status, minutes_used, amount_charged, currency_code, rate_per_min, last_tick_at")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }
  if (session.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ ok: false, status: session.status, remaining_minutes: 0 });
  }

  // Server-side rate limit: reject ticks faster than every 55 seconds (5s grace for network jitter)
  if (session.last_tick_at) {
    const msSince = Date.now() - new Date(session.last_tick_at as string).getTime();
    if (msSince < 55_000) {
      return NextResponse.json({ ok: false, error: "tick_too_soon" }, { status: 429 });
    }
  }

  // Use locked rate from session (falls back to consultant if migration not yet applied)
  const ratePerMin = Number(session.rate_per_min) > 0
    ? Number(session.rate_per_min)
    : await fetchConsultantRate(supabase, session.consultant_id);

  if (ratePerMin <= 0) {
    console.error("[tick] session has no valid rate:", sessionId, "rate:", ratePerMin, "— aborting tick");
    return NextResponse.json({ ok: false, error: "session_rate_invalid" }, { status: 422 });
  }

  // Calculate available balance for this consultant
  const { data: recharges } = await supabase
    .from("connect_recharges")
    .select("minutes_credited")
    .eq("user_id", user.id)
    .eq("consultant_id", session.consultant_id)
    .eq("status", "completed");

  const { data: usedSessions } = await supabase
    .from("connect_sessions")
    .select("minutes_used")
    .eq("user_id", user.id)
    .eq("consultant_id", session.consultant_id)
    .in("status", ["completed", "active"]);

  const totalCredited = (recharges ?? []).reduce((s, r) => s + Number(r.minutes_credited), 0);
  const totalUsed     = (usedSessions ?? []).reduce((s, r) => s + Number(r.minutes_used), 0);
  const balanceBefore = totalCredited - totalUsed;
  const now           = new Date().toISOString();

  if (balanceBefore <= 0) {
    // Auto-complete: no balance remaining.
    // minutes_used lock is required here too — a concurrent tick that took the
    // "remaining=0" path could have already incremented minutes_used between our
    // balance read and this write. Without the lock that tick's increment would be
    // silently overwritten, under-crediting the consultant.
    const { data: completedRows } = await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        last_tick_at:   now,
        minutes_used:   Number(session.minutes_used),
        amount_charged: Number(session.amount_charged ?? 0),
      })
      .eq("id", sessionId)
      .eq("status", "active")
      .eq("minutes_used", Number(session.minutes_used))
      .select("id");

    if (completedRows && completedRows.length > 0) {
      await creditConsultant(supabase, session.consultant_id, session.minutes_used, ratePerMin);
      void sendCompletionEmails(supabase, {
        sessionId,
        userId:        session.user_id,
        consultantId:  session.consultant_id,
        minutesUsed:   Number(session.minutes_used),
        amountCharged: Number(session.amount_charged ?? 0),
        currency:      session.currency_code ?? "INR",
        ratePerMin,
      }).catch((e) => console.error("[tick] completion email error:", e));
    }

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  // Deduct 1 minute
  const newMinutesUsed   = Number(session.minutes_used) + 1;
  const newAmountCharged = newMinutesUsed * ratePerMin;
  const remaining        = balanceBefore - 1;

  // Auto-complete when balance hits zero.
  // Optimistic lock on minutes_used prevents a concurrent tick from also
  // completing the session and double-crediting the consultant.
  if (remaining <= 0) {
    const { data: completedRows } = await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        minutes_used:   newMinutesUsed,
        amount_charged: newAmountCharged,
        last_tick_at:   now,
      })
      .eq("id", sessionId)
      .eq("status", "active")
      .eq("minutes_used", Number(session.minutes_used))
      .select("id");

    if (completedRows && completedRows.length > 0) {
      await creditConsultant(supabase, session.consultant_id, newMinutesUsed, ratePerMin);
      void sendCompletionEmails(supabase, {
        sessionId,
        userId:        session.user_id,
        consultantId:  session.consultant_id,
        minutesUsed:   newMinutesUsed,
        amountCharged: newAmountCharged,
        currency:      session.currency_code ?? "INR",
        ratePerMin,
      }).catch((e) => console.error("[tick] completion email error:", e));
    }

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  // Optimistic lock: only write if minutes_used hasn't changed since we read it.
  // Also require status="active" so a concurrent PATCH complete cannot be overwritten.
  const { data: updated } = await supabase
    .from("connect_sessions")
    .update({
      minutes_used:   newMinutesUsed,
      amount_charged: newAmountCharged,
      last_tick_at:   now,
    })
    .eq("id", sessionId)
    .eq("status", "active")
    .eq("minutes_used", Number(session.minutes_used))
    .select("id");

  if (!updated || updated.length === 0) {
    // Another concurrent tick already wrote — return current state without double-counting
    return NextResponse.json({ ok: true, status: "active", remaining_minutes: remaining });
  }

  return NextResponse.json({ ok: true, status: "active", remaining_minutes: remaining });
}

// Fire-and-forget: send session summary to user, earnings credit to consultant,
// and platform revenue notification to Imotara. Non-blocking — caller does not await this.
async function sendCompletionEmails(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  data: {
    sessionId:    string;
    userId:       string;
    consultantId: string;
    minutesUsed:  number;
    amountCharged: number;
    currency:     string;
    ratePerMin:   number;
  }
) {
  try {
    const totalCharged   = data.amountCharged;
    const earnedAmount   = data.minutesUsed * data.ratePerMin * 0.80;
    const platformFee    = data.minutesUsed * data.ratePerMin * 0.20;

    // Fetch user email + most recent recharge invoice for reference
    const [{ data: authUser }, { data: invoiceRow }] = await Promise.all([
      supabase.auth.admin.getUserById(data.userId),
      supabase
        .from("payment_invoices")
        .select("invoice_number")
        .eq("user_id", data.userId)
        .eq("product_id", "connect_session_minutes")
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const userEmail     = authUser?.user?.email;
    const invoiceNumber = invoiceRow?.invoice_number ?? undefined;

    // Fetch consultant name and user_id
    const { data: consultant } = await supabase
      .from("connect_consultants")
      .select("display_name, user_id")
      .eq("id", data.consultantId)
      .limit(1)
      .maybeSingle();

    const consultantName = consultant?.display_name ?? "Companion";

    // 1. User: session statement
    if (userEmail) {
      await sendSessionSummaryEmail({
        userEmail,
        consultantName,
        minutesUsed:   data.minutesUsed,
        amountCharged: totalCharged,
        currency:      data.currency,
        sessionId:     data.sessionId,
        invoiceNumber,
      });
    }

    // 2. Consultant: earnings credit (shows 3-way split)
    if (consultant?.user_id) {
      const { data: cAuthUser } = await supabase.auth.admin.getUserById(consultant.user_id);
      const consultantEmail = cAuthUser?.user?.email;
      if (consultantEmail) {
        await sendConsultantEarningsEmail({
          consultantEmail,
          consultantName,
          minutesUsed:   data.minutesUsed,
          earnedAmount,
          platformFee,
          totalCharged,
          currency:      data.currency,
          sessionId:     data.sessionId,
          userEmail:     userEmail ?? undefined,
        });
      }
    }

    // 3. Imotara: platform revenue notification
    await sendPlatformRevenueEmail({
      sessionId:        data.sessionId,
      userEmail:        userEmail ?? data.userId,
      consultantName,
      minutesUsed:      data.minutesUsed,
      totalCharged,
      platformFee,
      consultantEarned: earnedAmount,
      currency:         data.currency,
      invoiceNumber,
    });
  } catch (err) {
    console.error("[tick/sendCompletionEmails] error:", err);
  }
}

async function fetchConsultantRate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  consultantId: string
): Promise<number> {
  const { data } = await supabase
    .from("connect_consultants")
    .select("rate_per_min")
    .eq("id", consultantId)
    .single();
  return Number(data?.rate_per_min ?? 0);
}

async function creditConsultant(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  consultantId: string,
  minutesUsed: number,
  lockedRatePerMin: number
) {
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, sessions_completed")
    .eq("id", consultantId)
    .single();

  if (!consultant) return;

  // Use the rate locked at session creation, not the consultant's current rate.
  const sessionEarnings = Number(minutesUsed) * Number(lockedRatePerMin) * 0.80;

  await supabase
    .from("connect_wallet")
    .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });

  const { error: earningsErr } = await supabase.rpc("increment_wallet_earnings", {
    p_user_id: consultant.user_id,
    p_amount:  sessionEarnings,
  });
  if (earningsErr) console.error("[tick/creditConsultant] CRITICAL: increment_wallet_earnings failed:", earningsErr.message, "consultantId:", consultantId);

  const { error: scErr } = await supabase.rpc("increment_sessions_completed", {
    p_consultant_id: consultant.id,
  });
  if (scErr) {
    console.warn("[tick/creditConsultant] increment_sessions_completed RPC unavailable, using fallback:", scErr.message);
    await supabase
      .from("connect_consultants")
      .update({ sessions_completed: (consultant.sessions_completed ?? 0) + 1 })
      .eq("id", consultant.id);
  }

  await supabase
    .from("connect_consultants")
    .update({ is_busy: false })
    .eq("id", consultant.id);
}
