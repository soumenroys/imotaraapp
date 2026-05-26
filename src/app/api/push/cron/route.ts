// src/app/api/push/cron/route.ts
// Called daily at 09:00 UTC by Vercel Cron (see vercel.json).
// Sends a gentle re-engagement nudge ONLY to users who have been inactive
// (no chat_reply event) for at least INACTIVITY_THRESHOLD_MS.
// Active users are skipped entirely to avoid spamming engaged users.
// When the user's last message is available, the nudge body is personalised
// to reference what they last talked about so it feels like Imotara remembers.
//
// Vercel automatically passes Authorization: Bearer <CRON_SECRET> on cron calls.
// Set CRON_SECRET in Vercel env vars to protect this endpoint.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendPushNotification } from "@/lib/imotara/webpush";
import { getNudgeLang, pick } from "@/lib/imotara/nudgeStrings";

// Only nudge users silent for 2+ days; re-notify at most once every 24 h
const INACTIVITY_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours
const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;           // 24 hours between nudges

/** Truncates text to a word boundary and appends "…" if cut. */
function truncateToWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 10 ? cut.slice(0, lastSpace) : cut) + "…";
}

/** Builds a localised nudge payload in the user's preferred language. */
function buildNudge(lastUserMessage?: string, lang?: string): { title: string; body: string } {
  const L = getNudgeLang(lang);
  if (!lastUserMessage) {
    return { title: L.gt, body: pick(L.gb) };
  }
  const snippet = truncateToWord(lastUserMessage.replace(/[.!?,;:]+$/, "").trim(), 50);
  return { title: L.pt, body: pick(L.pb(snippet)) };
}

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
    .select("user_id, value")
    .eq("type", "push")
    .eq("key", "subscription");

  if (error) {
    console.error("[push/cron] fetch error:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!rows?.length) return NextResponse.json({ ok: true, sent: 0 });

  const userIds = rows.map((r) => r.user_id);
  const now = Date.now();
  const inactivityCutoff = new Date(now - INACTIVITY_THRESHOLD_MS).toISOString();

  // Fetch last_notified_at, recent activity, chat messages, and preferred language in parallel
  const [notifiedRes, activityRes, chatRes, langRes] = await Promise.all([
    admin
      .from("user_memory")
      .select("user_id, value")
      .eq("type", "push")
      .eq("key", "last_notified_at")
      .in("user_id", userIds),

    // Any chat_reply event after the cutoff means the user is still active — skip them
    admin
      .from("usage_events")
      .select("user_id, created_at")
      .eq("event_type", "chat_reply")
      .in("user_id", userIds)
      .gte("created_at", inactivityCutoff),

    // Fetch recent user messages so we can personalise the nudge body.
    // user_scope in imotara_chat_messages == user_id from auth.
    admin
      .from("imotara_chat_messages")
      .select("user_scope, content, created_at")
      .in("user_scope", userIds)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(userIds.length * 3),

    // Preferred language stored by /api/profile/sync as type="identity", key="preferred_lang"
    admin
      .from("user_memory")
      .select("user_id, value")
      .eq("type", "identity")
      .eq("key", "preferred_lang")
      .in("user_id", userIds),
  ]);

  const lastNotifiedMap = new Map(
    (notifiedRes.data ?? []).map((r) => [r.user_id, new Date(r.value).getTime()]),
  );

  // Build set of users who chatted recently (i.e. active — skip them)
  const activeUserIds = new Set(
    (activityRes.data ?? []).map((r) => r.user_id),
  );

  // Most recent user message per user_scope (already DESC-ordered by created_at)
  const lastMessageMap = new Map<string, string>();
  for (const msg of (chatRes.data ?? [])) {
    if (!lastMessageMap.has(msg.user_scope) && msg.content?.trim()) {
      lastMessageMap.set(msg.user_scope, msg.content.trim());
    }
  }

  // Preferred language per user (e.g. "hi", "bn", "ta")
  const langMap = new Map(
    (langRes.data ?? []).map((r) => [r.user_id, r.value as string]),
  );

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      // Skip active users — they don't need a re-engagement nudge
      if (activeUserIds.has(row.user_id)) return;

      // Skip if we already sent a nudge within the cooldown window
      const lastNotified = lastNotifiedMap.get(row.user_id) ?? 0;
      if (now - lastNotified < NUDGE_COOLDOWN_MS) return;

      let sub: any;
      try { sub = JSON.parse(row.value); } catch { return; }

      const lastUserMessage = lastMessageMap.get(row.user_id);
      const lang = langMap.get(row.user_id);
      const nudge = buildNudge(lastUserMessage, lang);

      const result = await sendPushNotification(sub, {
        ...nudge,
        icon: "/android-chrome-192.png",
        url: "/chat",
      });

      if (result.ok) {
        sent++;
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
