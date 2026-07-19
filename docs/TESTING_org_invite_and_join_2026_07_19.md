# Functional Testing — Org Invite Accept & Domain Auto-Join

**Date:** 2026-07-19
**Scope:** Web only (imotaraapp)
**Pages under test:** `/org/invite/[token]`, `/org/join/[slug]`
**Related pages (already tested, for context only):** `/org/new`, `/login`, `/auth/accept`, `/auth/forgot-password`, `/admin` provisioning
**Related fixes this round:**
- Equal-weight sign-in buttons (Google "G" icon instead of the word "Google") on all three sign-in gates
- Stale-session handling: a 401 on accept/join now flips back to the sign-in gate instead of a dead-end error
- `/settings` previously had **no visible sign-in button at all** when signed out — now fixed
- Rollback bug: `generateLink()` failure during provisioning could leave a dangling `org_members` row / consumed seat / orphaned auth user — now rolled back
- Invite email said "72 hours"; corrected to "24 hours" to match the real Supabase link TTL (this applies to the **admin-panel provisioning email only** — see note below)

**IMPORTANT — there are two separate invite mechanisms, corrected after an independent review caught this doc conflating them:**

| | Admin-panel "Create & Invite" | Org-dashboard "Invite by email" |
|---|---|---|
| Where | `/admin` → org → Members (superadmin only) | `/org/dashboard/members` (org owner/admin only) |
| Route | `POST /api/admin/organizations/[orgId]/members` (`create_and_invite`) | `POST /api/org/dashboard/members` |
| Link mechanism | Supabase `generateLink()` → `/auth/accept` (set password) | App-generated `org_invites.token` → `/org/invite/[token]` |
| Email function | `sendOrgInviteEmail` (`mailer.ts`) | `sendInviteEmail` (`org/dashboard/members/route.ts`) |
| TTL / copy | Supabase link TTL, **"24 hours"** | `org_invites.expires_at`, **"7 days"** (`org_schema.sql:154`) |

**§4 of this doc tests `/org/invite/[token]`, which is only reachable via the org-dashboard flow (right column) — not the admin panel.** The admin-panel "Create & Invite" instead lands the user on `/auth/accept` (already tested in a prior round, not covered by this doc).

---

## 1. Features covered

1. **Invite acceptance** (`/org/invite/[token]`) — a user clicks the link from `sendOrgInviteEmail`, signs in if needed, and joins the org as the invited role.
2. **Domain auto-join** (`/org/join/[slug]`) — a durable, repeatable link anyone with a matching email domain can use to join, unlike the single-use invite token.
3. **Sign-in gates on both pages** — icon-based, equal-weight buttons (Google icon "Sign in" vs "Sign in with email & password"), no literal word "Google" in button copy.
4. **Stale-session recovery** — if the accept/join API call returns 401 (session expired between page load and clicking the button), the page falls back to the sign-in gate instead of showing a raw error.
5. **`/settings` sign-in button** — the OAuth entry point every "Sign in" link on these pages routes to.

Explicitly **not** in scope for this pass: the admin-panel provisioning UI itself, `/login`, `/auth/accept` (all already tested in a prior round — see conversation history / `docs/sql/org_seat_leak_idempotency_fix.sql` context).

---

## 2. Test environment

- Local dev server (`npm run dev`), pointed at the **production** Supabase project (no separate staging DB exists for this repo).
- Admin access: log into `/admin` with the superadmin account (`soumenroys@gmail.com`).
- Use a **disposable test org** and **disposable test emails** — do not reuse real member accounts. Suggested naming: org `ZZ_TEST_InviteJoin`, emails `zz-test-invite-1@gmail.com` style (must be real, receivable inboxes — Supabase actually sends the email).
- You'll need at least **two real, receivable test inboxes** you control (e.g. Gmail `+` aliases: `i.am.soumen.roy+invite1@gmail.com`, `+invite2@gmail.com`, `+join1@gmail.com` — Gmail treats these as the same inbox but Supabase/Postgres treats them as distinct emails).
- Browser: use an Incognito/Private window for "signed out" scenarios so you don't clobber your main browser session.

---

## 3. Setup steps (do once before testing)

