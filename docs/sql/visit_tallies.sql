-- docs/sql/visit_tallies.sql
-- Run in Supabase SQL editor.
--
-- DO PEOPLE COME BACK, AND HOW LONG DO THEY STAY — for EVERYONE, guests
-- included, with no identifier of any kind.
--
-- 🔑 OWNER, 31 Oct 2026 (S4): "users are not returning a second time" and "not
-- spending much time" could not be measured: usage_events records only
-- signed-in cloud replies, so guests and on-device replies were invisible, and
-- GA was mostly our own admin pages and mail scanners. The owner agreed to an
-- ANONYMOUS count — "no message text, no name, no account".
--
-- 🔑 HOW RETURN IS MEASURED WITHOUT A DEVICE ID. The device remembers, on the
-- device, the day it first opened Imotara. Once a day it reports only "this is
-- day N since my first visit". Day-0 rows are the new devices of that day;
-- day-1 rows a day later are the ones that came back. Retention is arithmetic
-- on tallies — no row can be joined to another, because nothing ties them.
--
-- 🔑 HOW TIME SPENT IS MEASURED. When a visit ends, the device reports only
-- "k messages sent, about m minutes" — as buckets. If the same visit carries
-- on (back within 30 minutes) the device moves its own +1 from the old bucket
-- to the new one (delta -1 / +1), so a visit is counted once, at its final size.
--
-- ⛔ NOT COLLECTED, and must stay that way: user id, account, device id,
-- session id, IP (in any form), country, city, message text, timestamps finer
-- than the day. This matches the privacy policy's "anonymous performance
-- metrics" and "a daily tally … with nothing in it that identifies a person".

begin;

create table if not exists public.visit_tallies (
    day        date     not null,
    -- web | ios | android | unknown — server-side resolvePlatform(), never trusted from the body.
    platform   text     not null,
    -- visit_age: bucket = days since this device's first visit (0–30 exact, 31 = 31–90, 91 = 91+)
    -- session_messages: bucket = messages sent in the visit (0–5 exact, 6 = 6–10, 11 = 11+)
    -- session_minutes:  bucket = minutes in the visit (0 = <1, 1, 2, 3 = 3–5, 6 = 6–10, 11 = 11–20, 21 = 21+)
    kind       text     not null,
    bucket     smallint not null,
    hits       integer  not null default 0,
    updated_at timestamptz not null default now(),

    primary key (day, platform, kind, bucket),

    constraint visit_tallies_platform_chk check (platform in ('web','ios','android','unknown')),
    constraint visit_tallies_kind_chk     check (kind in ('visit_age','session_messages','session_minutes')),
    constraint visit_tallies_bucket_chk   check (bucket between 0 and 91),
    constraint visit_tallies_hits_chk     check (hits >= 0)
);

comment on table public.visit_tallies is
    'Anonymous daily tallies: days-since-first-visit, messages and minutes per visit. No user, device, session, IP or place. See docs/sql/visit_tallies.sql.';

create index if not exists visit_tallies_day_idx on public.visit_tallies (day desc);

-- ── The atomic increment (and the -1 that moves a visit to its final bucket) ──
create or replace function public.imotara_record_visit_tally(
    p_platform text,
    p_kind     text,
    p_bucket   integer,
    p_delta    integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if p_delta not in (-1, 1) then
        return;
    end if;
    insert into public.visit_tallies (day, platform, kind, bucket, hits, updated_at)
    values (current_date, p_platform, p_kind, p_bucket, greatest(p_delta, 0), now())
    on conflict (day, platform, kind, bucket)
    do update set hits = greatest(0, visit_tallies.hits + p_delta), updated_at = now();
end;
$$;

-- ── Access: service role only ────────────────────────────────────────────────
alter table public.visit_tallies enable row level security;

drop policy if exists "service_only_visit_tallies" on public.visit_tallies;
create policy "service_only_visit_tallies" on public.visit_tallies
    for all using (false);

revoke all on public.visit_tallies from anon;
revoke all on public.visit_tallies from authenticated;
-- 🔴 From 30 Oct 2026 a NEW table gets no Data API grant by default — even the
-- service role is refused without this line ⇒ trap_new_supabase_tables_need_explicit_grants.
grant select, insert, update, delete on public.visit_tallies to service_role;

revoke all on function public.imotara_record_visit_tally(text, text, integer, integer) from public;
revoke all on function public.imotara_record_visit_tally(text, text, integer, integer) from anon;
revoke all on function public.imotara_record_visit_tally(text, text, integer, integer) from authenticated;
grant execute on function public.imotara_record_visit_tally(text, text, integer, integer) to service_role;

commit;

-- ── Proving it ──────────────────────────────────────────────────────────────
--   anon:    curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--              "$SUPABASE_URL/rest/v1/visit_tallies?select=*&limit=1"   → 42501 permission denied
--   counts:  select day, platform, kind, bucket, hits from public.visit_tallies
--              order by day desc, kind, bucket;
--   D1 return for day D:  hits(day = D+1, kind = 'visit_age', bucket = 1)
--                       / hits(day = D,   kind = 'visit_age', bucket = 0)
