-- docs/sql/connect_consultants_column_disclosure_fix.sql
--
-- 🔴 LIVE DISCLOSURE OF REAL PEOPLE'S PAYOUT AND ID DETAILS.
-- Found 2026-10-16 in the owner-requested security review. ⚠️ Unlike the
-- org_invites hole in org_rls_recursion_and_invite_disclosure_fix.sql, which a
-- separate bug happens to mask, THIS ONE IS REACHABLE TODAY.
--
-- ── WHAT IS WRONG ───────────────────────────────────────────────────────────
-- connect_schema.sql grants the public directory read:
--
--   CREATE POLICY "connect_consultants_public_view" ON connect_consultants
--     FOR SELECT USING (status = 'approved');
--
-- That was correct for the table as it then stood: display_name, bio, rate,
-- languages, ratings — a directory profile.
--
-- 🔑 BUT POSTGRES RLS FILTERS ROWS, NOT COLUMNS, and the table has grown nine
-- times since. An approved consultant's row now also carries:
--
--   payout_info        jsonb   ← payout / bank details          (v3)
--   verification_docs  jsonb   ← storage paths: photo ID, address proof, age proof (v3)
--   docs_notes         text    ← internal verification notes     (v3)
--   contact_email      text                                      (v4)
--   contact_phone      text                                      (v4)
--   digital_signature  text                                      (v5)
--   user_id            uuid    ← their auth.users id             (original)
--
-- The app's own routes are careful — /api/connect/consultants enumerates about
-- twenty safe columns and names none of the above. ⛔ BUT THAT LIST IS
-- ADVISORY. The boundary is the policy, the policy is row-level, and no
-- column-level GRANT exists on this table, so an anonymous caller skips the
-- route entirely:
--
--   GET /rest/v1/connect_consultants?select=*&status=eq.approved
--     apikey: <the anon key, which ships in the client bundle by design>
--
-- and receives every column of every approved consultant. Measured
-- 2026-10-16: this table answers anon with ROWS, where every user table
-- answers []. These are identifiable real people.
--
-- ── THE FIX, AND WHY IT IS THIS ONE ─────────────────────────────────────────
-- Column-level GRANTs were considered and rejected: they are per ROLE, so
-- restricting `authenticated` would also stop a consultant reading their own
-- payout_info, and widening it back would reopen this. A public VIEW was
-- considered and rejected: it needs matching code changes in every reader.
--
-- 🔑 EVERY ONE OF THE 29 READERS IN THIS REPO IS SERVER-SIDE ON
-- getSupabaseAdmin() — the service role, which bypasses RLS. Nothing in any
-- browser and nothing in imotara-mobile queries this table directly. So the
-- correct boundary is to stop handing the table to anon and authenticated at
-- all, which makes those careful per-route column lists the REAL boundary
-- instead of a convention.
--
-- ⛔ THE POLICIES ARE DELIBERATELY LEFT IN PLACE. Belt and braces: if a future
-- migration or a Supabase default ever restores the grant, the row-level rules
-- still apply rather than the table being wide open.
--
-- ⚠️ PRECEDENT IN THIS SAME SCHEMA: terms_acceptances already answers anon
-- with 42501 "permission denied" rather than []. This brings the consultant
-- table into line with the table we already decided to close.

begin;

revoke select on public.connect_consultants from anon;
revoke select on public.connect_consultants from authenticated;

-- ⚠️ Also revoke the write verbs. A consultant edits their profile through
-- /api/connect/consultant/profile (service role); connect_v33_final_hardening
-- added an explicit INSERT deny policy for the same reason. Nothing legitimate
-- writes to this table over PostgREST.
revoke insert, update, delete on public.connect_consultants from anon;
revoke insert, update, delete on public.connect_consultants from authenticated;

commit;

-- ── HOW TO PROVE IT WORKED, with the PUBLIC anon key ────────────────────────
-- Before: 200, and the body contains payout_info / contact_phone.
-- After:  401 with {"code":"42501","message":"permission denied for table
--         connect_consultants"} — the same answer terms_acceptances gives.
--
--   curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     "$SUPABASE_URL/rest/v1/connect_consultants?select=*&status=eq.approved&limit=1"
--
-- ⛔ AND THE REGRESSION CHECK THAT MATTERS MORE — the public directory must
-- still work, because it is a paid product surface:
--
--   curl -s "https://www.imotara.com/api/connect/consultants" | head -c 400
--
-- That route runs on the service role, so it is expected to be unaffected. If
-- it breaks, revert with:
--   grant select on public.connect_consultants to anon, authenticated;
