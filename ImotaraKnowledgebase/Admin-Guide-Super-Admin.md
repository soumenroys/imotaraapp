# Imotara Admin Guide (Super-Admin)

This guide is the source of truth for Imotara staff who operate the platform through the super-admin panel at **`www.imotara.com/admin`**. It covers who can do what, how to get the first admin account created, day-to-day account and security tasks, user support actions, license management, organization oversight, comment moderation, and Connect (consultant marketplace) review.

Audience: technical support, user support, administrators, and non-technical staff. Every procedure is grounded in the actual code. Where an action has **no UI and is API-only**, that is called out explicitly with the endpoint and an example.

> Terminology note: "super-admin" (the platform operator, stored in the `super_admins` table) is a completely different thing from a "user" (an app account stored in Supabase `auth.users`) and from an "org owner" (a customer who runs an organization). This guide is about super-admins.

---

## 1. What the super-admin system is

The super-admin system is a **separate login and account store from normal Imotara user accounts**. A super-admin does not sign in with Google/Apple like an app user does; they have their own email + password record in the `super_admins` database table and sign in at `/admin`.

Key facts (from `src/app/api/admin/_auth.ts` and `src/lib/imotara/adminCrypto.ts`):

- Passwords are hashed with **scrypt** (never stored in plain text).
- A successful login issues a session stored as an **httpOnly cookie** named `imotara_admin_session`.
- **Sessions last 8 hours** (`SESSION_TTL_MS = 8 hours`), then require re-login.
- Every admin API route checks the session cookie first. There is also a legacy `ADMIN_SECRET` Bearer-token fallback (see §17).

### 1.1 Roles and exactly what each can/cannot do

There are three roles: **owner**, **admin**, and **connect_reviewer**.

| Capability | owner | admin | connect_reviewer |
|---|---|---|---|
| Log in to `/admin` | yes | yes | yes (limited view) |
| View/manage user Licenses | yes | yes | no |
| View/manage Organizations (create, edit, verify, suspend) | yes | yes | no |
| **Delete an organization** | yes | no | no |
| Ban / unban users; generate recovery links; suspend accounts | yes | yes | no |
| **Permanently delete a user's account** (own action, unrelated to orgs) | yes | no | no |
| List and **create** super-admin accounts | yes | yes (cannot create an *owner*) | no |
| **Create another owner** account | yes | no | no |
| **Edit / deactivate / delete / unlock** an existing super-admin | yes | no | no |
| Moderate blog comments (view/approve/delete) | yes | yes | yes |
| View Connect applications / consultants / refunds (read-only) | yes | yes | yes |
| **Approve/reject consultants, process payouts, approve refunds** | yes | yes | no |

Notes grounded in code:
- `connect_reviewer` is intentionally **excluded** from `adminAuthorized()` — it can only reach `/api/admin/connect/*` and `/api/admin/comments/*`. It cannot touch licenses, orgs, or user bans (`src/app/api/admin/_auth.ts`).
- Even inside Connect, `connect_reviewer` is **view + comment moderation only**. The consultant-approve, payout, and refund endpoints each reject it with a 403 ("Insufficient privileges..."). See §13.
- `admin` can create other admins/reviewers but **cannot manage them afterward** — editing role/password/active status, deleting, and unlocking all require `owner` (`super-admins/[id]/route.ts`, `unlock/route.ts`).

---

## 2. Creating the FIRST super-admin (bootstrap / seed)

Before anyone can log in, one owner account must be seeded. This is a one-time bootstrap.

**Endpoint:** `POST /api/admin/auth/seed` (API-only — there is no seed UI; the login screen just reminds you it exists).

How it works (`src/app/api/admin/auth/seed/route.ts`):
1. It only works while the `super_admins` table is **empty**. The moment one account exists, it permanently returns **409 "Seed already done"** and can never create another account. (A race between two simultaneous seed calls is also caught by a partial unique index and returns 409.)
2. The `super_admins.sql` migration must already have been run in Supabase, or you get a 500 "table not found."
3. The password must pass complexity rules (§4).
4. It creates the account with `role: owner` and `is_seed_owner: true`.

**Steps:**
1. Confirm the `super_admins` table exists in the Supabase project (migration applied).
2. Ensure the environment has `SUPABASE_SERVICE_ROLE_KEY` set (the seed writes with the service-role client).
3. Send the request:
   ```bash
   curl -X POST https://www.imotara.com/api/admin/auth/seed \
     -H "Content-Type: application/json" \
     -d '{"email":"you@imotara.com","name":"Your Name","password":"YourStr0ng!Passphrase"}'
   ```
