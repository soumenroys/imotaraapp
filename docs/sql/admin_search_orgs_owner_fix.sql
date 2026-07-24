-- admin_search_orgs_owner_fix.sql
-- Run manually in the Supabase SQL Editor (same workflow as every other
-- schema/function change in this repo).
--
-- Bug: admin_search_orgs (the super-admin org list at /admin) derived
-- owner_email ONLY from organizations.owner_user_id. That column is a
-- decorative pointer set only by two paths: self-serve org creation
-- (org/new/route.ts, which also creates a real org_members row) and admin
-- org creation with an "Owner email" field (organizations/route.ts, which
-- — until the accompanying app-code fix — did NOT create an org_members
-- row or a licenses.org_id for that person at all).
--
-- Net effect: any org whose real, functional admin was added afterward via
-- the separate member-provisioning flow (createAndInvite / "Add member by
-- email" / domain auto-join / self-serve invite-accept) — i.e. every org
-- that was created as an empty shell first — showed "no owner" in the
-- super-admin org list and detail view, even though it had a genuine active
-- org_members row with role owner/admin. This is why a super admin entering
-- such an org couldn't find who the org admin was: the one place shown a
-- one-line summary (owner_email) was reading the wrong source of truth.
--
-- Fix: prefer the real org_members-derived admin (role owner, else admin,
-- picking the earliest by joined_at), falling back to owner_user_id only
-- for orgs that have neither (matches the pre-existing legacy behavior).
-- Same for the search predicate, so searching by an org admin's email also
-- finds orgs whose owner was set up via member-provisioning only.

create or replace function admin_search_orgs(
  search_query  text    default null,
  status_filter text    default null,   -- null = all
  page_offset   integer default 0,
  page_limit    integer default 20
)
returns table (
  org_id           uuid,
  name             text,
  slug             text,
  billing_type     text,
  tier             text,
  status           text,
  seats_purchased  integer,
  seats_used       integer,
  owner_email      text,
  expires_at       timestamptz,
  created_at       timestamptz,
  member_count     bigint
)
language sql
security definer
set search_path = public
as $$
  select
    o.id              as org_id,
    o.name,
    o.slug,
    o.billing_type,
    o.tier,
    o.status,
    o.seats_purchased,
    o.seats_used,
    coalesce(
      (
        select u2.email
        from org_members om2
        join auth.users u2 on u2.id = om2.user_id
        where om2.org_id = o.id and om2.status = 'active'
        order by case om2.role when 'owner' then 0 when 'admin' then 1 else 2 end, om2.joined_at
        limit 1
      ),
      u.email
    )                 as owner_email,
    o.expires_at,
    o.created_at,
    count(om.id)      as member_count
  from organizations o
  left join auth.users u  on u.id = o.owner_user_id
  left join org_members om on om.org_id = o.id and om.status = 'active'
  where
    (status_filter is null or o.status = status_filter)
    and (
      search_query is null
      or o.name  ilike '%' || search_query || '%'
      or o.slug  ilike '%' || search_query || '%'
      or u.email ilike '%' || search_query || '%'
      or exists (
        select 1
        from org_members om3
        join auth.users u3 on u3.id = om3.user_id
        where om3.org_id = o.id and om3.status = 'active'
          and u3.email ilike '%' || search_query || '%'
      )
    )
  group by o.id, u.email
  order by o.created_at desc
  offset page_offset
  limit page_limit;
$$;

revoke execute on function admin_search_orgs from public, anon, authenticated;
grant  execute on function admin_search_orgs to service_role;
