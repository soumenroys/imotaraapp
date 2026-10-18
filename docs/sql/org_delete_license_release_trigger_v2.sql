-- docs/sql/org_delete_license_release_trigger_v2.sql
--
-- 🔴 DELETING AN ORGANISATION STRIPPED A PERMANENT ENTITLEMENT FROM ITS MEMBERS.
--
-- The v1 trigger (org_delete_license_release_trigger.sql) released members by
-- setting `tier = 'free'`. That was right when it was written and became wrong
-- on 2026-10-01, when the grandfather backfill ran.
--
-- The backfill's design is stated in its own file: **a floor, never an
-- overwrite**. For members of an organisation it did this —
--
--     update public.licenses
--     set tier='plus', status='valid', expires_at=null,
--         notes = ... 'permanent plus floor under org tier;
--                      org licence still governs while live'
--     where tier = 'edu';                       -- 4 rows
--
-- — so the stored row IS the floor, and the org tier governs on top of it
-- while the org is alive. When the org goes away the member should land ON
-- THEIR FLOOR, not on the ground.
--
-- ⚠️ v1 landed them on the ground. All four current org members hold
-- `plus / expires_at null` with the note "permanent plus floor under org
-- tier", and deleting their organisation would have set every one of them to
-- free — taking away a thing the word "permanent" was used about.
--
-- ⛔ Found by reading a member's licence before pressing delete, not after.
--
-- ── THE RULE ────────────────────────────────────────────────────────────────
-- An account created before the 2026-10-01 cutoff has a permanent Plus floor.
-- That is the backfill's own definition of who qualifies ("pre-cutoff
-- account"), and it is what STEP 5 of that file bounds on, so this trigger and
-- the backfill cannot disagree about who is owed what.
--
-- Anyone who signed up after the cutoff never had a floor, so for them the
-- release still lands on free, exactly as before.
--
-- Safe to re-run: it replaces the function and recreates the trigger.

create or replace function release_licenses_on_org_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update licenses l
  set    org_id     = null,
         -- 🔑 The floor, for anyone who holds one. 'free' only for accounts
         -- that postdate the cutoff and therefore never had one.
         tier       = case when u.created_at < timestamptz '2026-10-01 00:00:00+00'
                           then 'plus' else 'free' end,
         status     = 'valid',
         -- ⚠️ NULL = permanent. A date here would grant nothing past it, which
         -- is the same mistake in a different costume.
         expires_at = null,
         source     = case when u.created_at < timestamptz '2026-10-01 00:00:00+00'
                           then 'grandfather' else 'manual' end,
         notes      = coalesce(l.notes || ' · ', '') ||
                      'org ' || old.name || ' deleted ' || to_char(now(), 'YYYY-MM-DD') ||
                      case when u.created_at < timestamptz '2026-10-01 00:00:00+00'
                           then ' — released to permanent plus floor'
                           else ' — released to free (post-cutoff account)' end,
         updated_at = now()
  from   auth.users u
  where  l.org_id = old.id
    and  u.id = l.user_id;
  return old;
end;
$$;

drop trigger if exists trg_release_licenses_on_org_delete on organizations;

create trigger trg_release_licenses_on_org_delete
before delete on organizations
for each row
execute function release_licenses_on_org_delete();

-- ── Check before you delete anything ────────────────────────────────────────
-- Shows what each current org member would become. Run it, read it, then
-- delete. Nothing below changes a row.
select o.name                              as org,
       u.email,
       l.tier                              as tier_now,
       case when u.created_at < timestamptz '2026-10-01 00:00:00+00'
            then 'plus (permanent floor)' else 'free' end
                                           as tier_after_org_delete,
       u.created_at::date                  as account_created
from   licenses l
join   auth.users u     on u.id = l.user_id
join   organizations o  on o.id = l.org_id
order  by o.name, u.email;
