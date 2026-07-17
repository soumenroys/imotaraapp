# Organization Owner & Admin How-Tos

This guide is for **customers who run an organization on Imotara** — schools (EDU), NGOs, companies (commercial), and government bodies (govt) — and for the Imotara support staff who help them. It explains how to create and run an org, invite and manage members, understand licensing, use analytics and API access, and delete an org.

Audience: org owners/admins and Imotara support (technical + user support). Every step is grounded in the actual product. Where a step is **API-only** it says so. Where something is **not yet built / de-scoped**, it is called out honestly per the v1.2.7 changelog.

> Roles inside an org: **owner** (one per org, full control incl. deletion), **admin** (manage members, licenses, settings), **member** (regular user). This is separate from the Imotara platform super-admins.
>
> For the full chained walkthrough (create NGO → get verified → appoint admins → add users), see **"Playbook — Organizations & NGOs End-to-End"**.

---

## 1. Creating an organization

**Where:** `www.imotara.com/org/new` (must be signed in to an Imotara account).

**Billing types available:** **commercial**, **ngo**, **edu**, **govt** (`src/app/api/org/new/route.ts`).

**Steps:**
1. Sign in to your Imotara account.
2. Go to `/org/new`.
3. Enter the organization **name**, choose a **billing type**, and optionally a contact email and description.
4. Submit.

**What happens after creation** (all automatic):
- The org is created with **status = pending** and **0 seats**. Its tier is set to `edu` for EDU orgs, otherwise `enterprise` (this is a placeholder until Imotara activates it).
- You are added as the **owner** member, and a free license row is created for you tied to the org.
- An alert email goes to Imotara (`info@imotara.com`) so staff can review and activate.
- **One org per account:** if you already own an org, creation is blocked (409) — contact support to create another.

**Pending vs active:** a **pending** org is not yet usable for seats/invites at full tier. An Imotara super-admin reviews it, sets your real **tier** and **seat count**, and flips **status -> active**. Once active, your members resolve to the org tier and you can invite people up to your seat limit.

**Related API endpoints:** `POST /api/org/new`

---

## 2. How org licensing works (plain language)

- **Seats**: your plan has a number of purchased seats (`seats_purchased`). Each active member uses one (`seats_used`). Invites and joins are blocked when seats run out.
- **Default tier**: your org has a tier (e.g. Enterprise, EDU). By default **every member gets that tier** just by being a member.
- **Per-member override**: you can give a specific member a different tier (e.g. one Enterprise seat inside an EDU org) via an **override tier**.
- **Pools**: a pool is a batch of licenses of a specific tier that Imotara issues to your org (e.g. "50 Pro licenses"). Your admins then assign individual licenses from the pool to specific members. Removing a member automatically frees their pool capacity back.

**Effective tier priority** — when a member opens the app, the system picks the tier as follows (verified against `resolve_user_tier()` in `docs/sql/org_license_pools.sql`):
1. **Pool assignment** (a specific license assigned from a pool) — highest, overrides everything.
2. **Org tier override** (a tier manually set for that specific member) — beats everything except a pool assignment.
3. **The HIGHER of the member's personal license vs your org's default tier**, compared by tier rank (`free < plus < pro < family < edu < enterprise`). So a personal Plus subscriber inside an Enterprise org resolves to **Enterprise** (org default wins), while a personal Pro subscriber inside a Plus-tier org keeps **Pro** (personal wins). Neither flatly outranks the other — the better one applies.

**Related API endpoints:** `GET /api/org/dashboard/license-inventory`, `GET|POST|DELETE /api/org/dashboard/pools`

---

## 3. Inviting members

**Where:** Org dashboard -> **Members** (`/org/dashboard/members`). Owner/admin only.

### 3.1 Invite one person by email
1. Enter the person's email and pick a role (member or admin).
2. Send. This checks seat availability first — if full, you get "No seats available. Contact Imotara to increase your seat limit."
3. An invite email is sent with a link `.../org/invite/<token>`. **Invites expire after 7 days.**

### 3.2 Bulk invite
- `POST /api/org/dashboard/members/bulk` accepts an array of `{email, role}` (up to **500** per batch). It returns a per-row result (invited / skipped / error): it skips people who are already members or already have a pending invite, and reports "No seats available" once seats run out. Your org must be **active**.

### 3.3 How invites work when accepted
- The recipient opens the invite link and signs in. The invite is **tied to the invited email** — signing in with a different email is refused. Expired or already-accepted invites are rejected.
- On acceptance, any prior active org membership is released first (one paid seat per user), the person is added as a member, and a seat is assigned (seat limit enforced).

**Related API endpoints:** `GET|POST|PATCH|DELETE /api/org/dashboard/members`, `POST /api/org/dashboard/members/bulk`, `GET|POST /api/org/invite/[token]`

