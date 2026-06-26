export const preferredRegion = ["sin1"];

// GET /api/connect/consultant/sessions
// Returns sessions assigned to the authenticated consultant.
// Query params: ?status=pending|active|history|all (default: pending+active)
// history → completed+declined+cancelled (last 50)
// Auto-expires pending sessions older than 5 minutes on every call.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Resolve consultant id from authenticated user
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id")
    .eq("user_id", user.id)
    .single();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Not a registered consultant" }, { status: 403 });
  }

  const statusParam = req.nextUrl.searchParams.get("status") ?? "incoming";

  // Cleanup stale sessions whenever the consultant fetches their session list.
  if (statusParam !== "history") {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Auto-expire pending sessions with no response for 5+ minutes.
    await supabase
      .from("connect_sessions")
      .update({ status: "cancelled" })
      .eq("consultant_id", consultant.id)
      .eq("status", "pending")
      .lt("created_at", fiveMinutesAgo);

    // Auto-complete active sessions whose client has disconnected (no billing tick for 5+ min).
    // last_tick_at is set by the tick endpoint; null means the session went active but never
    // received a tick — use started_at as the staleness reference in that case.
    // Only auto-complete sessions that have stalled after ticking, OR instant sessions that
    // never received a tick. Scheduled sessions that were just accepted (status=active, no
    // tick yet) must NOT be killed — the actual meeting may not start for hours.
    const { data: staleSessions } = await supabase
      .from("connect_sessions")
      .select("id, user_id, consultant_id, minutes_used, rate_per_min, amount_charged, translation_enabled, user_lang, consultant_lang, currency_code")
      .eq("consultant_id", consultant.id)
      .eq("status", "active")
      .or(`last_tick_at.lt.${fiveMinutesAgo},and(last_tick_at.is.null,started_at.lt.${fiveMinutesAgo},type.eq.instant)`);

    if (staleSessions && staleSessions.length > 0) {
      const now = new Date().toISOString();
      for (const stale of staleSessions) {
        // Atomic guard: only credit if THIS request wins the status transition.
        // If another process (tick, orphan cron) already completed it, we skip.
        // RETURNING minutes_used gives us the DB's actual value at lock time — a tick
        // may have incremented it between our SELECT (line 52) and this UPDATE.
        const { data: wonRows } = await supabase
          .from("connect_sessions")
          .update({ status: "completed", ended_at: now })
          .eq("id", stale.id)
          .eq("status", "active")
          .select("id, minutes_used");

        if (!wonRows || wonRows.length === 0) continue; // another process already handled it

        // Use the locked minutes_used from RETURNING, not the pre-read stale value.
        const freshMinutes = Number(wonRows[0].minutes_used ?? stale.minutes_used);

        // Credit consultant for minutes already consumed before client disconnected.
        // Mirrors the 80/20 split in sessions/[id]/route.ts and orphan cron:
        // attempt wallet ops FIRST, write consultant_credited ONLY on success.
        if (freshMinutes > 0 && Number(stale.rate_per_min) > 0) {
          const lockedRate      = Number(stale.rate_per_min);
          const sessionEarnings = freshMinutes * lockedRate * 0.80;
          const amountCharged   = freshMinutes * lockedRate;

          const { error: walletErr } = await supabase.from("connect_wallet")
            .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });

          if (walletErr) {
            console.error("[stale-complete] CRITICAL: wallet upsert failed — earnings not credited:", walletErr.message, "session:", stale.id);
            await supabase.from("connect_sessions")
              .update({ amount_charged: amountCharged, platform_fee: +(amountCharged * 0.20).toFixed(4) })
              .eq("id", stale.id)
              .or("amount_charged.is.null,amount_charged.eq.0");
            continue;
          }

          const { error: rpcErr } = await supabase.rpc("increment_wallet_earnings", {
            p_user_id: consultant.user_id,
            p_amount:  sessionEarnings,
          });

          if (rpcErr) {
            console.error("[stale-complete] CRITICAL: increment_wallet_earnings failed:", rpcErr.message, "session:", stale.id, "— consultant_credited NOT written");
            await supabase.from("connect_sessions")
              .update({ amount_charged: amountCharged, platform_fee: +(amountCharged * 0.20).toFixed(4) })
              .eq("id", stale.id)
              .or("amount_charged.is.null,amount_charged.eq.0");
            continue;
          }

          // Both wallet ops succeeded — write all three receipt columns.
          await supabase.from("connect_sessions")
            .update({
              amount_charged:      amountCharged,
              platform_fee:        +(amountCharged * 0.20).toFixed(4),
              consultant_credited: +sessionEarnings.toFixed(4),
            })
            .eq("id", stale.id)
            .or("amount_charged.is.null,amount_charged.eq.0,consultant_credited.is.null");

          const { error: rpcScErr } = await supabase.rpc("increment_sessions_completed", { p_consultant_id: stale.consultant_id });
          if (rpcScErr) {
            // Do NOT fall back to read-modify-write — concurrent runs would each read the same
            // stale value and produce a lost update. Log CRITICAL for manual correction.
            console.error("[stale-complete] CRITICAL: increment_sessions_completed RPC failed — sessions_completed NOT incremented. Manual correction needed. Error:", rpcScErr.message, "session:", stale.id, "consultant:", stale.consultant_id);
          }
        }
      }
      // Only clear is_busy when no active sessions remain — guards against incorrectly
      // clearing it when another process (tick, cron) still holds a legitimately active
      // session and all our atomic wins above were already claimed by that other process.
      const { count: remainingActive } = await supabase
        .from("connect_sessions")
        .select("id", { count: "exact", head: true })
        .eq("consultant_id", consultant.id)
        .eq("status", "active");
      if ((remainingActive ?? 0) === 0) {
        await supabase.from("connect_consultants").update({ is_busy: false }).eq("id", consultant.id);
      }
    }
  }

  const statusFilter =
    statusParam === "all"
      ? ["pending", "active", "completed", "declined", "cancelled"]
      : statusParam === "history"
      ? ["completed", "declined", "cancelled"]
      : statusParam === "active"
      ? ["active"]
      : ["pending", "active"]; // default: actionable sessions

  const { data, error } = await supabase
    .from("connect_sessions")
    .select(
      "id, user_id, type, status, scheduled_note, scheduled_at, started_at, ended_at, " +
      "minutes_used, rate_per_min, amount_charged, rating, review_text, created_at, " +
      "translation_enabled, user_lang, consultant_lang, currency_code"
    )
    .eq("consultant_id", consultant.id)
    .in("status", statusFilter)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[consultant/sessions/GET] query error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not load sessions. Please try again." }, { status: 500 });
  }

  type SessionRow = {
    id: string; user_id: string; type: string; status: string;
    scheduled_note: string | null; scheduled_at: string | null;
    started_at: string | null; ended_at: string | null;
    minutes_used: number; rating: number | null;
    review_text: string | null; created_at: string;
  };

  // Enrich pending/active sessions with minimal user profile for preview card
  const sessions = (data ?? []) as unknown as SessionRow[];
  const previewUserIds = sessions
    .filter((s) => s.status === "pending" || s.status === "active")
    .map((s) => s.user_id);

  // Expose only non-sensitive display fields to the consultant — email is never shared.
  const userPreviewMap: Record<string, { display_name: string | null; photo_url: string | null }> = {};
  if (previewUserIds.length > 0) {
    for (const uid of previewUserIds) {
      try {
        const { data: u } = await supabase.auth.admin.getUserById(uid);
        if (u?.user) {
          const meta = u.user.user_metadata ?? {};
          userPreviewMap[uid] = {
            display_name: meta.full_name ?? meta.display_name ?? meta.name ?? null,
            photo_url:    meta.avatar_url ?? meta.photo_url ?? null,
          };
        }
      } catch { /* non-critical */ }
    }
  }

  // Strip user_id from the response — the raw DB UUID is used only for the preview
  // lookup above and should not be sent to the consultant's client; user_preview
  // contains the only user-identifying fields the consultant needs to see.
  const enriched = sessions.map(({ user_id, ...rest }) => ({
    ...rest,
    user_preview: userPreviewMap[user_id] ?? null,
  }));

  return NextResponse.json({ ok: true, sessions: enriched, consultant_id: consultant.id });
}
