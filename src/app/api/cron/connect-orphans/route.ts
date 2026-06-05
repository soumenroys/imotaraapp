// GET /api/cron/connect-orphans
// Called by Vercel Cron every 10 minutes.
// Auto-completes active sessions that have not received a tick in > 15 minutes
// (client crashed, network dropped, etc.) and credits the consultant.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  // Protect against unauthenticated calls (Vercel Cron sends this header)
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Find active sessions with no tick for > 15 minutes
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: orphans, error } = await supabase
    .from("connect_sessions")
    .select("id, consultant_id, minutes_used, rate_per_min, started_at, last_tick_at")
    .eq("status", "active")
    .or(`last_tick_at.is.null,last_tick_at.lt.${cutoff}`);

  if (error) {
    console.error("[connect-orphans] query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // For sessions that never received a tick, also require started_at > 15 min ago
  const trueOrphans = (orphans ?? []).filter((s) => {
    if (s.last_tick_at) return true; // already filtered by cutoff above
    return new Date(s.started_at).getTime() < Date.now() - 15 * 60 * 1000;
  });

  if (trueOrphans.length === 0) {
    return NextResponse.json({ ok: true, completed: 0 });
  }

  const now = new Date().toISOString();
  let completed = 0;

  for (const session of trueOrphans) {
    const { error: updateError } = await supabase
      .from("connect_sessions")
      .update({ status: "completed", ended_at: now })
      .eq("id", session.id)
      .eq("status", "active"); // guard against concurrent completion

    if (updateError) continue;

    // Credit consultant if any minutes were used
    if (Number(session.minutes_used) > 0) {
      const { data: consultant } = await supabase
        .from("connect_consultants")
        .select("id, user_id, rate_per_min, sessions_completed")
        .eq("id", session.consultant_id)
        .single();

      if (consultant) {
        // Use locked session rate; fall back to current rate
        const rate = Number(session.rate_per_min) > 0
          ? Number(session.rate_per_min)
          : Number(consultant.rate_per_min);
        const earnings = Number(session.minutes_used) * rate * 0.80;

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
            earned_amount: (Number(wallet?.earned_amount ?? 0) + earnings),
            updated_at:    now,
          })
          .eq("user_id", consultant.user_id);

        await supabase
          .from("connect_consultants")
          .update({
            sessions_completed: (consultant.sessions_completed ?? 0) + 1,
            is_busy: false,
          })
          .eq("id", consultant.id);
      }
    } else {
      // No minutes used — just clear busy flag
      await supabase
        .from("connect_consultants")
        .update({ is_busy: false })
        .eq("id", session.consultant_id);
    }

    completed++;
  }

  console.log(`[connect-orphans] auto-completed ${completed} orphan session(s)`);
  return NextResponse.json({ ok: true, completed });
}
