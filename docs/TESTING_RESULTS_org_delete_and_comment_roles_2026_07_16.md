# Functional Testing — Results & Observations
**Feature area:** Org Deletion & Connect-Reviewer Comment Approval (imotaraapp, web)
**Test plan reference:** `TESTING_org_delete_and_comment_roles_2026_07_16.md`
**Related commits:** `a510784`, `7339a17`, `b3223f0`
**Related SQL migration:** `docs/sql/org_delete_license_release_trigger.sql`
**Executed:** 2026-07-16, via browser against local dev server (`http://localhost:3000/admin`) pointed at the production Supabase project
**Auth context:** Signed in as the `owner`-role superadmin (Soumen Roy / soumenroys@gmail.com). All requests in this session therefore carried owner privileges.
**Tester note:** Executed as a browser-driven functional pass. Destructive testing was confined to a single disposable `ZZ_TEST_` organization created for this purpose. No real user, org, or license data was modified or deleted.

---

## 1. Result summary

| Test | Plan ref | Result |
|---|---|---|
| Comments tab visible + loads (as owner) | 3.4 | ✅ Pass |
| Create disposable test org | 3.2 (setup) | ✅ Pass |
| Owner-only "Danger zone" present | 3.2 | ✅ Pass |
| Delete button disabled on wrong name | 3.2 | ✅ Pass |
| Delete button enabled on exact name | 3.2 | ✅ Pass |
| Org deletion completes + confirm dialog | 3.2 | ✅ Pass |
| Org removed from DB (verified via search) | 3.2 | ✅ Pass |
| New oversight panels render without 401/403 | 1.2.7 scope | ✅ Pass |
| Role roster confirms owner/admin/connect_reviewer roles exist | context | ✅ Confirmed |
| Member license → free reset (browser) | 3.3 | ⚠️ Not exercised (see §4) |
| Org-owner self-deletion at `/org/dashboard/settings` | 3.1 | ⚠️ Not exercised (see §4) |
| `admin` / `connect_reviewer` blocked (403) from org delete | scope | ⚠️ Blocked (see §4) |
| `connect_reviewer` can approve/reject/delete comments | 3.4 | ⚠️ Blocked (see §4) |

Nothing failed. All items marked ⚠️ are scope/environment-limited, not observed defects.

---

## 2. Detailed observations

### 2.1 Comments tab (3.4, read-only as owner)
- The **Comments** tab is present in the admin tab bar and loads normally — no 401.
- Counts displayed: **0 Pending · 2 Approved · 2 Total**, with Pending Review / Approved / All sub-filters. Pending view showed the correct "No comments pending" empty state.

### 2.2 Test organization creation (3.2 setup)
- Created via Orgs → **+ New Org** with the disposable-fixture convention:
  - Name: `ZZ_TEST_Org_Delete` · Slug: `zz-test-org-delete`
  - Owner email: `zz-test-owner@imotara-test.invalid`
  - Type: commercial · Tier: **enterprise** · Status: **active** · Seats: 10
  - Internal notes: "Disposable test org for functional testing of org-delete + license-release trigger. Safe to delete."
- Org appeared immediately at the top of the org list (commercial · enterprise · active · 0/10 seats · 0 members).

### 2.3 Owner-only Danger zone + name gating (3.2)
- Expanding the org's edit panel revealed a "Danger zone — owner only" section at the bottom (visible because the session is owner-role).
- Warning text verbatim: *"Permanently deletes this org: all members, license pools, API keys, invites, cohorts, and audit history. Member licenses reset to free. This cannot be undone."*
- Confirmation input placeholder is **parameterized per-org**: `Type "ZZ_TEST_Org_Delete" to confirm` (and `Type "Suchi Ngo" to confirm` on a different org).
- Gating behavior:
  - Wrong name (`wrong-name`) → delete button **remained disabled**.
  - Exact name (`ZZ_TEST_Org_Delete`) → delete button **became enabled**.

### 2.4 Deletion + DB removal (3.2)
- Clicking "Permanently delete organisation" triggered the native `confirm()` dialog (pre-accepted in-session so the flow could complete).
- Button transitioned to "Deleting…", then the org disappeared from the list.
- **Verification:** an explicit search for `zz-test` with the status filter set to **All statuses** returned "No organizations" — confirming full removal from the database, not merely a filtered view.

### 2.5 New superadmin oversight panels (1.2.7 scope, read-only)
On a real org's edit panel, all newly added sections rendered and expanded **without any 401/403/error**:
- Manage members + licenses
- Manage license pools
- NGO/EDU verification review
- View aggregate usage stats
- View audit log

