// src/lib/social/alert.ts
// Telling somebody that a channel has stopped working.
//
// ⚠️ TO THE SOCIAL MAILBOX, not to a person's inbox. `social@imotara.com` is
// the address on every social profile, so it is the one somebody is already
// reading when they are thinking about social ⇒ feedback_social_media_uses_the_social_mailbox.

import { sendOne, isResendConfigured, envIdentities, sendingDomain } from "@/lib/broadcast/resendClient";

const TO = "social@imotara.com";

export async function sendChannelAlert(
  broken: { platform: string; displayName: string; why: string }[],
): Promise<boolean> {
  if (broken.length === 0) return false;

  if (!isResendConfigured()) {
    // ⛔ Logged loudly rather than swallowed. A failed alert about a failed
    // channel is two silent failures stacked, which is how three weeks of
    // nothing being posted goes unnoticed.
    console.error("[social-health] a channel needs re-validating and email is not configured:", broken);
    return false;
  }

  const lines = broken.map((b) => `• ${b.displayName} (${b.platform}) — ${b.why}`).join("\n");

  /**
   * ⚠️ PLAIN TEXT, ONE LINK, NO BUTTON. The house style the broadcast
   * templates already enforce, and it matters more here: this is an
   * operational alert, and an alert that looks like marketing gets filtered
   * like marketing ⇒ broadcast_templates_house_style.
   */
  const text = [
    "A channel needs re-validating.",
    "",
    lines,
    "",
    "Nothing has been published in the meantime — posts are still being written and queued, and",
    "they will go out once the channel works again. Nothing is lost.",
    "",
    "To fix it: generate a new token on the platform and paste it into",
    "https://www.imotara.com/admin/social/channels",
    "",
    "⛔ The token is the only thing that needs replacing. Your password is not stored here and is",
    "not involved — changing it does not break posting.",
  ].join("\n");

  // ⚠️ From a configured identity on our own sending domain. A From address
  // the domain does not authorise is how an operational alert lands in spam
  // and the channel stays broken ⇒ mailbox_mail_lands_in_spam_no_dkim.
  const identity = envIdentities()[0];
  const from = identity
    ? `${identity.name} <${identity.email}>`
    : `Imotara <social@${sendingDomain()}>`;

  const subject =
    broken.length === 1
      ? `Re-validate ${broken[0].displayName} — posting is paused for it`
      : `${broken.length} channels need re-validating`;

  const outcome = await sendOne({
    from,
    to: TO,
    subject,
    // ⚠️ The HTML is the same words, not a designed mail. An operational alert
    // that looks like marketing is filtered like marketing.
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
    text,
  });

  if (!outcome.ok) {
    console.error("[social-health] the alert itself failed to send:", outcome.code, outcome.message, broken);
    return false;
  }
  return true;
}

/**
 * Telling somebody that a schedule was due and wrote nothing.
 *
 * 🔴 THE GAP THIS CLOSES, found at 00:00 on 19 Oct. The health cron alerts
 * when a TOKEN stops working. Nothing alerted when GENERATION refused — and
 * generation refuses for several honest reasons: three drafts rejected by the
 * gate, a channel that cannot take a post without a picture and no card could
 * be made, a model outage.
 *
 * ⛔ So the failure mode was: the queue refuses at 15:00, nothing publishes at
 * 17:00, and the only symptom is an empty feed. That is precisely what this
 * feature was built to prevent, and the "refuse loudly" built into the
 * pipeline only ever reached an HTTP response nobody reads
 * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 *
 * ⚠️ A REFUSAL IS AN EVENT, NOT A STATE, so unlike the health alert this does
 * not wait for a change — each due slot that produced nothing is worth one
 * message. At one or two slots a day that is rare by construction.
 */
export async function sendQueueAlert(
  refused: { schedule: string; platform: string; language?: string; why: string }[],
): Promise<boolean> {
  if (refused.length === 0) return false;

  if (!isResendConfigured()) {
    console.error("[social-queue] a schedule was due and wrote nothing, and email is not configured:", refused);
    return false;
  }

  const lines = refused
    .map((r) => `• ${r.platform}${r.language ? ` (${r.language})` : ""} — “${r.schedule}”\n  ${r.why}`)
    .join("\n\n");

  const text = [
    "A schedule was due and wrote nothing.",
    "",
    lines,
    "",
    "⚠️ Nothing is broken at the platform end — the channel and its token are fine. What failed is",
    "the WRITING, so there is no post waiting for that slot and the slot will simply pass.",
    "",
    "The attempts and the reason each one was refused are on",
    "https://www.imotara.com/admin/social",
    "",
    "⛔ If the same reason repeats for several days it is a signal about the brief, not bad luck.",
  ].join("\n");

  const identity = envIdentities()[0];
  const from = identity
    ? `${identity.name} <${identity.email}>`
    : `Imotara <social@${sendingDomain()}>`;

  const subject =
    refused.length === 1
      ? `Nothing written for ${refused[0].platform} — the slot will pass`
      : `${refused.length} schedules were due and wrote nothing`;

  const outcome = await sendOne({
    from,
    to: TO,
    subject,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
    text,
  });

  if (!outcome.ok) {
    console.error("[social-queue] the alert itself failed to send:", outcome.code, outcome.message, refused);
    return false;
  }
  return true;
}

