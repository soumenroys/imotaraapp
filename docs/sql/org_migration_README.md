# Org Licensing — Supabase Migration Guide
Phase 1A · Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)  
Use **service-role** connection (postgres superuser) for all steps.

## Run Order — STRICTLY FOLLOW THIS SEQUENCE

| Step | File | What it creates |
|------|------|-----------------|
| 1 | `org_schema.sql` | `organizations`, `org_members`, `org_invites` tables + indexes + RLS |
| 2 | `org_audit_log.sql` | `org_audit_log` table + indexes + RLS |
| 3 | `org_licenses_alter.sql` | Adds `org_id` column to `licenses` + `tier_rank()` helper |
| 4 | `org_functions.sql` | All 7 DB functions (resolve tier, assign/revoke, stats, search) |

## Step-by-step

1. Open Supabase Dashboard → SQL Editor → New query
2. Paste contents of `org_schema.sql` → Run
3. Verify: Tables `organizations`, `org_members`, `org_invites` appear in Table Editor
4. New query → paste `org_audit_log.sql` → Run
5. Verify: Table `org_audit_log` appears
6. New query → paste `org_licenses_alter.sql` → Run
7. Verify: Column `org_id` appears in `licenses` table
8. New query → paste `org_functions.sql` → Run
9. Verify: Functions appear in Database → Functions

## Verification Queries (run after each step)

```sql
-- After step 1: check tables exist
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('organizations', 'org_members', 'org_invites');

-- After step 2: check audit log
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'org_audit_log';

-- After step 3: check org_id column added
select column_name, data_type from information_schema.columns
where table_name = 'licenses' and column_name = 'org_id';

-- After step 4: check all functions exist
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'resolve_user_tier', 'assign_org_license', 'revoke_org_license',
    'get_org_members', 'get_org_usage_stats', 'admin_search_orgs',
    'check_org_seat_available', 'tier_rank'
  );
```

## Rollback (if needed)

```sql
-- Run in reverse order if you need to undo
drop function if exists resolve_user_tier, assign_org_license, revoke_org_license,
  get_org_members, get_org_usage_stats, admin_search_orgs,
  check_org_seat_available, tier_rank cascade;

alter table licenses drop column if exists org_id;

drop table if exists org_audit_log cascade;
drop table if exists org_invites cascade;
drop table if exists org_members cascade;
drop table if exists organizations cascade;
```

## What's Next After Migration

Once SQL migration is done, implement Phase 1B–1E:

- `1B` — Server-side TypeScript functions: `assignOrgLicense()`, `revokeOrgLicense()`, `resolveUserTier()`
- `1C` — `useOrgContext()` React hook + API guards
- `1D` — Organizations tab in `/admin` panel
- `1E` — `/org/new` org creation form
