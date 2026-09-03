// POST /api/webhooks/resend
// Delivery events from Resend (BC-08).
//
// This is the other half of the loop. The send path can only report that
// Resend ACCEPTED a message; whether it reached a human is decided minutes
// later by the receiving server, and that verdict arrives here.
//
// It is also where the suppression list is fed. A hard bounce means the
// address does not exist, and mailing it again on the next broadcast is how a
// sender's reputation degrades — so it is recorded once, globally, and every
// future send skips it.

export const preferredRegion = ["sin1"];
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "";
const API_KEY = process.env.RESEND_API_KEY?.trim() ?? "";

/**
 * Hard vs soft.
 *
 * Only a PERMANENT bounce justifies suppression. A transient one — mailbox
 * full, greylisted, server briefly down — usually succeeds on a later attempt,
 * and suppressing on it would quietly delete a real subscriber over a bad
 * afternoon at their mail host.
 *
 * The exact vocabulary Resend passes through is not documented in the SDK
 * types (EmailBounce is `{ message, subType, type }`, all plain strings), so
 * this matches loosely and logs the raw value. When the real strings are known
 * from production traffic this can tighten into an exact comparison — until
 * then, erring toward NOT suppressing is the safe direction.
 */
function isHardBounce(type: string | undefined, subType: string | undefined): boolean {
  const t = `${type ?? ""} ${subType ?? ""}`.toLowerCase();
  if (/transient|soft|delayed|throttl|mailbox ?full|quota/.test(t)) return false;
  return /permanent|hard|invalid|no ?such|not ?exist|suppress/.test(t);
}

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set — rejecting");
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });
  }

  // The raw body is required: the signature covers the exact bytes sent, so
  // parsing to JSON first and re-serialising would break verification.
  const raw = await req.text();

  // Resend signs webhooks with Svix, so verify() wants the three Svix headers
  // as a plain object — NOT the request's Headers instance. The SDK declares
  // its own `Headers` interface of { id, timestamp, signature }, which is easy
  // to misread as the web one.
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: "Missing signature headers" }, { status: 400 });
  }

  let event;
  try {
    event = new Resend(API_KEY).webhooks.verify({
      payload: raw,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: WEBHOOK_SECRET,
    });
  } catch (e) {
    // An unverified payload is untrusted input, not a delivery report.
    console.warn("[resend-webhook] signature rejected:",
      e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Every email.* event carries email_id — the same id sendBatch wrote into
  // broadcast_sends.resend_id. The union also covers domain.* / contact.* /
  // suppression.* events whose data has no email_id, hence the widening via
  // unknown and the null check below rather than a direct cast.
  const data = ((event as unknown as { data?: unknown }).data ?? {}) as Record<string, unknown>;
  const emailId = typeof data.email_id === "string" ? data.email_id : null;
  const to = Array.isArray(data.to) && typeof data.to[0] === "string"
    ? (data.to[0] as string).toLowerCase()
    : null;

  // Not one of ours, or an account-level event (domain.*, contact.*).
  if (!emailId) {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const { data: row } = await supabase
    .from("broadcast_sends")
    .select("id, broadcast_id, email, status")
    .eq("resend_id", emailId)
    .maybeSingle();

  if (!row) {
    // Either mail sent outside this feature (the Connect/wallet mailers), or
    // an event that overtook our own write. Acknowledge either way: a non-2xx
    // makes Resend retry, and retrying will not conjure the row.
    return NextResponse.json({ ok: true, unmatched: emailId, type: event.type });
  }

  const email = row.email ?? to;

  switch (event.type) {
    case "email.delivered": {
      await supabase.from("broadcast_sends")
        .update({ status: "delivered", delivered_at: now })
        .eq("id", row.id);
      break;
    }

    case "email.bounced": {
      const bounce = (data.bounce ?? {}) as { type?: string; subType?: string; message?: string };
      const hard = isHardBounce(bounce.type, bounce.subType);

      await supabase.from("broadcast_sends")
        .update({
          status: "bounced",
          error: `${hard ? "hard" : "soft"} bounce: ${bounce.type ?? "?"}/${bounce.subType ?? "?"} ${bounce.message ?? ""}`.trim(),
        })
        .eq("id", row.id);

      if (hard && email) {
        // upsert: the same address can bounce on several broadcasts, and a
        // webhook may be delivered more than once.
        await supabase.from("broadcast_suppressions")
          .upsert(
            { email, reason: "hard_bounce", source_broadcast_id: row.broadcast_id },
            { onConflict: "email", ignoreDuplicates: true },
          );
      }

      console.warn("[resend-webhook] bounce", email, bounce.type, bounce.subType, hard ? "(suppressed)" : "(soft, kept)");
      break;
    }

    case "email.complained": {
      // Someone pressed "report spam". This matters more than a bounce:
      // complaint rate is what mailbox providers judge a sender on, and the
      // threshold is around 0.1%. Always suppress, immediately.
      await supabase.from("broadcast_sends")
        .update({ status: "complained" })
        .eq("id", row.id);

      if (email) {
        await supabase.from("broadcast_suppressions")
          .upsert(
            { email, reason: "complaint", source_broadcast_id: row.broadcast_id },
            { onConflict: "email", ignoreDuplicates: true },
          );
      }
      console.warn("[resend-webhook] COMPLAINT", email, "— suppressed");
      break;
    }

    case "email.failed": {
      await supabase.from("broadcast_sends")
        .update({ status: "failed", error: "Resend reported email.failed" })
        .eq("id", row.id);
      break;
    }

    // email.sent is already recorded when the API accepted the message.
    // email.opened / email.clicked are deliberately ignored — Imotara does not
    // track opens or clicks, and receiving the event is not a reason to start.
    default:
      return NextResponse.json({ ok: true, ignored: event.type });
  }

  return NextResponse.json({ ok: true, type: event.type, sendId: row.id });
}
