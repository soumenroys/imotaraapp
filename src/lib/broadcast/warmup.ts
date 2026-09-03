// src/lib/broadcast/warmup.ts
// Warm-up ceiling for broadcast sending (BC-06).
//
// imotara.com has only ever sent a trickle of transactional mail. A domain
// that suddenly emits thousands is the classic spam signal, and no amount of
// correct SPF/DKIM/DMARC overrides it — reputation is built by volume that
// grows, not volume that appears.
//
// This is enforced in code rather than left to discipline for a specific
// reason: the sending domain is the ROOT domain, so a single careless
// broadcast does not just hurt marketing, it degrades delivery of password
// resets, Connect session notices and org invites. One bad day would cost
// weeks of recovery on mail that actually matters.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Per-day ceilings by week since the first broadcast send.
// Week 1 is deliberately the same as Resend's free-plan cap, so the ramp and
// the plan agree until there is a reason to upgrade.
const WEEKLY_CAPS = [100, 500, 2000] as const;
const FULL_VOLUME = 50_000; // week 4+; still bounded, so a bug cannot run away

// Optional hard override, e.g. to hold the ramp during an incident.
// Set BROADCAST_DAILY_CAP=0 to stop all sending without touching code.
const OVERRIDE = process.env.BROADCAST_DAILY_CAP;

export type Budget = {
  week: number;          // 1-based; 4 means "week 4 or later"
  cap: number;           // messages allowed today
  sentToday: number;
  remaining: number;
  overridden: boolean;
  firstSendAt: string | null;
};

export function capForWeek(week: number): number {
  if (week <= 0) return WEEKLY_CAPS[0];
  return WEEKLY_CAPS[week - 1] ?? FULL_VOLUME;
}

/** Whole weeks elapsed since the first send, 1-based. No sends yet → week 1. */
export function weekSince(firstSendAt: Date | null, now: Date = new Date()): number {
  if (!firstSendAt) return 1;
  const days = Math.floor((now.getTime() - firstSendAt.getTime()) / 86_400_000);
  return Math.floor(days / 7) + 1;
}

/** Start of the current UTC day — the window "sent today" is counted over. */
function startOfUtcDay(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Today's remaining send budget.
 *
 * Both figures are DERIVED — the first-send date and today's count come from
 * broadcast_sends rather than a counter column. A counter would drift the
 * first time a send crashed between incrementing and writing the row, and the
 * drift would be silent and always in the dangerous direction.
 */
export async function getBudget(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Budget> {
  const { data: firstRow } = await supabase
    .from("broadcast_sends")
    .select("sent_at")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstSendAt = firstRow?.sent_at ? new Date(firstRow.sent_at) : null;
  const week = weekSince(firstSendAt, now);

  const { count } = await supabase
    .from("broadcast_sends")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", startOfUtcDay(now));

  const sentToday = count ?? 0;

  const overridden = OVERRIDE !== undefined && OVERRIDE !== "";
  const cap = overridden ? Math.max(0, Number(OVERRIDE) || 0) : capForWeek(week);

  return {
    week,
    cap,
    sentToday,
    remaining: Math.max(0, cap - sentToday),
    overridden,
    firstSendAt: firstSendAt?.toISOString() ?? null,
  };
}
