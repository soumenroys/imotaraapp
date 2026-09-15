// src/app/api/admin/analytics/route.ts
// GET /api/admin/analytics?days=30 — product activity, computed from our own
// usage_events table. No third-party analytics service is involved, which is
// the entire point: Imotara's store declarations and its in-app copy both say
// there is no analytics SDK, and that stays true.
//
// What this can and cannot tell you is worth being clear about up front:
//
//   CAN   how many people used the product, on which surface, doing what,
//         whether they came back, and what they were feeling.
//   CANNOT where they came from, what they clicked, or how long they stayed.
//         usage_events is written by four API routes at the moment something
//         costly happens (a cloud reply, a TTS render, a transcription, a
//         settings search). It is a quota ledger that we are reading as a
//         product signal — not a clickstream, and it should not become one.

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { ClientPlatform } from "@/lib/imotara/clientPlatform";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE   = 1000;   // Supabase's own per-request ceiling
const MAX_ROWS = 200_000;

type Row = {
  user_id:    string;
  event_type: string | null;
  emotion:    string | null;
  platform:   string | null;
  created_at: string;
};

/**
 * Read every row in a range.
 *
 * supabase-js silently returns AT MOST 1000 rows. Not an error — just a short
 * array, which then aggregates into numbers that look plausible and are wrong,
 * and get quietly wronger as the product grows. So page explicitly, and report
 * truncation rather than hiding it.
 */
