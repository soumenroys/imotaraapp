// GET /api/cron/connect-orphans
// Called by Vercel Cron every 10 minutes.
// Auto-completes active sessions that have not received a tick in > 15 minutes
// (client crashed, network dropped, etc.) and credits the consultant.

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  // Protect against unauthenticated calls (Vercel Cron sends this header)
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
      .update({ status: "completed", ended_at: now })
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
          const amountCharged = freshMinutes * rate;
          const earnings = amountCharged * 0.80;

          // Write amount_charged, platform_fee, and consultant_credited.
          // Guard: skip the entire update if path-B/C already wrote all three columns
          // (amount_charged non-zero AND consultant_credited non-null).
          // The OR includes consultant_credited.is.null so that sessions where a
          // path-A tick already wrote amount_charged (but never writes consultant_credited)
          // still receive the fee columns from the orphan cron.
          await supabase.from("connect_sessions")
            .update({
              amount_charged:      amountCharged,
              platform_fee:        +(amountCharged * 0.20).toFixed(4),
              consultant_credited: +earnings.toFixed(4),
            })
            .eq("id", session.id)
            .or("amount_charged.is.null,amount_charged.eq.0,consultant_credited.is.null");

          await supabase
            .from("connect_wallet")
            .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });

          const { error: earningsErr } = await supabase.rpc("increment_wallet_earnings", {
            p_user_id: consultant.user_id,
            p_amount:  earnings,
          });
          if (earningsErr) {
            // Earnings credit failed — clear is_busy so the consultant is not locked out,
            // but do NOT increment sessions_completed. The discrepancy (session completed
            // but no earnings + no count increment) surfaces clearly in the earnings dashboard.
            console.error("[connect-orphans] CRITICAL: increment_wallet_earnings failed:", earningsErr.message, "session:", session.id, "— skipping sessions_completed to keep discrepancy visible");
            await supabase.from("connect_consultants").update({ is_busy: false }).eq("id", consultant.id);
            // Still notify the user that their session was force-closed
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
            continue;
          }
        }

        const { error: scErr } = await supabase.rpc("increment_sessions_completed", {
          p_consultant_id: consultant.id,
        });
        if (scErr) {
          console.warn("[connect-orphans] increment_sessions_completed RPC unavailable, using fallback:", scErr.message);
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

  console.log(`[connect-orphans] auto-completed ${completed} orphan session(s)`);
  return NextResponse.json({ ok: true, completed });
}
