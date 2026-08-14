-- connect_v40_earnings_ledger.sql
-- Durable ledger for consultant-earnings credits. Fixes a real, confirmed bug
-- (see ImotaraKnowledgebase / code_review_audit_2026_08_14): three separate
-- session-completion code paths (tick/route.ts, cron/connect-orphans,
-- consultant/sessions stale-cleanup) each attempted to credit a consultant's
-- wallet with only a console.error on failure — no retry, no record, no way
-- to recover. The session was already marked completed and the user already
-- charged, so a transient DB hiccup during the credit step meant the
-- consultant's earnings were silently, permanently lost.
--
-- This table is written FIRST, before any credit attempt, so the debt is
-- durably recorded regardless of whether the credit itself succeeds. A
-- settlement cron (connect-settle-earnings) retries every unsettled row
-- indefinitely until it succeeds.

CREATE TABLE IF NOT EXISTS connect_earnings_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES connect_sessions(id),
  consultant_id       UUID NOT NULL REFERENCES connect_consultants(id),
  consultant_user_id  UUID NOT NULL,
  amount              NUMERIC(12,4) NOT NULL CHECK (amount >= 0),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  attempts            INT NOT NULL DEFAULT 0,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at          TIMESTAMPTZ,
  -- One ledger row per session — makes the initial insert itself idempotent,
  -- so a race between two completion paths for the same session (already
  -- guarded elsewhere by optimistic locks on connect_sessions, but defense
  -- in depth here is cheap) can never double-record or double-credit.
  UNIQUE (session_id)
);

-- Settlement cron scans exactly this shape: unsettled rows, oldest first.
CREATE INDEX IF NOT EXISTS idx_connect_earnings_ledger_pending
  ON connect_earnings_ledger (created_at)
  WHERE status = 'pending';

ALTER TABLE connect_earnings_ledger ENABLE ROW LEVEL SECURITY;
-- Service-role only — no policy grants any client-side (anon/authenticated)
-- access. All reads/writes happen via getSupabaseAdmin() from trusted server
-- code (tick route, orphan cron, stale-session cleanup, settlement cron).

-- Atomic attempt-count/last-error bump for a failed credit attempt — avoids
-- an application-level read-modify-write race between concurrent attempts
-- (initial try + settlement-cron retry landing close together).
CREATE OR REPLACE FUNCTION increment_ledger_attempt(p_session_id uuid, p_error text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE connect_earnings_ledger
  SET attempts   = COALESCE(attempts, 0) + 1,
      last_error = p_error
  WHERE session_id = p_session_id;
$$;

-- Per connect_v22's hard-learned lesson: a SECURITY DEFINER function with no
-- explicit GRANT fails every service-role .rpc() call with "permission
-- denied" — silently, in production, exactly like increment_wallet_earnings
-- did before v22. Grant explicitly rather than relying on default privileges.
GRANT EXECUTE ON FUNCTION increment_ledger_attempt(UUID, TEXT) TO service_role;

-- Verify after running:
-- SELECT has_function_privilege('service_role', 'increment_ledger_attempt(uuid,text)', 'EXECUTE');
-- Expected: 't'
