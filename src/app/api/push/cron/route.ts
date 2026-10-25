// src/app/api/push/cron/route.ts
// Called daily at 09:00 UTC by Vercel Cron (see vercel.json).
// Sends a gentle re-engagement nudge ONLY to users who have been inactive
// at the person's own local hour, skipping anyone who already used Imotara
// during their own day. See src/lib/reminders/schedule.ts.
// Active users are skipped entirely to avoid spamming engaged users.
// When the user's last message is available, the nudge body is personalised
// to reference what they last talked about so it feels like Imotara remembers.
//
// 🔴 EXCEPT WHEN THAT CONVERSATION WAS A CRISIS. See buildNudge.
//
// Vercel automatically passes Authorization: Bearer <CRON_SECRET> on cron calls.
// Set CRON_SECRET in Vercel env vars to protect this endpoint.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendPushNotification } from "@/lib/imotara/webpush";
import { getNudgeLang, pick } from "@/lib/imotara/nudgeStrings";
import { isCrisisTier2 } from "@/lib/emotion/keywordMaps";
import { PUSH_REMINDERS_TABLE, isSuppressed } from "@/lib/reminders/snooze";
import { isDueNow, DEFAULT_REMINDER_HOUR } from "@/lib/reminders/schedule";
import { markCronFired } from "@/lib/cron/heartbeat";

// Only nudge users silent for 2+ days; re-notify at most once every 24 h

/** Truncates text to a word boundary and appends "…" if cut. */
export function truncateToWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 10 ? cut.slice(0, lastSpace) : cut) + "…";
}

/**
 * Builds a localised nudge payload in the user's preferred language.
 *
 * 🔴 THE PERSONALISED BODY QUOTES THE PERSON'S OWN WORDS, so it must never
 * quote a crisis.
 *
 * This nudge lands on a LOCK SCREEN, where anyone holding the phone can read
 * it, hours or days after the conversation. A notification saying "Last time
 * you mentioned wanting to end it — how are you now?" is indefensible: it
 * exposes the most private thing someone has ever typed to whoever picks up
 * their phone, and it reopens the subject with no one there to respond.
 *
 * ⚠️ `recentMessages` is the whole fetched window, not just the quoted one.
 * The decision is about the CONVERSATION, not the sentence we happened to pick:
 * someone can say "I want to end it" and then "ok goodnight", and quoting the
 * second while the first sits two messages above it is the same failure.
 *
 * 🔑 THE NUDGE STILL GOES OUT — only the personalisation is dropped. Staying
 * silent would mean the people who most need a gentle "I'm still here" are the
 * only ones who never get one. The generic body ("How are you feeling today?")
 * is warm, carries nothing private, and is safe on any lock screen.
 *
 * ⛔ Do not "improve" this by softening the crisis text instead of dropping it.
 * There is no phrasing of someone's suicidal message that belongs in a push
 * notification.
 */
/**
 * The localised weekday of a conversation, e.g. "বৃহস্পতিবার" for bn.
 *
 * Verified 2026-10-13 that Node's ICU resolves a native weekday for all 22
 * supported languages — including Odia and Malayalam — so there is no English
 * fallback hiding in here. Falls back to the generic nudge if it ever throws.
 */
