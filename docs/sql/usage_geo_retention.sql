-- docs/sql/usage_geo_retention.sql
-- Run in Supabase SQL editor AFTER usage_geo_daily.sql.
--
-- 🔑 THE DATA GETS COARSER AS IT AGES, rather than being kept forever or
-- thrown away. Added 2026-10-16 at the owner's request to tighten the guard:
--
--   *"need extra cautious. take the guard properly. i do not want to intervene
--    anyones personal information honestly. i just want to see country or
--    state wise imotara users and usage for my own shake"*
--
-- ── WHY AGEING RATHER THAN DELETING ─────────────────────────────────────────
-- A daily row is already not personal data: no user id, no session, no IP, no
-- time finer than the day. The one way it could ever come CLOSE to pointing at
-- somebody is a very small count in a very specific place — "one iOS open from
-- this region on this date". That risk lives entirely in the DAY.
--
-- So after 100 days each day's rows are summed into a single row for the first
-- of that month. The trend survives forever, which is the whole point of
-- keeping it, while the thing that could single anyone out — the exact date —
-- is destroyed. Deleting instead would have protected nobody further and lost
-- the owner the year-on-year comparison he actually wants.
--
-- ⚠️ IT IS NOT REVERSIBLE, deliberately. Once a month is rolled up the daily
-- detail is gone for good; there is no archive copy.
--
-- ⛔ 100 days, not 30: it keeps a full quarter of daily detail for reading
-- week-on-week movement, which is the horizon anyone actually looks at.

begin;

create or replace function public.imotara_roll_up_usage_geo()
returns integer
language plpgsql
security definer
-- ⛔ Pinned, as with every SECURITY DEFINER function here.
set search_path = public, pg_temp
as $$
declare
    v_rolled integer := 0;
begin
    -- ⚠️ `day <> date_trunc(...)` is what makes this safe to run every night:
    -- a row already sitting on the first of its month is ALREADY rolled up and
    -- must not be folded into itself, which would double its count daily.
    with aged as (
        delete from public.usage_geo_daily
        where day < (current_date - interval '100 days')
          and day <> date_trunc('month', day)::date
        returning day, country, region, platform, hits
    ),
    monthly as (
        select date_trunc('month', day)::date as day,
               country, region, platform,
               sum(hits)::integer as hits
        from aged
        group by 1, 2, 3, 4
    )
    insert into public.usage_geo_daily (day, country, region, platform, hits, updated_at)
    select day, country, region, platform, hits, now() from monthly
    on conflict (day, country, region, platform)
    do update set hits = usage_geo_daily.hits + excluded.hits, updated_at = now();

    get diagnostics v_rolled = row_count;
    return v_rolled;
end;
$$;

comment on function public.imotara_roll_up_usage_geo() is
    'Sums usage_geo_daily rows older than 100 days into one row per month, destroying the exact date. Idempotent: already-rolled rows sit on the 1st and are skipped.';

revoke all on function public.imotara_roll_up_usage_geo() from public;
revoke all on function public.imotara_roll_up_usage_geo() from anon;
revoke all on function public.imotara_roll_up_usage_geo() from authenticated;

commit;

-- Called nightly from /api/cron/exchange-rates (02:00), rather than adding an
-- eighth Vercel cron — the cron count is pinned by
-- src/__tests__/broadcast/everyCronAnswersTheVerbVercelSends.test.ts, and a
-- once-a-day job does not need a schedule of its own.
--
-- To check what it would do before trusting it:
--   select count(*) from usage_geo_daily
--    where day < current_date - interval '100 days'
--      and day <> date_trunc('month', day)::date;
