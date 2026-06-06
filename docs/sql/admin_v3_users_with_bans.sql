-- admin_v3_users_with_bans.sql
-- Updates admin_search_users_with_licenses RPC to include ban status.
-- Run in Supabase SQL Editor.

create or replace function admin_search_users_with_licenses(
  search_email  text    default null,
  page_offset   integer default 0,
  page_limit    integer default 20
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
  banned_at             timestamptz
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
    b.banned_at
  from auth.users u
  left join public.licenses l on l.user_id = u.id
  left join public.user_bans b on b.user_id = u.id and b.unbanned_at is null
  where
    search_email is null
    or u.email ilike '%' || search_email || '%'
  order by coalesce(l.updated_at, u.created_at) desc
  offset page_offset
  limit  page_limit;
$$;

-- Permissions unchanged
revoke execute on function admin_search_users_with_licenses from public, anon, authenticated;
grant  execute on function admin_search_users_with_licenses to service_role;
