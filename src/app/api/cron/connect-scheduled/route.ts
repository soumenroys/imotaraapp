// GET /api/cron/connect-scheduled
// Called by Vercel Cron every hour.
// Auto-cancels pending scheduled sessions whose scheduled_at passed > 2 hours ago.

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: expired, error } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, scheduled_at")
    .eq("status", "pending")
    .eq("type", "scheduled")
    .lt("scheduled_at", cutoff);

  if (error) {
    console.error("[connect-scheduled] query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ ok: true, expired: 0 });
  }

  const now = new Date().toISOString();
  let expiredCount = 0;

  for (const session of expired) {
    const { data: wonRows } = await supabase
      .from("connect_sessions")
      .update({ status: "cancelled", ended_at: now })
      .eq("id", session.id)
      .eq("status", "pending")
      .select("id");

    if (!wonRows || wonRows.length === 0) continue;

    // Notify user — best-effort, non-blocking
    void supabase.auth.admin.getUserById(session.user_id).then(({ data: uAuth }) => {
      const pushToken = uAuth?.user?.user_metadata?.expo_connect_push_token as string | undefined;
      if (!pushToken) return;
      return fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: pushToken,
          sound: "default",
          title: "Session Request Expired",
          body: "Your scheduled session request was not accepted in time. Please book again.",
          data: { session_id: session.id, type: "session_expired" },
        }),
      });
    }).catch(() => {});

    // Notify consultant — best-effort, non-blocking
    void (async () => {
      try {
        const { data: c } = await supabase
          .from("connect_consultants")
          .select("user_id")
          .eq("id", session.consultant_id)
          .single();
        if (!c?.user_id) return;
        const { data: cAuth } = await supabase.auth.admin.getUserById(c.user_id);
        const pushToken = cAuth?.user?.user_metadata?.expo_connect_push_token as string | undefined;
        if (!pushToken) return;
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            to: pushToken,
            sound: "default",
            title: "Scheduled Session Expired",
            body: "A scheduled session request you hadn't accepted has been automatically cancelled.",
            data: { session_id: session.id, type: "session_expired_consultant" },
          }),
        });
      } catch {}
    })();

    expiredCount++;
  }

  console.log(`[connect-scheduled] auto-expired ${expiredCount} unaccepted scheduled session(s)`);
  return NextResponse.json({ ok: true, expired: expiredCount });
}
