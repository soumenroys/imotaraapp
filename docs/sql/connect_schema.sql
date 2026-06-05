-- ============================================================
-- Imotara Connect — DB Migration
-- Version: v1.2 (MVP)
-- Run in Supabase SQL editor (service role)
-- ============================================================

-- ── TABLE 1: connect_consultants ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connect_consultants (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       text          NOT NULL,
  gender             text          CHECK (gender IN ('male','female')),
  photo_url          text,
  bio                text          CHECK (char_length(bio) <= 500),
  expertise_tags     text[]        DEFAULT '{}',
  languages          text[]        DEFAULT '{}',
  rate_per_min       numeric(10,2) NOT NULL,
  currency_code      text          NOT NULL DEFAULT 'INR'
                     CHECK (currency_code IN ('INR','USD','EUR','GBP','AED','SGD','AUD')),
  rate_per_min_inr   numeric(10,2),  -- snapshot for INR-normalised sorting; recomputed on update
  availability_note  text,
  coc_agreed         boolean       NOT NULL DEFAULT false,
  status             text          NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','suspended','rejected')),
  rejection_reason   text,
  is_online          boolean       NOT NULL DEFAULT false,
  rating_avg         numeric(3,2)  NOT NULL DEFAULT 0,
  rating_count       integer       NOT NULL DEFAULT 0,
  sessions_completed integer       NOT NULL DEFAULT 0,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE connect_consultants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connect_consultants_public_view" ON connect_consultants
  FOR SELECT USING (status = 'approved');

CREATE POLICY "connect_consultants_own_all" ON connect_consultants
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_connect_consultants_status ON connect_consultants(status);
CREATE INDEX IF NOT EXISTS idx_connect_consultants_is_online ON connect_consultants(is_online);
CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_consultants_user ON connect_consultants(user_id);


-- ── TABLE 2: connect_sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connect_sessions (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consultant_id       uuid          NOT NULL REFERENCES connect_consultants(id),
  type                text          NOT NULL CHECK (type IN ('instant','scheduled')),
  status              text          NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','active','completed','declined','cancelled')),
  scheduled_note      text,         -- free-text preferred time from user
  started_at          timestamptz,
  ended_at            timestamptz,
  minutes_used        numeric(10,2) NOT NULL DEFAULT 0,
  amount_charged      numeric(12,2) NOT NULL DEFAULT 0,
  currency_code       text          NOT NULL DEFAULT 'INR',
  rating              integer       CHECK (rating BETWEEN 1 AND 5),
  review_text         text          CHECK (char_length(review_text) <= 200),
  review_submitted_at timestamptz,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE connect_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connect_sessions_participant_select" ON connect_sessions
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM connect_consultants WHERE id = consultant_id
    )
  );

CREATE POLICY "connect_sessions_user_insert" ON connect_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "connect_sessions_participant_update" ON connect_sessions
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM connect_consultants WHERE id = consultant_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_connect_sessions_user ON connect_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_connect_sessions_consultant ON connect_sessions(consultant_id);
CREATE INDEX IF NOT EXISTS idx_connect_sessions_status ON connect_sessions(status);


-- ── TABLE 3: connect_messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connect_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES connect_sessions(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE connect_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connect_messages_participant_select" ON connect_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM connect_sessions WHERE id = session_id
      UNION
      SELECT cc.user_id
        FROM connect_sessions cs
        JOIN connect_consultants cc ON cc.id = cs.consultant_id
       WHERE cs.id = session_id
    )
  );

CREATE POLICY "connect_messages_participant_insert" ON connect_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    auth.uid() IN (
      SELECT user_id FROM connect_sessions WHERE id = session_id
      UNION
      SELECT cc.user_id
        FROM connect_sessions cs
        JOIN connect_consultants cc ON cc.id = cs.consultant_id
       WHERE cs.id = session_id
    ) AND
    (SELECT status FROM connect_sessions WHERE id = session_id) = 'active'
  );

