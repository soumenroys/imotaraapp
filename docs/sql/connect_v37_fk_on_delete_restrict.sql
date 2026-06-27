-- connect_v37_fk_on_delete_restrict.sql
-- Adds ON DELETE RESTRICT to connect_sessions.consultant_id and
-- connect_recharges.consultant_id foreign keys.
--
-- WHY:
--   The original FK definitions have no ON DELETE clause, which defaults to
--   NO ACTION (raises an error at statement end if orphans exist). However,
--   deferred constraints can silently allow the DELETE to succeed in some
--   transaction patterns. ON DELETE RESTRICT is checked immediately at row
--   delete time, making the protection explicit and non-deferrable.
--
--   Without this, a hard-delete of a connect_consultants row (e.g. emergency
--   admin cleanup) would silently produce orphan connect_sessions and
--   connect_recharges rows with a dangling consultant_id.
--
-- SAFE TO RUN ON LIVE DB:
--   Dropping and re-adding a FK constraint is a metadata-only operation in
--   Postgres — it does not rewrite any rows. Downtime: none.
--   A brief ACCESS SHARE lock is taken on the table during the constraint scan.
--
-- PRE-FLIGHT: confirm no existing orphan rows (should return 0):
--   SELECT id FROM connect_sessions
--     WHERE consultant_id NOT IN (SELECT id FROM connect_consultants);
--   SELECT id FROM connect_recharges
--     WHERE consultant_id NOT IN (SELECT id FROM connect_consultants);

-- ─── 1. connect_sessions.consultant_id ────────────────────────────────────────

ALTER TABLE connect_sessions
  DROP CONSTRAINT IF EXISTS connect_sessions_consultant_id_fkey;

ALTER TABLE connect_sessions
  ADD CONSTRAINT connect_sessions_consultant_id_fkey
  FOREIGN KEY (consultant_id)
  REFERENCES connect_consultants (id)
  ON DELETE RESTRICT;


-- ─── 2. connect_recharges.consultant_id ───────────────────────────────────────

ALTER TABLE connect_recharges
  DROP CONSTRAINT IF EXISTS connect_recharges_consultant_id_fkey;

ALTER TABLE connect_recharges
  ADD CONSTRAINT connect_recharges_consultant_id_fkey
  FOREIGN KEY (consultant_id)
  REFERENCES connect_consultants (id)
  ON DELETE RESTRICT;
