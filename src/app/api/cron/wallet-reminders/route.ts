export const preferredRegion = ["sin1"];
export const maxDuration = 60;

// GET /api/cron/wallet-reminders
// Vercel Cron — runs daily at 08:00 IST (02:30 UTC).
//
// Sends 6 milestone reminder emails before wallet expiry:
//   180 days → 90 days → 30 days → 14 days → 7 days → 1 day
//
// Also sends annual balance statements once per year to all active wallets.
//
// Each milestone is tracked in a dedicated column on imotara_wallets to
// prevent duplicate sends even if the cron runs multiple times in a day.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendWalletNotification, type NotificationType } from "@/lib/wallet/mailer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Each entry: [days_before_expiry, column_on_wallets_table, notification_type]
const MILESTONES: [number, string, NotificationType][] = [
  [180, "notified_180d_at", "180d_warning"],
  [90,  "notified_90d_at",  "90d_warning"],
  [30,  "notified_30d_at",  "30d_warning"],
  [14,  "notified_14d_at",  "14d_warning"],
  [7,   "notified_7d_at",   "7d_warning"],
  [1,   "notified_1d_at",   "1d_warning"],
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now      = new Date();
  const results: Record<string, number> = {};

  // ── Milestone reminders ───────────────────────────────────────────────────
  for (const [days, col, type] of MILESTONES) {
    // Window: expires_at between (now + days - 1 day) and (now + days + 1 day)
    // This gives a 2-day window so a missed cron day still fires.
    const windowStart = new Date(now.getTime() + (days - 1) * 86_400_000).toISOString();
    const windowEnd   = new Date(now.getTime() + (days + 1) * 86_400_000).toISOString();

    const { data: wallets } = await supabase
      .from("imotara_wallets")
      .select("user_id, balance, expires_at")
      .eq("status", "active")
      .gt("balance", 0)
      .gte("expires_at", windowStart)
      .lte("expires_at", windowEnd)
      .is(col, null); // not yet notified for this milestone

    if (!wallets || wallets.length === 0) { results[type] = 0; continue; }

    let sent = 0;
    for (const w of (wallets as Array<{ user_id: string; balance: number; expires_at: string }>) ) {
      const { data: { user } } = await supabase.auth.admin.getUserById(w.user_id);
      if (!user?.email) continue;

      await sendWalletNotification({
        userId:    w.user_id,
        email:     user.email,
        type,
        balance:   Number(w.balance),
        expiresAt: w.expires_at,
      });

      // Mark this milestone as done
      await supabase.from("imotara_wallets").update({ [col]: now.toISOString() }).eq("user_id", w.user_id);
      sent++;
    }
    results[type] = sent;
  }

  // ── Annual balance statement ──────────────────────────────────────────────
  // Send once per year to all active wallets with a positive balance.
  const oneYearAgo = new Date(now.getTime() - 365 * 86_400_000).toISOString();

  const { data: annualWallets } = await supabase
    .from("imotara_wallets")
    .select("user_id, balance, expires_at, annual_statement_sent_at")
    .eq("status", "active")
    .gt("balance", 0)
    .or(`annual_statement_sent_at.is.null,annual_statement_sent_at.lt.${oneYearAgo}`);

  let annualSent = 0;
  for (const w of annualWallets ?? []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(w.user_id);
    if (!user?.email) continue;

    await sendWalletNotification({
      userId:    w.user_id,
      email:     user.email,
      type:      "annual_statement",
      balance:   Number(w.balance),
      expiresAt: w.expires_at,
    });

    await supabase.from("imotara_wallets")
      .update({ annual_statement_sent_at: now.toISOString() })
      .eq("user_id", w.user_id);

    annualSent++;
  }
  results["annual_statement"] = annualSent;

  console.log("[wallet-reminders] results:", results);
  return NextResponse.json({ ok: true, results });
}