CREATE INDEX IF NOT EXISTS idx_connect_messages_session ON connect_messages(session_id, created_at);


-- ── TABLE 4: connect_wallet ───────────────────────────────────────────────────
-- One row per user (user-facing balance) OR per consultant (earnings).
-- A user who is also a consultant has one row covering both.
CREATE TABLE IF NOT EXISTS connect_wallet (
  user_id          uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- user fields: pre-paid balance (consultant-specific buckets in connect_recharges)
  balance_amount   numeric(12,2) NOT NULL DEFAULT 0,
  balance_currency text          NOT NULL DEFAULT 'INR',
  -- consultant fields: lifetime earnings + pending payout
  earned_amount    numeric(12,2) NOT NULL DEFAULT 0,
  earned_currency  text          NOT NULL DEFAULT 'INR',
  pending_payout   numeric(12,2) NOT NULL DEFAULT 0,
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE connect_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connect_wallet_own_select" ON connect_wallet
  FOR SELECT USING (auth.uid() = user_id);
-- All writes are service-role only (API uses getSupabaseAdmin())


-- ── TABLE 5: connect_recharges ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connect_recharges (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consultant_id       uuid          NOT NULL REFERENCES connect_consultants(id),
  razorpay_order_id   text          UNIQUE,
  razorpay_payment_id text,
  stripe_payment_id   text,
  amount              numeric(12,2) NOT NULL,
  currency_code       text          NOT NULL DEFAULT 'INR',
  minutes_credited    numeric(10,2) NOT NULL,
  platform_fee        numeric(12,2) NOT NULL,   -- 20% of amount
  consultant_credit   numeric(12,2) NOT NULL,   -- 80% of amount
  status              text          NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','completed','failed')),
  created_at          timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE connect_recharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connect_recharges_own_select" ON connect_recharges
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_connect_recharges_user ON connect_recharges(user_id);
CREATE INDEX IF NOT EXISTS idx_connect_recharges_consultant ON connect_recharges(consultant_id);


-- ── TABLE 6: connect_payouts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connect_payouts (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_user_id  uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              numeric(12,2) NOT NULL,
  currency_code       text          NOT NULL DEFAULT 'INR',
  payout_method       text          CHECK (payout_method IN ('upi','bank','paypal')),
  payout_details      jsonb,        -- { upi_id } or { account_number, ifsc } etc.
  status              text          NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','completed','failed')),
  admin_note          text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  processed_at        timestamptz
);

ALTER TABLE connect_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connect_payouts_own_select" ON connect_payouts
  FOR SELECT USING (auth.uid() = consultant_user_id);

CREATE INDEX IF NOT EXISTS idx_connect_payouts_consultant ON connect_payouts(consultant_user_id);


-- ── HELPER: auto-update updated_at on connect_consultants ────────────────────
CREATE OR REPLACE FUNCTION update_connect_consultants_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connect_consultants_updated_at ON connect_consultants;
CREATE TRIGGER trg_connect_consultants_updated_at
  BEFORE UPDATE ON connect_consultants
  FOR EACH ROW EXECUTE FUNCTION update_connect_consultants_updated_at();


-- ── REALTIME ─────────────────────────────────────────────────────────────────
-- Run these in Supabase Dashboard → Database → Replication if SQL fails:
--   ALTER PUBLICATION supabase_realtime ADD TABLE connect_messages;
--   ALTER PUBLICATION supabase_realtime ADD TABLE connect_sessions;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND tablename = 'connect_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE connect_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND tablename = 'connect_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE connect_sessions;
  END IF;
END;
$$;


-- ── app_settings row for exchange rates (if table exists) ────────────────────
-- Upsert a placeholder; the /api/cron/exchange-rates route will fill in real values.
INSERT INTO app_settings (key, value)
VALUES ('exchange_rates', '{
  "USD": 83.5,
  "EUR": 90.2,
  "GBP": 105.8,
  "AED": 22.7,
  "SGD": 61.9,
  "AUD": 54.3
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
