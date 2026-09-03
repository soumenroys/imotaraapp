// src/app/api/admin/broadcast/health/route.ts
// GET — can this system send at all, and what is it allowed to send today?
//
// Every answer here is read from the live environment or derived from
// broadcast_sends. Nothing is a stored flag someone set once and forgot: a
// configuration panel that reports what it was told rather than what is true
// is worse than no panel, because it is believed.
//
// Owner role only (BC-23).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getBudget } from "@/lib/broadcast/warmup";
import { isUnsubscribeConfigured } from "@/lib/broadcast/unsubscribe";
import { isResendConfigured, sendingDomain } from "@/lib/broadcast/resendClient";
import { availableIdentities } from "@/lib/broadcast/identities";

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();
  const budget = await getBudget(supabase);

  // Suppressions, by reason. These are people who will never be mailed again,
  // and the number belongs in front of the operator rather than buried in a
  // table — a climbing complaint count is the earliest warning that the
  // content, not the infrastructure, is the problem.
  const reasons = ["unsubscribed", "hard_bounce", "complaint"] as const;
  const suppressions: Record<string, number> = {};
  for (const r of reasons) {
    const { count } = await supabase
      .from("broadcast_suppressions")
      .select("email", { count: "exact", head: true })
      .eq("reason", r);
    suppressions[r] = count ?? 0;
  }

  const { data: last } = await supabase
    .from("broadcast_sends")
    .select("sent_at")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A queue still draining. Worth showing even when no broadcast is 'sending'
  // — a non-zero number with nothing in flight means the cron is not running.
  const { count: waiting } = await supabase
    .from("broadcast_sends")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  return NextResponse.json({
    sender: { email: auth.admin.email, name: auth.admin.name },
    // What this admin can actually send as. Empty means their login is off the
    // verified domain and no fallback is configured — the one state where the
    // whole feature is inert for them, and it needs saying out loud.
    identities: await availableIdentities(supabase, auth.admin.email, auth.admin.name),
    sendingDomain: sendingDomain(),
    configured: {
      // The API key's presence, not its validity — proving validity would mean
      // sending something. A wrong key surfaces as a paused run with the
      // reason attached, which is where it can actually be acted on.
      resend: isResendConfigured(),
      unsubscribe: isUnsubscribeConfigured(),
      // Without this, Resend's callbacks are rejected and every message stays
      // at "sent" forever: delivered, bounced and complaint counts stop being
      // real. Sending still works, which is exactly why it needs saying.
      webhook: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    },
    budget,
    capOverride: process.env.BROADCAST_DAILY_CAP ?? null,
    suppressions,
    suppressedTotal: reasons.reduce((n, r) => n + suppressions[r], 0),
    queuedNow: waiting ?? 0,
    lastSentAt: last?.sent_at ?? null,
  }, { status: 200 });
}
