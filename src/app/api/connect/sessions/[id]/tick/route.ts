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

  // Calculate available balance for this consultant using a single atomic DB
  // expression — replaces two sequential reads that had a TOCTOU window where a
  // concurrent tick or recharge could land between them and produce a stale balance.
  const { data: balanceData, error: balanceErr } = await supabase
    .rpc("get_session_balance", { p_user_id: user.id, p_consultant_id: session.consultant_id });
  if (balanceErr) {
    console.error("[tick] get_session_balance failed:", balanceErr.message, "session:", sessionId);
    return NextResponse.json({ ok: false, error: "Service temporarily unavailable. Please try again." }, { status: 503 });
  }
  const balanceBefore = Number(balanceData ?? 0);
  const now           = new Date().toISOString();

  if (balanceBefore <= 0) {
    // Auto-complete: no balance remaining.
    // minutes_used lock is required here too — a concurrent tick that took the
    // "remaining=0" path could have already incremented minutes_used between our
    // balance read and this write. Without the lock that tick's increment would be
    // silently overwritten, under-crediting the consultant.
    // Do NOT write amount_charged here — it was already set correctly by the
    // last path-A/B tick. Writing the pre-SELECT value would overwrite it with stale data.
    // consultant_credited is intentionally NOT written here — it is written inside
    // creditConsultant() ONLY after the wallet is actually credited, to prevent a
    // false audit record if wallet upsert or earnings RPC subsequently fails.
    const pathCAmount      = Number(session.minutes_used) * ratePerMin;
    const { data: completedRows, error: pathCErr } = await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        last_tick_at:   now,
        minutes_used:   Number(session.minutes_used),
        amount_charged: +pathCAmount.toFixed(4),
        platform_fee:   +(pathCAmount * 0.20).toFixed(4),
      })
      .eq("id", sessionId)
      .eq("status", "active")
      .eq("minutes_used", Number(session.minutes_used))
      .select("id");
    if (pathCErr) {
      console.error("[tick/pathC] update error:", pathCErr.message, "session:", sessionId);
      return NextResponse.json({ ok: false, error: "Service temporarily unavailable. Please try again." }, { status: 503 });
    }

    if (completedRows && completedRows.length > 0) {
      await creditConsultant(supabase, session.consultant_id, session.minutes_used, ratePerMin, sessionId);
      void sendCompletionEmails(supabase, {
        sessionId,
        userId:        session.user_id,
        consultantId:  session.consultant_id,
        minutesUsed:   Number(session.minutes_used),
        // Use computed value rather than the DB field — session.amount_charged was read
        // at request start; a concurrent tick may have written a larger value since then.
        // The optimistic lock guarantees minutes_used hasn't changed, so the computed
        // amount is authoritative and consistent with what creditConsultant credits.
        amountCharged: Number(session.minutes_used) * ratePerMin,
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
  // consultant_credited is intentionally NOT written here — written inside
  // creditConsultant() ONLY after wallet is actually credited.
  if (remaining <= 0) {
    const { data: completedRows, error: pathBErr } = await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        minutes_used:   newMinutesUsed,
        amount_charged: newAmountCharged,
        platform_fee:   +(newAmountCharged * 0.20).toFixed(4),
        last_tick_at:   now,
      })
      .eq("id", sessionId)
      .eq("status", "active")
      .eq("minutes_used", Number(session.minutes_used))
      .select("id");
    if (pathBErr) {
      console.error("[tick/pathB] update error:", pathBErr.message, "session:", sessionId);
      return NextResponse.json({ ok: false, error: "Service temporarily unavailable. Please try again." }, { status: 503 });
    }

    if (completedRows && completedRows.length > 0) {
      await creditConsultant(supabase, session.consultant_id, newMinutesUsed, ratePerMin, sessionId);
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
  const { data: updated, error: pathAErr } = await supabase
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
  if (pathAErr) {
    console.error("[tick/pathA] update error:", pathAErr.message, "session:", sessionId);
    return NextResponse.json({ ok: false, error: "Service temporarily unavailable. Please try again." }, { status: 503 });
  }

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

// sessionId: when provided, consultant_credited is written to the session row ONLY
// after both wallet upsert and earnings RPC succeed — ensuring no false audit record.
async function creditConsultant(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  consultantId: string,
  minutesUsed: number,
  lockedRatePerMin: number,
  sessionId?: string
) {
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, sessions_completed")
    .eq("id", consultantId)
    .single();

  if (!consultant) return;

  // Use the rate locked at session creation, not the consultant's current rate.
  const sessionEarnings = Number(minutesUsed) * Number(lockedRatePerMin) * 0.80;

  const { error: walletErr } = await supabase
    .from("connect_wallet")
    .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (walletErr) {
    console.error("[tick/creditConsultant] CRITICAL: wallet upsert failed — earnings not credited:", walletErr.message, "consultant user_id:", consultant.user_id);
    // Still clear is_busy so the consultant is not permanently locked out of new sessions.
    // The orphan cron cannot recover this because the session is already status=completed.
    await supabase.from("connect_consultants").update({ is_busy: false }).eq("id", consultant.id);
    return;
  }

  const { error: earningsErr } = await supabase.rpc("increment_wallet_earnings", {
    p_user_id: consultant.user_id,
    p_amount:  sessionEarnings,
  });
  if (earningsErr) {
    console.error("[tick/creditConsultant] CRITICAL: increment_wallet_earnings failed:", earningsErr.message, "consultantId:", consultantId, "— consultant_credited NOT written");
  } else if (sessionId) {
    // Both wallet ops succeeded — write consultant_credited audit column now.
    const { error: acErr } = await supabase
      .from("connect_sessions")
      .update({ consultant_credited: +sessionEarnings.toFixed(4) })
      .eq("id", sessionId);
    if (acErr) console.error("[tick/creditConsultant] consultant_credited write failed:", acErr.message, "session:", sessionId);
  }

  const { error: scErr } = await supabase.rpc("increment_sessions_completed", {
    p_consultant_id: consultant.id,
  });
  if (scErr) {
    // Do NOT fall back to read-modify-write: a stale sessions_completed value read before
    // the session started would produce a lost-update under concurrent completions (two
    // concurrent completes each read N, both write N+1 → final value N+1 instead of N+2).
    // The increment_sessions_completed RPC is atomic and has been deployed and granted since
    // v15. Log CRITICAL so the discrepancy is visible in Vercel logs but do not write stale data.
    console.error("[tick/creditConsultant] CRITICAL: increment_sessions_completed RPC failed — sessions_completed NOT incremented. Manual correction needed. Error:", scErr.message, "consultantId:", consultantId);
  }

  await supabase
    .from("connect_consultants")
    .update({ is_busy: false })
    .eq("id", consultant.id);
}
