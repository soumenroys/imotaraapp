-- admin_v4_licenses_pagination.sql
-- Updates admin_search_users_with_licenses so the admin licenses screen can
-- page through every user, and can hide anonymous guest accounts.
-- Run in Supabase SQL Editor.
--
-- WHY
--
-- The screen showed only the 20 most-recently-updated users and had no way to
-- reach anyone older — the UI never sent page_offset. Worse, the query reads
-- from auth.users, and the mobile app signs people in anonymously by default,
-- so every guest occupies a row. As guests accumulate they crowd real,
-- licensable users out of the only window the screen has.
--
-- WHAT CHANGES
--
--   * exclude_anonymous (new arg, defaults false)  — filters guest accounts out
--   * is_anonymous      (new column)               — so the UI can label them
--   * total_count       (new column)               — so the UI can say
--                                                    "showing 21-40 of 137"
--
-- Anonymity is taken from auth.users.is_anonymous, which Supabase maintains,
-- rather than inferred from a null email. Five other routes in this codebase
-- already trust that column, and a real user who happens to have no email
-- must not be misfiled as a guest.
--
-- BACKWARD COMPATIBILITY
--
-- exclude_anonymous defaults to false, so any caller using the old three-arg
-- signature behaves exactly as before. The two added output columns are
-- additive; the single caller (src/app/api/admin/licenses/route.ts) selects by
-- name. That route also falls back to the old argument list if this migration
-- has not been run yet, so deploying the code first degrades the filter
-- rather than breaking the screen — but run this FIRST and the fallback never
-- has to be used.
--
-- total_count is count(*) OVER (), i.e. the size of the filtered set before
-- OFFSET/LIMIT. It is repeated on every row; that is the normal cost of
-- getting a total without a second round trip, and the page is at most 50 rows.

create or replace function admin_search_users_with_licenses(
  search_email      text    default null,
  page_offset       integer default 0,
  page_limit        integer default 20,
  exclude_anonymous boolean default false
)
returns table (
  user_id               uuid,
  email                 text,
  user_created_at       timestamptz,
  tier                  text,
  status                text,
  expires_at            timestamptz,
  token_balance         integer,
  source                text,
  license_notes         text,
  license_created_at    timestamptz,
  license_updated_at    timestamptz,
  banned_at             timestamptz,
  is_anonymous          boolean,
  total_count           bigint
)
language sql
security definer
set search_path = public
as $$
  select
    u.id                  as user_id,
    u.email,
    u.created_at          as user_created_at,
    l.tier,
    l.status,
    l.expires_at,
    l.token_balance,
    l.source,
    l.notes               as license_notes,
    l.created_at          as license_created_at,
    l.updated_at          as license_updated_at,
    b.banned_at,
    coalesce(u.is_anonymous, false) as is_anonymous,
    count(*) over ()      as total_count
  from auth.users u
  left join public.licenses l on l.user_id = u.id
  left join public.user_bans b on b.user_id = u.id and b.unbanned_at is null
  where
    (search_email is null or u.email ilike '%' || search_email || '%')
    and (not exclude_anonymous or not coalesce(u.is_anonymous, false))
  order by coalesce(l.updated_at, u.created_at) desc
  offset page_offset
  limit  page_limit;
$$;

-- Permissions unchanged from admin_v3 — service_role only.
revoke execute on function admin_search_users_with_licenses from public, anon, authenticated;
grant  execute on function admin_search_users_with_licenses to service_role;

-- Sanity checks (safe to run, read-only):
--   select count(*) from auth.users;
--   select count(*) from auth.users where coalesce(is_anonymous, false);
--   select user_id, email, is_anonymous, total_count
--     from admin_search_users_with_licenses(null, 0, 5, true);
