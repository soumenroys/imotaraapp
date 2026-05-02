-- admin_license_history: audit log for every admin license action
-- Run in Supabase SQL editor with service-role (no RLS needed on this table).

create table if not exists admin_license_history (
  id                  uuid        primary key default gen_random_uuid(),
  admin_label         text        not null default 'admin',  -- who acted (free-text label)
  user_id             uuid        references auth.users(id) on delete set null,
  user_email          text        not null,                  -- denormalised at time of action
  action              text        not null,
  -- 'assign' | 'extend' | 'withdraw' | 'tier_change' | 'token_adjust' | 'status_change'
  old_tier            text,
  new_tier            text,
  old_status          text,
  new_status          text,
  old_expires_at      timestamptz,
  new_expires_at      timestamptz,
  old_token_balance   integer,
  new_token_balance   integer,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists admin_license_history_user_idx
  on admin_license_history (user_id);
create index if not exists admin_license_history_created_idx
  on admin_license_history (created_at desc);

-- No RLS: only accessible via service-role key from admin API routes.

-- ── Search/join function (auth.users ⨝ licenses) ─────────────────────────────
-- Returns matching users with their current license row (LEFT JOIN — users
-- without a license row are included with NULL license fields).
-- security definer runs as postgres superuser so it can read auth.users.

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
  license_updated_at    timestamptz
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
    l.updated_at          as license_updated_at
  from auth.users u
  left join public.licenses l on l.user_id = u.id
  where
    search_email is null
    or u.email ilike '%' || search_email || '%'
  order by coalesce(l.updated_at, u.created_at) desc
  offset page_offset
  limit  page_limit;
$$;

-- Restrict: only service_role may call this function.
revoke execute on function admin_search_users_with_licenses from public, anon, authenticated;
grant  execute on function admin_search_users_with_licenses to service_role;