export function localisedWeekday(at: Date, lang: string | undefined): string | null {
  try {
    const base = String(lang ?? "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
    const w = new Intl.DateTimeFormat(base, { weekday: "long" }).format(at);
    return w && w.trim() ? w : null;
  } catch {
    return null;
  }
}

export function buildNudge(
  lastUserMessage: string | undefined,
  lang: string | undefined,
  recentMessages: string[] = [],
  lastMessageAt?: Date,
): { title: string; body: string } {
  const L = getNudgeLang(lang);
  const generic = { title: L.gt, body: pick(L.gb) };

  if (!lastUserMessage) return generic;

  // isCrisisTier2 is the same detector the in-app crisis card uses, in both
  // repos — 22 languages, explicit suicidal ideation / self-harm / assault /
  // immediate danger. See trap_crisis_card_two_detectors_two_platforms.
  const window = recentMessages.length ? recentMessages : [lastUserMessage];
  if (window.some((m) => isCrisisTier2(m))) return generic;

  // ⛔ The person's own words are NEVER put on a lock screen. Owner decision
  // 2026-10-13: the nudge references WHEN the conversation happened, not WHAT
  // was said. A lock screen is read by whoever picks the phone up, and quoting
  // someone's message about their marriage or their diagnosis can out their use
  // of a mental-health app to the person they are trying to get away from.
  //
  // The weekday is the hook: unmistakable to them, meaningless to a bystander.
  // 🔴 Until 26 Oct 2026 the cron never passed lastMessageAt, so this fell to
  // `new Date()` and named TODAY — "Something from Sunday has stayed with me"
  // on a Sunday, for a conversation on Wednesday. No date ⇒ the generic nudge,
  // never a guessed day.
  if (!lastMessageAt || Number.isNaN(lastMessageAt.getTime())) return generic;
  const day = localisedWeekday(lastMessageAt, lang);
  if (!day) return generic;
  return { title: L.pt, body: pick(L.rb(day)) };
}

// 🔴 GET, NOT POST. **Vercel Cron issues a GET.** This route was declared in
// vercel.json and written as POST in the SAME commit (08cabfe, 2026-04-03), so
// every scheduled invocation for over six months answered **405 Method Not
// Allowed** and the daily push notification NEVER FIRED ONCE.
//
// ⚠️ Nothing caught it. ~3,800 tests were green because they all exercise
// buildNudge/isDueNow/isSuppressed as FUNCTIONS; not one of them asked which
// HTTP verb the handler answers. docs/ARCHITECTURE.md had it right — it
// documents this endpoint as GET — so the docs and the code disagreed and the
// code lost. Measured against production: GET ⇒ 405, while a working cron
// returns 401.
//
// ⛔ Do not "simplify" this back to POST. The auth below is already exactly
// Vercel's documented scheme (Authorization: Bearer ${CRON_SECRET}); it was
// only ever the verb that was wrong.
export async function GET(req: Request) {
  // Verify Vercel Cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 🔵 It fired. Recorded before the work, so a job that crashes
  // half-way still proves Vercel invoked it. Never throws.
  void markCronFired("/api/push/cron");

  const admin = getSupabaseAdmin();

  // Fetch all push subscriptions — with their last-sent time and the person's
  // snooze/off choice, all in one row.
  // 🔴 push_reminders, NOT user_memory (25 Oct 2026): user_memory's live
  // constraints rejected every subscription (none was ever saved), and it is
  // loaded whole into the AI's context. ⇒ docs/sql/push_reminders.sql
  const { data: rows, error } = await admin
    .from(PUSH_REMINDERS_TABLE)
    .select("user_id, subscription, last_notified_at, snoozed_until, disabled")
    .not("subscription", "is", null);

  if (error) {
    console.error("[push/cron] fetch error:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!rows?.length) return NextResponse.json({ ok: true, sent: 0 });

  const userIds = rows.map((r) => r.user_id);
  const now = Date.now();

  // Fetch last_notified_at, recent activity, chat messages, and preferred language in parallel
  const [activityRes, chatRes, langRes, whenRes] = await Promise.all([
    // Recent chat_reply events. ⚠️ The window is wider than the old 48h
    // inactivity cutoff because the daily check-in asks a different question:
    // "did they use Imotara during THEIR day", which needs the timestamp, not a
    // boolean. isDueNow does the local-day comparison.
    admin
      .from("usage_events")
      .select("user_id, created_at")
      .eq("event_type", "chat_reply")
      .in("user_id", userIds)
      .gte("created_at", new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()),

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

    // Timezone and chosen hour, so the nudge lands in the person's own evening
    // rather than at one absolute instant for the whole world.
    admin
      .from("user_memory")
      .select("user_id, key, value")
      .eq("type", "identity")
      .in("key", ["time_zone", "reminder_hour"])
      .in("user_id", userIds),
  ]);

  const lastNotifiedMap = new Map(
    rows.filter((r) => r.last_notified_at).map((r) => [r.user_id, new Date(r.last_notified_at as string).getTime()]),
  );


  // Most recent user message per user_scope (already DESC-ordered by created_at)
  // 🔑 …and the whole fetched window per user, because the crisis decision in
  // buildNudge is about the CONVERSATION, not just the sentence we quote.
  const lastMessageMap = new Map<string, string>();
  // …and WHEN that message was written — the day the nudge names.
  const lastMessageAtMap = new Map<string, Date>();
  const recentMessagesMap = new Map<string, string[]>();
  for (const msg of (chatRes.data ?? [])) {
    const text = msg.content?.trim();
    if (!text) continue;
    if (!lastMessageMap.has(msg.user_scope)) {
      lastMessageMap.set(msg.user_scope, text);
      const at = new Date(msg.created_at);
      if (!Number.isNaN(at.getTime())) lastMessageAtMap.set(msg.user_scope, at);
    }
    const bucket = recentMessagesMap.get(msg.user_scope);
    if (bucket) bucket.push(text);
    else recentMessagesMap.set(msg.user_scope, [text]);
  }

  // Most recent activity per user, as a timestamp — isDueNow needs the instant,
  // not just "was active".
  const lastActiveMap = new Map<string, number>();
  for (const r of (activityRes.data ?? [])) {
    const t = Date.parse(r.created_at);
    if (!Number.isFinite(t)) continue;
    const prev = lastActiveMap.get(r.user_id) ?? 0;
    if (t > prev) lastActiveMap.set(r.user_id, t);
  }

  // Timezone and chosen hour per user.
  const tzMap = new Map<string, string>();
  const hourMap = new Map<string, number>();
  for (const r of (whenRes.data ?? [])) {
    if (r.key === "time_zone" && typeof r.value === "string") {
      tzMap.set(r.user_id, r.value);
    } else if (r.key === "reminder_hour") {
      const h = Number.parseInt(String(r.value), 10);
      if (Number.isFinite(h) && h >= 0 && h <= 23) hourMap.set(r.user_id, h);
    }
  }

  // Suppression state per user: an active snooze, or a paid user's permanent off.
  // ⛔ Snooze and permanent-off MUST be enforced here. The nudge is a server
  // push, so a client-side flag cannot stop it — the person would tap
  // "snooze", see nothing change, and rightly conclude the control is fake.
  const snoozedUntilMap = new Map<string, string>();
  const disabledSet = new Set<string>();
  for (const r of rows) {
    if (typeof r.snoozed_until === "string") snoozedUntilMap.set(r.user_id, r.snoozed_until);
    if (r.disabled) disabledSet.add(r.user_id);
  }

  // Preferred language per user (e.g. "hi", "bn", "ta")
  const langMap = new Map(
    (langRes.data ?? []).map((r) => [r.user_id, r.value as string]),
  );

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      // ⛔ Snoozed or switched off: skip before anything else. This is the
      // only place the person's choice is actually enforced.
      if (isSuppressed(
        snoozedUntilMap.get(row.user_id),
        disabledSet.has(row.user_id),
        new Date(now),
      )) return;

      // Is it this person's hour, have they been quiet today, and were they
      // left alone since yesterday? One decision, tested in isolation — see
      // src/lib/reminders/schedule.ts.
      if (!isDueNow({
        now: new Date(now),
        timeZone: tzMap.get(row.user_id) ?? null,
        preferredHour: hourMap.get(row.user_id) ?? DEFAULT_REMINDER_HOUR,
        lastNotifiedMs: lastNotifiedMap.get(row.user_id) ?? null,
        lastActiveMs: lastActiveMap.get(row.user_id) ?? null,
      })) return;

      // jsonb comes back as an object; a string is tolerated, never trusted blindly.
      let sub: any = row.subscription;
      if (typeof sub === "string") { try { sub = JSON.parse(sub); } catch { return; } }

      const lastUserMessage = lastMessageMap.get(row.user_id);
      const lang = langMap.get(row.user_id);
      const nudge = buildNudge(
        lastUserMessage, lang, recentMessagesMap.get(row.user_id) ?? [],
        lastMessageAtMap.get(row.user_id),
      );

      const result = await sendPushNotification(sub, {
        ...nudge,
        icon: "/android-chrome-192.png",
        url: "/chat",
      });

      if (result.ok) {
        sent++;
        const { error: upsertErr } = await admin
          .from(PUSH_REMINDERS_TABLE)
          .update({ last_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("user_id", row.user_id);
        if (upsertErr) console.error("[push/cron] upsert last_notified_at failed:", upsertErr.message);
      } else if (result.gone) {
        stale.push(row.user_id);
      }
    }),
  );

  // Remove stale/expired subscriptions
  if (stale.length) {
    // The push service said this subscription is gone: forget it, but keep the
    // person's snooze/off choice for when they subscribe again.
    const { error: deleteErr } = await admin
      .from(PUSH_REMINDERS_TABLE)
      .update({ subscription: null, updated_at: new Date().toISOString() })
      .in("user_id", stale);
    if (deleteErr) console.error("[push/cron] delete stale subs failed:", deleteErr.message);
  }

  return NextResponse.json({ ok: true, sent, staleRemoved: stale.length });
}
