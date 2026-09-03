// GET /api/cron/broadcast-queue
// Called by Vercel Cron every minute. Drains queued broadcast_sends rows
// through Resend, respecting the warm-up ceiling (BC-05).
//
// Sending is queued rather than done inline because a Vercel function caps at
// 300s and a list of thousands will not fit. Draining a slice per minute also
// means a crash loses one batch, not a whole broadcast.

export const preferredRegion = ["sin1"];
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  sendBatch, MAX_BATCH, isResendConfigured,
  type BroadcastMessage, type SendOutcome,
} from "@/lib/broadcast/resendClient";
import { getBudget } from "@/lib/broadcast/warmup";
import {
  unsubscribeHeaders, unsubscribeFooterHtml, unsubscribeFooterText,
  isUnsubscribeConfigured,
} from "@/lib/broadcast/unsubscribe";
import { emailDocument } from "@/lib/broadcast/markup";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

type BroadcastRow = {
  id: string;
  subject: string;
  body_html: string;
  reply_to: string | null;
  body_text: string;
  message_type: "broadcast" | "operational";
  from_email: string;
  from_name: string | null;
  status: string;
};

/**
 * "Suchismita Sen <suchismita.sen@imotara.com>" rather than the bare address.
 * Recipients see the name, which is the entire premise of the feature — the
 * mail comes from a person, not a system. Falls back to the bare address for
 * a broadcast created before from_name existed.
 *
 * A name containing " or \ would break the quoted display-name syntax, so
 * those are stripped rather than escaped: an admin's name legitimately
 * containing them is far less likely than a malformed From header.
 */
