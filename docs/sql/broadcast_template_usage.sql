-- docs/sql/broadcast_template_usage.sql
--
-- Which message template a broadcast was started from, so the admin panel can
-- show how often each of the 50 has been used and how it actually performed.
--
-- Owner request, 2026-10-15: "add a counter with template content so that
-- admin can see which template was sent how many times with details".
--
-- ── WHY TWO COLUMNS AND NOT ONE ──────────────────────────────────────────────
--
-- A template is a STARTING POINT: the composer fills the subject and body with
-- editable markup and the admin then changes it. Recording only which template
-- seeded a message would quietly claim that the message still SAYS what the
-- template says, which after an edit is false — and a usage counter built on
-- that would be worse than no counter, because it would look authoritative.
--
-- So `template_id` records what it was started from, and `template_edited`
-- records whether the body still matched that template at the moment it was
-- sent. The panel reports both: "used 12 times, 8 unedited".
--
-- ⛔ template_id is deliberately NOT a foreign key. The catalogue lives in
-- TypeScript (src/lib/broadcast/templates/), not in the database, so there is
-- no table to reference. The API validates the id against the catalogue before
-- writing it, which is the real control; a check constraint here would have to
-- be migrated every time a template is added.
--
-- ⚠️ Safe to run more than once. Existing rows keep NULL, which reads as
-- "written before templates existed" and is exactly right.

alter table broadcasts
  add column if not exists template_id      text,
  add column if not exists template_edited  boolean;

-- The panel groups by template and orders by recency. Partial, because the
-- overwhelming majority of historical rows are NULL and indexing them is waste.
create index if not exists broadcasts_template_idx
  on broadcasts (template_id, created_at desc)
  where template_id is not null;

comment on column broadcasts.template_id is
  'Catalogue id from src/lib/broadcast/templates/ this message was started from. NULL = written from scratch, or predates templates. Validated by the API against the catalogue, not by a constraint.';

comment on column broadcasts.template_edited is
  'Whether the body still matched the template when the message was sent. NULL where template_id is NULL.';
