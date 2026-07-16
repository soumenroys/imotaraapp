# Functional Testing — Org Deletion & Connect-Reviewer Comment Approval
**Date:** 2026-07-16
**Scope:** Web only (imotaraapp)
**Related commits:** `a510784`, `7339a17`, `b3223f0`
**Related SQL migration:** `docs/sql/org_delete_license_release_trigger.sql` (confirmed run in production 2026-07-16)

---

## 1. Features covered

1. **Org owner self-deletion** — an org's own `owner` role can permanently delete their organization from `/org/dashboard/settings`.
2. **Imotara owner org deletion** — the platform's `owner`-role superadmin can permanently delete any organization from `/admin` → Organizations.
3. **Automatic license release on org delete** — a DB trigger (`trg_release_licenses_on_org_delete`) resets every affected member's license to free, regardless of which of the two paths above (or any future path) deletes the org.
4. **Connect-reviewer blog-comment approval** — the `connect_reviewer` superadmin role can now view/approve/reject/delete blog comments, in addition to its existing Connect marketplace scope.

Explicitly **not** in scope: superadmin roles other than `owner` still cannot delete organizations (`admin` and `connect_reviewer` are rejected with 403).

---

## 2. Test environment

- Local dev server (`npm run dev`), pointed at the **production** Supabase project (this repo has no separate staging DB — see §5 for how destructive tests were isolated).
- Auth: `ADMIN_SECRET` legacy Bearer token (maps to `owner` role) for admin-panel tests.
- All test fixtures (orgs, users, license rows, API keys, invites, license pools) were created with a `ZZ_TEST_` / `zz-test-…@imotara-test.invalid` naming convention and deleted at the end of each test run — verified zero leftovers via a final sweep query.

---

## 3. Manual functional test instructions

### 3.1 Org owner self-deletion (`/org/dashboard/settings`)

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as a user with `role: "member"` or `"admin"` (not owner) in an org, go to Settings | "Danger zone" shows a support-contact link only, no delete control |
| 2 | Log in as the org's `owner`, go to Settings | "Danger zone" shows a text input + "Permanently delete organisation" button, disabled until the org name is typed exactly |
| 3 | Type a wrong name | Button stays disabled |
| 4 | Type the exact org name, click delete | Native `confirm()` dialog appears |
| 5 | Confirm | Org is deleted, browser redirects to `/` |
| 6 | Try logging back into the deleted org's dashboard | No longer accessible — org and membership are gone |

### 3.2 Imotara owner org deletion (`/admin` → Organizations)

| Step | Action | Expected result |
|---|---|---|
| 1 | Log into `/admin` as an `admin`-role or `connect_reviewer`-role superadmin, expand any org | No "Danger zone" section visible at all |
| 2 | Log in as the `owner`-role superadmin, expand any org | "Danger zone — owner only" section visible at the bottom, with a name-confirmation input + delete button |
| 3 | Type the wrong org name | Button stays disabled |
| 4 | Type the exact name, click delete | Native `confirm()` dialog, then the org disappears from the list on success |

### 3.3 License release verification (either delete path)

| Step | Action | Expected result |
|---|---|---|
| 1 | Before deleting, note a member's license tier in `/admin` → Licenses (should match the org's tier, `org_id` set) | — |
| 2 | Delete the org via either path above | — |
| 3 | Re-check that member's license in `/admin` → Licenses | `tier: free`, `org_id: null`, `status: valid`, no `expires_at` |

### 3.4 Connect-reviewer comment approval

| Step | Action | Expected result |
|---|---|---|
| 1 | Log into `/admin` as the `connect_reviewer` account | "Comments" tab is now visible in the tab bar (previously hidden) alongside "Connect" |
| 2 | Open Comments, view pending list | Loads normally (previously would 401) |
| 3 | Approve a pending comment | Succeeds, comment moves to Approved |
| 4 | Delete a comment | Succeeds |

---

## 4. Automated testing performed this session

Run against the local dev server + production Supabase, using disposable fixtures only (see §2).

