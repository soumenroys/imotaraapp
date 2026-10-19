-- docs/sql/social_accounts_refresh_token.sql
-- A second, DIFFERENT kind of secret, because YouTube is not like the others.
--
-- 🔑 WHY A NEW COLUMN RATHER THAN REUSING `access_token`.
--
-- Facebook, Instagram and LinkedIn each hand over one long-lived token: what we
-- store is what we send, and `access_token` is an honest name for it. Google's
-- access tokens last about an HOUR, so for YouTube the durable secret is a
-- REFRESH token, which is never sent to YouTube at all — it is exchanged with
-- Google for a short-lived access token immediately before each upload.
--
-- ⛔ PUTTING A REFRESH TOKEN IN A COLUMN CALLED `access_token` WOULD HAVE
-- WORKED, and that is exactly the problem. The next person to read the schema
-- would believe the name, and the first symptom of their believing it would be
-- a 401 from YouTube that reads precisely like an expired credential. A name
-- that lies costs more than a column
-- ⇒ trap_a_constraint_nobody_told_the_writer.
--
-- ⚠️ NULLABLE ON PURPOSE. Every existing row — facebook, instagram — has no
-- refresh token and never will. A NOT NULL with a dummy default would mean
-- "every channel has one of these", which is false.
--
-- 🔑 ENCRYPTED WITH THE SAME AAD AS `access_token`: platform + external_id, via
-- tokenAad(). ⚠️ That binding is why editing `external_id` on a connected row
-- BRICKS the secret rather than renaming it
-- ⇒ trap_an_id_can_be_half_an_encryption_key.

alter table public.social_accounts
  add column if not exists refresh_token text;

comment on column public.social_accounts.refresh_token is
  'Encrypted OAuth REFRESH token, for platforms whose access tokens are short-lived (YouTube/Google: ~1h). '
  'NULL for every platform that issues one long-lived token — facebook, instagram, linkedin, x. '
  'Encrypted with the same AAD as access_token (platform + external_id), so changing external_id '
  'makes it undecryptable rather than wrong. Never sent to the platform: it is exchanged with the '
  'provider for a short-lived access token at publish time.';

-- ⛔ NO INDEX, DELIBERATELY. Nothing looks a channel up BY its secret, and an
-- index on a credential column is a credential in one more place.
