# Playbook — Organizations & NGOs End-to-End

This is the **read-aloud playbook** a support person uses to walk an organization founder — most often an **NGO founder** — through the whole lifecycle on Imotara (`www.imotara.com`), from "I have nothing yet" to "my org is running, my members have the right license, and I know how to wind it down." It is written as **chained scenarios**: numbered steps you do in order.

Every step is grounded in the actual code (`src/app/org/**`, `src/app/api/org/**`, `src/app/api/admin/organizations/**`, `src/lib/imotara/org.ts`, `docs/sql/org_*.sql`, `docs/CHANGELOG_v1.2.7.md`). Each step names **WHO** does it, **WHERE** (exact URL / page section / button label, or the API endpoint when there is no UI), **what happens behind the scenes** (DB rows, emails, status changes), and **what you should see when it worked**.

> **The four roles you will hear.** Inside an org: **owner** (one per org, full control incl. deletion), **admin** (manage members/licenses/settings, can't delete the org or change the owner), **member** (regular user). Separate from all of these is the **Imotara super-admin** — Imotara staff operating `www.imotara.com/admin`, with their own sub-roles (owner / admin / connect_reviewer). "Approve my NGO," "activate my org," "raise my seats," and "delete via admin" are all super-admin actions.

> **Billing types.** Every org has one of four `billing_type` values, chosen at creation: **commercial**, **ngo**, **edu**, **govt**. Where behavior differs by type, each scenario says so explicitly.

---

## Scenario 1 — "I run an NGO and want to set up Imotara for my beneficiaries"

This is the full cold-start chain: account → org → NGO verification (with the interleaved Imotara-staff step) → activation.

### Part A — Create your Imotara account (NGO founder)

1. **WHO:** the NGO founder. **WHERE:** open Imotara and sign in the normal way (Google / Apple) — the org-creation page checks your login via `/api/license/status`. There is no separate "org account"; your org is attached to your personal Imotara identity.
2. **What you should see:** you're signed in with an email. Hold onto which email you used — **you become the org owner, and that email is what invites, verification emails, and the "one paid seat per user" rule key off.**

### Part B — Create the organization (NGO founder)

3. **WHERE:** go to **`www.imotara.com/org/new`**. Page title: **"Set up your organisation."** If you're not signed in you'll see a **"Sign in required"** screen instead — sign in first.
4. **Fill the form** (`src/app/org/new/page.tsx`). Exact fields:
   - **Organisation name** *(required, max 80 chars)* — e.g. "Hope Foundation."
   - **Organisation type** *(required)* — four tile buttons: **🏢 Company** (`commercial`), **🤝 NGO / NPO** (`ngo`), **🎓 Educational** (`edu`), **🏛️ Government** (`govt`). **For an NGO, click the "NGO / NPO" tile.**
   - **Billing / contact email** *(optional)* — only if different from your account email.
   - **Brief description** *(optional, max 500 chars)* — free text; helps Imotara size your setup ("NGO supporting 500 rural students in West Bengal").
   - A grey box confirms **"Submitting as [your email]. You'll be set as the organisation owner."**
5. **Click "Submit organisation request."**
6. **Slug rules (behind the scenes, `POST /api/org/new`).** You never type a slug — it's auto-derived from the name: lowercased, trimmed, non-alphanumerics stripped, spaces → hyphens, collapsed, **truncated to 48 chars**. If that slug is taken it appends `-1`, `-2`, … until unique. "Hope Foundation" → `hope-foundation`. This slug is permanent and is what the domain-join link (`/org/join/<slug>`) later uses.
7. **What status the org starts in — pending, with zero seats.** The insert creates the org with **`status = "pending"`, `seats_purchased = 0`**, and a **placeholder tier**: `edu` for EDU billing, otherwise **`enterprise`** — so **an NGO org starts at tier `enterprise` as a placeholder** until Imotara sets the real tier. You are inserted into `org_members` as **role `owner`, status `active`**, and a `licenses` row is created for you (`tier: free`, `source: org`, `org_id` set) so the app knows your org context.
8. **Behind the scenes — email + one-org rule.** An alert email fires to **`info@imotara.com`** with subject `[New Org Request] <name> (<billing_type>)`. **One org per account:** if you already own an org, you get a **409** ("You already have an org… Contact support to create another") — a DB unique index (`organizations_single_owner`) also blocks a concurrent double-submit.
9. **What you should see:** a **"Request submitted!"** confirmation ("We'll review it and email [you] within 24–48 hours"). *(If you arrived via a Stripe payment redirect `?stripe_paid=1`, you instead see a "Request received!" screen — same outcome.)* **At this point you cannot invite anyone yet** — the org is pending with 0 seats.

### Part C — NGO verification submission (NGO founder) — optional, and NOT a paywall

10. **WHERE:** once activated (or even while pending), org owner/admin go to **Org dashboard → Settings** (`/org/dashboard/settings`) → the **"NGO Verification"** section (this section renders for NGO billing type; EDU orgs get an "EDU Domain Verification" section instead).
11. **WHAT to submit** (`POST /api/org/dashboard/verification`): a **public URL to a verification document** — for an NGO, your **80G / FCRA / registration certificate**; for EDU, an affiliation letter. Optional document type and notes. There is no file upload here — it takes a **URL** (`documentUrl` is required).
12. **Behind the scenes:** `org_settings.verification_status` is set to **`pending_review`**, the doc URL/notes are stored, and an alert email goes to `info@imotara.com` (`[Verification] <name> submitted verification docs`).
13. **What you should see:** status shows **"pending_review."**
14. > **Honesty note (v1.2.7):** verification is **NOT required to get subsidized NGO/EDU pricing** — the discount applies unconditionally. Verification is an oversight/record step, not a gate. Don't tell an NGO they must verify before they can be activated or priced.

### Part D — The interleaved Imotara-staff step: approve the org and activate it (Imotara super-admin)

This is what unblocks the founder. It happens in `/admin`, not in the org dashboard.

15. **WHO:** Imotara super-admin (owner or admin role — **not** connect_reviewer). **WHERE:** `www.imotara.com/admin` → **Organizations** tab. Search by name, slug, or owner email; filter by status (the new org shows as **pending**).
16. **Activate it** (`PATCH /api/admin/organizations/[orgId]`): expand the org, set the real **tier** and **seats_purchased**, set **status → active**, Save. **Behind the scenes:** when tier changes or the org becomes active, the API upserts a `licenses` row (`source: org`) for **every active member** so the org tier resolves immediately.
17. **Resolve verification** (same PATCH, field `verification_decision`): choose **approve** or **reject**, optional review note.
    - Approve → `org_settings.verification_status = "verified"`; reject → `"rejected"`.
    - **The org owner is emailed the decision automatically** (`sendOrgVerificationDecisionEmail`).
    - This PATCH is the **only** way verification moves past `pending_review` — there is no other endpoint that can resolve it.
18. **(Optional) Issue license pools** here too — see Scenario 4.
19. **What the super-admin should see:** the org row flips to **active** with the seat count and tier they set; verification shows **verified**.

### Part E — What changes for the founder after approval

20. **WHO:** NGO founder. **WHERE:** `/org/dashboard`. **What you should see now:** your org is **active**, you have a seat count, and you can invite people (Scenario 3), assign licenses (Scenario 4), create cohorts (Scenario 5). Your own account and every member now resolve to the org tier automatically. **Support quick-check:** if a founder says "I can't invite anyone / it says no seats," the org is still pending or has `seats_purchased = 0` — an Imotara super-admin must set seats and flip status to active (step 16).

---

## Scenario 2 — "Make someone an admin of my org"

Admins are made by **role change**, and the person must be **in the org first**. You do not "invite an admin" as a separate concept — you invite them (or they join), then promote.

1. **WHO:** org **owner or admin**. **WHERE:** invite them first (Scenario 3) — when you invite, the role dropdown offers **member** or **admin**, so you can invite straight in as an admin. Or invite as member and promote later.
2. **Promote an existing member** (`PATCH /api/org/dashboard/members`, body `{ userId, role: "admin" }`). There is a members list at **Org dashboard → Members** (`/org/dashboard/members`); role changes go through this endpoint. Valid role values here are **`admin`** or **`member`**.
3. **Behind the scenes:** updates the member's `org_members.role`. **You cannot change the owner's role** — the API returns 403 ("Cannot change the owner's role"). Role change does not touch their license/seat.
4. **Who can change roles:** **both owner and admin** can (the endpoint uses `requireOrgAdmin`, which accepts owner and admin). So an admin can make another member an admin.
5. **What an org admin CAN do:** manage members (invite, bulk invite, remove non-owners, change member/admin roles, set per-member override tiers), assign/withdraw pool licenses, create/edit cohorts, configure domain auto-join, branding, SSO config, verification, referral codes, API keys, and view analytics/audit. (All org dashboard write routes use `requireOrgAdmin` = owner **or** admin.)
6. **What an org admin CANNOT do (owner-only):** **delete the organization** (`DELETE /api/org/dashboard/settings` returns 403 for non-owners), **change the owner's role**, or **remove the owner**. Org tier, seats, billing type, and status are **read-only to both owner and admin** — only Imotara changes those.
7. **What you should see:** the promoted person now shows role **admin** in the members list and can reach the admin-only dashboard controls.

---

## Scenario 3 — "Add users to my org"

Four ways to get people in. All of them enforce seat capacity and the **one-paid-seat-per-user** rule (joining releases any prior active org membership first, via `releasePriorOrgMembership()`).

### 3A — Individual invite by email (owner/admin)

1. **WHERE:** Org dashboard → **Members** → **"Invite a member"** form. Enter an email, pick role (member/admin), click **"Send invite."** (`POST /api/org/dashboard/members`.)
2. **Behind the scenes:** first checks a seat is free (`check_org_seat_available`). If full → **409 "No seats available. Contact Imotara to increase your seat limit."** Otherwise it upserts an `org_invites` row (unique per `org_id,email`, so re-inviting the same email **reuses/refreshes the same invite** and resets expiry) with a fresh `token` and **7-day expiry**, and emails the person a link **`/org/invite/<token>`** ("Accept invitation →", "This link expires in 7 days").
3. **What the invitee does:** opens the link → `/org/invite/[token]` page → signs in → accepts (`POST /api/org/invite/[token]`). **The invite is tied to the invited email** — signing in with a different email is refused (403, "This invite was sent to …"). Expired invites → 410; already-accepted → 409.
4. **On acceptance:** any prior active org membership is released, they're inserted into `org_members` (active), and `assign_org_license` gives them a seat (row-locked seat check). The invite is marked `accepted_at`. If seats filled up in the meantime, the member insert is rolled back and they get a 409.
5. **What you should see:** the invitee appears in the members list; pending invites (visible to owner/admin) drop the accepted one.

### 3B — Bulk add via CSV (owner/admin)

6. **WHERE:** Org dashboard → **Members** → the **CSV bulk import** area. **WHAT format:** a CSV the page parses client-side (`src/app/org/dashboard/members/page.tsx`) — rows of **`email,role`** (an optional header row is detected; role defaults to member). You upload a file; it shows parsed rows, then you click send.
7. **Behind the scenes** (`POST /api/org/dashboard/members/bulk`, body `{ entries: [{email, role}] }`): **max 500 per batch**; **org must be `active`** (else 409 "Organisation is not active"). For each row it returns **invited / skipped / error**: skips people already an active member ("Already a member") or with a pending invite ("Invite already pending"), errors invalid emails, and once seats run out returns **"No seats available"** for the rest. Each successful row upserts an `org_invites` row and emails a 7-day invite link — **so bulk add still sends invites people must accept; it does not silently seat them.**
8. **What you should see:** a summary (`total / invited / skipped / errors`) plus per-row results.

### 3C — Domain auto-join (NGO / EDU only)

9. **WHO can enable:** owner/admin, **only for NGO or EDU** billing types (enforced server-side in `POST /api/org/dashboard/domain-verify` — a commercial/govt org gets 403 "Domain auto-join is available for NGO and EDU accounts only").
10. **WHERE to enable:** Org dashboard → Settings → the domain-verification section. Add allowed email domains (e.g. `hopefoundation.org`), toggle auto-join on, save. Optionally set academic-year start/end (stored as e.g. `"08-01"`). Domains are normalized (lowercased, `@` stripped, must contain a dot).
11. **The durable link:** share **`/org/join/[slug]`** (uses your org slug). **Org must be `active`** for it to work.
12. **What the joining user does:** opens `/org/join/<slug>` → page shows the org name and the **qualifying domains** so they can confirm they match → signs in → clicks **"Join [org]"** (`POST /api/org/join-by-domain`). Their email domain must match an allowed domain (exact or subdomain). On success: prior membership released, added as **member** (always member — never admin via this path), seat assigned.
13. **Durable + repeatable (v1.2.7 fix):** unlike an invite token, this link is **not single-use** — any number of eligible people can use it repeatedly. (It used to piggyback a single-use invite that only the first claimant could use.) Domain auto-join was also opened to NGOs in v1.2.7 (was accidentally EDU-only).
14. **What you should see:** each qualifying person lands on a **"Welcome to [org]!"** screen and appears in your members list; non-matching accounts see a "doesn't match any qualifying domain" message and cannot join.

### 3D — Join-by-slug link

15. There is no separate "anyone with the link joins" flow beyond 3C. **`/org/join/[slug]` is the slug link, and it is gated by domain matching** — it is the domain auto-join landing page, not an open join link. (An invite link `/org/invite/<token>` is per-recipient and per-token, from 3A.)

### Seat-capacity behavior when full (all methods)

16. Every path is capped by `seats_purchased`. Single invite → 409 up front; bulk → per-row "No seats available"; invite acceptance / domain-join → 409 if the last seat was taken between check and commit (member insert rolled back). **The fix is always the same: an Imotara super-admin raises `seats_purchased`** (Scenario 1, step 16). Org owners/admins **cannot** raise their own seat count.

---

## Scenario 4 — "Give my members the right license"

Four sources of a member's tier, resolved by a strict priority chain in `resolve_user_tier()` (`docs/sql/org_license_pools.sql`).

### The priority chain (highest wins)

1. **Pool assignment** (`tier_source: pool_assignment`) — a license assigned from a pool. Beats everything.
2. **Per-member override tier** (`org_override`) — a tier set on one member.
3. **Org default vs personal — the higher of the two.** If the **org tier outranks** the member's personal tier, org wins (`org`); otherwise the member's own paid **personal** license wins (`personal`).
4. **Free** (`default`) — nobody has anything.

> **Precision note (differs from a naive reading):** step 3 is **"higher of org-default vs personal,"** by `tier_rank`, **not** "personal always beats org default." A member who bought a personal Plus plan inside an Enterprise org still resolves to **Enterprise** (org outranks personal). Personal only wins when it outranks the org default. Pool and override always sit above this comparison.

### Org default tier (applies to everyone with no override/pool)

5. **WHO sets it:** **Imotara super-admin** (`PATCH /api/admin/organizations/[orgId]`, field `tier`) — org owners/admins cannot change org tier. When it changes, every active member's `licenses` row is re-synced. **What a member should see:** they get the org tier automatically, no action needed.

### License pools (batch of a specific tier)

6. **WHO creates a pool:** **Imotara super-admin** — `POST /api/admin/organizations/[orgId]/pools`, body `{ tier, quantity, label?, expires_at?, notes? }`. **Valid pool tiers: `free`, `plus`, `pro`, `edu`, `enterprise`** (note: **no `family`** pool). Writes an `org_license_pools` row (active) and an `org_audit_log` `pool_issued` entry. Super-admin can later PATCH quantity (can't drop below already-assigned count) or deactivate.
7. **WHO assigns from a pool:** org **owner/admin**. **WHERE:** Org dashboard → **Pool** page (`/org/dashboard/pool`). Assign a pool license to a member (`POST /api/org/dashboard/pools`, `{ poolId, userId }`). The target must be an **active member of your org** (else 409). **Behind the scenes** (`assign_pool_license`): row-locks the pool, checks capacity/expiry, reassigns cleanly if the user had another active assignment, increments `quantity_used`, writes the member's `licenses` row (`source: pool`) so the tier shows immediately, and logs `license_assigned`.
8. **Withdraw a pool license:** `DELETE /api/org/dashboard/pools?assignmentId=…` (`withdraw_pool_license`) — frees pool capacity (`quantity_used -1`) and resets the member's license back to the **org default tier**.

### Per-member override tier

9. **WHO:** org owner/admin. **WHAT** (`PATCH /api/org/dashboard/members`, `{ userId, overrideTier }`): valid values **`free`, `plus`, `pro`, `family`, `edu`, `enterprise`, or `null`** (null clears it). Setting it syncs the member's `licenses` row so it resolves immediately. Use it to give one person a different tier than the org default (e.g. one Enterprise seat in an EDU org). **Remember a pool assignment beats an override.**

### Verifying a member's effective tier

10. **WHERE:** Org dashboard → **Licenses** page (`/org/dashboard/licenses`), backed by `GET /api/org/dashboard/license-inventory`. It shows seat counts (purchased / used / available), a tier breakdown, and per-member rows with **`overrideTier`** and **`effectiveTier`** (override if set, else org tier) plus last-30-day session counts. **What you should see:** the member's effective tier and whether it comes from an override. (Pool-derived tiers show on the Pool page.)

---

## Scenario 5 — "Organize members into cohorts / teams"

Cohorts group members and set an AI-companion tone per group. **EDU orgs see these as "Classrooms," Enterprise as "Teams/Departments"** (same feature).

1. **WHO:** org owner/admin. **WHERE:** Org dashboard → **Teams** (`/org/dashboard/teams`), heading **"Teams & Groups."**
2. **Create a cohort** (`POST /api/org/dashboard/cohorts`): give it a **name** (required; placeholder "e.g. Class 10A / Sales Team"), optional description, optional **seat limit**, and a **tone policy** — one of **`close_friend` (🤝 Close Friend)**, **`calm_companion` (🌿 Calm Companion)**, **`coach` (🎯 Coach)**, **`mentor` (📚 Mentor)**. Defaults to `close_friend`.
3. **Add members** (`POST /api/org/dashboard/cohorts/members`, `{ cohortId, userId }`): expand a cohort → **"Add members"** picker (built in v1.2.7 — the UI used to reference it but it didn't exist). Only **active org members** can be added; if the cohort has a **seat_limit** and it's full you get 409 ("This cohort is at its seat limit (N)").
4. **Edit / delete** cohorts (`PATCH` / `DELETE …?cohortId=`). Removing a member from a cohort is `DELETE …/members?cohortId=&userId=`.
5. **What you should see:** the cohort card shows its tone label and member count; added members list under the cohort.

---

## Scenario 6 — "See how my org is doing"

1. **Analytics.** **WHO:** owner/admin. **WHERE:** Org dashboard → **Analytics** (`/org/dashboard/analytics`, `GET /api/org/dashboard/analytics`). Shows **aggregate** engagement — active users, total events, avg session minutes, active days. **Aggregate-only by design: you cannot see any individual member's private chats or data.** (`get_org_usage_stats` never returns per-user rows.)
2. **Audit log.** Org dashboard → **Audit** (`/org/dashboard/audit`, `GET /api/org/dashboard/audit`): org actions — invites, role changes, removals, tier changes, pool issue/assign/withdraw — with actor, target, timestamp.
3. **License / usage inventory.** Org dashboard → **Licenses** (Scenario 4, step 10): seat usage and per-member last-30-day session counts.
4. **NGO/EDU Certificate.** `GET /api/org/certificate` (any org **member** can fetch). **Eligibility (all required):** billing type **ngo or edu**, status **active**, **≥10 seats used** (`seats_used >= 10`), and **org active ≥30 days**. If eligible it returns a printable **HTML** "Emotional Wellness Champion" certificate; if not, a JSON reason (e.g. "Need at least 10 active members (currently N)" — note: the API's own message says "active members," but the actual check is `seats_used`, i.e. seats purchased/consumed, not a live re-count of currently-active `org_members` rows; usually identical in practice but worth knowing if a support case ever hinges on the difference). **Govt/commercial orgs are not eligible.** (v1.2.7 fixed a badge that showed "Eligible" on seat count alone and then silently failed the 30-day check.)
5. **NGO/EDU Impact Report.** `GET /api/org/certificate/impact-report?months=3` (owner/admin; NGO/EDU only, else 403). Grant-oriented summary — total sessions, active days, avg WAU — as **HTML, not a PDF** (the old "Grant-ready PDF" label was corrected in v1.2.7). **Note:** the impact report is **not** gated on the 10-member/30-day rule the certificate uses — any active NGO/EDU org admin can pull it.

---

## Scenario 7 — "Remove a member / a member leaves"

1. **WHO:** org owner/admin. **WHERE:** Org dashboard → **Members** → remove control (`DELETE /api/org/dashboard/members?userId=…`).
2. **Guards:** you **cannot remove yourself** (403 "You cannot remove yourself") and **cannot remove the owner** (403 "Cannot remove the org owner").
3. **Behind the scenes** (`revoke_org_license`): the member's `licenses` row is reset to **free** (`org_id` cleared, `status: valid`, no expiry, `source: manual`), the org's **`seats_used` is decremented** (freeing the seat), `org_members.status` → **`removed`**, and an `org_audit_log` `member_removed` row is written.
4. **Pool capacity release (v1.2.7 fix):** if the member held a **pool** license, member removal now **releases that pool capacity automatically** (`quantity_used` decrements) — previously a pool seat stayed occupied forever after someone left.
5. **One-paid-seat-per-user rule:** a user can only ever occupy **one** paid org seat. Joining any org first releases their prior active membership (`releasePriorOrgMembership()`), so a person paying for/using two orgs at once can't leak a seat the first org keeps paying for (the v1.2.7 cross-org seat-leak fix, closed at all six entry points: invite, domain-join, admin add-by-email, self-serve org creation, and personal Razorpay/Stripe checkout).
6. **What the ex-member experiences:** their tier drops back to free (or their own personal license if they have one). On mobile they no longer see the "Managed by [Org]" badge and personal upgrade prompts return.
7. **Imotara-side equivalent:** a super-admin can remove a member via `DELETE /api/admin/organizations/[orgId]/members?userId=…` (same `revoke_org_license` path), or **suspend** a member's access (`PATCH … { suspendAccess: true }`, a reversible Supabase ban; an already-issued token can linger up to ~1h).

---

## Scenario 8 — "Delete my organization"

Two delete paths exist; **both fire the same DB trigger** that frees member licenses.

### Path A — Org owner self-delete (owner only)

1. **WHO:** the org **owner** only — admins and members see a support-contact link, not a delete button. **Imotara support cannot self-delete on your behalf via this route; it's deliberately the owner's own informed choice.**
2. **WHERE:** Org dashboard → **Settings** → **"Danger zone"** (rose/red panel). Copy reads: "Permanently delete [org] — removes every member's access, API keys, license pools, and audit history. This cannot be undone. Only the owner can do this."
3. **Confirmations required (two of them):** type the org's **exact name** into the confirmation input — the **"Permanently delete organisation"** button stays disabled until it matches — then confirm the **browser `confirm()` dialog** ("Permanently delete "[org]"? This cannot be undone."). (`DELETE /api/org/dashboard/settings`, body `{ confirmName }`; wrong name → 400.)
4. **On success:** you're redirected to `/`.

### Path B — Imotara super-admin delete (Imotara **owner** role only)

5. **WHO:** Imotara super-admin with the **owner** role — **admin and connect_reviewer get 403** ("Only the Imotara owner role can delete organizations"). **WHERE:** `/admin` → Organizations → expand org → **"Danger zone — owner only"** panel.
6. **Confirmation:** type the org's exact name (button disabled until it matches) + native dialog. (`DELETE /api/admin/organizations/[orgId]`, `{ confirmName }`.)

### What the DB auto-releases (both paths)

7. Deleting the `organizations` row **cascade-deletes** `org_members`, `api_keys`, `org_invites`, `org_license_pools` + `org_license_assignments`, `cohorts` + `cohort_members`, and `org_audit_log`.
8. A **BEFORE-DELETE trigger** (`trg_release_licenses_on_org_delete`, `docs/sql/org_delete_license_release_trigger.sql`) runs in the **same transaction** and **resets every affected member's license to free**: `tier: free`, `org_id: null`, `status: valid`, `expires_at: null`, `source: manual`. This is guaranteed regardless of which path (or even a raw SQL delete) triggers it — because `licenses.org_id` is `ON DELETE SET NULL`, not cascade, so without the trigger ex-members would keep a paid tier with no org behind it.
9. **Email trail:** an alert goes to `info@imotara.com` (`[Org Deleted]` for owner self-delete, `[Org Deleted by Superadmin]` for admin delete). Since the audit log is gone after deletion, **this email is the only remaining trace.**
10. **What members experience afterward:** their access drops to free (or their own personal license). On mobile the "Managed by [Org]" badge disappears and personal upgrade prompts return. **This is irreversible — no undo.**

---

## Scenario 9 — "API access for my org"

The public v1 REST API is **Enterprise tier only**, enforced both in the dashboard UI and server-side.

1. **WHO:** org owner/admin. **WHERE:** Org dashboard → Settings → API keys area (`POST /api/org/dashboard/apikeys`, `{ name, scopes? }`).
2. **Enterprise gate:** if the org tier isn't `enterprise`, key creation returns **403 "API access requires the Enterprise plan"** — even via a direct API call (defense-in-depth; the two consuming endpoints also require Enterprise).
3. **Behind the scenes:** a key is minted and the **plaintext is returned exactly once** — copy it now; only a `key_prefix` and a hash are stored. Scopes default to **`read:stats`, `read:members`**. Each key carries a **rate limit of 100 requests/minute** (a real global cap since v1.2.7, not per-instance).
4. **Revoke:** `DELETE /api/org/dashboard/apikeys?keyId=…` (soft-sets `revoked_at`; you can only revoke your own org's keys).
5. **What the v1 endpoints return** (send `Authorization: Bearer imk_…`; Enterprise only):
   - `GET /api/v1/org/stats?days=30` (needs `read:stats`) → org name/tier, seats purchased/used, and aggregate daily usage stats (days capped at 180).
   - `GET /api/v1/org/members?page=0&limit=50` (needs `read:members`) → org member list (limit capped at 100).
6. **Test with curl:**
   ```bash
   curl -H "Authorization: Bearer imk_your_key_here" \
     "https://www.imotara.com/api/v1/org/stats?days=30"
   curl -H "Authorization: Bearer imk_your_key_here" \
     "https://www.imotara.com/api/v1/org/members?limit=50"
   ```
7. **Failure modes:** invalid/missing key → 401; over the rate limit → **429 "rate limit exceeded"**; missing scope → 403 ("API key missing …:… scope"); non-Enterprise → 403 ("REST API access requires Enterprise plan").

---

## Honest status — org features that exist in UI but are partial / "Coming soon"

Verified against code + the v1.2.7 changelog. Tell customers the truth:

- **LMS / iframe embed — NOT built.** The embed section in Settings is marked **"Coming soon."** `GET /api/org/dashboard/embed` will hand back an embed key and a ready-looking `<iframe>` snippet (`/embed/chat?org=…&key=…`), but **the feature doesn't function.** (The Data Residency form shares this section and saves independently — a v1.2.7 fix stopped it from silently wiping embed domains on save.)
- **Referral commission tracking — partial ("Coming soon").** NGO-only. You can create referral codes (auto-generated from the org name, default **10% commission rate**) and deactivate them, and they're stored — but the **commission attribution/payout pipeline does not actually track or pay commissions yet.** Treat codes as not-live for revenue sharing.
- **Impact Report — works, but HTML not PDF.** NGO/EDU only; grant-oriented summary delivered as **HTML** (the "Grant-ready PDF" label was corrected in v1.2.7).
- **SSO / SAML — stores config, needs Imotara to activate.** EDU/Enterprise. Saving your IdP metadata (entity ID, SSO URL, certificate, email domain) via `PATCH /api/org/dashboard/sso` stores it with **status `pending`**; the UI even says **"Save your IdP metadata below, then contact us to activate."** **It is not self-service end-to-end** — Imotara/Supabase-side config is required.
- **Custom branding — works (EDU + Enterprise).** Logo URL, accent color (hex, validated), and a brand name that replaces "Imotara" in the header (`PATCH /api/org/dashboard/branding`). Lower tiers see a contact-us message.
- **NGO/EDU verification — works, but is not a paywall.** Approve/reject is real (v1.2.7 added the missing resolve path), but subsidized pricing does **not** depend on it.

---

## Related docs

For the Imotara-staff side of every "super-admin" step above (activating orgs, verification approve/reject, pools, deletion, bans), see **"Imotara Admin Guide (Super-Admin)."** For the condensed org-owner reference, see **"Organization Owner & Admin How-Tos."**