async function readAll(
  from: string,
  to: string,
  withPlatform: boolean,
): Promise<{ rows: Row[]; truncated: boolean }> {
  const admin  = getSupabaseAdmin();
  const cols   = `user_id, event_type, emotion, created_at${withPlatform ? ", platform" : ""}`;
  const rows: Row[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await admin
      .from("usage_events")
      .select(cols)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** Every user_id that has an event strictly before `before`. */
async function usersSeenBefore(before: string): Promise<Set<string>> {
  const admin = getSupabaseAdmin();
  const seen  = new Set<string>();

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await admin
      .from("usage_events")
      .select("user_id")
      .lt("created_at", before)
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    const batch = data ?? [];
    batch.forEach((r) => seen.add((r as { user_id: string }).user_id));
    if (batch.length < PAGE) break;
  }
  return seen;
}

const dayKey = (iso: string) => iso.slice(0, 10);

function normPlatform(p: string | null): ClientPlatform {
  return p === "web" || p === "ios" || p === "android" ? p : "unknown";
}

export async function GET(req: NextRequest) {
  if (!(await adminAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10) || 30));
  const now  = Date.now();
  // Bucket by UTC day. usage_events.created_at is timestamptz, and the free
  // quota already resets at midnight UTC, so UTC keeps the dashboard and the
  // quota telling the same story about what "today" means.
  const toISO   = new Date(now).toISOString();
  const fromISO = new Date(now - days * DAY_MS).toISOString();

  // The platform column may not exist yet (docs/sql/usage_events_platform.sql
  // is run by hand in the Supabase SQL editor). Degrade to the platform-less
  // shape rather than 500-ing the whole page on a missing column.
  let rows: Row[] = [];
  let truncated = false;
  let platformReady = true;
  try {
    ({ rows, truncated } = await readAll(fromISO, toISO, true));
  } catch {
    platformReady = false;
    try {
      ({ rows, truncated } = await readAll(fromISO, toISO, false));
    } catch (e) {
      return NextResponse.json(
        { error: "query failed", detail: String((e as Error)?.message ?? e) },
        { status: 500 },
      );
    }
  }

  // ── Daily series ────────────────────────────────────────────────────────
  const daily = new Map<string, { events: number; users: Set<string>; byPlatform: Record<string, number> }>();
  for (let i = 0; i < days; i++) {
    const k = dayKey(new Date(now - (days - 1 - i) * DAY_MS).toISOString());
    daily.set(k, { events: 0, users: new Set(), byPlatform: { web: 0, ios: 0, android: 0, unknown: 0 } });
  }

  const byEvent    = new Map<string, { events: number; users: Set<string> }>();
  const byPlatform = new Map<string, { events: number; users: Set<string> }>();
  const emotions   = new Map<string, number>();
  const allUsers   = new Set<string>();
  const firstSeen  = new Map<string, string>();   // user → earliest day IN WINDOW

  for (const r of rows) {
    const k  = dayKey(r.created_at);
    const pf = normPlatform(r.platform ?? null);
    const et = r.event_type ?? "unknown";

    const d = daily.get(k);
    if (d) { d.events++; d.users.add(r.user_id); d.byPlatform[pf]++; }

    if (!byEvent.has(et))    byEvent.set(et, { events: 0, users: new Set() });
    byEvent.get(et)!.events++; byEvent.get(et)!.users.add(r.user_id);

    if (!byPlatform.has(pf)) byPlatform.set(pf, { events: 0, users: new Set() });
    byPlatform.get(pf)!.events++; byPlatform.get(pf)!.users.add(r.user_id);

    if (r.emotion) emotions.set(r.emotion, (emotions.get(r.emotion) ?? 0) + 1);

    allUsers.add(r.user_id);
    const prev = firstSeen.get(r.user_id);
    if (!prev || k < prev) firstSeen.set(r.user_id, k);
  }

  // ── New vs returning ────────────────────────────────────────────────────
  // "New" means no event EVER before the window — not merely none inside it.
  // Without the second query a long-standing user who happened to be quiet
  // last month would be counted as a new signup, which would make retention
  // look better than it is.
  const priorUsers  = await usersSeenBefore(fromISO);
  const newUserIds  = [...allUsers].filter((u) => !priorUsers.has(u));
  const newUsers    = new Set(newUserIds);

  // ── Retention: of the people who arrived on day X, how many came back? ───
  // Only cohorts old enough to have HAD the chance to return are reported;
  // a cohort from yesterday cannot have a D7 number, and showing it as 0%
  // would read as churn rather than as "too early to say".
  const activeDays = new Map<string, Set<string>>();   // user → set of active day keys
  for (const r of rows) {
    if (!activeDays.has(r.user_id)) activeDays.set(r.user_id, new Set());
    activeDays.get(r.user_id)!.add(dayKey(r.created_at));
  }

  const cohorts = new Map<string, string[]>();
  for (const u of newUsers) {
    const c = firstSeen.get(u)!;
    if (!cohorts.has(c)) cohorts.set(c, []);
    cohorts.get(c)!.push(u);
  }

  const todayKey = dayKey(toISO);
  const retention = [...cohorts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortDate, members]) => {
      const base = Date.parse(`${cohortDate}T00:00:00Z`);
      const age  = Math.floor((Date.parse(`${todayKey}T00:00:00Z`) - base) / DAY_MS);
      const back = (n: number) => {
        if (age < n) return null;                        // not old enough to know
        const target = dayKey(new Date(base + n * DAY_MS).toISOString());
        return members.filter((u) => activeDays.get(u)?.has(target)).length;
      };
      return { cohortDate, size: members.length, d1: back(1), d7: back(7), d30: back(30) };
    });

  // ── Rolling active users ────────────────────────────────────────────────
  const activeSince = (n: number) => {
    const cut = new Date(now - n * DAY_MS).toISOString();
    const s = new Set<string>();
    for (const r of rows) if (r.created_at >= cut) s.add(r.user_id);
    return s.size;
  };

  const series = [...daily.entries()].map(([date, d]) => ({
    date,
    events:      d.events,
    activeUsers: d.users.size,
    byPlatform:  d.byPlatform,
  }));

  const shape = (m: Map<string, { events: number; users: Set<string> }>) =>
    [...m.entries()]
      .map(([key, v]) => ({ key, events: v.events, users: v.users.size }))
      .sort((a, b) => b.events - a.events);

  return NextResponse.json({
    range:   { days, from: fromISO, to: toISO },
    totals:  {
      events:        rows.length,
      activeUsers:   allUsers.size,
      newUsers:      newUsers.size,
      returningUsers: allUsers.size - newUsers.size,
    },
    rolling: { dau: activeSince(1), wau: activeSince(7), mau: activeSince(30) },
    series,
    byEventType: shape(byEvent),
    byPlatform:  shape(byPlatform),
    emotions:    [...emotions.entries()].map(([emotion, count]) => ({ emotion, count }))
                   .sort((a, b) => b.count - a.count).slice(0, 12),
    retention:   retention.slice(-30),
    meta: {
      platformReady,
      truncated,
      note: platformReady
        ? "Events before the platform migration report as 'unknown'."
        : "Run docs/sql/usage_events_platform.sql to split web from app.",
    },
  });
}
