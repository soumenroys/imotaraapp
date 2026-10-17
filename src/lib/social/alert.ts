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
