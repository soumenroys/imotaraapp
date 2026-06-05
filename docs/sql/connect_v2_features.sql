-- connect_v2_features.sql
-- Migration for all Imotara Connect v2 feature improvements.
-- Run in Supabase SQL editor.

-- ─── connect_sessions: lock rate at creation, track billing, orphan detection ───

ALTER TABLE connect_sessions
  ADD COLUMN IF NOT EXISTS rate_per_min    NUMERIC        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_tick_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_at   TIMESTAMPTZ;

-- amount_charged already exists; ensure it's NUMERIC
-- ALTER TABLE connect_sessions ALTER COLUMN amount_charged TYPE NUMERIC USING amount_charged::NUMERIC;

-- ─── connect_consultants: busy status + availability windows ─────────────────

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS is_busy              BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS availability_windows JSONB;

-- ─── connect_blocks: consultant blocks a user ────────────────────────────────

CREATE TABLE IF NOT EXISTS connect_blocks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id    UUID        NOT NULL REFERENCES connect_consultants(id) ON DELETE CASCADE,
  blocked_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (consultant_id, blocked_user_id)
);

ALTER TABLE connect_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultant manages own blocks"
  ON connect_blocks
  FOR ALL
  USING (
    consultant_id IN (
      SELECT id FROM connect_consultants WHERE user_id = auth.uid()
    )
  );

-- ─── connect_favorites: user bookmarks a consultant ──────────────────────────

CREATE TABLE IF NOT EXISTS connect_favorites (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consultant_id UUID        NOT NULL REFERENCES connect_consultants(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, consultant_id)
);

ALTER TABLE connect_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own favorites"
  ON connect_favorites
  FOR ALL
  USING (user_id = auth.uid());

-- ─── connect_session_notes: consultant private notes per session ─────────────

CREATE TABLE IF NOT EXISTS connect_session_notes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        NOT NULL REFERENCES connect_sessions(id) ON DELETE CASCADE,
  consultant_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content             TEXT        NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, consultant_user_id)
);

ALTER TABLE connect_session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultant manages own session notes"
  ON connect_session_notes
  FOR ALL
  USING (consultant_user_id = auth.uid());

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_connect_blocks_consultant   ON connect_blocks(consultant_id);
CREATE INDEX IF NOT EXISTS idx_connect_blocks_user         ON connect_blocks(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_connect_favorites_user      ON connect_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_connect_favorites_consult   ON connect_favorites(consultant_id);
CREATE INDEX IF NOT EXISTS idx_connect_sessions_last_tick  ON connect_sessions(last_tick_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_connect_session_notes_sess  ON connect_session_notes(session_id);
