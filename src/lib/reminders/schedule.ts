// src/lib/reminders/schedule.ts
//
// Decides WHO should get the daily check-in nudge on this cron tick.
//
// WHY THIS IS NOT "send at 09:00 UTC":
// the cron fired once a day at 09:00 UTC, which is 14:30 in India, 05:00 on the
// US east coast and 10:00 in Berlin. A reminder to check in with yourself is
// about the shape of someone's day, so a single absolute instant is wrong for
// almost everyone. The cron now runs hourly and this module answers "is it this
// person's hour yet?".
//
// ⛔ Pure functions only — no clients, no I/O. The cron is hard to test; this is
// where the decision actually lives, so this is what gets tested.

/** Default local hour for the check-in, matching the mobile reminder's 20:00. */
export const DEFAULT_REMINDER_HOUR = 20;

/**
 * Hour (0-23) in `timeZone` at instant `at`.
 *
 * Returns null for an unknown or malformed zone rather than guessing. A guess
 * would silently nudge someone in the middle of their night.
 */
export function localHourIn(at: Date, timeZone: string | null | undefined): number | null {
    if (!timeZone) return null;
    try {
        const h = new Intl.DateTimeFormat("en-GB", {
            hour: "numeric",
            hour12: false,
            timeZone,
        }).format(at);
        const n = Number.parseInt(h, 10);
        // Intl returns "24" for midnight in some ICU versions.
        return Number.isFinite(n) ? n % 24 : null;
    } catch {
        return null;
    }
}

/** The local calendar date in `timeZone`, as YYYY-MM-DD, or null. */
export function localDateIn(at: Date, timeZone: string | null | undefined): string | null {
    if (!timeZone) return null;
    try {
        return new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone,
        }).format(at);
    } catch {
        return null;
    }
}

export type DueInput = {
    now: Date;
    /** IANA zone from the client, e.g. "Asia/Kolkata". May be absent. */
    timeZone?: string | null;
    /** The person's chosen hour, 0-23. Defaults to DEFAULT_REMINDER_HOUR. */
    preferredHour?: number | null;
    /** When they last received any nudge. */
    lastNotifiedMs?: number | null;
    /** When they last sent a message. */
    lastActiveMs?: number | null;
};

/**
 * True when this person should be nudged on this tick.
 *
 * Three independent reasons to stay quiet, in order of how annoying it would be
 * to get them wrong:
 *   1. They already used Imotara today — a "check in" nudge would be noise.
 *   2. They were nudged within the last 20 hours — never twice in a day.
 *   3. It is not their hour yet.
 *
 * ⚠️ Someone with NO timezone falls back to the fixed hour in UTC. That keeps
 * existing subscribers working rather than silently dropping everyone who
 * predates timezone capture.
 */
export function isDueNow(input: DueInput): boolean {
    const { now, timeZone, preferredHour, lastNotifiedMs, lastActiveMs } = input;
    const nowMs = now.getTime();

    // 2. One nudge a day, at most. 20h rather than 24h so a person whose hour
    //    sits near a DST boundary is not skipped entirely for a day.
    if (lastNotifiedMs && nowMs - lastNotifiedMs < 20 * 60 * 60 * 1000) return false;

    const hour =
        typeof preferredHour === "number" && preferredHour >= 0 && preferredHour <= 23
            ? preferredHour
            : DEFAULT_REMINDER_HOUR;

    const local = localHourIn(now, timeZone);
    // No usable zone: fall back to the same hour in UTC.
    const effective = local ?? now.getUTCHours();
    if (effective !== hour) return false;

    // 1. Already spoke to Imotara during their own day — nothing to remind.
    if (lastActiveMs) {
        const today = localDateIn(now, timeZone) ?? now.toISOString().slice(0, 10);
        const activeDay =
            localDateIn(new Date(lastActiveMs), timeZone) ??
            new Date(lastActiveMs).toISOString().slice(0, 10);
        if (activeDay === today) return false;
    }

    return true;
}
