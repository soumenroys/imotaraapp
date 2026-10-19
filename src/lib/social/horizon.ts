// src/lib/social/horizon.ts
// Which posts SHOULD exist, for the next ten days.
//
// 🔴 THIS REPLACES A LEAD TIME, AND THE DIFFERENCE IS THE WHOLE POINT.
//
// The old model asked "is a schedule due THIS MINUTE?" and, if so, wrote one
// post for a slot two hours out. Three things follow from that, and all three
// bit us:
//
//   · A REVIEWER HAD TWO HOURS. The owner asked for ten days, because a post
//     that needs a comment, a correction or a second opinion cannot get one
//     inside a window that opens while you are at lunch.
//   · A MISSED MINUTE WAS A MISSED DAY, FOREVER. The trigger matched one exact
//     minute. A deploy, a cold start or a Vercel hiccup during that minute and
//     the day simply had no post — with no record that anything was meant to
//     happen ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
//   · IT COULD NOT FILL A GAP IT DID NOT CAUSE. The Instagram time was added
//     at 20:45 on 18 Oct, after that day's 15:00 trigger. Nothing was broken,
//     and Instagram still had no queued post — because the only moment that
//     could create one had already passed.
//
// ⇒ So this module answers a different question: WHICH SLOTS SHOULD EXIST
// between now and ten days from now? The cron fills the earliest ones that do
// not. That is self-healing by construction — a gap from any cause at all,
// including a cause nobody has thought of, is simply a slot that is missing
// and gets filled on the next run.
//
// ⚠️ PURE. No database, no clock of its own. Every rule here is a function of
// (schedule, now), which is why the timezone arithmetic can be tested at fixed
// instants rather than hoped about.

/** How far ahead posts are written, so there is real time to review them. */
export const HORIZON_DAYS = 10;

/**
 * 🔑 HOW MANY POSTS ONE CRON RUN MAY WRITE.
 *
 * ⛔ NOT THE WHOLE HORIZON AT ONCE. Filling ten days across two channels is
 * twenty model calls, which would blow the function's time limit and spend
 * twenty generations before a human has seen whether the first one is any
 * good. ⚠️ The cron runs every minute, so a bound of two fills an empty
 * ten-day horizon in about ten minutes and a single new day instantly.
 */
export const MAX_PER_RUN = 2;

export type ScheduleTimes = {
  id: string;
  post_at: string;
  timezone: string;
  days: number[];
  active: boolean;
  platforms: string[] | null;
  platform_times?: Record<string, { post_at?: string; days?: number[] }> | null;
};

export type Slot = {
  scheduleId: string;
  platform: string;
  /** The exact instant, as stored in `scheduled_for`. */
  scheduledFor: string;
};

/** The wall clock an instant shows in a particular zone. */
function wallClockIn(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // ⚠️ "24" is a real answer from Intl at midnight in some locales.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

/**
 * A wall clock in some zone, as the instant it actually is.
 *
 * 🔴 THERE IS NO LIBRARY FOR THIS HERE (date-fns is installed, date-fns-tz is
 * not), so it is done the standard way: guess, measure how wrong the guess
 * was in the target zone, correct, and measure again. ⛔ The SECOND pass is
 * not belt and braces — a single correction lands on the wrong side of a DST
 * boundary, which is a once-a-year wrong hour that nobody connects to this
 * code. India has no DST; the schedule's timezone is a column.
 */
export function instantOf(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string,
): Date {
  const want = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let guess = want;
  for (let pass = 0; pass < 2; pass += 1) {
    const shown = wallClockIn(new Date(guess), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, 0, 0);
    const drift = want - shownAsUtc;
    if (drift === 0) break;
    guess += drift;
  }
  return new Date(guess);
}

/** Is this a real time of day, and not merely four digits and a colon? */
export function isTime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59 && Number(m[3] ?? "0") <= 59;
}

/** The time and days ONE platform runs on, which may not be the schedule's. */
export function timesFor(
  schedule: Pick<ScheduleTimes, "post_at" | "days" | "platform_times">,
  platform: string,
): { post_at: string; days: number[] } {
  const override = schedule.platform_times?.[platform];
  /**
   * ⛔ RANGE-CHECKED, NOT JUST SHAPE-CHECKED. "25:99" satisfies
   * /^\d{2}:\d{2}$/ perfectly, and `Date.UTC(y, m, d, 25, 99)` does not
   * throw — it rolls silently into the NEXT DAY at 02:39. A hand-edited digit
   * would move a channel to a different day at a time nobody chose, and
   * nothing anywhere would say so. ⇒ Caught by a test, not by reading.
   *
   * ⚠️ A bad value means "this channel runs at the schedule's normal time",
   * never "this channel silently stops".
   */
  const at = isTime(override?.post_at) ? (override!.post_at as string) : schedule.post_at;
  const days =
    Array.isArray(override?.days) && override.days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      ? override.days
      : schedule.days;
  return { post_at: at, days };
}

