// src/lib/reminders/snooze.ts
//
// The snooze contract for the daily check-in reminder.
//
// OWNER DECISION 2026-10-13, option (a):
//   Free  → may SNOOZE for 3 or 5 days. No permanent off in-app.
//   Plus  → may turn it off permanently.
//
// ⚠️ THE OS-LEVEL SWITCH IS THE FREE ESCAPE HATCH AND IT ALWAYS REMAINS.
// That is what keeps a paywalled in-app off switch defensible: nobody is ever
// trapped, because iOS and Android (and the browser) can silence Imotara for
// free at any time. The first-run copy must say so — see the reminder plan.
//
// ⛔ Snooze MUST be enforced server-side. The nudge is a server push, so a
// client-only flag cannot stop it: the person would tap "snooze", see nothing
// change, and reasonably conclude the control is fake.

/** What a tier may do with the reminder. */
import { normaliseTier, TIER_RANK } from "@/types/license";

export type ReminderControl = "snooze_only" | "can_disable";

/** Snooze lengths offered to free users, in days. Owner decision: 3 or 5. */
export const SNOOZE_DAYS = [3, 5] as const;
export type SnoozeDays = (typeof SNOOZE_DAYS)[number];

/**
 * Where the snooze and the permanent off live: one row per person in
 * push_reminders (columns snoozed_until, disabled), beside the subscription.
 *
 * 🔴 NOT user_memory (25 Oct 2026). These used to be user_memory rows of type
 * "push"; the live constraints rejected them, so no snooze or off was ever
 * saved — and user_memory is loaded whole into the AI's context.
 * ⇒ docs/sql/push_reminders.sql
 */
export const PUSH_REMINDERS_TABLE = "push_reminders";

/**
 * What this tier is allowed to do.
 *
 * ⚠️ Tier lives at `license.tier`, never at the root of the license object —
 * see trap_tier_lives_at_license_tier.
 *
 * ⛔ DERIVED from the licensing model, never a hand-written list. The first
 * version of this function listed "plus | pro | enterprise | edu" and silently
 * MISSED `family` — a paying subscriber would have been denied a paid control,
 * and nothing would have failed. Anything above free can disable; normaliseTier
 * resolves legacy ids (`pro` → `plus`) and returns "free" for anything it does
 * not recognise, so an unknown tier fails CLOSED rather than granting a paid
 * control by accident.
 */
export function controlForTier(tier: string | null | undefined): ReminderControl {
    return TIER_RANK[normaliseTier(tier)] > TIER_RANK.free ? "can_disable" : "snooze_only";
}

/** True when `days` is one of the offered snooze lengths. */
export function isValidSnoozeDays(days: unknown): days is SnoozeDays {
    return typeof days === "number" && (SNOOZE_DAYS as readonly number[]).includes(days);
}

/** The ISO instant a snooze of `days` started `from` should end. */
export function snoozeUntil(days: SnoozeDays, from: Date = new Date()): string {
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * True when reminders are currently suppressed for this person.
 *
 * Takes the raw stored values so one function answers the question for the
 * cron, the API and the UI — three places that must never disagree about
 * whether someone is snoozed.
 */
export function isSuppressed(
    snoozedUntilIso: string | null | undefined,
    disabled: boolean,
    now: Date = new Date(),
): boolean {
    if (disabled) return true;
    if (!snoozedUntilIso) return false;
    const until = Date.parse(snoozedUntilIso);
    // ⚠️ An unparseable value must NOT suppress. Treating junk as "snoozed
    // forever" would silently stop a person's reminders with no way to notice.
    if (!Number.isFinite(until)) return false;
    return until > now.getTime();
}

/**
 * When an active snooze ends, for the "Reminders will resume on …" line.
 * Returns null when nothing is snoozed, so the caller shows no date rather
 * than a misleading one.
 *
 * ⚠️ Silent resumption is what produces "this app won't stop notifying me"
 * reviews — on a 3-day cycle it would happen often. The date is not optional
 * polish.
 */
export function snoozeEndsAt(
    snoozedUntilIso: string | null | undefined,
    now: Date = new Date(),
): Date | null {
    if (!snoozedUntilIso) return null;
    const until = Date.parse(snoozedUntilIso);
    if (!Number.isFinite(until) || until <= now.getTime()) return null;
    return new Date(until);
}