function fromHeader(b: BroadcastRow): string {
  const name = b.from_name?.trim().replace(/["\\]/g, "");
  return name ? `"${name}" <${b.from_email}>` : b.from_email;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isResendConfigured()) {
    console.error("[broadcast-queue] RESEND_API_KEY missing — nothing sent");
    return NextResponse.json({ ok: false, error: "Sending not configured" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  // ── 1. Is anything sending? ────────────────────────────────────────────────
  // This runs every minute forever, and almost every run has nothing to do.
  // So the idle path is ONE query: ask for a sending broadcast and leave.
  // Computing the budget first would make the common case three queries for
  // no reason.
  //
  // Oldest first. Handling a single broadcast per tick keeps message
  // construction simple and means a fatal error pauses exactly the run that
  // caused it, rather than whichever run happened to be interleaved.
  const { data: broadcast, error: bErr } = await supabase
    .from("broadcasts")
    .select("id, subject, body_html, body_text, message_type, from_email, from_name, reply_to, status")
    .eq("status", "sending")
    .order("started_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle<BroadcastRow>();

  if (bErr) {
    console.error("[broadcast-queue] broadcast query error:", bErr.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
  if (!broadcast) {
    return NextResponse.json({ ok: true, drained: 0, reason: "nothing sending" });
  }

  // ── 2. Today's budget ──────────────────────────────────────────────────────
  const budget = await getBudget(supabase);
  if (budget.remaining <= 0) {
    return NextResponse.json({
      ok: true, drained: 0, reason: "daily ceiling reached",
      week: budget.week, cap: budget.cap, sentToday: budget.sentToday,
    });
  }

  // A 'broadcast'-type message without a working unsubscribe must not go out:
  // Gmail and Yahoo require one-click for bulk, and shipping without it costs
  // inbox placement. Pause rather than send a non-compliant message.
  if (broadcast.message_type === "broadcast" && !isUnsubscribeConfigured()) {
    await supabase.from("broadcasts").update({ status: "paused" }).eq("id", broadcast.id);
    console.error("[broadcast-queue] no unsubscribe secret — paused", broadcast.id);
    return NextResponse.json(
      { ok: false, error: "Unsubscribe signing not configured; broadcast paused" },
      { status: 500 },
    );
  }

  // ── 3. Claim a slice ───────────────────────────────────────────────────────
  const take = Math.min(budget.remaining, MAX_BATCH);
  const { data: rows, error: rErr } = await supabase
    .from("broadcast_sends")
    .select("id, email")
    .eq("broadcast_id", broadcast.id)
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(take);

  if (rErr) {
    console.error("[broadcast-queue] queue query error:", rErr.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  // Queue empty for this broadcast — it is finished.
  if (!rows || rows.length === 0) {
    await supabase
      .from("broadcasts")
      .update({ status: "sent", finished_at: new Date().toISOString() })
      .eq("id", broadcast.id);
    return NextResponse.json({ ok: true, drained: 0, completed: broadcast.id });
  }

  // ── 4. Build ───────────────────────────────────────────────────────────────
  const sender = fromHeader(broadcast);
  const messages: BroadcastMessage[] = rows.map((r) => ({
    from: sender,
    to: r.email,
    subject: broadcast.subject,
    // emailDocument puts the footer INSIDE the body's container. Concatenating
    // the two left the footer full-bleed and misaligned under the card, and —
    // worse — meant the composer's preview was showing something the recipient
    // would never actually see.
    html: emailDocument(
      broadcast.body_html,
      broadcast.message_type === "broadcast"
        ? unsubscribeFooterHtml(r.email, broadcast.id) : "",
    ),
    text: broadcast.body_text +
      (broadcast.message_type === "broadcast"
        ? unsubscribeFooterText(r.email, broadcast.id) : ""),
    // Answers go to the person who wrote it, which is not always the address
    // it was sent from — an owner signed in with a personal address sends
    // under the company one and still receives the replies.
    replyTo: broadcast.reply_to ?? broadcast.from_email,
    headers: unsubscribeHeaders(broadcast.message_type, r.email, broadcast.id),
  }));

  // ── 5. Send ────────────────────────────────────────────────────────────────
  const outcomes = await sendBatch(messages);
  const byEmail = new Map<string, SendOutcome>(outcomes.map((o) => [o.email, o]));

  // ── 6. Write outcomes back ─────────────────────────────────────────────────
  const now = new Date().toISOString();
  let sent = 0, failed = 0, retry = 0, fatal = false, fatalMsg = "";

  for (const row of rows) {
    const o = byEmail.get(row.email);
    if (!o) { retry++; continue; }        // no outcome: leave queued

    if (o.ok) {
      await supabase.from("broadcast_sends")
        .update({ status: "sent", resend_id: o.id, sent_at: now, error: null })
        .eq("id", row.id);
      sent++;
      continue;
    }

    if (o.kind === "recipient") {
      await supabase.from("broadcast_sends")
        .update({ status: "failed", error: `${o.code}: ${o.message}` })
        .eq("id", row.id);
      failed++;
      continue;
    }

    if (o.kind === "fatal") {
      // Do NOT mark the row — it must be retried once the fault is fixed.
      fatal = true; fatalMsg = `${o.code}: ${o.message}`;
      continue;
    }

    // transient — leave queued, record why for visibility
    await supabase.from("broadcast_sends")
      .update({ error: `${o.code}: ${o.message}` })
      .eq("id", row.id);
    retry++;
  }

  // ── 7. A fatal fault pauses the run ────────────────────────────────────────
  // Without this, a revoked API key would march the cron through every
  // remaining row, failing each identically, and the queue would be gone by
  // the time anyone noticed.
  if (fatal) {
    await supabase.from("broadcasts").update({ status: "paused" }).eq("id", broadcast.id);
    console.error("[broadcast-queue] fatal, paused", broadcast.id, fatalMsg);
    return NextResponse.json(
      { ok: false, error: "Paused after a fatal send error", detail: fatalMsg,
        broadcastId: broadcast.id, sent, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    broadcastId: broadcast.id,
    sent, failed, retry,
    week: budget.week, cap: budget.cap,
    sentToday: budget.sentToday + sent,
    remaining: Math.max(0, budget.remaining - sent),
  });
}
