// src/lib/connect/creditConsultant.ts
// Durable consultant wallet-crediting, shared by every session-completion
// path (tick/route.ts, cron/connect-orphans, consultant/sessions
// stale-session cleanup). Each of those three previously had its own
// independent, duplicated version of "wallet upsert + increment_wallet_earnings
// RPC, log-and-give-up on failure" — a transient DB hiccup during that step
// silently, permanently lost a consultant's earnings for the session, with no
// retry and no durable record. See ImotaraKnowledgebase's code-review-audit
// notes / [[code_review_audit_2026_08_14]] for the original finding.
//
// This module writes a ledger row FIRST, before attempting the credit, so
// the debt is durably recorded independent of whether the credit attempt
// itself succeeds. The settlement cron (connect-settle-earnings) retries
// every unsettled ledger row indefinitely until it succeeds — nothing is
// ever silently dropped, only delayed.
//
// Deliberately scoped to ONLY the wallet-credit step. Each call site remains
// responsible for its own session-completion detection, amount_charged /
// platform_fee writes, and consultant_credited write — those already have
// real, carefully-reasoned optimistic-locking guards specific to each path,
// and forcing them into one shape here would risk disturbing races that are
// currently handled correctly.

import type { getSupabaseAdmin } from "@/lib/supabaseServer";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export interface CreditConsultantParams {
  supabase: SupabaseAdmin;
  sessionId: string;
  consultantId: string;
  consultantUserId: string;
  /** The consultant's 80% share, already computed by the caller (amountCharged * 0.80). */
  earnings: number;
  /** Log-line prefix for the caller's context, e.g. "[tick/creditConsultant]", "[connect-orphans]". */
  logTag: string;
}

/**
 * Durably credit a consultant for a completed session. Returns `settled: true`
 * only if the wallet was actually incremented (now, or already settled by an
 * earlier attempt/the settlement cron) — the caller should only write
 * `consultant_credited` on the session row when this returns true.
 */
export async function creditConsultantDurably(params: CreditConsultantParams): Promise<{ settled: boolean }> {
  const { supabase, sessionId, consultantId, consultantUserId, earnings, logTag } = params;

  // Ledger row first, unconditionally. `ignoreDuplicates` makes this
  // idempotent on session_id — if another completion path already recorded
  // this session (shouldn't happen given the optimistic locks elsewhere, but
  // cheap defense in depth), this is a no-op rather than an error.
  const { error: ledgerErr } = await supabase
    .from("connect_earnings_ledger")
    .upsert(
      { session_id: sessionId, consultant_id: consultantId, consultant_user_id: consultantUserId, amount: +earnings.toFixed(4) },
      { onConflict: "session_id", ignoreDuplicates: true },
    );
  if (ledgerErr) {
    // The durability guarantee itself failed to write. Still attempt the
    // credit below rather than giving up — if the DB is this unhealthy the
    // credit attempt will likely fail too, but there's no reason to skip
    // trying. Logged CRITICAL since this specific failure means the
    // settlement cron has no row to retry if the attempt below also fails.
    console.error(`${logTag} CRITICAL: earnings-ledger write failed — settlement cron will not see this session if the credit attempt below also fails:`, ledgerErr.message, "session:", sessionId);
  }

  return attemptCredit(supabase, { sessionId, consultantId, consultantUserId, earnings, logTag });
}

/**
 * The actual credit attempt — wallet upsert + earnings RPC + ledger/session
 * bookkeeping on success. Shared by the initial attempt above and the
 * settlement cron's retries (which call this directly, since the ledger row
 * already exists by the time the cron picks it up).
 */
export async function attemptCredit(
  supabase: SupabaseAdmin,
  args: { sessionId: string; consultantId: string; consultantUserId: string; earnings: number; logTag: string },
): Promise<{ settled: boolean }> {
  const { sessionId, consultantId, consultantUserId, earnings, logTag } = args;

  const { error: walletErr } = await supabase
    .from("connect_wallet")
    .upsert({ user_id: consultantUserId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (walletErr) {
    console.error(`${logTag} wallet upsert failed:`, walletErr.message, "session:", sessionId);
    await recordFailedAttempt(supabase, sessionId, walletErr.message);
    return { settled: false };
  }

  const { error: earningsErr } = await supabase.rpc("increment_wallet_earnings", {
    p_user_id: consultantUserId,
    p_amount:  earnings,
  });
  if (earningsErr) {
    console.error(`${logTag} increment_wallet_earnings failed:`, earningsErr.message, "session:", sessionId);
    await recordFailedAttempt(supabase, sessionId, earningsErr.message);
    return { settled: false };
  }

  // Both wallet operations succeeded.
  await supabase
    .from("connect_earnings_ledger")
    .update({ status: "settled", settled_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  // Guarded with .is(null) so a settlement-cron retry landing after some
  // other path already wrote this (shouldn't happen given the ledger's
  // UNIQUE(session_id), but cheap defense in depth) can't clobber it.
  const { error: acErr } = await supabase
    .from("connect_sessions")
    .update({ consultant_credited: +earnings.toFixed(4) })
    .eq("id", sessionId)
    .is("consultant_credited", null);
  if (acErr) {
    console.error(`${logTag} consultant_credited write failed (earnings ARE credited to the wallet, this is a receipt-column-only issue):`, acErr.message, "session:", sessionId);
  }

  const { error: scErr } = await supabase.rpc("increment_sessions_completed", { p_consultant_id: consultantId });
  if (scErr) {
    // Do NOT fall back to read-modify-write — concurrent completions would
    // each read the same stale value and produce a lost update. The earnings
    // credit itself already succeeded and is not affected by this failing;
    // logged CRITICAL for manual correction since this counter has no
    // ledger/retry mechanism of its own (it's a simple completed-sessions
    // count, not money).
    console.error(`${logTag} CRITICAL: increment_sessions_completed RPC failed — sessions_completed NOT incremented. Manual correction needed. Error:`, scErr.message, "consultantId:", consultantId);
  }

  return { settled: true };
}

async function recordFailedAttempt(supabase: SupabaseAdmin, sessionId: string, errorMessage: string) {
  // Best-effort — if this write itself fails there's nothing further to do;
  // the settlement cron will still pick up the row on its next pass since
  // `attempts`/`last_error` are informational only, not gating.
  try {
    await supabase.rpc("increment_ledger_attempt", { p_session_id: sessionId, p_error: errorMessage });
  } catch {
    // ignore — see comment above
  }
}