4. On success you get `201` and can now log in at `/admin` with that email + password.
5. Create all further accounts through the UI (§3) — never by re-seeding (it won't work).

**Related API endpoints:** `POST /api/admin/auth/seed`

---

## 3. Creating additional super-admins / connect_reviewers

**UI:** `/admin` -> **Admins** tab -> the "Add team member" form.

**Steps:**
1. Log in at `/admin` as an owner (or admin — but an admin cannot create an owner).
2. Open the **Admins** section.
3. Fill in name, email, and a starting password that meets the policy (§4).
4. Choose a role from the dropdown: **Owner** ("full access + manage admins"), **admin**, or **Connect Reviewer** ("review Connect applications only").
5. Submit. The account appears in the admins list immediately.

Rules enforced by the API (`src/app/api/admin/super-admins/route.ts`):
- Both owner and admin may create accounts.
- Only an **owner** may create another **owner** (a non-owner attempting this gets 403).
- Passwords are validated against the complexity policy and scrypt-hashed.

**Related API endpoints:** `GET /api/admin/super-admins` (list), `POST /api/admin/super-admins` (create)

---

## 4. Password rules, lockout, and resetting a forgotten admin password

### 4.1 Password policy
From `checkPasswordComplexity` in `src/lib/imotara/adminCrypto.ts`, every admin password must be:
- **At least 12 characters**
- At least **one uppercase letter**
- At least **one number**
- At least **one special character** (`!@#$%^&*` etc.)

### 4.2 Lockout policy
From the login route (`src/app/api/admin/auth/login/route.ts`):
- After **5 failed attempts**, the account is **locked for 15 minutes** (HTTP 429).
- Each failed attempt tells the user how many remain.
- Every login attempt (success or failure) is written to the `admin_login_audit` table with IP and user agent.
- A successful login resets the failure counter.

**To unlock a locked account before the 15 minutes elapse (owner only):**
1. Go to **Admins**.
2. Find the locked account and click its **Unlock** control.

This calls `POST /api/admin/super-admins/[id]/unlock` (owner only), which clears `failed_attempts` and `locked_until`.

### 4.3 Resetting a forgotten password (self-service)
The login screen has a **"Forgot password"** link.
1. On `/admin`, click **Forgot password** and enter your admin email.
2. This calls `POST /api/admin/auth/forgot-password`. For privacy it **always** responds "If that email belongs to a super-admin, a reset link has been sent" — regardless of whether the email exists. Rate-limited to **3 requests per hour** per account.
3. A reset email (valid **15 minutes**) arrives with a link of the form `.../admin?reset_token=...`.
4. Opening that link shows a set-new-password form (`GET`/`POST /api/admin/auth/reset-password`). Setting the password **revokes all existing sessions** for that admin, forcing re-login everywhere.

### 4.4 Resetting another admin's password (owner only)
An owner can overwrite any admin's password directly:
- **UI:** Admins section -> edit the target admin -> set a new password.
- **API:** `PATCH /api/admin/super-admins/[id]` with `{"password":"NewStr0ng!Pass"}`.

**Related API endpoints:** `POST /api/admin/auth/forgot-password`, `GET|POST /api/admin/auth/reset-password`, `POST /api/admin/super-admins/[id]/unlock`, `PATCH /api/admin/super-admins/[id]`

---

## 5. Two-factor authentication (2FA / TOTP)

2FA uses a standard authenticator app (Google Authenticator, Authy, etc.) via TOTP. **These are API-only endpoints** — there is no 2FA management screen in the current admin UI beyond the login challenge. Perform these with the admin session cookie active.

### 5.1 Enable 2FA
1. Call `POST /api/admin/auth/2fa/setup` while logged in. It returns a `secret` and a `qrDataUrl` (a scannable QR image). 2FA is **not yet active** at this point.
2. Scan the QR (or enter the secret) into your authenticator app.
3. Call `POST /api/admin/auth/2fa/verify` with `{"code":"123456"}` (the current 6-digit code). On the **first** successful verify, 2FA is enabled and the response includes **8 one-time backup codes** — store these somewhere safe; they are shown only once.

### 5.2 Log in with 2FA
When 2FA is enabled, login is completed by verifying the TOTP code against the pending session (`loginToken` flow), which marks the session `two_fa_verified`.

### 5.3 Disable 2FA
- Call `DELETE /api/admin/auth/2fa/disable` with `{"code":"123456"}` (a current valid code is required to confirm). This clears the secret, disables 2FA, and wipes the backup codes.

**Related API endpoints:** `POST /api/admin/auth/2fa/setup`, `POST /api/admin/auth/2fa/verify`, `DELETE /api/admin/auth/2fa/disable`

---

## 6. Logging in, session duration, and revoking sessions

### 6.1 Log in
1. Go to `/admin`.
2. The login card has two tabs: **Email / Password** (preferred, your personal account) and **Secret key** (legacy emergency fallback, see §17).
3. Enter credentials and submit (`POST /api/admin/auth/login`). A session cookie is set for **8 hours**.

### 6.2 See your active sessions
- `GET /api/admin/auth/sessions` lists your active sessions with IP, user agent, and timestamps, and marks which one is current.

### 6.3 Revoke sessions
- Revoke one: `DELETE /api/admin/auth/sessions?sessionId=<id>` (you can only revoke your own).
- Revoke all others (keep the one you're using): `DELETE /api/admin/auth/sessions?all=true`.
- Log out the current session: `DELETE /api/admin/auth/logout` (deletes the session row and clears the cookie).

Sessions also expire automatically after 8 hours, and a password reset revokes all of that admin's sessions.

**Related API endpoints:** `POST /api/admin/auth/login`, `GET /api/admin/auth/me`, `GET|DELETE /api/admin/auth/sessions`, `DELETE /api/admin/auth/logout`

---

## 7. Banning and unbanning a user (and what banning actually does)

**Where:** In `/admin` -> **Licenses**, open a user's detail panel. There is an **Account Ban** section.

**Steps to ban:**
1. Find the user (search by email in Licenses).
2. Open their detail panel.
3. In **Account Ban**, type a **reason** (required) and confirm. The confirm dialog warns "They will lose access immediately."

**Steps to unban:** open the same panel and click **Unban**.

**What banning actually does** (`src/app/api/admin/users/[userId]/ban/route.ts`):
- It applies a **real Supabase auth ban** (`ban_duration: "876000h"`, ~100 years — effectively indefinite). This **blocks sign-in and token refresh at the auth layer**.
- It also writes an audit row to `user_bans` (who banned whom, when, why). That table is audit-only.
- Important nuance: an **already-issued access token can remain valid until it needs to refresh (up to ~1 hour)**. Banning stops new sign-ins and refreshes immediately, but is not a guaranteed instant session kill.
- Historical note: before the v1.2.7 fix, "ban" only set the inert audit row and did nothing — banned users kept full access. It is now a real ban.

**Role note:** owner and admin can ban/unban/read ban status; **connect_reviewer is rejected (401)** on all three.

**Related API endpoints:** `POST /api/admin/users/[userId]/ban` (ban), `DELETE .../ban` (unban), `GET .../ban` (status)

---

## 8. Generating a user recovery link

Use this when a user has **permanently lost access to the Google/Apple account** their Imotara identity is tied to (there is no separate Imotara password to reset).

**Where:** the same user detail panel in **Licenses** has a **"Generate a sign-in link"** control.

**Steps:**
1. Open the user's detail panel.
2. Click **Generate a sign-in link** and confirm the warning ("Only do this once you're satisfied this request is genuinely from the account owner — this link signs in as them directly").
3. Copy the returned link and deliver it manually through a channel you trust belongs to the real account owner.

Behavior (`src/app/api/admin/users/[userId]/recovery-link/route.ts`):
- Generates a Supabase **magic link** for the user's email.
- The link **expires in ~1 hour**.
- It is **never sent automatically** — it is returned to you only. This is a deliberate manual, human-verified process, not a self-service "recover my account" flow.
- **connect_reviewer is rejected (401).**

**Related API endpoints:** `POST /api/admin/users/[userId]/recovery-link`

---

## 9. Permanently deleting a user's account (owner only)

Standalone, general-purpose account deletion — independent of orgs. **This is different from deleting an org (§11.6):** deleting an org releases its members' seats and resets their licenses to free but keeps their accounts intact; this action deletes one specific person's *entire* Imotara identity — chat history, memories, licenses, and any org membership. Use it for a person who genuinely needs to be gone (e.g. a stray test/leftover account), not as a side effect of an org going away.

**Where:** **Licenses** → open the user's detail panel → **"Danger zone — owner only"** at the bottom (only rendered for the `owner` role).

**Steps:**
1. Open the user's detail panel in Licenses.
2. Scroll to **Danger zone**.
3. Type the account's **exact email** into the confirmation field (the delete button stays disabled until it matches).
4. Click **Permanently delete account** and confirm the native dialog.

Behavior (`DELETE /api/admin/users/[userId]`, owner-only, `{confirmEmail}` in the body must match exactly):
- If the user holds any **active org membership**, it's released first via the same `revokeOrgLicense` path used elsewhere (correctly decrements the org's `seats_used`) — this avoids leaving an orphaned `org_members` row, since that table's `user_id` FK is `on delete set null`, not cascade.
- Deletes `imotara_history`, `user_memory` (companion memory + push subscriptions), `licenses`, `payment_licenses`, and `usage_events` for the user — the same data set the person's own self-service **"Delete my account"** (Settings) removes.
- Deletes the Supabase auth user last, once everything else succeeds.
- Sends an alert email to `info@imotara.com` recording who deleted whom.
- `admin` and `connect_reviewer` cannot use this — 403.

**Related API endpoints:** `DELETE /api/admin/users/[userId]`

---

## 10. Managing licenses from admin

**Where:** `/admin` -> **Licenses**. Two sub-tabs: **User Licenses** and **Action History**.

**Grant or change a user's license:**
1. Search for the user by email.
2. Open the detail panel — it shows the license row, payment history, and admin history for that user.
3. Set tier, status, expiry, and token balance, then save.

Behavior (`src/app/api/admin/licenses/route.ts` and `.../[userId]/route.ts`):
- `POST /api/admin/licenses` upserts the license (`source: manual`) and records a history entry with a derived action (`assign`, `tier_change`, `extend`, `token_adjust`, `withdraw`, `status_change`).
- `PATCH /api/admin/licenses/[userId]` supports partial updates including **absolute** `tokenBalance` or **relative** `tokenDelta` (floored at 0). It auto-creates a free license row if none exists.
- Every change writes to `admin_license_history`.

**View license action history:** the **Action History** sub-tab, or `GET /api/admin/licenses/history?userId=&page=&limit=` (omit `userId` for the global log).

These routes use `adminAuthorized` (owner/admin; connect_reviewer excluded).

**Related API endpoints:** `GET|POST /api/admin/licenses`, `GET|PATCH /api/admin/licenses/[userId]`, `GET /api/admin/licenses/history`

---

## 11. Organization oversight

**Where:** `/admin` -> **Organizations**. You can search by name, slug, or owner email, and filter by status.

### 11.1 View orgs and org detail
- The list comes from `adminSearchOrgs` (name, slug, billing type, tier, status, seats purchased/used, owner email, member count).
- **Owner email** is derived from the org's real, active `org_members` row (preferring role `owner`, else `admin`) — not from a separate pointer. If an org has no active members at all, it falls back to a legacy `organizations.owner_user_id` field and shows "no owner" if that's also empty.
- Expanding an org loads its detail + member list (`GET /api/admin/organizations/[orgId]`).

### 11.2 Create a new org, with an owner (`+ New Org`)
The create-org form's **Owner email** field, when filled in, goes through the **same provisioning pipeline as Create & Invite (§11.7.1)** — it creates the account if needed, adds them as an active `org_members` row (role `owner`), assigns the seat/license, and emails them a set-your-password invite. This only works if the org is created with **status active** and at least **1 seat purchased** — an org created as (default) **pending**, or with 0 seats, still gets created, but the owner isn't provisioned yet; the form shows an amber warning telling you to activate the org and then use **Create & Invite** or **Resend password link** (§11.7.1) to finish it. Check the org's member list to confirm the owner actually landed before considering it done — an owner email on the list row is not by itself proof they have a working seat if the org was created pending.

### 11.3 Activate a pending org
New self-serve orgs arrive as **pending**. To make one live:
1. Expand the org.
2. Set its **tier** and **seats_purchased**, and set **status -> active**.
3. Save. When tier changes or the org becomes active, the API syncs a `licenses` row for every active member so the org tier resolves immediately (`PATCH /api/admin/organizations/[orgId]`).
4. If the org was created with an **Owner email** that wasn't provisioned yet (§11.2), activating it here does **not** retroactively provision them — use **Create & Invite** or **Resend password link** afterward.

### 11.4 Verify an NGO/EDU org (approve or reject)
An org submits verification docs. To resolve it:
1. Expand the org and open the verification review.
2. Choose **approve** or **reject**, optionally adding a review note.
3. Save. This sends `PATCH /api/admin/organizations/[orgId]` with `verification_decision: "approved" | "rejected"`.
   - Approve sets `org_settings.verification_status = "verified"`; reject sets it to `"rejected"`.
   - The org owner is emailed the decision automatically.
   - This `PATCH` is the **only** way verification can move past "pending_review."

> Honesty note (per v1.2.7 changelog): document verification is **not** a prerequisite for subsidized NGO/EDU pricing — the discount applies unconditionally at checkout. Verification is an oversight/record step, not a paywall.

### 11.5 Suspend an org
- Set **status -> suspended** via `PATCH`. Members lose the org tier and fall back to their personal license or free.

### 11.6 Delete an org (owner only) — and what happens to licenses
**Only the Imotara `owner` role can delete an org.** admin and connect_reviewer get 403.

**Steps:**
1. Expand the org. As an owner you see a **"Danger zone — owner only"** panel at the bottom.
2. Type the org's **exact name** into the confirmation input (the delete button stays disabled until it matches).
3. Click delete and confirm the native dialog.

Behavior (`src/app/api/admin/organizations/[orgId]/route.ts` DELETE):
- Wrong name -> 400, org untouched. Nonexistent org -> 404.
- On success, the org row is deleted; `org_members`, `api_keys`, `org_invites`, `org_license_pools`, cohorts, and audit log **cascade-delete**.
- A **database trigger** (`trg_release_licenses_on_org_delete`) automatically **resets every affected member's license to free**: `tier: free`, `org_id: null`, `status: valid`, no `expires_at`, `source: manual`. This runs regardless of which delete path is used (admin or the org owner's own self-delete).
- An alert email is sent to `info@imotara.com` on every successful deletion.

