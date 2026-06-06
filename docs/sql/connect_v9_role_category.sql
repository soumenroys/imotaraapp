-- connect_v9_role_category.sql
-- Adds role_category to connect_consultants for the full vision (12 categories).
-- Phase 1 supports only wellness_companion.

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS role_category text NOT NULL DEFAULT 'wellness_companion';

COMMENT ON COLUMN connect_consultants.role_category IS
  'Relationship role: wellness_companion | friend | dad | mom | sister | brother | grandfather | grandmother | yoga_instructor | fitness_companion';

CREATE INDEX IF NOT EXISTS idx_connect_consultants_role_category
  ON connect_consultants (role_category);
