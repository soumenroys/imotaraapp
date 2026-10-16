-- docs/sql/data_retention.sql
--
-- GDPR Art. 5(1)(e) storage limitation — the enforcement side of the retention
-- policy stated at /privacy.
--
-- 🔴 WHAT THIS FILE DOES NOT DO: delete anything. Not one DELETE statement.
-- It only *identifies* candidates and records what happened. The erasure runs
-- in src/lib/account/purgeUserData.ts, the same cascade the user-facing
-- "delete my account" button uses, so the two can never drift. A second delete
-- path written in SQL is exactly the drift this design exists to prevent.
--
-- ⚠️ THE POLICY, decided 2026-10-16: data is kept while an account is ACTIVE.
-- An account with no activity for 24 months is warned by email, and purged no
-- sooner than 30 days after that warning. Active users never lose history —
-- longitudinal mood history is the product, and a hard cap would delete the
-- thing people value most.
--
-- Apply in the Supabase SQL editor. Idempotent.

-- ── 1. Proof that the job ran ────────────────────────────────────────────────
-- 🔑 A cron that fails silently fails where nobody is watching: two of this
-- project's seven crons were dead for MONTHS and the only way that was ever
-- going to surface is by looking for what the job should have WRITTEN.
-- Every run inserts here, including a run that finds nothing to do.
create table if not exists public.retention_runs (
    id              bigserial primary key,
    ran_at          timestamptz not null default now(),
    -- false = report-only. The job runs in this mode until the owner flips
    -- IMOTARA_RETENTION_ENFORCE, so the first weeks produce evidence, not loss.
    enforced        boolean     not null,
    candidates      integer     not null default 0,
    warned          integer     not null default 0,
    purged          integer     not null default 0,
    errors          text[]      not null default '{}'
);

comment on table public.retention_runs is
    'One row per data-retention cron run. Its ABSENCE is the alarm: a gap means the cron is dead.';

-- ── 2. Who was warned, and when ──────────────────────────────────────────────
-- ⛔ No cascade to auth.users. The row must OUTLIVE the user it refers to —
-- it is the evidence that notice was given before erasure, and a cascade would
-- destroy that evidence at exactly the moment it becomes load-bearing.
create table if not exists public.retention_warnings (
    user_id     uuid        primary key,
    email       text,
    warned_at   timestamptz not null default now(),
    purged_at   timestamptz
);

comment on table public.retention_warnings is
    'Evidence that a dormant account was warned before erasure. Deliberately NOT cascaded from auth.users.';

alter table public.retention_runs     enable row level security;
alter table public.retention_warnings enable row level security;

-- No policies on purpose: service-role only. ⚠️ RLS filters ROWS, not COLUMNS —
-- the lesson from the 16 Oct security review — so the safe posture for a table
-- that should never be client-readable is no policy at all, not a narrow one.
revoke all on public.retention_runs     from anon, authenticated;
revoke all on public.retention_warnings from anon, authenticated;

-- ── 3. The candidate query ───────────────────────────────────────────────────
-- 🔑 "Inactive" is the LATEST of every signal we have, never a single one.
-- Using last_sign_in_at alone would purge someone who stays signed in on a
-- phone for two years and uses the app daily — the exact person least likely
-- to expect it, and a mental-health journal is the worst possible thing to
-- delete by accident.
create or replace function public.retention_candidates(p_months integer)
returns table (
    user_id        uuid,
    email          text,
    last_active_at timestamptz,
    warned_at      timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
    select
        u.id,
        u.email::text,
        greatest(
            coalesce(u.last_sign_in_at, u.created_at),
            u.created_at,
            coalesce((select max(ue.created_at) from public.usage_events ue where ue.user_id = u.id), u.created_at)
        ) as last_active_at,
        w.warned_at
    from auth.users u
    left join public.retention_warnings w on w.user_id = u.id
    where greatest(
            coalesce(u.last_sign_in_at, u.created_at),
            u.created_at,
            coalesce((select max(ue.created_at) from public.usage_events ue where ue.user_id = u.id), u.created_at)
          ) < now() - make_interval(months => p_months)
      and w.purged_at is null
$$;

-- 🔴 REVOKE FROM **PUBLIC** FIRST, AND THIS IS THE LINE THAT ACTUALLY MATTERS.
-- PostgreSQL grants EXECUTE on every new function to PUBLIC automatically, and
-- `anon` inherits it from there. Revoking from anon and authenticated by name
-- therefore removes NOTHING — the implicit PUBLIC grant is still standing.
--
-- ⚠️ MEASURED, 2026-10-16, after this file was first applied: calling this
-- function with the public anon key returned `[]` — it EXECUTED. It is
-- `security definer` and selects `auth.users.email`, so once accounts started
-- going dormant, anyone holding the anon key could have enumerated the email
-- addresses of dormant users. It returned empty only because no account is yet
-- 24 months idle; the hole was real and simply had nothing in it.
--
-- ⇒ Every other function in docs/sql already revokes from PUBLIC. This file
-- was the one that broke the convention.
revoke all on function public.retention_candidates(integer) from public;
revoke all on function public.retention_candidates(integer) from anon, authenticated;

comment on function public.retention_candidates(integer) is
    'Dormant-account candidates. READ ONLY — deletion is done by the app, through the same cascade as the user-facing account delete.';
