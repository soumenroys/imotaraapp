-- docs/sql/terms_acceptances.sql
--
-- Evidence that a person accepted the Terms and Privacy Policy, and WHICH text
-- they accepted.
--
-- WHY A DEDICATED TABLE RATHER THAN user_memory:
--   * user_memory is a mutable key/value store. An acceptance record that can be
--     overwritten is not evidence. This table is APPEND-ONLY by policy — there is
--     no UPDATE grant below, deliberately.
--   * The gate is shown at FIRST USE, before sign-in, so a record must be able to
--     exist with no user_id. user_memory is keyed by user_id and cannot hold one.
--
-- A later sign-in links the anonymous row to the account by setting user_id once
-- (see the link_terms_acceptance function), which is the only mutation allowed.

create table if not exists public.terms_acceptances (
    id           uuid primary key default gen_random_uuid(),

    -- Null until the person signs in. Both may be present after linking.
    user_id      uuid references auth.users(id) on delete set null,
    -- Stable per-device identifier generated client-side for guests.
    anon_id      text,

    -- WHICH text was accepted. Without this the row proves nothing.
    version      text        not null,
    -- When they accepted, as reported by the client.
    accepted_at  timestamptz not null,
    -- Which translation was actually on screen.
    locale       text        not null default 'en',
    -- 'web' | 'ios' | 'android'.
    surface      text        not null,

    -- Weak corroboration only. Never relied on for identity.
    user_agent   text,

    -- Server clock. Trusted over accepted_at, which a client controls.
    created_at   timestamptz not null default now(),

    constraint terms_acceptances_surface_check
        check (surface in ('web', 'ios', 'android')),
    -- A row with neither identifier cannot be tied to anyone, so it is not
    -- evidence of anything and must not be written.
    constraint terms_acceptances_has_subject
        check (user_id is not null or anon_id is not null)
);

create index if not exists terms_acceptances_user_idx
    on public.terms_acceptances (user_id, created_at desc);
create index if not exists terms_acceptances_anon_idx
    on public.terms_acceptances (anon_id, created_at desc);
create index if not exists terms_acceptances_version_idx
    on public.terms_acceptances (version);

alter table public.terms_acceptances enable row level security;

-- No policies for anon/authenticated at all: every read and write goes through
-- the service role in /api/legal/accept. A client that could write its own
-- acceptance row could also forge one.
revoke all on public.terms_acceptances from anon, authenticated;

comment on table public.terms_acceptances is
    'Append-only record of Terms/Privacy acceptance. Evidence for liability defence: proves WHO accepted WHICH version, WHEN, in WHICH language, on WHICH platform. Never UPDATE or DELETE rows here except to link anon_id to user_id on sign-in.';

-- Links a guest's earlier acceptance to the account they later create, so the
-- evidence trail survives signing in. Idempotent and never overwrites a row that
-- already belongs to a different user.
create or replace function public.link_terms_acceptance(p_anon_id text, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    affected integer;
begin
    if p_anon_id is null or p_user_id is null then
        return 0;
    end if;

    update public.terms_acceptances
       set user_id = p_user_id
     where anon_id = p_anon_id
       and user_id is null;

    get diagnostics affected = row_count;
    return affected;
end;
$$;

revoke all on function public.link_terms_acceptance(text, uuid) from public, anon, authenticated;
