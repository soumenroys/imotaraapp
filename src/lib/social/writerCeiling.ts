// src/lib/social/writerCeiling.ts
// A daily ceiling on how many drafts the social writer may ask the AI for.
//
// 🔑 OWNER, 30 Oct 2026 (option a): measured first — normal use is ~3–9 posts
// a day plus a few rewritten drafts (~15 AI calls, ≈ $0.15). The limits
// already in the queue (≤3 drafts a post, ≤2 posts a run, a back-off on a
// failing slot) still let a broken writer spend ~$5–7 a day across 60 empty
// slots. This stops it at MAX_WRITER_CALLS_PER_DAY and tells the owner once.
//
// ⚠️ Kept in app_settings (no migration). A counter per IST day; a new day
// starts from zero. Read-modify-write is safe enough here: the queue job runs
// once a minute and writes one slot at a time.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const MAX_WRITER_CALLS_PER_DAY = 60;
/** The most one post can cost: the pipeline's draft limit. */
export const DRAFTS_PER_POST = 3;
const KEY = "social_writer_calls";

export type CeilingState = { day: string; calls: number; alerted?: boolean };

/** The IST calendar day — the owner's day, so "today" means what he reads in the alert. */
export const istDay = (now: Date) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** Today's count; yesterday's (or none) counts as zero. */
export function today(state: CeilingState | null | undefined, now: Date): CeilingState {
  const day = istDay(now);
  return state && state.day === day ? state : { day, calls: 0 };
}

/** May another post be written — even if it needs every draft it is allowed? */
export function mayWrite(state: CeilingState, max = MAX_WRITER_CALLS_PER_DAY): boolean {
  return state.calls + DRAFTS_PER_POST <= max;
}

/** How many AI calls one attempt at a post cost: the kept draft plus every one thrown away. */
export function draftsUsed(result: { ok: true; post: { rejected: unknown[] } } | { ok: false; rejected: unknown[] }): number {
  return result.ok ? 1 + result.post.rejected.length : Math.max(1, result.rejected.length);
}

export async function loadCeiling(now = new Date()): Promise<CeilingState> {
  const { data } = await getSupabaseAdmin().from("app_settings").select("value").eq("key", KEY).maybeSingle();
  return today((data?.value as CeilingState | undefined) ?? null, now);
}

export async function saveCeiling(state: CeilingState): Promise<void> {
  await getSupabaseAdmin().from("app_settings").upsert({ key: KEY, value: state, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
