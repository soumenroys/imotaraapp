-- docs/sql/admin_v6_message_filter.sql
-- Admin ⇒ Licenses ⇒ User Licenses: filter by NUMBER OF MESSAGES (owner, 12 Nov 2026 — task #136).
-- Run ONCE in the Supabase SQL editor. Read-only: it creates a function, it changes no data.
-- Same as admin_search_users_v5 (docs/sql/admin_v5_users_activity.sql) plus f_msgs_min / f_msgs_max.
-- The page keeps working on v5 until this is run (only the message filter is unavailable).
-- message_count = the person's OWN messages in synced history — chats kept only on a phone are not
-- on the server, so it can be lower than the real number. A count only; never any text.

create or replace function admin_search_users_v6(
  search_email      text        default null,
  page_offset       integer     default 0,
  page_limit        integer     default 20,
  exclude_anonymous boolean     default false,
  f_tier            text        default null,  -- 'free' | 'plus' | 'family' | 'none'
  f_status          text        default null,  -- 'trial' | 'valid' | 'cancelling' | 'expired' | 'invalid'
  f_platform        text        default null,  -- 'web' | 'android' | 'ios' | 'unknown'
  f_active_days     integer     default null,  -- active within N days; 0 = never active
  f_joined_from     timestamptz default null,
  f_joined_to       timestamptz default null,
  sort_by           text        default 'updated', -- 'updated' | 'last_active' | 'messages' | 'joined'
  f_msgs_min        integer     default null,  -- #136: own messages, inclusive
  f_msgs_max        integer     default null   -- #136: inclusive; null = no upper limit
)
returns table (
  user_id            uuid,
  email              text,
  user_created_at    timestamptz,
  tier               text,
  status             text,
  expires_at         timestamptz,
  token_balance      integer,
  source             text,
  license_notes      text,
  license_created_at timestamptz,
  license_updated_at timestamptz,
  banned_at          timestamptz,
  is_anonymous       boolean,
  message_count      bigint,
  last_active_at     timestamptz,
  platform           text,
  total_count        bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with hist as (
    select substring(h.id from 1 for 36)::uuid as uid,
           count(*) filter (where h.record->>'source' = 'user' and not coalesce(h.deleted, false)) as msgs,
           max(h.created_at_ms) as last_ms
    from public.imotara_history h
    where h.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:'
    group by 1
  ),
  ue as (
    select e.user_id as uid,
           max(e.created_at) as last_at,
           (array_agg(e.platform order by e.created_at desc) filter (where e.platform is not null and e.platform <> 'unknown'))[1] as platform
    from public.usage_events e
    where e.user_id is not null
    group by 1
  ),
  base as (
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
      coalesce(h.msgs, 0)::bigint     as message_count,
      nullif(greatest(
        coalesce(to_timestamp(nullif(h.last_ms, 0) / 1000.0), '-infinity'::timestamptz),
        coalesce(ue.last_at,                        '-infinity'::timestamptz),
        coalesce(u.last_sign_in_at,                 '-infinity'::timestamptz)
      ), '-infinity'::timestamptz)    as last_active_at,
      ue.platform
    from auth.users u
    left join public.licenses   l  on l.user_id = u.id
    left join public.user_bans  b  on b.user_id = u.id and b.unbanned_at is null
    left join hist              h  on h.uid = u.id
    left join ue                   on ue.uid = u.id
  )
  select base.*, count(*) over () as total_count
  from base
  where
    (search_email is null or base.email ilike '%' || search_email || '%')
    and (not exclude_anonymous or not base.is_anonymous)
    and (f_tier is null
         or (f_tier = 'none' and base.tier is null)
         or base.tier = f_tier)
    and (f_status is null
         or (f_status = 'expired' and base.expires_at is not null and base.expires_at < now())
         or (f_status <> 'expired' and base.status = f_status))
    and (f_platform is null
         or (f_platform = 'unknown' and base.platform is null)
         or base.platform = f_platform)
    and (f_active_days is null
         or (f_active_days = 0 and base.last_active_at is null)
         or (f_active_days > 0 and base.last_active_at >= now() - make_interval(days => f_active_days)))
    and (f_joined_from is null or base.user_created_at >= f_joined_from)
    and (f_joined_to   is null or base.user_created_at <  f_joined_to)
    and (f_msgs_min    is null or base.message_count >= f_msgs_min)
    and (f_msgs_max    is null or base.message_count <= f_msgs_max)
  order by
    case when sort_by = 'last_active' then base.last_active_at  end desc nulls last,
    case when sort_by = 'messages'    then base.message_count   end desc nulls last,
    case when sort_by = 'joined'      then base.user_created_at end desc nulls last,
    coalesce(base.license_updated_at, base.user_created_at) desc
  offset page_offset
  limit  page_limit;
$$;

revoke execute on function admin_search_users_v6(text, integer, integer, boolean, text, text, text, integer, timestamptz, timestamptz, text, integer, integer)
  from public, anon, authenticated;
grant  execute on function admin_search_users_v6(text, integer, integer, boolean, text, text, text, integer, timestamptz, timestamptz, text, integer, integer)
  to service_role;

-- check (read-only; expected: people with 1–5 messages, most messages first)
select email, message_count, last_active_at, total_count
from admin_search_users_v6(null, 0, 5, true, null, null, null, null, null, null, 'messages', 1, 5);
