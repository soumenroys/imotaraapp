-- docs/sql/usage_geo_daily.sql
-- Run in Supabase SQL editor.
--
-- WHERE IMOTARA IS USED, at country and region level, across web, iOS and
-- Android — without a location permission, without a coordinate, and without
-- a per-person location record.
--
-- 🔑 WHY THIS SHAPE AND NOT A COLUMN ON usage_events. A per-user location is
-- personal data and, recorded per event, it is not a location at all — it is a
-- MOVEMENT TRAIL. For an app people open when they are at their lowest, a
-- history of where someone was each time they used it is a liability far
-- beyond anything it would tell us. This table has **no user id, no session
-- id, no IP and no timestamp finer than the day**, so no row can be traced to
-- a person, and a row is shared by everyone who matches it.
--
-- ⛔ WHAT IS DELIBERATELY NOT COLLECTED, and must stay that way:
--   · latitude / longitude — Vercel offers x-vercel-ip-latitude and
--     -longitude on every request. We never read them.
--   · city — x-vercel-ip-city is available and is NOT read. A city plus a
--     mental-health session plus a date is identifying in a small town, and a
--     map pin is not worth that.
--   · the IP itself, in any form, hashed or otherwise.
--   · anything tying a row to a user, an account or a device.
--
-- 🔑 NO DEVICE LOCATION SERVICE IS INVOLVED. Both apps call imotara.com, so
-- every request already arrives at Vercel carrying the phone's IP and Vercel
-- attaches the geo headers at the edge. Location services can be off, denied,
-- or never requested — this still works, and the apps ask for no new
-- permission. ⚠️ The flip side: this records where the REQUEST came from, not
-- where the person is. VPNs, corporate egress and carrier NAT all lie. The
-- Singapore traffic in GA turned out to be e-mail security scanners, not
-- users, which is the standing reminder.

begin;

create table if not exists usage_geo_daily (
    -- ⚠️ The day, never a timestamp. Finer time would let a row be correlated
    -- with a single session, which is exactly what this table avoids.
    day        date    not null,
    -- ISO 3166-1 alpha-2, or 'ZZ' when the edge could not place the request.
    country    text    not null,
    -- State / province / region code, or '' when unknown. ⛔ NOT a city.
    region     text    not null default '',
    -- web | ios | android | unknown — from resolvePlatform(), which is the
    -- only thing GA cannot tell us, since GA is scoped to the website only.
    platform   text    not null,
    hits       integer not null default 0,
    updated_at timestamptz not null default now(),

    primary key (day, country, region, platform),

    constraint usage_geo_country_chk  check (country ~ '^[A-Z]{2}$'),
    constraint usage_geo_region_chk   check (char_length(region) <= 8),
    constraint usage_geo_platform_chk check (platform in ('web','ios','android','unknown')),
    constraint usage_geo_hits_chk     check (hits >= 0)
);

comment on table usage_geo_daily is
    'Aggregate usage counts by day/country/region/platform. No user id, no IP, no coordinates, no city — deliberately not personal data. See docs/sql/usage_geo_daily.sql.';

create index if not exists usage_geo_daily_day_idx on usage_geo_daily (day desc);

-- ── The atomic increment ────────────────────────────────────────────────────
-- ⚠️ A read-then-write from the route would lose counts under concurrency, and
-- PostgREST's upsert REPLACES rather than adds. `on conflict do update set
-- hits = hits + 1` inside one statement is the only version that counts
-- correctly when two requests land in the same millisecond.
create or replace function public.imotara_record_usage_geo(
    p_country  text,
    p_region   text,
    p_platform text
)
returns void
language plpgsql
security definer
-- ⛔ Pinned: a SECURITY DEFINER function without a fixed search_path can be
-- hijacked by a caller-controlled schema shadowing the table.
set search_path = public, pg_temp
as $$
begin
    insert into public.usage_geo_daily (day, country, region, platform, hits, updated_at)
    values (current_date, p_country, coalesce(p_region, ''), p_platform, 1, now())
    on conflict (day, country, region, platform)
    do update set hits = usage_geo_daily.hits + 1, updated_at = now();
end;
$$;

-- ── Access ──────────────────────────────────────────────────────────────────
-- ⛔ Service role only, both ways. The route writes with the service key; the
-- admin panel reads with it. Nothing reaches this from a browser.
-- This follows the decision already taken for crisis_events and user_bans, and
-- the lesson of connect_consultants_column_disclosure_fix.sql: revoke the
-- grant as well as writing a policy, because RLS is not the only door.
alter table usage_geo_daily enable row level security;

drop policy if exists "service_only_usage_geo" on public.usage_geo_daily;
create policy "service_only_usage_geo" on public.usage_geo_daily
    for all using (false);

revoke all on public.usage_geo_daily from anon;
revoke all on public.usage_geo_daily from authenticated;
revoke all on function public.imotara_record_usage_geo(text, text, text) from public;
revoke all on function public.imotara_record_usage_geo(text, text, text) from anon;
revoke all on function public.imotara_record_usage_geo(text, text, text) from authenticated;

commit;

-- ── Proving it ──────────────────────────────────────────────────────────────
-- Anon must be refused outright, exactly as connect_consultants now is:
--   curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     "$SUPABASE_URL/rest/v1/usage_geo_daily?select=*&limit=1"
--   → {"code":"42501","message":"permission denied for table usage_geo_daily"}
--
-- And the counts themselves, with the service key:
--   select day, country, region, platform, hits
--     from usage_geo_daily order by day desc, hits desc limit 20;
