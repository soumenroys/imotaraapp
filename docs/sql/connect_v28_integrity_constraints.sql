-- connect_v28_integrity_constraints.sql
-- DB integrity gaps identified in Round-75 audit.
-- Run in Supabase SQL editor after connect_v27_constraints_and_index.sql.
--
-- Summary of changes:
-- 1. connect_sessions.scheduled_duration_min — add CHECK (1–480 min)
--    No DB CHECK existed; a direct write of 99999 would make the double-booking
--    overlap window span ~69 days, blocking the consultant from accepting any
--    booking for that period. The API already enforces 5–480 min; this is the
--    DB backstop.
--
-- 2. connect_sessions.minutes_used — add CHECK (>= 0)
--    The tick route increments by +1; no DB guard prevents a direct write of
--    -100, which would produce amount_charged = -100 * rate_per_min (a credit
--    on the session that reverses billing math). The API never writes negative
--    values but there is no DB backstop.
--
-- 3. connect_sessions.rate_per_min — add CHECK (> 0)
--    The stale-complete path guards `if (freshMinutes > 0 && rate > 0)` in JS.
--    A direct DB write of rate_per_min = 0 would create a free session:
--    amount_charged = minutes_used * 0 = 0, and the JS guard skips the
--    consultant credit step entirely. The register API enforces rate > 0;
--    this is the DB backstop on the session row itself.
--
-- 4. connect_consultants.rating_avg — add CHECK BETWEEN 0 AND 5
--    The update_consultant_rating() trigger computes AVG(rating) from
--    connect_sessions.rating (which is CHECK BETWEEN 1 AND 5 at the DB level).
--    The trigger therefore cannot produce a value outside [1, 5].
--    Additionally, numeric(3,2) physically cannot store 100 (max 9.99).
--    However, the explicit CHECK documents the intent and guards against
--    trigger replacements that forget to bound the result.
--
-- 5. connect_recharges.razorpay_payment_id — add UNIQUE partial index
--    No UNIQUE constraint existed. Two concurrent webhook deliveries for the
--    same payment_id (Razorpay retries on timeout) could both match the
--    'pending' status check and complete, double-crediting the user's minutes.
--    The partial index (WHERE NOT NULL) allows one row with NULL (Stripe flows)
--    while preventing duplicate Razorpay payment IDs.
--
-- Note: connect_blocks and connect_favorites already have inline UNIQUE
-- constraints from connect_v2_features.sql. connect_session_reviews does not
-- exist as a separate table — reviews are columns on connect_sessions, with
-- review_submitted_at IS NULL used as the optimistic lock in the review route.
-- No additional constraint is needed there.

-- ─── 1. scheduled_duration_min: bound 1–480 ──────────────────────────────────
--
-- NULL is allowed (instant sessions and scheduled sessions where the caller
-- omits duration). The constraint only fires when the value is NOT NULL.
-- Using 1 as the lower bound (not 5) to allow any non-zero positive duration;
-- the API already enforces >= 5 and <= 480. The DB must catch the extreme case
-- of a direct write (e.g. 99999) that would corrupt the double-booking window.

ALTER TABLE connect_sessions
  ADD CONSTRAINT connect_sessions_scheduled_duration_min_check
  CHECK (scheduled_duration_min IS NULL OR (scheduled_duration_min >= 1 AND scheduled_duration_min <= 480));

-- ─── 2. minutes_used: non-negative ───────────────────────────────────────────
--
-- Existing data: the tick route always writes 0 or a positive increment.
-- The RPCs (get_session_balance) would produce wrong results for negative values.
-- The connect_v27 migration already added CHECK >= 0 on connect_wallet columns
-- (same pattern). This migration brings connect_sessions in line.

ALTER TABLE connect_sessions
  ADD CONSTRAINT connect_sessions_minutes_used_nonneg
  CHECK (minutes_used >= 0);