| Step | Action |
|---|---|
| 1 | In `/admin`, create a test org (e.g. `ZZ_TEST_InviteJoin`), type **`ngo` or `edu`** (required — domain auto-join is rejected by `domain-verify/route.ts:49` for any other billing type), tier of your choice. |
| 2 | Note the org's **slug** (shown in the admin org list or org dashboard URL) — needed for `/org/join/[slug]` tests. |
| 3 | Sign in as that org's **owner** and go to `/org/dashboard/settings` (domain auto-join is configured from the **org dashboard only**, via `POST /api/org/dashboard/domain-verify` — there is no admin-panel control for this). Enable **"Auto-join by domain"** and set the allowed domain to match your test email's domain (e.g. `gmail.com` — broad; consider this test's blast radius and clean up afterward). |
| 4 | From `/org/dashboard/members` (**org owner/admin login required — not the superadmin admin panel**), use **"Invite by email"** to invite `zz-test-invite-1@gmail.com` as `member`. This is the flow that actually produces an `/org/invite/[token]` link — the admin panel's "Create & Invite" produces a *different* link (`/auth/accept`, already covered in a prior test round). |
| 5 | Check that inbox for the invite email. Confirm the CTA link points to `localhost:3000/org/invite/<token>` (only if `NEXT_PUBLIC_SITE_URL=http://localhost:3000` is set in `.env.local` — otherwise it'll point at production and you'll need to swap the domain manually to test locally). |
| 6 | Confirm the email body says **"This link expires in 7 days"** — this is the org-dashboard invite flow (`sendInviteEmail`), a separate, pre-existing mechanism from the admin-panel provisioning email. The "24 hours" copy fix applies only to the admin panel's `sendOrgInviteEmail` / `/auth/accept` flow, tested in a prior round — do not expect it here. |

---

## 4. Test matrix — `/org/invite/[token]`

### 4.1 Happy path — brand-new account, signed out

| Step | Action | Expected result |
|---|---|---|
| 1 | Open the invite link from §3 step 5 in an Incognito window (fully signed out). | Page loads, shows "Sign in to join {org}" with invite context (org name, role). |
| 2 | Look at the two buttons. | Two **equal-weight** pill buttons side by side: one with the Google "G" icon + "Sign in", one "Sign in with email & password". Neither says the word "Google" in the button label. |
| 3 | Click the Google-icon button. | Redirects to `/settings?redirect=/org/invite/[token]`. |
| 4 | On `/settings`, confirm a visible **"Sign in"** button appears (Google icon) since you're signed out. | Button is present and clickable — this is the gap that was just fixed. |
| 5 | Click it, complete Google OAuth with the invited email. | Redirects back to `/org/invite/[token]` automatically. |
| 6 | Page now shows the invite preview (org name, role, your account) with a "Join {org}" button. | — |
| 7 | Click "Join". | Success screen: "Welcome to {org}!", link to `/org/dashboard`. |
| 8 | In `/admin` → org → Members, confirm the new member shows as `active`, correct role. | — |
| 9 | In `/admin` → org overview, confirm `seats_used` incremented by exactly 1 (not more). | — |

### 4.2 Happy path — existing account (recovery-type link)

| Step | Action | Expected result |
|---|---|---|
| 1 | Invite an email that **already has an Imotara account** (e.g. your main test account) via the admin panel. | Invite email sent. |
| 2 | Open the link, already signed in as that account (no Incognito needed). | Page skips the sign-in gate, shows invite preview directly. |
| 3 | Click "Join". | Same success flow as 4.1. |

### 4.3 Email mismatch, no domain auto-join

| Step | Action | Expected result |
|---|---|---|
| 1 | Open an invite addressed to `zz-test-invite-1@gmail.com`, but sign in with a **different** account that does NOT match the org's auto-join domain (or with auto-join disabled). | Page shows: "This invite was sent to {email}. Please sign in with that email to accept it." No join button. |

### 4.4 Email mismatch, WITH domain auto-join enabled (the redirect path)

| Step | Action | Expected result |
|---|---|---|
| 1 | With the org's auto-join domain enabled (§3 step 3), open the invite link signed in as an account with a **different but domain-qualifying** email. | Page shows an amber notice: "This invite was sent to X, but {org} also accepts anyone signing in with a matching email domain," plus a "Check if your email qualifies →" button. |
| 2 | Click it. | Navigates to `/org/join/[slug]` — continue in §5. |

### 4.5 Expired invite

| Step | Action | Expected result |
|---|---|---|
| 1 | Either wait 24h+ after issuing an invite, or manually set `expires_at` to a past timestamp on the `org_invites` row via SQL Editor for a test invite. | — |
| 2 | Open the link. | "Invite unavailable" screen: "This invite link has expired. Ask your admin to resend." with a link back to Imotara. |

### 4.6 Already-accepted invite

| Step | Action | Expected result |
|---|---|---|
| 1 | Accept an invite once (4.1), then revisit the exact same link. | "Invite unavailable": "This invite has already been accepted." |

### 4.7 Stale-session recovery (the fix just applied)

| Step | Action | Expected result |
|---|---|---|
| 1 | Open a fresh, valid invite link while signed in — let it reach the invite-preview screen (do NOT click Join yet). | Preview shows normally. |
| 2 | In a **different tab**, go to `/settings` and click "Sign out". | Header shows no "Sign out" in that tab. |
| 3 | Go back to the first tab (still showing the invite preview, stale auth state) and click **"Join {org}"**. | Because of the fix: the page should detect the 401 and flip straight back to the **"Sign in to join"** gate (equal-weight buttons) — NOT show a raw error or a dead end. |
| 4 | Sign back in via either button. | Should land back on the invite preview or complete the join, per redirect logic. |

---

## 5. Test matrix — `/org/join/[slug]`

### 5.1 Qualifying domain, signed in

| Step | Action | Expected result |
|---|---|---|
| 1 | Navigate to `/org/join/[slug]` for the test org (auto-join enabled, domain matching your signed-in account). | Shows "Join {org}" preview: your account email, qualifying domains list. |
| 2 | Click "Join {org}". | Success screen, "Welcome to {org}!", dashboard link. |
| 3 | Confirm seat count incremented correctly (same idempotency check as 4.1 step 9). | — |

### 5.2 Non-qualifying domain, signed in

| Step | Action | Expected result |
|---|---|---|
| 1 | Same page, but signed in with an email whose domain does NOT match. | Preview shows your account/domain, but instead of a join button: "Your account ({email}) doesn't match any qualifying domain for this organisation." in red, no button. |

### 5.3 Signed-out gate

| Step | Action | Expected result |
|---|---|---|
| 1 | Open `/org/join/[slug]` in Incognito (signed out). | "Sign in to join" screen, same equal-weight icon-button design as the invite page (this was the third file fixed in this round). |
| 2 | Click "Sign in with email & password". | Goes to `/login?redirect=/org/join/[slug]`. Only usable if this account was provisioned by an admin (has a password) — otherwise this is a dead end by design (expected — password login is intentionally gated to provisioned accounts only). |
| 3 | Click the Google-icon "Sign in" instead. | Goes to `/settings?redirect=/org/join/[slug]`, same flow as invite page. |

### 5.4 Invalid/unsupported org slug

| Step | Action | Expected result |
|---|---|---|
| 1 | Visit `/org/join/some-nonexistent-slug`. | "Can't join" error screen: "This organisation doesn't support domain auto-join." (or similar, depending on the exact API error) with a link back to Imotara. |

### 5.5 Stale-session recovery (the fix just applied)

| Step | Action | Expected result |
|---|---|---|
| 1 | Load the qualifying-domain preview (5.1) but don't click Join yet. | — |
| 2 | Sign out in another tab. | — |
| 3 | Click "Join {org}" in the stale tab. | Should flip back to the "Sign in to join" gate (equal-weight buttons), not a raw error. |

---

## 6. Regression checks (bugs fixed just before this test round)

| Check | How to verify |
|---|---|
| **Rollback on `generateLink` failure** | Hard to trigger deliberately (requires Supabase's link-generation to fail, e.g. hitting a rate limit). If you can force it (e.g. by rapidly re-inviting the same email many times to hit Supabase's own email-send rate limit), confirm afterward: no leftover `org_members` row for that user in this org, `seats_used` unchanged, and — if this was a brand-new email — no orphaned row in `auth.users` (check via `/admin` → Users or SQL `select * from auth.users where email = '...'`). |
| **24h copy in admin-panel provisioning email** (`sendOrgInviteEmail`, `/auth/accept` flow — NOT the `/org/invite/[token]` flow this doc otherwise tests) | Send one "Create & Invite" from `/admin` as a spot-check and confirm the email says "24 hours", not "72". This is a quick side-check, separate from the §4/§5 test matrix above. |

---

## 7. Cleanup

- Delete the test org (`ZZ_TEST_InviteJoin`) via `/admin` → org → Danger zone, or org owner self-delete from `/org/dashboard/settings` — this should auto-release any test members' licenses back to free (per the existing `trg_release_licenses_on_org_delete` trigger).
- Delete test auth users created during this pass (`/admin` → Users → delete, or SQL) if they were newly created rather than reusing real accounts.
- Re-run `select * from organizations where name like 'ZZ_TEST%'` and `select * from auth.users where email like 'zz-test-%'` to confirm zero leftovers.

---

## 8. Sign-off checklist

- [ ] 4.1 Happy path (new account)
- [ ] 4.2 Happy path (existing account)
- [ ] 4.3 Email mismatch, no auto-join
- [ ] 4.4 Email mismatch, with auto-join → redirect
- [ ] 4.5 Expired invite
- [ ] 4.6 Already-accepted invite
- [ ] 4.7 Stale-session recovery
- [ ] 5.1 Qualifying domain join
- [ ] 5.2 Non-qualifying domain
- [ ] 5.3 Signed-out gate
- [ ] 5.4 Invalid slug
- [ ] 5.5 Stale-session recovery
- [ ] 6. Regression checks
- [ ] 7. Cleanup confirmed (zero test-data leftovers)
