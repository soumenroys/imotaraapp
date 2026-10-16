// src/lib/account/retentionPolicy.ts
//
// The retention policy, as NUMBERS, in one place.
//
// 🔴 WHY THIS FILE EXISTS. The privacy policy page imports these and writes
// them into its prose; the cron imports them and acts on them. A promise made
// to users in English and a timer enforcing it in TypeScript are the classic
// pair that drift — and when they drift, the published promise is the one that
// is wrong, which is the version that matters legally. Interpolating the same
// constant into both makes disagreement structurally impossible rather than
// merely tested for.
//
// ⚠️ Changing a number here changes what /privacy SAYS. That is the point. It
// is also why you must not change one casually: the page is a public statement.

/** Dormancy before the warning email. */
export const RETENTION_INACTIVE_MONTHS = 24;

/** Grace between the warning and erasure. */
export const RETENTION_GRACE_DAYS = 30;

/**
 * Is the retention job allowed to actually delete?
 *
 * 🔴 ANYTHING BUT THE EXACT STRING "true" MEANS REPORT ONLY — absent, empty,
 * "1", "True", "yes" all leave it inert. That asymmetry is deliberate: the
 * failure mode of a mis-set flag must be "deleted nothing", never "deleted
 * everything". ⇒ the mirror of the ADMIN_SECRET_DISABLED lesson, where a flag
 * tested with === "true" could silently fail OPEN; here it fails CLOSED.
 */
export function retentionEnforcing(): boolean {
    return process.env.IMOTARA_RETENTION_ENFORCE === "true";
}