-- ─── 3. rate_per_min: strictly positive ──────────────────────────────────────
--
-- The base schema added rate_per_min in connect_v2 with DEFAULT 0 and no CHECK.
-- A zero-rate session is a free session that bypasses the consultant credit step.
-- Existing rows with rate_per_min = 0 are legacy pre-v2 instant sessions that
-- were never billed; investigate before running if any rows exist.
-- If existing zero-rate rows are found, update them first:
--   UPDATE connect_sessions SET rate_per_min = <locked_rate> WHERE rate_per_min = 0 AND status = 'completed';
-- Then apply the constraint.

ALTER TABLE connect_sessions
  ADD CONSTRAINT connect_sessions_rate_per_min_positive
  CHECK (rate_per_min > 0);

-- ─── 4. rating_avg: must be 0–5 ──────────────────────────────────────────────
--
-- rating_avg = 0 is the DEFAULT (no reviews yet) and is valid.
-- The trigger produces values in [1, 5] once reviews exist.
-- numeric(3,2) physically cannot exceed 9.99, but the explicit CHECK
-- documents the intent and is a safety net for future trigger changes.

ALTER TABLE connect_consultants
  ADD CONSTRAINT connect_consultants_rating_avg_range
  CHECK (rating_avg >= 0 AND rating_avg <= 5);

-- ─── 5. razorpay_payment_id: unique where not null ───────────────────────────
--
-- The existing column has no UNIQUE constraint. Two concurrent Razorpay webhook
-- retries for the same payment_id could both find status='pending' and both
-- complete, double-crediting the user's minutes.
-- Partial unique index: NULL values are excluded so Stripe rows (which have
-- razorpay_payment_id = NULL) do not conflict with each other.

CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_recharges_payment_id
  ON connect_recharges (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- ─── 6. connect_recharges: at most one pending recharge per user+consultant ──
--
-- A user double-tapping "Recharge" creates two concurrent POST requests. Both
-- call Razorpay and create distinct order IDs, then both insert successfully
-- (different razorpay_order_id values) — the existing UNIQUE on razorpay_order_id
-- does not prevent this. The user pays twice if they complete both Razorpay flows.
-- Partial unique index: only pending rows participate, so a user can have many
-- completed recharges but at most one in-flight pending recharge per consultant.
-- The application (recharge/create/route.ts) maps 23505 to 409:
--   "A recharge is already in progress for this companion."

CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_recharges_user_consultant_pending
  ON connect_recharges (user_id, consultant_id)
  WHERE status = 'pending';

-- ─── 7. connect_sessions: at most one active session per consultant ──────────
--
-- Two concurrent accept requests for two different pending sessions (from two
-- different users) could both pass the application-level is_busy=false check
-- before either sets is_busy=true, leaving the consultant in two simultaneous
-- active sessions. This partial unique index makes Postgres the authoritative
-- guard: when one accept transitions a session to status='active', any other
-- concurrent accept that also tries to set status='active' for the same
-- consultant_id gets a 23505 unique_violation error.
--
-- The application (sessions/[id]/route.ts) maps 23505 to a 409 response:
--   "Companion is already in another active session."
--
-- Partial index: only rows WHERE status = 'active' are indexed, so pending,
-- completed, declined, and cancelled sessions do not participate in the constraint.
-- A consultant can have any number of non-active sessions but at most one active.

CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_sessions_consultant_active
  ON connect_sessions (consultant_id)
  WHERE status = 'active';

-- Verify:
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'connect_sessions'::regclass
--    AND conname IN (
--      'connect_sessions_scheduled_duration_min_check',
--      'connect_sessions_minutes_used_nonneg',
--      'connect_sessions_rate_per_min_positive'
--    );
--
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'connect_consultants'::regclass
--    AND conname = 'connect_consultants_rating_avg_range';
--
-- SELECT indexname, indexdef
--   FROM pg_indexes
--  WHERE tablename = 'connect_recharges'
--    AND indexname = 'uq_connect_recharges_payment_id';
