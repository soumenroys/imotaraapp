// src/app/api/admin/broadcast/broadcasts/[id]/preview/route.ts
// GET — what sending this broadcast would do. Writes nothing.
//
// Powers the review screen's arithmetic: "52 on the list, 3 skipped,
// 49 will receive". Owner role only (BC-14).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { previewEnqueue } from "@/lib/broadcast/enqueue";
import { getBudget } from "@/lib/broadcast/warmup";
import { isUnsubscribeConfigured } from "@/lib/broadcast/unsubscribe";
import { isResendConfigured, canSendFrom, sendingDomain, sendingIdentities } from "@/lib/broadcast/resendClient";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: b } = await supabase
    .from("broadcasts")
    .select("id, subject, body_html, body_text, message_type, status, from_email, from_name, reply_to, list_id")
    .eq("id", id)
    .maybeSingle();

  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Everything that would stop a send, gathered in one place so the review
  // screen can show them all at once rather than revealing them one refusal at
  // a time.
  const blockers: string[] = [];
  if (!b.list_id) blockers.push("No recipient list is attached");
  if (!b.subject?.trim()) blockers.push("The subject is empty");
  if (!b.body_html?.trim() && !b.body_text?.trim()) blockers.push("The message body is empty");
  if (b.status !== "draft" && b.status !== "paused") {
    blockers.push(`This broadcast is ${b.status}`);
  }
  if (!isResendConfigured()) blockers.push("Sending is not configured (RESEND_API_KEY)");
  if (!canSendFrom(b.from_email)) {
    const allowed = sendingIdentities(auth.admin.email);
    blockers.push(
      allowed.length > 0
        ? `This draft would be sent from ${b.from_email}, which is not on the verified ` +
          `sending domain (${sendingDomain()}). Change the From address to ${allowed[0]}.`
        : `Nothing on this platform can send yet: ${b.from_email} is not on the verified ` +
          `domain (${sendingDomain()}), and BROADCAST_FROM_EMAIL names no address that is.`,
    );
  }
  if (b.message_type === "broadcast" && !isUnsubscribeConfigured()) {
    blockers.push("Unsubscribe signing is not configured — a broadcast cannot go out without it");
  }

  const counts = b.list_id
    ? await previewEnqueue(supabase, b.list_id)
    : { total: 0, queued: 0, skipped: 0, skippedByReason: { unsubscribed: 0, hard_bounce: 0, complaint: 0 } };

  const budget = await getBudget(supabase);

  // Not a blocker. The cron enforces the ceiling regardless, so a queue larger
  // than today's budget simply drains over several days — the operator just
  // needs to know that before pressing send rather than wondering later why
  // only some arrived.
  const daysNeeded = budget.cap > 0 ? Math.ceil(counts.queued / budget.cap) : null;

  return NextResponse.json({
    broadcast: {
      id: b.id, subject: b.subject, status: b.status,
      messageType: b.message_type,
      from: b.from_name ? `${b.from_name} <${b.from_email}>` : b.from_email,
      replyTo: b.reply_to ?? b.from_email,
    },
    counts,
    budget,
    exceedsTodaysBudget: counts.queued > budget.remaining,
    daysNeeded,
    blockers,
    canSend: blockers.length === 0 && counts.queued > 0,
  }, { status: 200 });
}
