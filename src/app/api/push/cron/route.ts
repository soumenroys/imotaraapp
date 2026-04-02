// src/app/api/push/cron/route.ts
// Called daily at 09:00 UTC by Vercel Cron (see vercel.json).
// Sends a gentle check-in nudge to all subscribed users who haven't
// been notified in the last 22 hours.
//
// Vercel automatically passes Authorization: Bearer <CRON_SECRET> on cron calls.
// Set CRON_SECRET in Vercel env vars to protect this endpoint.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendPushNotification } from "@/lib/imotara/webpush";

const NUDGE_INTERVAL_MS = 22 * 60 * 60 * 1000; // 22 hours

const NUDGE_MESSAGES = [
  { title: "How are you feeling today?", body: "Take a moment to check in with yourself." },
  { title: "Your space is waiting 💙", body: "A quiet moment with Imotara can make a difference." },
  { title: "Checking in…", body: "How has your day been so far? Imotara is here." },
  { title: "A gentle reminder", body: "It's a good time to reflect on how you're feeling." },
];

export async function POST(req: Request) {
  // Verify Vercel Cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Fetch all push subscriptions
  const { data: rows, error } = await admin
    .from("user_memory")
    .select("user_id, value, updated_at")
    .eq("type", "push")
    .eq("key", "subscription");

  if (error) {
    console.error("[push/cron] fetch error:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!rows?.length) return NextResponse.json({ ok: true, sent: 0 });

  // Fetch last_notified_at for all these users
  const userIds = rows.map((r) => r.user_id);
  const { data: notifiedRows } = await admin
    .from("user_memory")
    .select("user_id, value")
    .eq("type", "push")
    .eq("key", "last_notified_at")
    .in("user_id", userIds);

  const lastNotifiedMap = new Map(
    (notifiedRows ?? []).map((r) => [r.user_id, new Date(r.value).getTime()]),
  );

  const now = Date.now();
  const nudge = NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      const lastNotified = lastNotifiedMap.get(row.user_id) ?? 0;
      if (now - lastNotified < NUDGE_INTERVAL_MS) return; // already notified recently

      let sub: any;
      try { sub = JSON.parse(row.value); } catch { return; }

      const result = await sendPushNotification(sub, {
        ...nudge,
        icon: "/android-chrome-192.png",
        url: "/chat",
      });

      if (result.ok) {
        sent++;
        // Update last_notified_at
        const { error: upsertErr } = await admin.from("user_memory").upsert(
          {
            user_id: row.user_id,
            type: "push",
            key: "last_notified_at",
            value: new Date().toISOString(),
            confidence: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,type,key" },
        );
        if (upsertErr) console.error("[push/cron] upsert last_notified_at failed:", upsertErr.message);
      } else if (result.gone) {
        stale.push(row.user_id);
      }
    }),
  );

  // Remove stale/expired subscriptions
  if (stale.length) {
    const { error: deleteErr } = await admin
      .from("user_memory")
      .delete()
      .eq("type", "push")
      .in("user_id", stale);
    if (deleteErr) console.error("[push/cron] delete stale subs failed:", deleteErr.message);
  }

  return NextResponse.json({ ok: true, sent, staleRemoved: stale.length });
}