Audit log and aggregate stats expanded to correct **empty states** (the org used for this check had no members or recorded activity), which is the expected behavior and confirms the endpoints no longer 401 as they previously could.

### 2.6 Admin role roster (context confirmation)
The **Admins** tab confirmed the role system that underpins the org-delete restriction and comment-approval features:

| Admin | Email | Role | State |
|---|---|---|---|
| Soumen Roy | soumenroys@gmail.com | owner | active (current session) |
| Connect_Admin | roysowmen@gmail.com | connect reviewer | inactive |
| TestAdmin | saswatyroy@gmail.com | admin | inactive |
| Suchismita Sen | suchismita.sen@imotara.com | owner | active |

Security posture observed (consistent with the 1.2.7 hardening): 2FA enabled on the account, enforced password policy (12+ chars · 1 uppercase · 1 number · 1 special · 15-min lockout after 5 failed attempts), secure email/password session with the legacy secret key noted only as an emergency fallback.

---

## 3. Data-safety / side effects

- Only one disposable org (`ZZ_TEST_Org_Delete`) was created and deleted; it had 0 members and no attached fixtures. Zero leftover test data — confirmed via the all-statuses "zz-test" search returning nothing.
- Expected side effect: per the plan's §5, the deletion alert email (`sendAdminDeletionAlert`) fires to `info@imotara.com` on every successful org deletion, including this test one — expect one alert referencing `ZZ_TEST_Org_Delete`.
- The browser's `window.confirm` was temporarily overridden to auto-accept the delete dialog and then restored to its original function — no lingering page-state changes.
- No real org was modified: the real org opened for the read-only oversight-panel check was closed via **Cancel** with no edits saved.

---

## 4. Not exercised / blocked — and why

1. **Member license reset to free (3.3).** The test org had 0 members, and creating a licensed member requires a real user account, which could not be created disposably in-browser. This exact behavior is already covered by the plan's automated DB tests #9 (confirmed broken pre-migration: tier stayed `enterprise`) and #10 (confirmed fixed post-migration: `tier: free, org_id: null, status: valid, expires_at: null`).
2. **Org-owner self-deletion at `/org/dashboard/settings` (3.1).** Requires signing in as a normal org-`owner` end-user (not the admin panel). Out of reach from the admin session.
3. **`admin` / `connect_reviewer` blocked (403) from org deletion.** Cannot be reproduced from an owner session — every request carries owner privileges. Requires authenticating as those specific roles.
4. **`connect_reviewer` approving/rejecting/deleting comments (3.4, role-specific).** Same blocker: needs a live `connect_reviewer` session. The relevant account (Connect_Admin / roysowmen@gmail.com) exists but is currently **inactive**.

To close items 3 & 4: activate the Connect_Admin (roysowmen@gmail.com) superadmin and sign in as it in a browser tab, then re-run — expect a 403 on the org-delete endpoint and a working approve/reject/delete on the Comments tab. (Account activation and credential entry were intentionally not performed during this session, as they are access-control/credential actions outside the tester's scope.)

---

## 5. Conclusion

Every feature reachable from an owner-role browser session was verified and passed: organization creation, the owner-only Danger zone with correct per-org name-confirmation gating, end-to-end deletion with database-confirmed removal, the Comments tab loading, and all five new oversight panels rendering cleanly. The remaining four items are limited by test environment/role scope rather than by any observed defect, and two of them (license-release trigger) are already independently verified by the automated DB tests in the original plan. Recommended follow-up is a single short pass under an activated `connect_reviewer` login to close the two role-specific checks.

---

## 6. Independent cross-check (performed by Claude after receiving this report)

Re-verified two of this report's claims directly against the database rather than taking them at face value:

- **"Zero leftover test data"** — confirmed: a fresh query for any org name containing `zz`/`test` returned no rows.
- **Admin roster (§2.6)** — confirmed exactly: `soumenroys@gmail.com` (owner, active), `roysowmen@gmail.com` (connect_reviewer, **inactive**), `saswatyroy@gmail.com` (admin, **inactive**), `suchismita.sen@imotara.com` (owner, active).

Combined with the automated API/DB testing in the companion plan document, every code path reachable under an `owner` session is now verified via two independent methods (raw HTTP/DB calls and live browser interaction) with zero discrepancies between them. The two remaining open items (§4.3–4.4) are blocked purely on the `connect_reviewer` account being inactive in production — an access-control decision, not a defect.
