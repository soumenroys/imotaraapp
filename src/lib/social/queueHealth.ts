// src/lib/social/queueHealth.ts
// A slot that passed with a post sitting right there, unpublished.
//
// 🔴 THE GAP THIS CLOSES, found 19 Oct by reading the queue. `social-health`
// exists for one failure, stated in its own header: "the queue fills, every
// screen looks healthy, and the first symptom is somebody asking why nothing
// has been posted for three weeks". ⛔ It watches `social_accounts` — tokens
// and connections — and never looks at `social_posts`.
//
// ⚠️ So there are TWO roads to that silence and only one was watched:
//
//   • the channel broke            → social-health sees it
//   • the writing failed           → sendQueueAlert, from social-queue. Its
//                                    words are "there is no post waiting for
//                                    that slot", which is the OPPOSITE case
//   • nobody approved the draft    → NOTHING. The channel is healthy, the
//                                    queue is full, the post is written, and
//                                    the hour passes in silence.
//
// 🔑 It happened the day this was written: Instagram's 11:30Z slot passed with
// a finished post in `needs_review` and nothing said a word.

import { backoffMinutes, BACKOFF_MINUTES } from "./horizon";

/** The shape this needs from a post row. ⚠️ Deliberately minimal, so the
 *  check can be tested without a database. */
export type QueueRow = {
  id: string;
  platform: string;
  subject: string | null;
  status: string;
  scheduled_for: string | null;
  attempts?: number | null;
  last_error?: string | null;
};

export type MissedSlot = {
  id: string;
  platform: string;
  subject: string;
  scheduledFor: string;
  lateMinutes: number;
  /**
   * 🔑 WHICH FAILURE IT IS, because the two need different people.
   *
   * `unreviewed` is the owner's to fix in one click. `stuck` is ours — the
   * post was approved and the publisher still has not sent it, which means
   * something is wrong at our end or the platform's.
   */
  kind: "unreviewed" | "stuck";
  why: string;
};

/**
 * ⚠️ HOW LATE IS LATE. The publisher runs every minute, so a post a few
 * minutes past its slot is in flight, not missed. Fifteen minutes is long
 * enough that a slow run, a retry or a clock skew never raises an alarm, and
 * short enough to be reported the same morning.
 */
export const GRACE_MINUTES = 15;

/**
 * Every post whose hour has gone by without it being published.
 *
 * ⛔ PURE, AND IT TAKES `now`. A check on "is it late" that reads the clock
 * itself can only be tested at the moment it happens to be right.
 */
export function missedSlots(rows: QueueRow[], now: Date, graceMinutes = GRACE_MINUTES): MissedSlot[] {
  const cutoff = now.getTime() - graceMinutes * 60_000;
  const out: MissedSlot[] = [];

  for (const r of rows) {
    /**
     * ⛔ A post with no `scheduled_for` is NOT late. Null means "as soon as it
     * is approved" ⇒ the publisher's own query, so it has no hour to miss.
     * Treating null as "overdue since 1970" would report every draft ever.
     */
    if (!r.scheduled_for) continue;
    if (r.status !== "needs_review" && r.status !== "approved") continue;

    const at = new Date(r.scheduled_for).getTime();
    // ⚠️ An unparseable date is not a missed slot; it is a different bug, and
    // reporting it here would bury the one this is for.
    if (!Number.isFinite(at)) continue;
    if (at > cutoff) continue;

    const lateMinutes = Math.round((now.getTime() - at) / 60_000);
    const subject = r.subject?.trim() || "(no subject)";

    out.push(
      r.status === "needs_review"
        ? {
            id: r.id,
            platform: r.platform,
            subject,
            scheduledFor: r.scheduled_for,
            lateMinutes,
            kind: "unreviewed",
            why: "It was written and is waiting for you. Nothing is broken — approving it sends it within the minute.",
          }
        : {
            id: r.id,
            platform: r.platform,
            subject,
            scheduledFor: r.scheduled_for,
            lateMinutes,
            kind: "stuck",
            // 🔑 `attempts` is the tell: 0 means the publisher never picked it
            // up at all, which is a different problem from one that keeps
            // failing ⇒ the attempts/MAX_ATTEMPTS guard in social-publish.
            why:
              (r.attempts ?? 0) === 0
                ? "It is approved and the publisher has not attempted it even once — look at whether that cron is firing."
                : `Approved, attempted ${r.attempts} time${r.attempts === 1 ? "" : "s"} and still not out.` +
                  (r.last_error ? ` Last error: ${r.last_error}` : ""),
          },
    );
  }

  // ⚠️ Oldest first: the one that has been waiting longest is the one most
  // likely to be forgotten.
  return out.sort((a, b) => b.lateMinutes - a.lateMinutes);
}