/**
 * 🔴 A SLOT PASSED WITH A FINISHED POST SITTING RIGHT THERE.
 *
 * ⛔ NOT THE SAME AS `sendQueueAlert`, whose words are "there is no post
 * waiting for that slot". That one is about the WRITING failing. This one is
 * the opposite shape: the post exists, the channel is healthy, the token is
 * fine — and the hour went by because nobody pressed approve.
 *
 * 🔑 WHY IT REPEATS UNTIL FIXED, unlike the channel alert. A broken token is
 * a STATE that somebody is already working on, so saying it daily is noise.
 * A post that missed its slot yesterday and is still sitting there has not
 * been seen — and at one or two slots a day, with a miss being rare, the
 * repetition costs almost nothing and stops exactly when it is acted on.
 *
 * ⚠️ TIMED TO BE ACTIONABLE. This rides the health cron at 03:30Z, which is
 * 09:00 in Kolkata — before the 18:30, 19:00 and 19:30 IST slots. So it
 * reports yesterday's miss while there is still a whole day to catch today's.
 * ⛔ The slot times here were 17:00/17:30 until 19 Oct. A comment that states
 * the world goes stale ⇒ it is the times that moved, not this reasoning.
 */
export async function sendMissedSlotAlert(
  missed: { platform: string; subject: string; lateMinutes: number; kind: "unreviewed" | "stuck"; why: string }[],
  summary: string,
): Promise<boolean> {
  if (missed.length === 0) return false;

  if (!isResendConfigured()) {
    console.error("[social-health] a slot passed unpublished and email is not configured:", missed);
    return false;
  }

  const hours = (m: number) => (m < 120 ? `${m} minutes late` : `${Math.round(m / 60)} hours late`);

  const lines = missed
    .map((m) => `• ${m.platform} — “${m.subject}”\n  ${hours(m.lateMinutes)}. ${m.why}`)
    .join("\n\n");

  const waiting = missed.filter((m) => m.kind === "unreviewed").length;

  const text = [
    summary + ".",
    "",
    lines,
    "",
    // ⛔ Said plainly, because the natural fear on reading this is worse than
    // the truth: nothing has been lost and nothing is broken at the platform.
    "⚠️ Nothing is lost. A post keeps its place and goes out within a minute of being approved —",
    "late, but out. What it cannot do is go out by itself.",
    ...(waiting > 0
      ? [
          "",
          "Approve them here:",
          "https://www.imotara.com/admin/social",
        ]
      : [
          "",
          "⛔ These are already approved, so this is not waiting on you — the publisher is not",
          "sending them. The attempts and the last error are on",
          "https://www.imotara.com/admin/social",
        ]),
  ].join("\n");

  const identity = envIdentities()[0];
  const from = identity
    ? `${identity.name} <${identity.email}>`
    : `Imotara <social@${sendingDomain()}>`;

  const outcome = await sendOne({
    from,
    to: TO,
    subject: summary,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
    text,
  });

  if (!outcome.ok) {
    console.error("[social-health] the missed-slot alert itself failed to send:", outcome.code, outcome.message, missed);
    return false;
  }
  return true;
}

/**
 * 🔴 A POST PEOPLE ARE UPSET BY, RAISED TO A PERSON — TODAY, NOT IN A REPORT.
 *
 * This is the one alert in this feature where being slow to notice costs more
 * than a quiet feed. Everything else here fails towards silence: a slot
 * passes, a draft is refused, a chart is thin. This one means a post that is
 * live under the brand's name has landed badly on a mental-health audience.
 *
 * ⛔ IT CARRIES NO SUGGESTED FIX, deliberately. The machinery's correct action
 * is to stop using the post as evidence and to say so; deciding what to do
 * about it means reading the comments, which is a person's job. A confident
 * recommendation here would be the system's least-informed opinion delivered
 * with the most authority.
 */
