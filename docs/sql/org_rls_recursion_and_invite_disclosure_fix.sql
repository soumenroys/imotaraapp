-- docs/sql/org_rls_recursion_and_invite_disclosure_fix.sql
--
-- 🔴 TWO DEFECTS, AND THE SECOND IS CURRENTLY HIDDEN BY THE FIRST.
-- Found 2026-10-16 in the owner-requested security review. ⛔ Fix them in one
-- migration: repairing the recursion alone would OPEN the disclosure.
--
-- ── ① RLS RECURSION ─────────────────────────────────────────────────────────
-- org_schema.sql defines, on org_members itself:
--
--   create policy "Org admins read all members" on org_members for select
--     using (exists (select 1 from org_members om where om.org_id = org_members.org_id ...));
--
-- Evaluating the policy requires reading org_members, which requires evaluating
-- the policy. Postgres raises 42P17 "infinite recursion detected in policy".
-- RLS applies inside subqueries too, so every OTHER table whose policy reads
-- org_members inherits the error — TEN tables in all: org_members,
-- org_invites, organizations, org_audit_log, org_license_pools,
-- org_license_assignments, api_keys, cohorts, referral_codes, payment_invoices.
--
-- ⚠️ This is NOT a vulnerability: it fails CLOSED. Measured 2026-10-16 against
-- production with the public anon key — every one of those tables answered 500
-- / 42P17, not data. It is a correctness defect: the policies do not do what
-- they say, and any client-side read of those tables errors. (Nothing
-- user-facing is broken today because the API routes use the service role,
-- which bypasses RLS entirely.)
--
-- ── ② THE DISCLOSURE THE RECURSION IS MASKING ───────────────────────────────
-- org_schema.sql also defines:
--
--   -- Anyone can read an invite by token (needed for the acceptance page)
--   create policy "Anyone can read invite by token" on org_invites for select
--     using (true);
--
-- 🔴 THE COMMENT SAYS "by token". THE PREDICATE HAS NO TOKEN FILTER. `using
-- (true)` grants every row of org_invites to every caller, including anonymous
-- ones holding the public anon key — which ships in the client bundle by
-- design. That is each pending invite's email, role, org_id and **token**, and
-- a token is all /org/invite/[token] needs to join an organisation.
--
-- ⛔ IT IS UNREACHABLE TODAY ONLY BY ACCIDENT. Permissive policies are OR'd,
-- and an error raised by any applicable policy fails the whole query, so the
-- 42P17 from "Org admins read org invites" masks it. Fix ① without ② and the
-- hole opens.
--
-- 🔑 AND IT IS NOT LOAD-BEARING. The acceptance page fetches
-- /api/org/invite/[token], which uses getSupabaseAdmin() — the service role,
-- which bypasses RLS. The browser never reads org_invites directly. So the
-- policy can be dropped outright: zero functional impact. The architecture the
-- comment describes is not the architecture the app has.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- A SECURITY DEFINER helper reads org_members as the table owner, so RLS is not
-- re-entered and the recursion cannot form. Each helper answers only about the
-- CALLER'S OWN membership and returns a boolean, so exposing it to anon and
-- authenticated leaks nothing — it cannot be used to enumerate anything.
--
-- ⚠️ ACCESS IS NOT WIDENED ANYWHERE. Every policy below grants exactly what its
-- predecessor meant to grant. The only removal is the `using (true)`.

begin;

-- ── 1. The helpers ──────────────────────────────────────────────────────────

create or replace function public.imotara_is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
-- ⛔ Pinned. A SECURITY DEFINER function without a fixed search_path can be
-- hijacked by a caller-controlled schema shadowing `org_members`.
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id  = p_org_id
      and om.user_id = auth.uid()
      and om.role    in ('owner', 'admin')
      and om.status  = 'active'
  );
$$;

create or replace function public.imotara_is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id  = p_org_id
      and om.user_id = auth.uid()
      and om.status  = 'active'
  );
$$;

comment on function public.imotara_is_org_admin(uuid) is
  'RLS helper. Answers only about auth.uid()''s own membership, so it cannot enumerate. SECURITY DEFINER to avoid the 42P17 recursion of a policy on org_members that reads org_members.';
comment on function public.imotara_is_org_member(uuid) is
  'RLS helper. Answers only about auth.uid()''s own membership, so it cannot enumerate.';

revoke all on function public.imotara_is_org_admin(uuid)  from public;
revoke all on function public.imotara_is_org_member(uuid) from public;
grant execute on function public.imotara_is_org_admin(uuid)  to anon, authenticated;
grant execute on function public.imotara_is_org_member(uuid) to anon, authenticated;

-- ── 2. The recursive policy, at the root ────────────────────────────────────
-- ⚠️ "Members read own membership" (auth.uid() = user_id) is NOT touched: it
-- never recursed, and it is what lets a plain member see their own row.