### 11.7 Add a member to an org by email / change roles / suspend an account
`/api/admin/organizations/[orgId]/members`:
- **POST** — add an existing Imotara user directly by email (they must already have an account). Releases any prior org membership first (a user can only hold one paid org seat), then assigns the seat (seat-limit enforced).
- **PATCH** — change a member's `role`, set a per-member `overrideTier`, and/or `suspendAccess: true|false` (a reversible Supabase ban on that user; same ~1h token caveat as §7).
- **DELETE `?userId=`** — remove the member and release their seat/license.

### 11.7.1 Create & Invite — provisioning a member who has no Imotara account yet
Every end-user sign-in on Imotara is Google-only, so the plain **"Add existing user"** action above only works if the person has already signed in with Google at least once. **Create & Invite** removes that dependency: it creates the account for them and emails a **set-your-own-password** link — no plaintext password is ever emailed.

**Where:** the org's **Members** panel — check **"Create new account + email a password-set invite"** before submitting the add-member form.

**Steps:**
1. Expand the org, open **Members**, enter the person's email and role.
2. Check the **Create & Invite** box, then submit.
3. They receive an email ("You've been invited to join *[org]*") with an **"Accept invite & set your password →"** link, plus website/Android/iOS QR codes.
4. They click the link, land on **imotara.com/auth/accept**, choose a password (same complexity policy as admin passwords — see §4), and are signed straight into their org dashboard.
5. From then on, they sign in at **imotara.com/login** with that email + password — a separate, gated login page that only ever works for accounts created this way. It is **not** wired into the regular Google sign-in used everywhere else, so it doesn't expand the attack surface for the rest of the user base. **"Forgot password?"** on that page (`/auth/forgot-password`) lets them reset it themselves later.

