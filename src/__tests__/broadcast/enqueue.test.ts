/**
 * src/__tests__/broadcast/enqueue.test.ts
 *
 * enqueueBroadcast decides who gets mailed. The two ways it can be wrong are
 * both serious and neither is loud:
 *
 *  1. Mailing someone who unsubscribed or hard-bounced. That is a legal
 *     problem under GDPR/PECR, and repeat-mailing a dead address is exactly
 *     what degrades a sender's reputation — the thing the whole warm-up ramp
 *     exists to protect.
 *  2. Silently omitting a suppressed address instead of recording it as
 *     skipped. Then the review screen says "52 on the list" and 49 go out
 *     with no explanation of the gap, and the reason is lost forever.
 *
 * These tests pin both, plus the pagination boundary (Supabase truncates a
 * select at 1000 rows, so a list of thousands would silently lose everyone
 * past the first page) and the idempotency flag (a retry must never reset an
 * already-sent row back to 'queued', which would mail that person twice).
 */

import { describe, it, expect, vi } from "vitest";

type Resp = { data: unknown; error: unknown };

type Upsert = { rows: Record<string, unknown>[]; opts: Record<string, unknown> };

/**
 * Chainable Supabase stub. Every builder method returns the builder, and the
 * builder is thenable — so it works whether the caller ends on .range(), .in()
 * or .upsert(). Upserts are captured rather than scripted, since what gets
 * written IS the thing under test.
 */
function makeSupabase(queues: Record<string, Resp[]>, captured: Upsert[]) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of ["select", "eq", "in", "order", "range", "limit", "not"]) {
        builder[m] = chain;
      }
      builder.upsert = (rows: Record<string, unknown>[], opts: Record<string, unknown>) => {
        captured.push({ rows, opts });
        const ok: Record<string, unknown> = {};
        ok.then = (r: (v: Resp) => void) => r({ data: null, error: null });
        return ok;
      };
      builder.then = (resolve: (v: Resp) => void) =>
        resolve(queues[table]?.shift() ?? { data: [], error: null });
      return builder;
    },
  };
}

const LIST = "11111111-1111-1111-1111-111111111111";
const BCAST = "22222222-2222-2222-2222-222222222222";

async function importEnqueue() {
  vi.resetModules();
  return await import("@/lib/broadcast/enqueue");
}

describe("enqueueBroadcast — suppression handling", () => {
  it("records suppressed addresses as skipped WITH a reason, never omits them", async () => {
    const captured: Upsert[] = [];
    const supabase = makeSupabase(
      {
        broadcast_recipients: [
          { data: [
            { email: "a@example.com" },
            { email: "gone@example.com" },
            { email: "angry@example.com" },
            { email: "b@example.com" },
          ], error: null },
        ],
        broadcast_suppressions: [
          { data: [
            { email: "gone@example.com",  reason: "hard_bounce" },
            { email: "angry@example.com", reason: "complaint" },
          ], error: null },
        ],
      },
      captured,
    );

    const { enqueueBroadcast } = await importEnqueue();
    const r = await enqueueBroadcast(supabase as never, BCAST, LIST);

    expect(r.total).toBe(4);
    expect(r.queued).toBe(2);
    expect(r.skipped).toBe(2);
    expect(r.skippedByReason.hard_bounce).toBe(1);
    expect(r.skippedByReason.complaint).toBe(1);

    // The arithmetic the review screen depends on.
    expect(r.queued + r.skipped).toBe(r.total);

    // Crucially: a row exists for EVERY recipient, including the skipped ones.
    const rows = captured.flatMap((c) => c.rows);
    expect(rows).toHaveLength(4);

    const byEmail = Object.fromEntries(rows.map((x) => [x.email, x]));
    expect(byEmail["gone@example.com"]).toMatchObject({
      status: "skipped", skip_reason: "hard_bounce",
    });
    expect(byEmail["angry@example.com"]).toMatchObject({
      status: "skipped", skip_reason: "complaint",
    });
    expect(byEmail["a@example.com"]).toMatchObject({ status: "queued", skip_reason: null });
    expect(byEmail["b@example.com"]).toMatchObject({ status: "queued", skip_reason: null });
  });

  it("never queues a suppressed address", async () => {
    const captured: Upsert[] = [];
    const supabase = makeSupabase(
      {
        broadcast_recipients: [
          { data: [{ email: "out@example.com" }], error: null },
        ],
        broadcast_suppressions: [
          { data: [{ email: "out@example.com", reason: "unsubscribed" }], error: null },
        ],
      },
      captured,
    );

    const { enqueueBroadcast } = await importEnqueue();
    const r = await enqueueBroadcast(supabase as never, BCAST, LIST);

    expect(r.queued).toBe(0);
    const queuedRows = captured.flatMap((c) => c.rows).filter((x) => x.status === "queued");
    expect(queuedRows).toHaveLength(0);
  });

  it("upserts with ignoreDuplicates so a retry cannot re-send an already-sent row", async () => {
    const captured: Upsert[] = [];
    const supabase = makeSupabase(
      {
        broadcast_recipients: [{ data: [{ email: "a@example.com" }], error: null }],
        broadcast_suppressions: [{ data: [], error: null }],
      },
      captured,
    );

    const { enqueueBroadcast } = await importEnqueue();
    await enqueueBroadcast(supabase as never, BCAST, LIST);

    expect(captured[0].opts).toMatchObject({
      onConflict: "broadcast_id,email",
      ignoreDuplicates: true,
    });
  });
});

