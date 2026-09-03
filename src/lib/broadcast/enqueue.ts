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

export type SkipReason = "unsubscribed" | "hard_bounce" | "complaint";

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
): Promise<EnqueueResult> {
  const result: EnqueueResult = {
    total: 0, queued: 0, skipped: 0,
    skippedByReason: { unsubscribed: 0, hard_bounce: 0, complaint: 0 },
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

    const rows = emails.map((email) => {
      const reason = suppressed.get(email);
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
): Promise<Omit<EnqueueResult, "total"> & { total: number }> {
  const result = {
    total: 0, queued: 0, skipped: 0,
    skippedByReason: { unsubscribed: 0, hard_bounce: 0, complaint: 0 } as Record<SkipReason, number>,
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

    for (const s of sup ?? []) {
      const reason = s.reason as SkipReason;
      result.skipped++;
      result.skippedByReason[reason] = (result.skippedByReason[reason] ?? 0) + 1;
    }

    result.total += recipients.length;
    result.queued += recipients.length - (sup?.length ?? 0);
    if (recipients.length < PAGE) break;
  }

  return result;
}
