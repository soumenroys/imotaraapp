-- docs/sql/google_grants.sql
-- One Google permission the server keeps, per purpose — today only the brand
-- calendar (owner, 31 Oct 2026: a meeting a person agreed to goes into the
-- imotara.imotara@gmail.com calendar, Tapan + Suchismita + the person invited).
--
-- 🔑 WHY A REFRESH TOKEN, AND NOT THE SERVICE ACCOUNT THE SHEET USES: Google
-- does not let a service account invite attendees on a normal Gmail calendar
-- (that needs a Workspace domain). So the server acts as the brand account
-- itself, through a consent given once in the imotara-publishing project.
--
-- ⛔ refresh_token is ENCRYPTED (lib/social/tokenCrypto, aad bound to purpose +
-- account). Only the service role can read the table: no anon, no signed-in user.
--
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.google_grants (
    purpose       text        primary key,
    account_email text        not null,
    refresh_token text        not null,
    scopes        text[]      not null default '{}',
    updated_at    timestamptz not null default now(),

    constraint google_grants_purpose_chk check (purpose in ('calendar'))
);

comment on table public.google_grants is
    'Google permissions the server keeps (refresh token encrypted). Service role only. See docs/sql/google_grants.sql.';

alter table public.google_grants enable row level security;

-- ⚠️ From 30 Oct 2026 a new table needs its grants spelled out, service_role too.
revoke all on public.google_grants from anon, authenticated;
grant select, insert, update, delete on public.google_grants to service_role;
