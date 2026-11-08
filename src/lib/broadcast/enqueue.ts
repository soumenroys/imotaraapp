// src/lib/broadcast/enqueue.ts
// Turns a recipient list into a send queue (BC-09).
//
// The important behaviour here is that suppressed addresses are RECORDED AS
// SKIPPED rather than omitted. Dropping them silently would make the review
// screen's arithmetic a mystery — "the list says 52, why did 49 go out?" —
// and would lose the reason. A skipped row answers that question forever.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase caps a select at 1000 rows by default; page at that boundary so a
// list of thousands is never silently truncated to the first page.
const PAGE = 1000;

export type SkipReason = "unsubscribed" | "hard_bounce" | "complaint" | "recently_mailed";

/**
 * 🔑 ONE MAIL PER PERSON PER 7 DAYS, across every list and the outreach mailer
 * (owner, 8 Nov 2026). The same address sits on several lists; each broadcast
 * used to treat its list alone, so one person could get three mails in a week.
 * Skipped WITH a reason, like a suppression, so the review screen still adds up.
 * ⚠️ Needs docs/sql/broadcast_weekly_cap.sql on the live database (new skip_reason).
 */
export const RECENT_DAYS = 7;

/** Addresses that were SENT any broadcast or outreach mail in the last RECENT_DAYS days (excluding this broadcast). */
async function recentlyMailed(
  supabase: SupabaseClient,
  emails: string[],
  excludeBroadcastId: string | null,
  now: Date,
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString();
  let q = supabase
    .from("broadcast_sends")
    .select("email")
    .in("email", emails)
    .eq("status", "sent")
    .gte("sent_at", since);
  if (excludeBroadcastId) q = q.neq("broadcast_id", excludeBroadcastId);
  const { data, error } = await q;
  if (error) throw new Error(`recent-mail lookup failed — ${error.message}`);
  return new Set((data ?? []).map((r) => r.email as string));
}

export type EnqueueResult = {
  total: number;                                  // recipients on the list
  queued: number;                                 // will actually be sent
  skipped: number;
  skippedByReason: Record<SkipReason, number>;
};

/**
 * Build broadcast_sends rows for every recipient of a list.
 *
 * Idempotent: rows are upserted with ignoreDuplicates on the
 * (broadcast_id, email) unique index. That matters because a retry must never
 * reset a row that has already been sent back to 'queued' — which would mail
 * the same person twice.
 */
export async function enqueueBroadcast(
  supabase: SupabaseClient,
  broadcastId: string,
  listId: string,
  now: Date = new Date(),
): Promise<EnqueueResult> {
  const result: EnqueueResult = {
    total: 0, queued: 0, skipped: 0,
    skippedByReason: { unsubscribed: 0, hard_bounce: 0, complaint: 0, recently_mailed: 0 },
  };

  for (let from = 0; ; from += PAGE) {
    const { data: recipients, error } = await supabase
      .from("broadcast_recipients")
      .select("email")
      .eq("list_id", listId)
      .order("email", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`enqueue: recipient page failed — ${error.message}`);
    if (!recipients || recipients.length === 0) break;

    const emails = recipients.map((r) => r.email as string);

    // Suppressions are looked up per page rather than loaded whole. The
    // suppression table grows without bound over the product's life, so
    // pulling all of it to filter one list would get slower every year.
    const { data: sup, error: sErr } = await supabase
      .from("broadcast_suppressions")
      .select("email, reason")
      .in("email", emails);

    if (sErr) throw new Error(`enqueue: suppression lookup failed — ${sErr.message}`);

    const suppressed = new Map<string, SkipReason>(
      (sup ?? []).map((s) => [s.email as string, s.reason as SkipReason]),
    );

    const recent = await recentlyMailed(supabase, emails, broadcastId, now);

    const rows = emails.map((email) => {
      const reason: SkipReason | undefined = suppressed.get(email) ?? (recent.has(email) ? "recently_mailed" : undefined);
      if (reason) {
        result.skipped++;
        result.skippedByReason[reason] = (result.skippedByReason[reason] ?? 0) + 1;
        return { broadcast_id: broadcastId, email, status: "skipped", skip_reason: reason };
      }
      result.queued++;
      return { broadcast_id: broadcastId, email, status: "queued", skip_reason: null };
    });

    const { error: iErr } = await supabase
      .from("broadcast_sends")
      .upsert(rows, { onConflict: "broadcast_id,email", ignoreDuplicates: true });

    if (iErr) throw new Error(`enqueue: insert failed — ${iErr.message}`);

    result.total += recipients.length;
    if (recipients.length < PAGE) break;
  }

  return result;
}

/**
 * What a send WOULD do, without writing anything.
 *
 * The review screen needs this to show "52 on the list, 3 skipped, 49 will
 * receive" before the admin commits. Counting here rather than reusing
 * enqueue() keeps the preview genuinely read-only — a preview that wrote rows
 * would leave a half-built queue behind if the admin changed their mind.
 */
export async function previewEnqueue(
  supabase: SupabaseClient,
  listId: string,
  now: Date = new Date(),
): Promise<Omit<EnqueueResult, "total"> & { total: number }> {
  const result = {
    total: 0, queued: 0, skipped: 0,
    skippedByReason: { unsubscribed: 0, hard_bounce: 0, complaint: 0, recently_mailed: 0 } as Record<SkipReason, number>,
  };

  for (let from = 0; ; from += PAGE) {
    const { data: recipients, error } = await supabase
      .from("broadcast_recipients")
      .select("email")
      .eq("list_id", listId)
      .order("email", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`preview: recipient page failed — ${error.message}`);
    if (!recipients || recipients.length === 0) break;

    const emails = recipients.map((r) => r.email as string);
    const { data: sup, error: sErr } = await supabase
      .from("broadcast_suppressions")
      .select("email, reason")
      .in("email", emails);

    if (sErr) throw new Error(`preview: suppression lookup failed — ${sErr.message}`);

    const supSet = new Set<string>();
    for (const s of sup ?? []) {
      const reason = s.reason as SkipReason;
      supSet.add(s.email as string);
      result.skipped++;
      result.skippedByReason[reason] = (result.skippedByReason[reason] ?? 0) + 1;
    }
    // Same rule as enqueue: a suppression wins, then the 7-day cap.
    const recent = await recentlyMailed(supabase, emails.filter((e) => !supSet.has(e)), null, now);
    result.skipped += recent.size;
    result.skippedByReason.recently_mailed += recent.size;

    result.total += recipients.length;
    result.queued += recipients.length - supSet.size - recent.size;
    if (recipients.length < PAGE) break;
  }

  return result;
}
