// GET /api/cron/connect-orphans
// Called by Vercel Cron every 10 minutes. Two jobs, both about sessions that
// got stuck somewhere they cannot leave on their own:
//
//   1. ACTIVE sessions with no tick for > 15 minutes (client crashed, network
//      dropped) — auto-completed, and the consultant credited.
//   2. PENDING INSTANT requests nobody ever accepted — cancelled.
//
// \U0001f534 (2) WAS MISSING ENTIRELY AND NOTHING ELSE COVERED IT. connect-scheduled
// expires pending requests, but only where `type = "scheduled"` and
// `scheduled_at` is in the past — an instant request has a null scheduled_at
// and never matches. This cron only ever looked at `status = "active"`. So an
// instant "talk to me now" that a companion never accepted stayed pending
// FOREVER: the oldest found in production was 63 days old.
//
// \u26a0\ufe0f Three consequences, and the third is how it was found. The person who
// asked sees a request that never resolves. The companion keeps a request they
// can still accept weeks later. And a consultant with any pending session
// cannot be removed — the admin soft-delete refuses with a 409 — so four stale
// rows were blocking the removal of two obvious test accounts from the public
// marketplace.

export const preferredRegion = ["sin1"];
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { creditConsultantDurably } from "@/lib/connect/creditConsultant";
import { splitSessionEarnings } from "@/lib/connect/money";
import { markCronFired } from "@/lib/cron/heartbeat";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  // Protect against unauthenticated calls (Vercel Cron sends this header)
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // 🔵 It fired. Recorded before the work, so a job that crashes
  // half-way still proves Vercel invoked it. Never throws.
  void markCronFired("/api/cron/connect-orphans");

  const supabase = getSupabaseAdmin();

  // Find active sessions with no tick for > 15 minutes
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: orphans, error } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, minutes_used, rate_per_min, started_at, last_tick_at, type")
    .eq("status", "active")
    .or(`last_tick_at.is.null,last_tick_at.lt.${cutoff}`);

  if (error) {
    console.error("[connect-orphans] query error:", error.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  // For sessions that never received a tick:
  // - Skip scheduled sessions — started_at is set at accept time, but the actual call
  //   may not begin for hours. A scheduled session with no tick is legitimately waiting;
  //   killing it prematurely would end a session the consultant accepted in advance.
  // - Kill instant sessions where started_at is set but no tick arrived in > 15 minutes
  //   — the client crashed after session start. Instant sessions tick immediately.
  // - Also require started_at > 15 min ago to avoid false positives on brand-new sessions.
  const trueOrphans = (orphans ?? []).filter((s) => {
    if (s.last_tick_at) return true; // already filtered by cutoff above — had ticks but went silent
    return s.type === "instant" && s.started_at != null && new Date(s.started_at).getTime() < Date.now() - 15 * 60 * 1000;
  });

  if (trueOrphans.length === 0) {
    return NextResponse.json({ ok: true, completed: 0 });
  }

  const now = new Date().toISOString();
  let completed = 0;

  for (const session of trueOrphans) {
    // RETURNING minutes_used gives us the DB's actual value at lock time — a tick may have
    // incremented it between our SELECT (line 25) and this UPDATE.
    const { data: wonRows, error: updateError } = await supabase
      .from("connect_sessions")
      .update({ status: "completed", ended_at: now, last_tick_at: now })
      .eq("id", session.id)
      .eq("status", "active") // guard against concurrent completion
      .select("id, minutes_used");

    // Skip if another process (tick, consultant/sessions cleanup) already completed this session
    if (updateError || !wonRows || wonRows.length === 0) continue;

    // Use the locked minutes_used from RETURNING, not the pre-read stale value.
    const freshMinutes = Number(wonRows[0].minutes_used ?? session.minutes_used);

    // Credit consultant if any minutes were used
    if (freshMinutes > 0) {
      const { data: consultant } = await supabase
        .from("connect_consultants")
        .select("id, user_id, rate_per_min, sessions_completed")
        .eq("id", session.consultant_id)
        .single();

      if (!consultant) {
        // Consultant row missing or inaccessible — still clear busy flag so they
        // are not permanently locked out of accepting new sessions.
        await supabase
          .from("connect_consultants")
          .update({ is_busy: false })
          .eq("id", session.consultant_id);
      } else {
        // Use locked session rate; fall back to current consultant rate.
        // Guard against zero-rate: a rate of 0 produces amountCharged=0 which would
        // pass the amount_charged.eq.0 guard and overwrite any valid non-zero value
        // previously set by a tick. Skip credit entirely when rate is 0.
        const rate = Number(session.rate_per_min) > 0
          ? Number(session.rate_per_min)
          : Number(consultant.rate_per_min);

        if (rate > 0) {
          // Wall-clock reconciliation (P1-5, same rationale as tick/route.ts
          // pathB/pathC): cap billed minutes to what could plausibly have
          // elapsed since started_at, so a client that ticked right at the
          // 55s floor before crashing can't leave an over-billed orphan.
          const wallClockMin = session.started_at
            ? Math.ceil((Date.now() - new Date(session.started_at as string).getTime()) / 60_000)
            : freshMinutes;
          const billableMin = Math.min(freshMinutes, Math.max(wallClockMin, 0));
          if (billableMin !== freshMinutes) {
            console.warn(
              `[connect-orphans] wall-clock reconciliation: capped billed minutes ${freshMinutes} -> ${billableMin} ` +
              `(wall-clock elapsed ${wallClockMin}min) session:`, session.id,
            );
          }
          const split = splitSessionEarnings(billableMin, rate);

          // The user owes this regardless of whether the consultant-credit
          // step below succeeds — write it unconditionally, first.
          await supabase.from("connect_sessions")
            .update({ amount_charged: split.amountCharged, platform_fee: split.platformFee })
            .eq("id", session.id)
            .or("amount_charged.is.null,amount_charged.eq.0");

          // Durable credit: writes an earnings-ledger row before attempting
          // anything, so a transient wallet-upsert or earnings-RPC failure no
          // longer silently, permanently loses the consultant's earnings —
          // the settlement cron (connect-settle-earnings) retries any
          // unsettled ledger row indefinitely until it succeeds. Writes
          // consultant_credited + increments sessions_completed internally
          // on success. Previously this branched into two separate,
          // inconsistent failure paths (wallet-upsert failure skipped the
          // force-close notification and the completed-count entirely;
          // earnings-RPC failure notified and counted) — collapsing both
          // into this one call also fixes that inconsistency: every orphan
          // session now falls through uniformly to the notification +
          // completed++ below, whether or not the credit settled.
          // See [[code_review_audit_2026_08_14]].
          await creditConsultantDurably({
            supabase,
            sessionId: session.id,
            consultantId: consultant.id,
            consultantUserId: consultant.user_id,
            earnings: split.consultantCredited,
            logTag: "[connect-orphans]",
          });
        }

        await supabase
          .from("connect_consultants")
          .update({ is_busy: false })
          .eq("id", consultant.id);
      }
    } else {
      // No minutes used — just clear busy flag
      await supabase
        .from("connect_consultants")
        .update({ is_busy: false })
        .eq("id", session.consultant_id);
    }

    // Notify the user that the session was force-closed (best-effort push, non-blocking)
    void supabase.auth.admin.getUserById(session.user_id).then(({ data: uAuth }) => {
      const pushToken = uAuth?.user?.user_metadata?.expo_connect_push_token as string | undefined;
      if (!pushToken) return;
      return fetch("https://exp.host/--/api/v2/push/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to:    pushToken,
          sound: "default",
          title: "Session Ended",
          body:  "Your session was closed due to inactivity.",
          data:  { session_id: session.id, type: "session_force_closed" },
        }),
      });
    }).catch(() => {});

    completed++;
  }

  /**
   * Pending instant requests nobody answered.
   *
   * \u26a0\ufe0f THIRTY MINUTES, not the two hours a scheduled booking gets. An
   * instant request means "talk to me now" \u2014 somebody who asked half an hour
   * ago and heard nothing has gone. Accepting it at that point would ring a
   * phone for a conversation its owner no longer expects.
   *
   * \u26d4 Nothing is charged and nothing is credited: minutes_used is zero on
   * these by definition, because the session never started.
   */
  const INSTANT_PENDING_TTL_MS = 30 * 60 * 1000;
  const staleRequestCutoff = new Date(Date.now() - INSTANT_PENDING_TTL_MS).toISOString();

  const { data: staleRequests, error: staleErr } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id")
    .eq("status", "pending")
    .eq("type", "instant")
    .lt("created_at", staleRequestCutoff);

  let cancelled = 0;
  if (staleErr) {
    console.error("[connect-orphans] stale pending query error:", staleErr.message);
  } else {
    for (const request of staleRequests ?? []) {
      // \u26a0\ufe0f Guarded on status, exactly like the active path above: a companion
      // may be accepting this request in the same instant.
      const { data: won } = await supabase
        .from("connect_sessions")
        .update({ status: "cancelled", ended_at: new Date().toISOString() })
        .eq("id", request.id)
        .eq("status", "pending")
        .select("id");
      if (!won || won.length === 0) continue;

      // \U0001f511 A companion left flagged busy by a request that never began would be
      // invisible in the marketplace until they noticed and fixed it themselves.
      await supabase.from("connect_consultants").update({ is_busy: false }).eq("id", request.consultant_id);
      cancelled++;
    }
  }

  console.log(
    `[connect-orphans] auto-completed ${completed} orphan session(s), ` +
      `cancelled ${cancelled} unanswered request(s)`,
  );
  return NextResponse.json({ ok: true, completed, cancelled });
}