| # | Test | Method | Result |
|---|---|---|---|
| 1 | Unauthenticated `DELETE /api/admin/organizations/:id` | curl, no auth header | **401** ✅ |
| 2 | Unauthenticated `GET/PATCH/DELETE /api/admin/comments*` | curl, no auth header | **401 on all three** ✅ |
| 3 | Owner (`ADMIN_SECRET`) can still `GET /api/admin/comments` after the `connectAdminAuthorized` swap | curl | **200** ✅ |
| 4 | Delete a nonexistent org | curl, valid owner auth, random UUID | **404**, `{"error":"org not found"}` ✅ |
| 5 | Delete with wrong `confirmName` | curl, real disposable test org | **400**, org left untouched (verified via follow-up `GET` → 200) ✅ |
| 6 | Delete with correct `confirmName` | curl | **200**, `{"ok":true}` ✅ |
| 7 | Verify org actually gone | curl `GET` on same id | **404** ✅ |
| 8 | Full FK cascade on delete — org with `org_members`, `api_keys`, `org_invites`, `org_license_pools` rows attached | Direct service-role DB test: created fixtures, deleted org, re-queried each table | All four tables: **0 rows remaining** ✅ |
| 9 | License-release trigger, before migration was run | Direct DB test: org + license row (`tier: enterprise`, `org_id` set), deleted org | `org_id` → null (FK `SET NULL`, unrelated to trigger), but **`tier` stayed `"enterprise"`** ❌ — confirmed the trigger was not yet installed |
| 10 | License-release trigger, after migration was run | Same test repeated post-migration | `org_id: null, tier: "free", status: "valid", expires_at: null, source: "manual"` — **all fields correctly reset** ✅ |
| 11 | Dev server logs across all above | `grep -i error` on server log | No errors/exceptions logged ✅ |
| 12 | Leftover test data sweep | Queried `organizations` for `ZZ_TEST%` and `super_admins` for `zz-test%` after all runs | **Zero leftovers** ✅ |

### 4.1 Not covered by automated testing

Two checks were **code-reviewed only, not live-tested**, because live-testing them would have required creating temporary `admin`/`connect_reviewer`-role superadmin accounts via the live API — blocked by the permission system as outside the scope of the testing request at the time:

- That `admin` and `connect_reviewer` roles are rejected with 403 from the org-delete endpoint (`src/app/api/admin/organizations/[orgId]/route.ts`, `if (auth.admin.role !== "owner") return 403`).
- That a real `connect_reviewer` account (not just the `owner`-mapped legacy secret) can actually approve/reject/delete comments end-to-end.

Both are simple, deterministic code paths that were manually reviewed and are believed correct, but have not been exercised live. Recommended: verify manually using the real `roysowmen@gmail.com` connect_reviewer account (per `admin_credentials.md`), or explicitly authorize creation of temporary test accounts for a follow-up automated pass.

---

## 5. Data safety notes

- No real user, org, or license data was read, modified, or deleted at any point.
- All destructive tests ran against organizations, users, and license rows created solely for the test and named with a `ZZ_TEST_` / `zz-test-…@imotara-test.invalid` convention, so they were identifiable and separable from real data even if a step had failed midway.
- A final sweep confirmed no `ZZ_TEST_*` orgs or `zz-test*` superadmin accounts remained in the database after testing.
- One real side effect: the alert email (`sendAdminDeletionAlert`) fires to `info@imotara.com` on every successful org deletion, including test ones — expect 1–2 test alert emails referencing `ZZ_TEST_ADMIN_DELETE_ROUTE` / `ZZ_TEST_CASCADE_*` in the inbox from this session.

---

## 6. Summary

| Area | Status |
|---|---|
| Org owner self-deletion | ✅ Built, code-reviewed, shares the verified trigger/cascade behavior |
| Imotara owner org deletion (admin panel) | ✅ Fully tested — auth, validation, cascade, trigger all pass |
| Automatic license release trigger | ✅ Verified broken pre-migration, verified fixed post-migration |
| Connect-reviewer comment approval | ⚠️ Auth-gate tested; role-specific live test still outstanding |
| `admin`/`connect_reviewer` blocked from org deletion | ⚠️ Code-reviewed only, not live-tested |

Nothing failed. The two outstanding items are scope-limited (they need a live `connect_reviewer` account), not known defects.