Behavior (`POST .../members` with `action: "create_and_invite"`, requires a full session-based super-admin login — the legacy `ADMIN_SECRET` bearer also works but has no name/email to record):
- If the email has no Imotara account, creates one (`email_confirm: false`) and sends a Supabase **invite**-type link. If the email already has an account (e.g. a prior Google user), sends a **recovery**-type link instead — either way they land on the same set-password page.
- Idempotent: re-inviting the same email re-issues the link without duplicating the seat or the `org_members` row.
- Rate-limited to **20 provisions/hour per admin**.
- Every provision writes an `org_audit_log` row (`member_provisioned`), and a second row is written when they actually finish setting their password — `member_joined` for a genuine first accept, or `password_reset` for a later reset (distinguished server-side by whether `org_members.joined_at` is within the last 10 minutes).
- If account creation, license assignment, or link generation fails partway through, everything already done in that call is rolled back (member row removed, license revoked, and — if a new account was created this call — the account itself deleted) rather than leaving a half-provisioned, seat-consuming ghost member.
- Invite links expire after **24 hours** (Supabase's own hard cap for email links) — this is shorter than the plain 7-day member-invite link in §11.7, because it doubles as the only way to set a first password.
- `connect_reviewer` cannot provision members.
- **Link delivery:** the email contains our own `imotara.com/auth/accept?token_hash=...&type=...` URL, verified client-side (`verifyOtp`) — not Supabase's raw one-time link. Fixed as of this version: the raw link is a bare, unauthenticated GET that consumes the one-time token on the *first* HTTP fetch — including a corporate email security scanner pre-visiting the link before the recipient ever opens it, which made even a genuinely fresh invite show "session has expired." If a member reports that symptom on an older build, re-send the link (§11.7.2) — it'll use the fixed format.

**Org-owner/admin self-service Create & Invite is not built yet** — as of this writing, provisioning someone **without** a Google account is still super-admin-only, from `/admin`. This is different from the self-service invite org owners/admins already have for members *with* Google accounts (`Org-Owner-and-Admin-How-Tos.md` §3) — that one they can trigger themselves.

**Related API endpoints:** `POST .../members` (`action: "create_and_invite"`), `GET /auth/accept`, `GET /login`, `GET /auth/forgot-password`

### 11.7.2 Resend password link — for a member already provisioned but stuck
For an already-active member (created via §11.7.1) who lost their original email, or whose link expired/was consumed before they used it — **Create & Invite** refuses to touch an already-active membership (409), so use this instead: on the org's **Members** panel, click **"Resend password link"** next to that member's row.

Behavior (`POST .../members` with `action: "resend_password_link"`, super-admin session required, `connect_reviewer` excluded, same 20/hour rate limit):
- Confirms the target is an **active** member of *this* org first (404 if not — this can't be used to send an arbitrary user an unrelated login link).
- Generates a fresh **recovery**-type link (same `token_hash` delivery as §11.7.1) and emails it — does **not** touch membership, role, or license, since the person is already a confirmed member.
- Writes an `org_audit_log` row (`password_link_resent`).

**Related API endpoints:** `POST .../members` (`action: "resend_password_link"`)

### 11.8 Org analytics and audit (read-only oversight)
- `GET /api/admin/organizations/[orgId]/analytics?days=30` — aggregate-only usage (total events, active days, average WAU, average session minutes). **No individual-member data** by design.
- `GET /api/admin/organizations/[orgId]/audit?page=&limit=` — read-only view of the org's own audit log (invites, role changes, removals, tier changes).

**Related API endpoints:** `GET|POST /api/admin/organizations`, `GET|PATCH|DELETE /api/admin/organizations/[orgId]`, `POST|PATCH|DELETE /api/admin/organizations/[orgId]/members`, `GET /api/admin/organizations/[orgId]/analytics`, `GET /api/admin/organizations/[orgId]/audit`, `GET|POST|DELETE /api/admin/organizations/[orgId]/pools`

---

## 12. Blog comment moderation

**Where:** `/admin` -> **Comments**. Sub-tabs: pending / approved / all.

**Who can moderate:** **any** super-admin role — owner, admin, **and connect_reviewer** (the Comments tab becomes visible to connect_reviewer). These routes use `connectAdminAuthorized`.

**Steps:**
1. Open **Comments** and select **pending**.
2. **Approve** a comment (`PATCH /api/admin/comments/[id]` sets `approved: true`) to publish it, or **Delete** it (`DELETE /api/admin/comments/[id]`).

**Related API endpoints:** `GET /api/admin/comments?status=pending|approved|all`, `PATCH /api/admin/comments/[id]`, `DELETE /api/admin/comments/[id]`

---

## 13. Connect review — what connect_reviewer (and owner/admin) can do

`/admin` -> **Connect**. Sub-tabs include pending applications, all consultants, earnings/payouts, and session monitor.

**What connect_reviewer CAN do:** view pending consultant applications, view all consultants, view refund requests, and moderate blog comments. It is effectively **read-only for Connect plus comment moderation**.

**What only owner/admin can do (connect_reviewer is 403):**

### 12.1 Approve or reject a consultant application
1. Open **Connect -> pending**. Each application shows the submitted profile; verification documents are shown via **1-hour signed URLs**, and banking/payout fields are **masked** to the last 4 digits.
2. Choose **approve** or **reject**. A rejection **requires a reason**; an approval can include an optional personal note.
3. Submit (`PATCH /api/admin/connect/[id]/approve` with `{"action":"approve"|"reject","reason":"..."}`). The consultant is emailed the outcome. The action is idempotent (approving an already-approved application is a no-op).

### 12.2 Process a payout
- `PATCH /api/admin/connect/payouts/[id]` moves a payout through `processing -> completed | failed`. Completing (or failing) atomically decrements the consultant's pending payout; a completed payout cannot be re-completed (optimistic lock).

### 12.3 Approve/reject a wallet refund
- `GET /api/admin/connect/refunds?status=` lists refund requests (bank details masked to last 4).
- `PATCH /api/admin/connect/refunds` sets `processing | completed | rejected`. Completing atomically decrements the user's wallet balance; double-completion is prevented by an optimistic lock.

**Related API endpoints:** `GET /api/admin/connect/pending`, `GET /api/admin/connect/consultants`, `PATCH /api/admin/connect/[id]/approve`, `GET /api/admin/connect/earnings`, `PATCH /api/admin/connect/payouts/[id]`, `GET|PATCH /api/admin/connect/refunds`, `GET /api/admin/connect/active-sessions`

---

## 14. The Dashboard tab

`/admin` -> **Dashboard** shows live platform stats: total/owners/admins/inactive super-admins, org counts, member counts, pool utilization, and a per-org breakdown table (member count, pool issued/available, status). Use it for an at-a-glance health check and to spot under- or over-provisioned pools (available = 0 with issued > 0 is flagged in red).

---

## 15. Crisis Events dashboard (added 2026-08-14)

**Where:** `/admin` -> the red **🆘 Crisis Events** button next to the tab bar, or directly at `/admin/crisis-events`.

**What it shows:** a chronological, metadata-only list of detected crisis-adjacent messages (suicidal ideation, self-harm, abuse language) — when, which user (by email), which platform (web/mobile), and which language. **The actual message text is never stored or shown** — this was a deliberate scope decision to minimize stored sensitive data. One row is logged per ~60-minute episode per user, not per message, so an ongoing conversation doesn't flood the list.

**What it does NOT do:** no real-time alert is sent anywhere (dashboard-only by design) — check it periodically rather than expecting a notification. It's read-only; there's no action to take from this page itself (follow up with the user directly if needed).

**Role note:** owner and admin can view it; **connect_reviewer cannot** (the link doesn't even render for that role, and the API 401s if called directly) — this is general user-safety data, not scoped to Connect.

**Backend:** `GET /api/admin/crisis-events`, table `crisis_events` (`docs/sql/crisis_events_v1.sql`), written by `/api/chat-reply` whenever `CRISIS_HINT_REGEX` fires (see the AI & TTS doc for detection details).

---

## 16. Broadcast email (added 2026-09-03) — **owner only**

**Where:** `/admin` -> the **📣 Broadcast** tab. It is the only tab restricted to the `owner` role. Every route behind it calls `requireOwner()`, so the hidden tab is convenience and the server is the rule. `requireOwner()` additionally **refuses the legacy `ADMIN_SECRET` bearer path** (see §17): that path returns a synthetic identity which is not a row in `super_admins`, so it could never satisfy `created_by`.

The tab has four screens:

**Broadcasts** — every message, with delivered/bounced/complaint tallies. Sent broadcasts are permanent and cannot be edited or deleted; the record has to keep saying what people actually received. Duplicate one to send a revised version.

**Recipient lists** — create a list, then paste addresses into it. Pasting is a two-step: **Check** is a real dry run against the database and reports five buckets — new, already on this list, repeated in the paste, unsubscribed/bounced, and not a valid address (with a suggested correction). Nothing is written until you confirm. **Adding requires provenance**: a source (one of eight, all describing something the *person* did — there is deliberately no "found online"), a free-text detail, and a collection date. The API rejects a write missing any of the three. Removing an address with the **×** removes list membership only and never touches suppression: opting out is the recipient's decision, not the admin's.

**Requests** — people who filled in the public form at `www.imotara.com/updates`. Adding someone from here copies their provenance across (source `website_form`, the real submission date, the IP the consent came from) rather than retyping it. An address already suppressed is flagged, and adding it clears nothing — anyone can type anyone's address into a form.

**Sending status** — can we send at all, and how much today. Reads the live environment and the send table, never a stored flag. Watch the **Delivery reporting** line: without `RESEND_WEBHOOK_SECRET`, mail still goes out but every message stays at `sent`, so delivered/bounced/complaint counts read zero whatever actually happens.

### Writing and sending

The composer stores a small markup, not HTML. Bold, italic, underline, strike, colour, font, size, alignment, headings, lists, quotes, buttons, links and images are all available, and all of them are rendered to email HTML server-side from a whitelist. Colour and font values are *checked*, not escaped — escaping would happily pass `red;background:url(http://tracker/p.gif)` into a style attribute. The client sends `body_source` only; `body_html`/`body_text` are never accepted from a request.

Images can be uploaded, dragged onto the message, pasted from the clipboard, or given as a URL. Uploads go to the public `broadcast-images` bucket. **Google Drive, OneDrive, SharePoint, iCloud and Google Photos share links are refused** — they point at a viewer page, not an image, and would arrive as a broken picture. Dropbox links are repaired automatically. The composer measures the rendered message against Gmail's ~102KB clipping limit and warns before the unsubscribe link is what gets hidden.

**Review & send** shows the arithmetic: who is on the list, who is skipped and why, how many will receive it, and — when the queue exceeds today's warm-up ceiling — how many days it will take, which must be acknowledged. Confirmation is typing the recipient count. If the list changed while the screen was open, the send is refused and the number is reloaded.

Pressing send does **not** send. It builds the queue and flips the status; `/api/cron/broadcast-queue` drains it every minute, up to 100 per batch. So sending survives a crash, a closed laptop, and a run larger than a function timeout.

### Warm-up, and why it exists

Per-day ceilings ramp by week from the first real send: **100, then 500, then 2000, then 50,000**. The week and the day's usage are derived from `broadcast_sends`, never from a counter column. `BROADCAST_DAILY_CAP` overrides the schedule; setting it to `0` halts all sending.

The ceiling is not bureaucracy. A new sending domain that suddenly emits thousands of messages is filtered as a spammer, and **this domain also carries password resets and session notices** — burning it costs far more than a slow campaign.

### Unsubscribing

Every broadcast carries a `List-Unsubscribe` header pointing at `POST /api/unsubscribe` (RFC 8058 one-click) and a visible footer link to the `/unsubscribe` page. Both suppress the address immediately and drop anything already queued for it. Operational messages carry neither — a policy change is not optional, and claiming otherwise would be a lie.

**Never remove someone from the suppression list to "let them back in".** A working unsubscribe is the reason a recipient presses it instead of "Report spam", and one spam report costs more reputation than a hundred unsubscribes.

### Consent policy

Only people who approached Imotara may be mailed: an event, a meeting, an email, WhatsApp, social media, the website form, a phone call, or an app signup. **Harvested or scraped lists are not permitted**, which is why the source enum has no value for them. If asked to mail a bought or scraped list, refuse.

**SQL:** `docs/sql/broadcast_v1.sql` (10 sections, all applied to production 2026-09-03/04). **Env:** `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `BROADCAST_UNSUBSCRIBE_SECRET`, optional `BROADCAST_DAILY_CAP`.

---

## 17. Security note: the ADMIN_SECRET legacy fallback

There is a legacy authentication path: a single shared secret sent as `Authorization: Bearer <ADMIN_SECRET>`. When accepted, it authenticates as a synthetic **owner** ("Admin (legacy key)").

**Why it should be disabled:** anyone holding that one secret gets full owner-level access with no individual accountability, no 2FA, and no per-person audit trail. The multi-user session system (this whole guide) exists to replace it.

**How to disable it:** set the environment variable **`ADMIN_SECRET_DISABLED=true`**. When set, both `adminAuthorized()` and `connectAdminAuthorized()` refuse the Bearer secret entirely and only accept real session cookies. The shipped `.env.example` already sets `ADMIN_SECRET_DISABLED=true` — production should keep it that way and reserve the secret strictly for emergency break-glass (e.g., if all owner accounts are locked out).
