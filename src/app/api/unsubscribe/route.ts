// src/app/api/unsubscribe/route.ts
// The machine end of unsubscribing (BC-27).
//
// POST is what Gmail and Outlook call when someone presses their own
// "Unsubscribe" button next to the sender name. RFC 8058 one-click: the
// provider posts here without a human ever seeing our page, and expects a 2xx.
// Getting this right is not a nicety — a working one-click link is the reason
// a recipient presses it instead of pressing "Report spam", and one spam
// report costs more reputation than a hundred unsubscribes.
//
// GET performs nothing. It redirects to the visible page, because a link in an
// email is fetched by scanners, previewers and prefetchers long before any
// person clicks it, and a GET that opted people out would opt them out by
// accident.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { verifyUnsubscribeToken } from "@/lib/broadcast/unsubscribe";

export const runtime = "nodejs";

async function suppress(token: string): Promise<{ ok: boolean; email?: string }> {
  const claim = verifyUnsubscribeToken(token);
  if (!claim) return { ok: false };

  const supabase = getSupabaseAdmin();

  // Idempotent: pressing unsubscribe twice, or a provider retrying its POST,
  // must not fail. The unique index on email makes the second one a no-op.
  const { error } = await supabase
    .from("broadcast_suppressions")
    .upsert(
      {
        email: claim.email,
        reason: "unsubscribed",
        source_broadcast_id: claim.broadcastId,
      },
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) {
    console.error("[unsubscribe] suppress:", error.message);
    return { ok: false };
  }

  // Their pending messages in this run, and any other queued run, are dropped
  // as well. Honouring the opt-out only from the next broadcast onwards would
  // still deliver whatever is already sitting in the queue — which, to the
  // person who just pressed unsubscribe, is indistinguishable from ignoring
  // them.
  await supabase
    .from("broadcast_sends")
    .update({ status: "skipped", skip_reason: "unsubscribed" })
    .eq("email", claim.email)
    .eq("status", "queued");

  return { ok: true, email: claim.email };
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const { ok } = await suppress(token);

  // A bad token still answers 200 to a one-click POST. The provider is not the
  // one who can fix it, and a non-2xx makes Gmail hide the unsubscribe button
  // for this sender — pushing the next person towards the spam button instead.
  return NextResponse.json({ ok }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  // Resolved against the request's own origin rather than a configured site
  // URL, so a preview deployment redirects to itself instead of bouncing the
  // visitor to production with a token that came from somewhere else.
  return NextResponse.redirect(
    new URL(`/unsubscribe?t=${encodeURIComponent(token)}`, req.url), 302,
  );
}