describe("enqueueBroadcast — pagination", () => {
  it("keeps paging past 1000, where a Supabase select would otherwise truncate", async () => {
    const captured: Upsert[] = [];
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ email: `u${i}@example.com` }));
    const page2 = Array.from({ length: 37 },   (_, i) => ({ email: `v${i}@example.com` }));

    const supabase = makeSupabase(
      {
        broadcast_recipients: [
          { data: page1, error: null },
          { data: page2, error: null },
        ],
        broadcast_suppressions: [
          { data: [], error: null },
          { data: [], error: null },
        ],
      },
      captured,
    );

    const { enqueueBroadcast } = await importEnqueue();
    const r = await enqueueBroadcast(supabase as never, BCAST, LIST);

    // A single-page implementation would report 1000 and lose 37 people.
    expect(r.total).toBe(1037);
    expect(r.queued).toBe(1037);
    expect(captured.flatMap((c) => c.rows)).toHaveLength(1037);
  });

  it("stops at a short page rather than looping forever on an empty list", async () => {
    const captured: Upsert[] = [];
    const supabase = makeSupabase(
      { broadcast_recipients: [{ data: [], error: null }] },
      captured,
    );

    const { enqueueBroadcast } = await importEnqueue();
    const r = await enqueueBroadcast(supabase as never, BCAST, LIST);

    expect(r.total).toBe(0);
    expect(captured).toHaveLength(0); // nothing written for an empty list
  });
});

describe("previewEnqueue", () => {
  it("reports the same counts as enqueue but writes nothing", async () => {
    const captured: Upsert[] = [];
    const supabase = makeSupabase(
      {
        broadcast_recipients: [
          { data: [
            { email: "a@example.com" },
            { email: "gone@example.com" },
            { email: "b@example.com" },
          ], error: null },
        ],
        broadcast_suppressions: [
          { data: [{ email: "gone@example.com", reason: "hard_bounce" }], error: null },
        ],
      },
      captured,
    );

    const { previewEnqueue } = await importEnqueue();
    const r = await previewEnqueue(supabase as never, LIST);

    expect(r.total).toBe(3);
    expect(r.queued).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.skippedByReason.hard_bounce).toBe(1);

    // A preview that wrote rows would leave a half-built queue behind if the
    // admin changed their mind on the review screen.
    expect(captured).toHaveLength(0);
  });
});
