-- docs/sql/admin_session_two_fa.sql
--
-- 🔴 THE COLUMN THE 2FA LOGIN CHALLENGE HAS ALWAYS NEEDED AND NEVER HAD.
--
-- /api/admin/auth/2fa/verify has a login-challenge branch that selects
-- `two_fa_verified` from admin_sessions and updates it. That column does not
-- exist, so the branch answered 401 for every request it ever received — which
-- nobody noticed, because the login route never called it either.
--
-- ⚠️ DEFAULT TRUE, DELIBERATELY, AND THIS IS THE IMPORTANT LINE IN THE FILE.
-- Every session that exists right now was created before 2FA was enforced, by
-- an admin who passed the only check there was. Defaulting to false would mark
-- all of them unverified the instant this runs and lock out whoever is signed
-- in — including the person running it. New sessions get an explicit value
-- from the login route, so the default only ever applies to rows already here.
--
-- ⛔ RUN THIS BEFORE DEPLOYING the login change. The code is written to cope
-- with the column being absent (it reads `?? true`, i.e. behaves exactly as it
-- does today), so neither order can lock anybody out — but with the column
-- present, enforcement starts working immediately.

alter table admin_sessions
  add column if not exists two_fa_verified boolean not null default true;

comment on column admin_sessions.two_fa_verified is
  'False only while a 2FA-enabled admin has signed in with their password but not yet entered a code. Defaults true so pre-existing sessions are never invalidated.';

-- ── Who is signed in, and how far through ───────────────────────────────────
select s.id,
       a.email,
       a.totp_enabled,
       s.two_fa_verified,
       s.expires_at > now() as still_valid,
       s.last_used_at
from   admin_sessions s
join   super_admins a on a.id = s.admin_id
order  by s.last_used_at desc nulls last;
