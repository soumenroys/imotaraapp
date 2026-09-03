// src/app/api/admin/broadcast/broadcasts/[id]/send/route.ts
// POST — commit a draft to sending, or resume a paused run.
//
// This route does NOT send anything. It builds the queue and flips the status;
// the cron drains it. Sending inline would cap at the function's 300s and lose
// a run halfway through on any crash. Owner role only (BC-14).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { enqueueBroadcast, previewEnqueue } from "@/lib/broadcast/enqueue";
import { getBudget } from "@/lib/broadcast/warmup";
import { isUnsubscribeConfigured } from "@/lib/broadcast/unsubscribe";
import { isResendConfigured, canSendFrom, sendingDomain } from "@/lib/broadcast/resendClient";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { confirmCount?: unknown; acceptMultiDay?: unknown };
  try { body = await req.json(); }
  catch { body = {}; }

  const supabase = getSupabaseAdmin();

  const { data: b } = await supabase
    .from("broadcasts")
    .select("id, subject, body_html, body_text, message_type, status, list_id, from_email")
    .eq("id", id)
    .maybeSingle();

  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Resume a paused run ────────────────────────────────────────────────────
  // A pause comes from a fatal send error — a revoked key, an unverified
  // domain. The queue is intact and its rows are still 'queued', so resuming
  // must NOT re-enqueue: doing so would be harmless only because of the
  // ignoreDuplicates upsert, and relying on that is a thin margin. Just flip
  // the status back and let the cron continue where it stopped.
  if (b.status === "paused") {
    const { error } = await supabase
      .from("broadcasts").update({ status: "sending" }).eq("id", id).eq("status", "paused");
    if (error) {
      console.error("[broadcast/send] resume:", error.message);
      return NextResponse.json({ error: "Could not resume" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resumed: true }, { status: 200 });
  }

  if (b.status !== "draft") {
    return NextResponse.json(
      { error: `This broadcast is ${b.status} and cannot be sent again`,
        hint: "Duplicate it to send a revised version" },
      { status: 409 },
    );
  }

  // ── Preflight ──────────────────────────────────────────────────────────────
  const blockers: string[] = [];
  if (!b.list_id) blockers.push("No recipient list is attached");
  if (!b.subject?.trim()) blockers.push("The subject is empty");
  if (!b.body_html?.trim() && !b.body_text?.trim()) blockers.push("The message body is empty");
  if (!isResendConfigured()) blockers.push("Sending is not configured (RESEND_API_KEY)");
  // Caught here as well as in the preview: the preview is advisory, and this
  // is the last point at which the failure is still cheap. Past it, the whole
  // queue is built and the first batch fails fatally.
  if (!canSendFrom(b.from_email)) {
    blockers.push(
      `${b.from_email} is not on the verified sending domain (${sendingDomain()})`,
    );
  }
  if (b.message_type === "broadcast" && !isUnsubscribeConfigured()) {
    blockers.push("Unsubscribe signing is not configured");
  }
  if (blockers.length > 0) {
    return NextResponse.json({ error: "Not ready to send", blockers }, { status: 400 });
  }

  const counts = await previewEnqueue(supabase, b.list_id as string);
  if (counts.queued === 0) {
    return NextResponse.json(
      { error: "Nobody on this list would receive it", counts }, { status: 400 },
    );
  }

  // ── Typed confirmation ─────────────────────────────────────────────────────
  // The client must echo back the number it was shown. If recipients were
  // added, removed or suppressed between the review screen loading and the
  // button being pressed, the counts no longer match and the send is refused
  // — rather than silently mailing a different set of people than the one the
  // admin actually approved.
  const confirmCount = Number(body.confirmCount);
  if (!Number.isInteger(confirmCount) || confirmCount !== counts.queued) {
    return NextResponse.json(
      {
        error: "Recipient count has changed since you reviewed this",
        expected: counts.queued,
        received: Number.isInteger(confirmCount) ? confirmCount : null,
        counts,
      },
      { status: 409 },
    );
  }

  // ── Warm-up ────────────────────────────────────────────────────────────────
  // Not a hard block: the cron enforces the ceiling regardless, so a large
  // queue simply drains over several days. But it must be a deliberate choice,
  // not a surprise discovered when only some arrived.
  const budget = await getBudget(supabase);
  if (counts.queued > budget.remaining && body.acceptMultiDay !== true) {
    return NextResponse.json(
      {
        error: "This is larger than today's remaining send budget",
        hint: "It will drain over several days. Send again with acceptMultiDay to proceed.",
        queued: counts.queued,
        remainingToday: budget.remaining,
        dailyCap: budget.cap,
        warmupWeek: budget.week,
        daysNeeded: budget.cap > 0 ? Math.ceil(counts.queued / budget.cap) : null,
      },
      { status: 409 },
    );
  }

  // ── Commit ─────────────────────────────────────────────────────────────────
  // Queue FIRST, then flip the status. If this crashes between the two, the
  // broadcast stays a draft with a populated queue — which the enqueue's
  // ignoreDuplicates makes safe to retry. The other order would leave a
  // broadcast marked 'sending' with an empty queue, which the cron would
  // immediately mark 'sent' having mailed nobody.
  let enqueued;
  try {
    enqueued = await enqueueBroadcast(supabase, id, b.list_id as string);
  } catch (e) {
    console.error("[broadcast/send] enqueue:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not build the send queue" }, { status: 500 });
  }

  const { error: sErr } = await supabase
    .from("broadcasts")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");

  if (sErr) {
    console.error("[broadcast/send] status:", sErr.message);
    return NextResponse.json(
      { error: "Queue built but the broadcast could not be started — try again" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    enqueued,
    budget: { week: budget.week, cap: budget.cap, remainingToday: budget.remaining },
    note: "Sending starts within a minute and continues in the background.",
  }, { status: 200 });
}
