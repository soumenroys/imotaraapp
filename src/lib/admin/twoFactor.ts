// src/lib/admin/twoFactor.ts
// The one rule that decides whether a session may act.
//
// 🔑 A PURE FUNCTION, ON PURPOSE. This is the only thing standing between a
// password and the admin panel, and its edge cases are all about ABSENT
// values: an admin row without totp_enabled, a session row from before the
// column existed, a migration not yet run. Those are exactly the cases that
// are awkward to reach through a route and trivial to enumerate in a test.

export type AdminFactorState = { totp_enabled?: boolean | null };
export type SessionFactorState = { two_fa_verified?: boolean | null };

/**
 * Should this session be refused until a code is entered?
 *
 * ⛔ TRUE ONLY WHEN THE ADMIN ACTUALLY HAS 2FA ON. Somebody who never enrolled
 * has no second factor to offer, so refusing them would be a lockout with no
 * way out — the single worst outcome this feature could produce.
 *
 * ⚠️ AN ABSENT `two_fa_verified` COUNTS AS VERIFIED, and that is deliberate.
 * It means one of two things: the migration has not run, or the row predates
 * it. In both cases the honest reading is "this session was made under the old
 * rules", and the safe failure is *not yet enforcing* — never locking out every
 * admin at once, including whoever would have to run the migration.
 */
export function sessionNeedsSecondFactor(
  admin: AdminFactorState | null | undefined,
  session: SessionFactorState | null | undefined,
): boolean {
  if (!admin?.totp_enabled) return false;
  // `?? true` is the absent-column case. `=== false` would also treat a null
  // as verified; being explicit here is the point of the function.
  const verified = session?.two_fa_verified ?? true;
  return verified !== true;
}