/**
 * Every slot this schedule should have between `now` and the horizon.
 *
 * ⚠️ SLOTS IN THE PAST ARE NOT RETURNED. A post written for an hour that has
 * gone cannot be reviewed and cannot be published — it would sit `needs_review`
 * forever, and every run would try to write it again.
 *
 * 🔑 EARLIEST FIRST, across platforms, because the cron fills a bounded number
 * per run and the nearest slot is the one with the least review time left.
 */
export function slotsInHorizon(
  schedule: ScheduleTimes,
  now: Date,
  horizonDays: number = HORIZON_DAYS,
): Slot[] {
  if (!schedule.active) return [];
  const out: Slot[] = [];

  for (const platform of schedule.platforms ?? []) {
    const { post_at, days } = timesFor(schedule, platform);
    // ⛔ The schedule's OWN post_at gets the same check as an override. It is
    // the fallback for a bad override, so trusting it blindly would make the
    // guard above a guard against one of the two ways in.
    if (!isTime(post_at)) continue;
    const [hh, mm] = post_at.split(":").map(Number);

    /**
     * ⚠️ COUNTED FROM THE SCHEDULE'S OWN TODAY, not from a UTC date. At 02:00
     * IST the UTC date is still yesterday, and a horizon counted from it would
     * be a day short at one end and a day long at the other — for four and a
     * half hours a day, every day.
     */
    const here = wallClockIn(now, schedule.timezone);
    for (let i = 0; i <= horizonDays; i += 1) {
      // Midday, so adding days never lands inside a DST jump.
      const probe = instantOf(here.year, here.month, here.day + i, 12, 0, schedule.timezone);
      const day = wallClockIn(probe, schedule.timezone);
      if (!days.includes(day.weekday)) continue;

      const at = instantOf(day.year, day.month, day.day, hh, mm, schedule.timezone);
      if (at.getTime() <= now.getTime()) continue;

      out.push({ scheduleId: schedule.id, platform, scheduledFor: at.toISOString() });
    }
  }

  return out.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

/** The key a stored post is recognised by. ⛔ One spelling, used by both
 *  sides of the comparison, or every slot looks missing and is rewritten. */
export function slotKey(s: { scheduleId: string; platform: string; scheduledFor: string }): string {
  return `${s.scheduleId}|${s.platform}|${new Date(s.scheduledFor).toISOString()}`;
}

/**
 * 🔴 HOW LONG TO LEAVE A SLOT ALONE AFTER IT FAILED.
 *
 * Without this, a slot that cannot be filled is retried every minute forever
 * — about 2,880 model calls a day for a post that is never written — and,
 * because the earliest missing slots are taken first, it blocks every slot
 * behind it. Ten days of queue would stay empty behind one bad day.
 *
 * ⚠️ RISING, NOT FIXED. The first failure is usually transient (a model
 * hiccup, a subject that collided with one written seconds earlier) and
 * deserves a quick retry. The fifth is a real problem that a sixth attempt
 * will not fix, and by then a human needs to look rather than a machine to
 * keep trying.
 *
 * ⛔ CAPPED, NOT ABANDONED. Six hours, not "never again": the cause may be an
 * outage that ends, and a slot abandoned permanently is a day that silently
 * never posts ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 */
export const BACKOFF_MINUTES = [5, 15, 60, 180, 360] as const;

export function backoffMinutes(attempts: number): number {
  if (attempts <= 0) return 0;
  return BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1];
}

/** Is this slot still inside its back-off, and so not to be tried yet? */
export function inBackoff(
  attempt: { attempts: number; last_attempt_at: string } | undefined,
  now: Date,
): boolean {
  if (!attempt) return false;
  const waited = (now.getTime() - new Date(attempt.last_attempt_at).getTime()) / 60_000;
  return waited < backoffMinutes(attempt.attempts);
}

/**
 * The slots that should exist and do not, earliest first, bounded.
 *
 * ⛔ `existing` is every post already written for these schedules — INCLUDING
 * ones a human rejected or skipped. A rejected post is a decision; rewriting
 * its slot would hand the reviewer the same post again tomorrow, and the
 * tomorrow after that.
 */
export function missingSlots(
  schedules: ScheduleTimes[],
  existing: Iterable<string>,
  now: Date,
  opts: {
    horizonDays?: number;
    max?: number;
    /** Keyed by slotKey ⇒ a slot that failed recently is left alone. */
    attempts?: Map<string, { attempts: number; last_attempt_at: string }>;
  } = {},
): Slot[] {
  const have = new Set(existing);
  const attempts = opts.attempts ?? new Map();
  const all = schedules
    .flatMap((s) => slotsInHorizon(s, now, opts.horizonDays ?? HORIZON_DAYS))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  return all
    .filter((s) => !have.has(slotKey(s)))
    /**
     * ⛔ THE BACK-OFF IS A SKIP, NOT A STOP. A slot inside its wait is passed
     * over so the ones behind it get their turn — which is the half of this
     * that matters. Taking the earliest first and retrying it forever would
     * leave ten days empty behind one bad day.
     */
    .filter((s) => !inBackoff(attempts.get(slotKey(s)), now))
    .slice(0, opts.max ?? MAX_PER_RUN);
}
