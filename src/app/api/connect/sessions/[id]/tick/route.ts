export const preferredRegion = ["sin1"];
export const maxDuration = 60;

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
import { creditConsultantDurably } from "@/lib/connect/creditConsultant";
import { splitSessionEarnings, type MoneySplit } from "@/lib/connect/money";

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
    .select("id, user_id, consultant_id, status, minutes_used, amount_charged, currency_code, rate_per_min, last_tick_at, started_at")
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

  // Use locked rate from session (falls back to consultant if migration not yet applied).
  // rate_per_min = 0 is a legitimate free-session rate, not a missing one — only fall
  // back to fetchConsultantRate when the session row itself has no rate at all.
  const ratePerMin = session.rate_per_min != null
    ? Number(session.rate_per_min)
    : await fetchConsultantRate(supabase, session.consultant_id);

  if (ratePerMin < 0 || Number.isNaN(ratePerMin)) {
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
    //
    // Wall-clock reconciliation (P1-5): the only ceiling on tick frequency is a
    // floor (>= 55s apart) — a client ticking right at that floor accrues minutes
    // faster than real time (60/55 ≈ 9% over a long session). Billed minutes are
    // capped to what could plausibly have elapsed since started_at, so a client
    // (or attacker) that ticks aggressively can't over-bill past wall-clock reality.
    // minutes_used itself is left untouched — it's the raw tick count, not the bill.
    const ticksMinutes  = Number(session.minutes_used);
    const wallClockMin  = session.started_at
      ? Math.ceil((Date.parse(now) - Date.parse(session.started_at as string)) / 60_000)
      : ticksMinutes;
    const billableMin   = Math.min(ticksMinutes, Math.max(wallClockMin, 0));
    if (billableMin !== ticksMinutes) {
      console.warn(
        `[tick/pathC] wall-clock reconciliation: capped billed minutes ${ticksMinutes} -> ${billableMin} ` +
        `(wall-clock elapsed ${wallClockMin}min) session:`, sessionId,
      );
    }
    const split = splitSessionEarnings(billableMin, ratePerMin);
    const { data: completedRows, error: pathCErr } = await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        last_tick_at:   now,
        minutes_used:   ticksMinutes,
        amount_charged: split.amountCharged,
        platform_fee:   split.platformFee,
      })
      .eq("id", sessionId)
      .eq("status", "active")
      .eq("minutes_used", ticksMinutes)
      .select("id");
    if (pathCErr) {
      console.error("[tick/pathC] update error:", pathCErr.message, "session:", sessionId);
      return NextResponse.json({ ok: false, error: "Service temporarily unavailable. Please try again." }, { status: 503 });
    }

    if (completedRows && completedRows.length > 0) {
      await creditConsultant(supabase, session.consultant_id, split.consultantCredited, sessionId);
      void sendCompletionEmails(supabase, {
        sessionId,
        userId:        session.user_id,
        consultantId:  session.consultant_id,
        minutesUsed:   billableMin,
        // Same split used for the DB write above — previously this
        // recomputed an unrounded raw float independently, so the email could
        // show a long floating-point amount even on the path whose DB write
        // was rounded.
        split,
        currency:      session.currency_code ?? "INR",
      }).catch((e) => console.error("[tick] completion email error:", e));
    }

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  // Deduct 1 minute
  const newMinutesUsed   = Number(session.minutes_used) + 1;
  const remaining        = balanceBefore - 1;

  // Auto-complete when balance hits zero.
  // Optimistic lock on minutes_used prevents a concurrent tick from also
  // completing the session and double-crediting the consultant.
  // consultant_credited is intentionally NOT written here — written inside
  // creditConsultant() ONLY after wallet is actually credited.
  if (remaining <= 0) {
    // Wall-clock reconciliation (P1-5) — see pathC's identical comment above.
    const wallClockMin = session.started_at
      ? Math.ceil((Date.parse(now) - Date.parse(session.started_at as string)) / 60_000)
      : newMinutesUsed;
    const billableMin  = Math.min(newMinutesUsed, Math.max(wallClockMin, 0));
    if (billableMin !== newMinutesUsed) {
      console.warn(
        `[tick/pathB] wall-clock reconciliation: capped billed minutes ${newMinutesUsed} -> ${billableMin} ` +
        `(wall-clock elapsed ${wallClockMin}min) session:`, sessionId,
      );
    }
    const split = splitSessionEarnings(billableMin, ratePerMin);
    const { data: completedRows, error: pathBErr } = await supabase
      .from("connect_sessions")
      .update({
        status:         "completed",
        ended_at:       now,
        minutes_used:   newMinutesUsed,
        amount_charged: split.amountCharged,
        platform_fee:   split.platformFee,
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
      await creditConsultant(supabase, session.consultant_id, split.consultantCredited, sessionId);
      void sendCompletionEmails(supabase, {
        sessionId,
        userId:        session.user_id,
        consultantId:  session.consultant_id,
        minutesUsed:   billableMin,
        split,
        currency:      session.currency_code ?? "INR",
      }).catch((e) => console.error("[tick] completion email error:", e));
    }

    return NextResponse.json({ ok: true, status: "completed", remaining_minutes: 0 });
  }

  // Ongoing (non-completing) tick — bill exactly what's ticked, no wall-clock cap.
  // Reconciliation only applies at completion (P1-5's stated scope); mid-session
  // the client still needs minutes_used to track its own remaining balance display.
  // platform_fee/consultant_credited aren't written here — only at completion —
  // so only amountCharged from the split is needed on this path.
  const { amountCharged: newAmountCharged } = splitSessionEarnings(newMinutesUsed, ratePerMin);

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
    split:        MoneySplit;
    currency:     string;
  }
) {
  try {
    const totalCharged   = data.split.amountCharged;
    const earnedAmount   = data.split.consultantCredited;
    const platformFee    = data.split.platformFee;

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
// earnings: computed by the caller via splitSessionEarnings() — see src/lib/connect/money.ts.
// Not recomputed here so this is never a second, independently-drifting copy of the split.
async function creditConsultant(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  consultantId: string,
  earnings: number,
  sessionId: string,
) {
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, sessions_completed")
    .eq("id", consultantId)
    .single();

  if (!consultant) return;

  // Durable credit: writes an earnings-ledger row before attempting anything,
  // so a transient failure here (wallet upsert or the earnings RPC) no
  // longer silently, permanently loses the consultant's earnings — the
  // settlement cron (connect-settle-earnings) retries any unsettled ledger
  // row indefinitely until it succeeds. Previously this was a bare
  // console.error with no recovery path — see [[code_review_audit_2026_08_14]].
  // Writes consultant_credited on the session row and increments
  // sessions_completed internally on success; nothing more to do for those
  // here regardless of outcome.
  await creditConsultantDurably({
    supabase,
    sessionId,
    consultantId: consultant.id,
    consultantUserId: consultant.user_id,
    earnings,
    logTag: "[tick/creditConsultant]",
  });

  // Clear is_busy so the consultant can accept new sessions, regardless of
  // whether the credit attempt above succeeded — a failed credit will be
  // retried by the settlement cron; the consultant shouldn't also be locked
  // out of new work while that's pending.
  await supabase.from("connect_consultants").update({ is_busy: false }).eq("id", consultant.id);
}