---

## 4. Domain auto-join (NGO / EDU only)

Domain auto-join lets anyone with an email at your domain(s) join without an individual invite — ideal for all students or all staff. **Available for NGO and EDU accounts only** (enforced server-side, not just in the UI).

**Enable it (owner/admin):**
1. In org settings, open the **Domain verification / auto-join** section (only shown for NGO/EDU).
2. Add your allowed email domains (e.g. `university.edu`), enable auto-join, and save. Optionally set academic-year start/end.
3. Your org must be **active** for the join link to work.

**How people join:** share the durable link **`/org/join/[slug]`**. Anyone whose email domain matches can use it, **repeatedly** — it is not a single-use token. The landing page shows the allowed domains so a user can confirm they qualify before signing in. (It is strictly **domain-gated** — not an open join link.)

> Fixed in v1.2.7: auto-join used to piggyback on a single-use invite link (only the first person could use it, and it could lock out the intended recipient). It is now a dedicated, repeatable, shareable link — and was opened to NGOs (previously EDU-only by mistake).

**Related API endpoints:** `GET|POST /api/org/dashboard/domain-verify`, `GET|POST /api/org/join-by-domain`

---

## 5. Adding/removing members, changing roles, bulk operations

**Where:** Org dashboard -> **Members**. Owner/admin only.

- **Change a member's role:** `PATCH /api/org/dashboard/members` with `{userId, role}` (admin or member). You **cannot change the owner's role**.
- **Override a member's tier:** the same `PATCH` accepts `overrideTier` (free/plus/pro/family/edu/enterprise, or null to clear). Setting it syncs their license so the new tier resolves immediately.
- **Remove a member:** `DELETE /api/org/dashboard/members?userId=...`. This releases their seat and resets their license to free. You **cannot remove yourself or the owner**.
- **Bulk:** see §3.2 for bulk invites.

**Related API endpoints:** `PATCH|DELETE /api/org/dashboard/members`, `POST /api/org/dashboard/members/bulk`

---

## 6. Cohorts / Teams

**Where:** Org dashboard -> **Teams** (`/org/dashboard/teams`). Owner/admin only.

Cohorts let you group members (e.g. a class, a department) and set a **tone policy** for the AI companion per group.