/**
 * 🔑 ONE LINE SAYING WHOSE PROBLEM IT IS, for the subject of the mail.
 *
 * ⛔ Not a count. "2 posts missed their slot" says nothing about whether to
 * open it now or after lunch; "waiting for you" and "not going out" do.
 */
export function missedSummary(missed: MissedSlot[]): string {
  if (missed.length === 0) return "";
  const unreviewed = missed.filter((m) => m.kind === "unreviewed").length;
  const stuck = missed.length - unreviewed;
  if (stuck === 0) {
    return unreviewed === 1
      ? "A post missed its slot — it is waiting for your approval"
      : `${unreviewed} posts missed their slots — they are waiting for your approval`;
  }
  if (unreviewed === 0) {
    return stuck === 1
      ? "An approved post missed its slot and is not going out"
      : `${stuck} approved posts missed their slots and are not going out`;
  }
  return `${missed.length} posts missed their slots — ${unreviewed} awaiting approval, ${stuck} stuck`;
}

/**
 * 🔴 THE OTHER HALF OF THE SAME SILENCE — added 20 Oct 2026.
 *
 * ⛔ `missedSlots` ONLY LOOKS BACKWARDS. Its own guard is `if (at > cutoff)
 * continue`, so a post is reported *after* its hour has gone. Riding the
 * 03:30Z cron, that means the mail describes a slot that is already lost and
 * cannot be recovered — the day is gone, then announced.
 *
 * 🔑 Measured on 20 Oct: three posts for 30 Oct and one for 31 Oct sat in
 * `needs_review`, every schedule healthy, `auto_publish` false on all three.
 * Nothing would have said a word until 03:30 on the 31st, about the 30th.
 *
 * ⚠️ WHY A LOOK-AHEAD IS THE WHOLE FIX AND AUTO-PUBLISH IS NOT. The gate is
 * deliberate — its own note reads "this schedule does not publish without
 * being read" — and reading is what caught the Bengali card that drew
 * অভিমান as অভমিান and the storyboard whose first frame was blank. Both
 * passed every test. ⇒ keep the gate, remove the silence.
 *
 * ⛔ IT CANNOT OVERLAP `missedSlots`, by construction: that one takes
 * `at <= now − grace` and this one takes `at > now − grace`. Every row with
 * an hour falls to exactly one of them, and the boundary is pinned by test.
 */
export const LOOKAHEAD_HOURS = 24;

export type UpcomingUnapproved = {
  id: string;
  platform: string;
  subject: string;
  scheduledFor: string;
  minutesAway: number;
  why: string;
};

/**
 * Every post that will miss its slot unless somebody approves it first.
 *
 * ⛔ PURE, AND IT TAKES `now` — same reason as `missedSlots`. A look-ahead
 * that reads the clock itself can only be tested at the moment it happens
 * to be right.
 */
