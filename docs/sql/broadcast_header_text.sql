-- Broadcast header text (owner request, 2026-09-12)
--
-- Adds one optional line of operator-written text that renders in the email
-- masthead, under the Imotara mark. Nullable with no default, so every
-- existing draft keeps rendering exactly as it does today: no value means the
-- header shows the logo and name only.
--
-- This repo has no migration runner — run this by hand in the Supabase SQL
-- Editor. It is idempotent and safe to run twice.

alter table broadcasts
  add column if not exists header_text text;

comment on column broadcasts.header_text is
  'Optional line shown in the email masthead beneath the Imotara mark. Escaped at render time (markup.ts headerHtml); never trusted as HTML.';
