// src/app/api/push/subscribe/route.ts
// POST — save a push subscription for the authenticated user
// DELETE — remove the subscription

import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { PUSH_REMINDERS_TABLE } from "@/lib/reminders/snooze";

async function getAuthedUserId(req: Request): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (bearerToken) {
    const { data } = await admin.auth.getUser(bearerToken);
    if (data?.user?.id) return data.user.id;
  }
  try {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch { /* no session */ }
  return null;
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let subscription: any;
  try {
    subscription = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // ⛔ Capture the timezone HERE, not only in Settings.
  //
  // The daily check-in is sent by an hourly cron that fires at the person's own
  // local hour. With no timezone it falls back to the same hour in UTC — and
  // the default hour is 20:00, which is 01:30 in India. Collecting it only in
  // Settings would have woken every existing subscriber who never opens that
  // page, in the middle of the night, in the main market.
  //
  // Anyone who can RECEIVE a nudge has subscribed, so this is exactly the right
  // population and the right moment. Validated by asking Intl, because the
  // value is fed straight to Intl.DateTimeFormat in the cron.
  const tz = (() => {
    const raw = typeof subscription.timeZone === "string" ? subscription.timeZone.trim() : "";
    if (!raw || raw.length > 64) return null;
    try {
      new Intl.DateTimeFormat("en", { timeZone: raw }).format(new Date());
      return raw;
    } catch {
      return null;
    }
  })();

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 🔴 push_reminders, NOT user_memory (25 Oct 2026). user_memory's live
  // constraints rejected every subscription — none was ever saved, so the web
  // check-in never reached anyone — and user_memory is loaded whole into the
  // AI's context. Only the subscription changes here: a snooze or off the
  // person chose earlier stays. ⇒ docs/sql/push_reminders.sql
  const { error } = await admin.from(PUSH_REMINDERS_TABLE).upsert(
    { user_id: userId, subscription, updated_at: now },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[push/subscribe] upsert error:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Best-effort and deliberately not fatal: a missing timezone means an
  // imperfect hour, a failed SUBSCRIPTION means no reminders at all.
  if (tz) {
    const { error: tzErr } = await admin.from("user_memory").upsert(
      // ⚠️ confidence is set because EVERY other write to this table sets it
      // (profile/sync, push/cron). If the column is NOT NULL with no default,
      // omitting it fails the upsert — and this write is deliberately
      // non-fatal, so that failure would be SILENT and we would be right back
      // to nudging people at 01:30.
      {
        user_id: userId,
        type: "identity",
        key: "time_zone",
        value: tz,
        confidence: 0.9, // ⛔ not 1 — see the subscription write above
        updated_at: now,
      },
      { onConflict: "user_id,type,key" },
    );
    if (tzErr) console.error("[push/subscribe] time_zone upsert failed:", tzErr.message);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  // Forget the subscription; keep the person's snooze/off choice.
  await admin
    .from(PUSH_REMINDERS_TABLE)
    .update({ subscription: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