**Steps:**
1. **Create a cohort:** give it a name, optional description, an optional seat limit, and a **tone_policy** — one of `close_friend`, `calm_companion`, `coach`, `mentor` (defaults to `close_friend`).
2. **Add members:** expand a cohort and add existing org members to it (the "Add members" control was built in v1.2.7 — previously the UI referenced it but it didn't exist).
3. **Edit or delete** cohorts as needed.

**Related API endpoints:** `GET|POST|PATCH|DELETE /api/org/dashboard/cohorts`, `GET|POST /api/org/dashboard/cohorts/members`

---

## 7. Analytics / usage and audit logs

**Where:** Org dashboard -> **Analytics** and **Audit log**. Owner/admin only.

- **Analytics** (`/org/dashboard/analytics`): aggregate engagement — weekly active users, average session length, active days, check-in rate. It is **aggregate-only by design** — you cannot see any individual member's private data.
- **Audit log** (`/org/dashboard/audit`): a record of org actions — invites, role changes, removals, tier changes — with actor, target, and timestamp.

**Related API endpoints:** `GET /api/org/dashboard/analytics`, `GET /api/org/dashboard/audit`

---

## 8. Managing API keys and the public v1 API

**Where:** Org settings -> API keys. **Enterprise tier only** (enforced both in the UI and server-side).

**Steps:**
1. In settings, create a key by giving it a name. It is returned **once in plaintext** — copy it immediately; only a prefix and a hash are stored afterward.
2. Keys carry scopes (`read:stats`, `read:members`) and a **rate limit of 100 requests/minute** (a real global cap as of v1.2.7).
3. Revoke a key from the same screen (`DELETE /api/org/dashboard/apikeys?keyId=...`).

**What the public v1 API offers** (send `Authorization: Bearer imk_...`; Enterprise only):
- `GET /api/v1/org/stats?days=30` — aggregate org usage stats (needs `read:stats`).
- `GET /api/v1/org/members` — org member list (needs `read:members`).

Requests over the rate limit get HTTP 429; missing scope or non-Enterprise tier gets 403.

**Related API endpoints:** `GET|POST|DELETE /api/org/dashboard/apikeys`, `GET /api/v1/org/stats`, `GET /api/v1/org/members`

---

## 9. Referral codes (honest current status)

**Where:** Org settings -> Referral codes. **NGO billing type only.**

You can create referral codes (auto-generated from your org name, with a commission rate, default 10%) and deactivate them.

> **Honesty note (v1.2.7):** referral **commission tracking is not functional yet** — it is marked **"Coming soon."** The UI to create codes works and stores them, but the commission attribution/payout pipeline behind it does not yet actually track or pay commissions. Treat referral codes as not-yet-live for revenue sharing, and set customer expectations accordingly.

**Related API endpoints:** `GET|POST|DELETE /api/org/dashboard/referrals`

---

## 10. Branding, settings, SSO, and verification (what's real vs "Coming soon")

**Where:** Org dashboard -> **Settings** (`/org/dashboard/settings`). Owner/admin only. Note: org tier, seats, billing type, and status are **read-only** here — they are managed by Imotara; contact `info@imotara.com` to change them.

### 10.1 Custom branding — works (EDU and Enterprise)
Set a logo URL, an accent color (hex), and a brand name that replaces "Imotara" in the header. Save via `PATCH /api/org/dashboard/branding`. Lower tiers see a "contact us" message instead.

### 10.2 SSO / SAML — stores config, needs Imotara to activate (EDU and Enterprise)
You can enter your IdP details (entity ID, SSO URL, certificate, email domain). Saving stores them with status **pending** — the actual SAML flow requires configuration on the Imotara/Supabase side, so **Imotara support activates it** after you submit. It is not self-service end-to-end.

### 10.3 Verification — works (NGO / EDU)
Submit a verification document URL (e.g. NGO 80G/FCRA, EDU affiliation letter) via the verification section. This sets status to **pending_review** and alerts Imotara, who approve or reject it. Reminder: verification is **not required** to get subsidized NGO/EDU pricing.

### 10.4 Not built yet — be honest with customers
- **LMS / iframe embed**: the embed section is marked **"Coming soon"** and does not function yet. (An embed key and iframe snippet may be generated, but the feature is not live.)
- **Referral commission tracking**: "Coming soon" (see §9).
- **Impact Report** (NGO): it is delivered as **HTML, not a PDF** — the earlier "Grant-ready PDF" label was corrected. Note: the impact report is gated only on NGO/EDU + org-admin, while the **certificate** additionally requires an active org with ≥10 members and ≥30 days of history.

**Related API endpoints:** `GET|PATCH /api/org/dashboard/branding`, `GET|PATCH /api/org/dashboard/sso`, `GET|POST /api/org/dashboard/verification`, `GET|PATCH /api/org/dashboard/embed`

---

## 11. Deleting your own organization (owner only)

**Where:** Org dashboard -> **Settings** -> **Danger zone**. **Only the org owner** sees the delete control; admins and members see a support-contact link instead. Imotara support **cannot** do this on your behalf — it is deliberately the owner's own informed choice.

**Steps:**
1. As the owner, go to Settings -> Danger zone.
2. Type your organization's **exact name** into the confirmation input (the delete button stays disabled until it matches exactly).
3. Click **"Permanently delete organisation"** and confirm the browser dialog.
4. On success you are redirected to `/` and the org is gone.

**What happens automatically** (`src/app/api/org/dashboard/settings/route.ts` DELETE):
- The org and all related data cascade-delete: members, API keys, license pools/assignments, invites, cohorts, and the audit log.
- A **database trigger** (`org_delete_license_release_trigger`) fires on the delete and **resets every member's license to free** in the same transaction (`tier: free`, `org_id: null`, `status: valid`, no expiry). This is the same automatic release used when an Imotara admin deletes an org — it happens no matter which path triggers the deletion.
- An alert email is sent to `info@imotara.com` (the audit log is gone after deletion, so this email is the only remaining trace).

This is irreversible — there is no undo.

**Related API endpoints:** `DELETE /api/org/dashboard/settings` (owner only, requires `confirmName`)

---

## 12. What your members see

When a person's plan is managed by your org:
- They see a **"Managed by [Org]" badge** in the mobile app. The badge is aware of billing type (NGO / EDU / govt / commercial) and is discoverable via settings search. It stays fresh across sign-in/auth events (not just at app launch).
- They see **no personal upgrade prompts** — upgrade CTAs are hidden on the chat quota card, the trial banner, and the plan panel, because their plan is provided by you, not something they buy individually.
- If their access is banned/suspended, they get a **clear notice** rather than being silently dropped to an anonymous session.

There is nothing members need to do to "activate" their org tier — it resolves automatically based on the priority chain in §2.

---

## Support quick-reference

- Org stuck **pending**? Imotara must set tier + seats and flip status to active (see Admin Guide).
- "No seats available" on invite? Ask Imotara to raise `seats_purchased`.
- Wrong tier for one member? Set a **per-member override** (§5) — it beats the org default but a **pool assignment** beats the override (§2).
- Domain auto-join not working? It's **NGO/EDU only**, the org must be **active**, and auto-join must be enabled with the correct domains (§4).
- API key rejected? API access is **Enterprise-only**, needs the right scope, and is rate-limited to 100/min (§8).
