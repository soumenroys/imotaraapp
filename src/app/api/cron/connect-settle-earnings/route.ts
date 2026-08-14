// GET /api/cron/connect-settle-earnings
// Called by Vercel Cron every 10 minutes (matches connect-orphans' cadence).
// Retries every unsettled row in connect_earnings_ledger — the durable
// record of consultant earnings still owed after an initial credit attempt
// (wallet upsert + increment_wallet_earnings RPC) failed. Retries
// indefinitely, every cycle, until each row settles: a transient failure
// (momentary DB contention, a blip in either RPC) is expected to clear on a
// later attempt, and there is no cap here that would let a row silently stop
// being retried. See [[code_review_audit_2026_08_14]] for the original bug
// this replaces (three separate completion paths that gave up on a
// console.error with no retry at all).

export const preferredRegion = ["sin1"];
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { attemptCredit } from "@/lib/connect/creditConsultant";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Cap on how many rows one cron run processes, so a large backlog can't push
// a single invocation past Vercel's maxDuration — remaining rows are simply
// picked up on the next 10-minute cycle.
const BATCH_LIMIT = 100;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Small buffer against the (extremely narrow) window where this cron
  // could run concurrently with the same session's own initial attempt,
  // between the ledger insert and that attempt's completion — not a real
  // correctness issue (both attempts are individually safe to run, and a
  // wallet double-credit isn't possible here since a *settled* row is
  // simply excluded going forward), just avoids redundant work.
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data: pending, error } = await supabase
    .from("connect_earnings_ledger")
    .select("session_id, consultant_id, consultant_user_id, amount")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[connect-settle-earnings] query error:", error.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, settled: 0, stillPending: 0 });
  }

  let settled = 0;
  for (const row of pending) {
    const result = await attemptCredit(supabase, {
      sessionId: row.session_id,
      consultantId: row.consultant_id,
      consultantUserId: row.consultant_user_id,
      earnings: Number(row.amount),
      logTag: "[connect-settle-earnings]",
    });
    if (result.settled) settled++;
  }

  const stillPending = pending.length - settled;
  if (stillPending > 0) {
    // Not necessarily an emergency (a row can legitimately take a few cycles
    // to clear a transient issue), but worth a visible log line — this is
    // exactly the kind of signal that should feed an alert once
    // observability tooling is wired up (see the audit's P2 item).
    console.warn(`[connect-settle-earnings] ${stillPending} of ${pending.length} ledger row(s) still unsettled after this run — will retry next cycle.`);
  }

  return NextResponse.json({ ok: true, settled, stillPending });
}