export function unapprovedSoon(
  rows: QueueRow[],
  now: Date,
  lookaheadHours = LOOKAHEAD_HOURS,
  graceMinutes = GRACE_MINUTES,
): UpcomingUnapproved[] {
  const floor = now.getTime() - graceMinutes * 60_000;
  const ceiling = now.getTime() + lookaheadHours * 3_600_000;
  const out: UpcomingUnapproved[] = [];

  for (const r of rows) {
    /**
     * ⛔ `approved` IS NOT WAITING FOR ANYBODY. Including it would mail the
     * owner every single morning about the posts that are working correctly,
     * which is the fastest way to make this alert ignored
     * ⇒ the false QR warning that cried wolf on every post.
     */
    if (r.status !== "needs_review") continue;
    // ⚠️ Null means "as soon as it is approved" — it has no hour to miss.
    if (!r.scheduled_for) continue;

    const at = new Date(r.scheduled_for).getTime();
    if (!Number.isFinite(at)) continue;
    if (at <= floor || at > ceiling) continue;

    out.push({
      id: r.id,
      platform: r.platform,
      subject: r.subject?.trim() || "(no subject)",
      scheduledFor: r.scheduled_for,
      minutesAway: Math.round((at - now.getTime()) / 60_000),
      why: "Written and gated. It keeps its slot and goes out within a minute of being approved.",
    });
  }

  // ⚠️ SOONEST FIRST — the opposite order to `missedSlots`, on purpose. There,
  // the one waiting longest is the one most likely forgotten; here, the one
  // about to happen is the only one you can still save.
  return out.sort((a, b) => a.minutesAway - b.minutesAway);
}

/**
 * 🔑 ONE LINE THAT SAYS HOW LONG THERE IS, for the subject of the mail.
 *
 * ⛔ Not "2 posts need review" — that reads like a backlog. The hour is the
 * whole point: it is the difference between acting and reading a post-mortem.
 */
export function unapprovedSoonSummary(soon: UpcomingUnapproved[]): string {
  if (soon.length === 0) return "";
  const next = soon[0].minutesAway;
  const when = next < 60 ? `${Math.max(next, 0)} minutes` : `${Math.round(next / 60)} hours`;
  return soon.length === 1
    ? `A post goes out in ${when} and is waiting for your approval`
    : `${soon.length} posts are waiting for your approval — the first in ${when}`;
}

/**
 * 🔴 IS A REFUSED SLOT ACTUALLY AT RISK? — added 21 Nov 2026 (#131).
 *
 * ⛔ THE ALARM THAT CRIED WOLF. The queue writes up to TEN DAYS ahead and
 * retries a refused slot on a rising back-off (5, 15, 60, 180, 360 min). But
 * `sendQueueAlert` fired on the FIRST refusal and said "the slot will simply
 * pass". Measured: "Nothing written for instagram" (16 Nov) and "Nothing
 * written for x" (19 Nov 00:01) — both slots were retried, written and
 * PUBLISHED on time (IG 19 Nov 14:30Z, X 20 Nov 13:30Z). Both refusals were the
 * repetition check doing its job (3 titles too close to ones already used).
 * And the mail never said WHICH slot, so nobody could check.
 *
 * 🔑 THE RULE. Mail only when somebody can still act and needs to:
 *   • the slot is within ALERT_WITHIN_HOURS — inside that, the owner also
 *     needs time to read and approve the post, so a refusal now matters; or
 *   • the slot has failed so often it reached the back-off cap — a real
 *     problem with the brief, said ONCE (at exactly the cap), not every 6 h.
 * Further out, a refusal is routine: it is retried and recorded on
 * /admin/social. ⛔ Never silent near the slot ⇒ the original 19 Oct gap stays closed.
 */
export const ALERT_WITHIN_HOURS = 24;

export type RefusalVerdict = {
  alert: boolean;
  /** When the queue will try this slot again (ISO). */
  nextTry: string;
  /** True when no retry can happen before the slot — it really will pass. */
  willPass: boolean;
};

/** ⛔ PURE, takes `now` — same reason as `missedSlots`. */
export function refusalVerdict(
  scheduledFor: string,
  attemptsAfterThis: number,
  now: Date,
  withinHours = ALERT_WITHIN_HOURS,
): RefusalVerdict {
  const at = new Date(scheduledFor).getTime();
  const next = now.getTime() + backoffMinutes(attemptsAfterThis) * 60_000;
  const willPass = !Number.isFinite(at) || next >= at;
  const near = !Number.isFinite(at) || at - now.getTime() <= withinHours * 3_600_000;
  const atCap = attemptsAfterThis === BACKOFF_MINUTES.length;
  return { alert: willPass || near || atCap, nextTry: new Date(next).toISOString(), willPass };
}

/** "Fri 20 Nov, 19:00 IST" — the slot named the way the schedule names it. */
export function istLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("weekday")} ${g("day")} ${g("month")}, ${g("hour")}:${g("minute")} IST`;
}
