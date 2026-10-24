// src/lib/cron/jobDescriptions.ts
// What each scheduled job actually does, in one line.
//
// 🔑 THE OWNER, 19 Oct 2026: "in the Scheduled jobs cron job list, add a small
// description that which cron is doing what."
//
// ⛔ The health panel listed twelve paths and a state chip. `connect-orphans`
// and `connect-recharge-expiry` tell a reader nothing, so a job showing LATE
// could not be judged — is that an outage or a tidy-up? ⇒ A list of names is
// not a list of jobs.
//
// ⚠️ EVERY LINE HERE WAS READ OFF THE ROUTE'S OWN HEADER, not inferred from
// its path ⇒ trap_a_model_invents_specifics_it_cannot_have. A path is a guess
// about behaviour; the file is the behaviour.
//
// 🔴 AND A DESCRIPTION GOES STALE LIKE ANY OTHER SENTENCE. `social-health`
// here says it watches the QUEUE as well as the channels, which became true
// on 19 Oct ⇒ trap_a_sentence_that_states_the_world_goes_stale. When a job
// changes, this line is part of the change.

export const CRON_DESCRIPTIONS: Record<string, string> = {
  "/api/push/cron":
    "Sends a gentle re-engagement nudge to people who have been inactive — and only to them.",
  "/api/cron/exchange-rates":
    "Fetches USD-base exchange rates into app_settings, so prices shown abroad are not months old.",
  "/api/cron/connect-orphans":
    "Rescues Connect sessions stuck somewhere they cannot leave on their own.",
  "/api/cron/connect-settle-earnings":
    "Retries every unsettled row in the Connect earnings ledger, so a peer is paid even after a failure.",
  "/api/cron/connect-scheduled":
    "Cancels pending scheduled Connect sessions whose time passed more than two hours ago.",
  "/api/cron/connect-recharge-expiry":
    "Marks abandoned Connect recharges as failed, so a half-finished payment does not sit pending forever.",
  "/api/cron/broadcast-queue":
    "Drains queued broadcast emails through Resend, respecting the sending warm-up ceiling.",
  "/api/cron/data-retention":
    "GDPR storage limitation: warns dormant accounts, then erases them.",
  "/api/cron/social-queue":
    "Writes the next ten days of social drafts, two per run, so there is always a queue to review.",
  "/api/cron/social-publish":
    "Publishes approved social posts whose hour has come. ⛔ Approved only — it never publishes a draft.",
  "/api/cron/social-stats":
    "Captures each channel's followers and each recent post's figures, once a day after the posting hour.",
  "/api/cron/social-health":
    "Checks every social channel's token, and the queue: alerts if a token is dying or a slot passed unpublished.",
  "/api/cron/voice-dispatch":
    "Places queued voice calls from the Call Directory sheet as lines free up, and catches results that never arrived. Calls due contacts by itself only when the sheet's Settings switch it on.",
  "/api/cron/auto-broadcast":
    "Hourly. Writes the monthly newsletter three days before its send day (one theme a month) and, on the day, sends the drafts that were approved. Does nothing while switched off.",
  "/api/cron/social-trends":
    "Every morning, gathers this week's moments for social posts — awareness days, and trending searches that pass a word filter and a judgement check for a wellbeing brand.",
  "/api/cron/outreach-mail":
    "Sends the outreach emails due from the Call Directory sheet (introduction, day-7 follow-up, day-21 note, and details a call asked for) using approved drafts, writing any missing draft for review. Does nothing while outreach email is off.",
};

/**
 * One line about a job, or null.
 *
 * ⛔ NULL RATHER THAN A GUESS. "Runs /api/cron/foo" dressed as a description
 * is worse than an empty cell: it reads as information and carries none. A
 * missing line should look missing, and the test below makes sure it cannot
 * stay missing for long.
 */
export function describeJob(path: string): string | null {
  return CRON_DESCRIPTIONS[path] ?? null;
}