drop policy if exists "Org admins read all members" on public.org_members;
create policy "Org admins read all members"
  on public.org_members for select
  using (public.imotara_is_org_admin(org_id));

-- ── 3. ⛔ THE DISCLOSURE — dropped, not rewritten ───────────────────────────
-- There is no token-scoped policy to replace it with, and none is needed: the
-- only reader is a service-role API route. Granting anon nothing here is the
-- correct end state.

drop policy if exists "Anyone can read invite by token" on public.org_invites;

drop policy if exists "Org admins read org invites" on public.org_invites;
create policy "Org admins read org invites"
  on public.org_invites for select
  using (public.imotara_is_org_admin(org_id));

-- ── 4. The eight tables that inherited the error ────────────────────────────

drop policy if exists "Org members can read their org" on public.organizations;
create policy "Org members can read their org"
  on public.organizations for select
  using (auth.uid() = owner_user_id or public.imotara_is_org_member(id));

drop policy if exists "Org admins read own audit log" on public.org_audit_log;
create policy "Org admins read own audit log"
  on public.org_audit_log for select
  using (public.imotara_is_org_admin(org_id));

drop policy if exists "Org admins read own license pools" on public.org_license_pools;
create policy "Org admins read own license pools"
  on public.org_license_pools for select
  using (public.imotara_is_org_admin(org_id));

drop policy if exists "Org admins read own assignments" on public.org_license_assignments;
create policy "Org admins read own assignments"
  on public.org_license_assignments for select
  using (public.imotara_is_org_admin(org_id));

drop policy if exists "Org admins read own api keys" on public.api_keys;
create policy "Org admins read own api keys"
  on public.api_keys for select
  using (public.imotara_is_org_admin(org_id));

drop policy if exists "Org admins read cohorts" on public.cohorts;
create policy "Org admins read cohorts"
  on public.cohorts for select
  using (public.imotara_is_org_admin(org_id));

drop policy if exists "Org admins read own referral codes" on public.referral_codes;
create policy "Org admins read own referral codes"
  on public.referral_codes for select
  using (public.imotara_is_org_admin(org_id));

drop policy if exists "Org admins read org invoices" on public.payment_invoices;
create policy "Org admins read org invoices"
  on public.payment_invoices for select
  using (public.imotara_is_org_admin(org_id));

-- ── 5. ⛔ app_settings — a public read justified by ONE row's contents ──────
-- connect_v20_app_settings_rls.sql added, with a reason:
--
--   -- The exchange_rates value is public information — no need to restrict reads.
--   CREATE POLICY "app_settings_public_read" ON app_settings FOR SELECT USING (true);
--
-- That reasoning was sound for the row that existed. 🔴 BUT THE POLICY IS
-- TABLE-WIDE AND THE TABLE LATER GREW A SECOND KEY: `broadcast_identities`,
-- written by src/lib/broadcast/identities.ts, holding the staff sender names
-- and @imotara.com addresses a broadcast goes out as. Those silently inherited
-- the public read, and the anon key is in the client bundle.
--
-- ⚠️ Not credentials — but a tidy list of real staff addresses to spoof or
-- phish, published while the owner is actively fighting spoofing and inbox
-- placement. Measured 2026-10-16: this table answered anon with ROWS, unlike
-- every user table, which answered with [].
--
-- 🔑 DROPPED RATHER THAN NARROWED TO `key = 'exchange_rates'`. Every reader in
-- both repos is server-side on getSupabaseAdmin() — the service role, which
-- bypasses RLS: /api/connect/wallet/recharge/create, /api/cron/exchange-rates,
-- and the six broadcast routes. Nothing in any browser or in imotara-mobile
-- reads this table. Narrowing would leave the same trap for the NEXT key
-- somebody adds; dropping closes the class.
--
-- ⛔ The absence of INSERT/UPDATE/DELETE policies is deliberate and is left
-- exactly as it was — that is what stops an authenticated client overwriting
-- exchange_rates and corrupting session billing.

drop policy if exists "app_settings_public_read" on public.app_settings;

commit;

-- ── HOW TO PROVE IT WORKED, with the PUBLIC anon key ────────────────────────
-- Before: every one of these answers 500 / 42P17.
-- After:  every one answers 200 with [] — RLS filtering rows, which is what
--         correct RLS looks like. ⛔ org_invites answering 200 with ROWS would
--         mean the drop in §3 did not take.
--
--   for t in org_members org_invites organizations org_audit_log \
--            org_license_pools org_license_assignments api_keys cohorts \
--            referral_codes payment_invoices; do
--     curl -s -o /dev/null -w "$t %{http_code}\n" \
--       -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--       "$SUPABASE_URL/rest/v1/$t?select=*&limit=1"
--   done