export async function sendUpsetAlert(
  flagged: { postId?: string; platform: string; pool: string | null; why: string }[],
): Promise<boolean> {
  if (flagged.length === 0) return false;

  if (!isResendConfigured()) {
    console.error("[social-stats] a live post drew an upset reaction and email is not configured:", flagged);
    return false;
  }

  const lines = flagged
    .map(
      (f) =>
        `• ${f.platform}${f.pool ? ` — angle “${f.pool}”` : ""}\n` +
        `  ${f.why}` +
        (f.postId ? `\n  https://www.imotara.com/admin/social?post=${encodeURIComponent(f.postId)}` : ""),
    )
    .join("\n\n");

  const text = [
    flagged.length === 1
      ? "A live post has drawn an angry reaction from a noticeable share of the people who saw it."
      : `${flagged.length} live posts have drawn angry reactions from a noticeable share of the people who saw them.`,
    "",
    lines,
    "",
    "⚠️ WHAT HAS ALREADY HAPPENED AUTOMATICALLY: the post has been taken out of the learning",
    "signal, so the angle behind it will NOT be promoted for performing well. Anger travels",
    "further than agreement, and a loop that counted it would ask for more of whatever caused it.",
    "",
    "⛔ WHAT HAS NOT HAPPENED, and should not: nothing has been edited, deleted or rewritten, and",
    "no rule has been changed. Deciding what to do means reading the comments.",
    "",
    "▶️ Read the post and its replies before changing anything. If the post is wrong, it can be",
    "removed on the platform; if it is merely uncomfortable, it may be doing its job.",
  ].join("\n");

  const identity = envIdentities()[0];
  const from = identity ? `${identity.name} <${identity.email}>` : `Imotara <social@${sendingDomain()}>`;

  const outcome = await sendOne({
    from,
    to: TO,
    subject:
      flagged.length === 1
        ? `A live ${flagged[0].platform} post is drawing anger — please read it`
        : `${flagged.length} live posts are drawing anger — please read them`,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
    text,
  });
  return outcome.ok;
}

/**
 * 🔵 A POST IS DUE AND NOBODY HAS APPROVED IT YET — added 20 Oct 2026.
 *
 * ⛔ THE SIBLING OF `sendMissedSlotAlert`, AND DELIBERATELY NOT THE SAME MAIL.
 * That one is a post-mortem: the hour is gone. This one is the only message in
 * the system that arrives while the slot can still be saved.
 *
 * 🔑 THEY CANNOT BOTH FIRE FOR ONE ROW — `missedSlots` takes `at <= now − grace`
 * and `unapprovedSoon` takes `at > now − grace`. Two mails on one morning means
 * two genuinely different problems, which is worth two mails.
 *
 * ⚠️ TIMED TO BE ACTIONABLE. It rides the health cron at 03:30Z = 09:00 in
 * Kolkata, and the slots are 18:30, 19:00 and 19:30 IST ⇒ roughly nine and a
 * half hours of notice on the earliest one.
 */
export async function sendUnapprovedSoonAlert(
  soon: { platform: string; subject: string; minutesAway: number; why: string }[],
  summary: string,
): Promise<boolean> {
  if (soon.length === 0) return false;

  if (!isResendConfigured()) {
    console.error("[social-health] a post is due unapproved and email is not configured:", soon);
    return false;
  }

  const away = (m: number) =>
    m < 0 ? "due now" : m < 120 ? `in ${m} minutes` : `in ${Math.round(m / 60)} hours`;

  const lines = soon
    .map((s) => `• ${s.platform} — “${s.subject}”\n  Goes out ${away(s.minutesAway)}. ${s.why}`)
    .join("\n\n");

  const text = [
    summary + ".",
    "",
    lines,
    "",
    // 🔑 The one sentence that makes this different from the missed-slot mail,
    // and the reason it is worth sending at all.
    "⚠️ Nothing has gone wrong yet. These schedules do not publish without being read, so",
    "unapproved means the slot passes in silence. There is still time.",
    "",
    "Approve them here:",
    "https://www.imotara.com/admin/social",
  ].join("\n");

  const identity = envIdentities()[0];
  const from = identity ? `${identity.name} <${identity.email}>` : `Imotara <social@${sendingDomain()}>`;

  const outcome = await sendOne({
    from,
    to: TO,
    subject: summary,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
    text,
  });

  if (!outcome.ok) {
    console.error("[social-health] the look-ahead alert itself failed to send:", outcome.code, outcome.message, soon);
    return false;
  }
  return true;
}
