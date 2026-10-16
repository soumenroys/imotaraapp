// src/lib/account/retentionNotice.ts
//
// The one email that warns a dormant account before its data is erased.
//
// 🔴 THIS IS A TRANSACTIONAL NOTICE, NOT A BROADCAST. It carries no
// List-Unsubscribe header and it does not consult the broadcast suppression
// list, deliberately: someone who unsubscribed from Imotara's occasional mail
// has not asked to be deleted without warning, and "unsubscribe from being
// told your data is about to go" is not a choice anyone should be offered.
// ⛔ Do not route this through the broadcast queue to "reuse the plumbing".
//
// ⚠️ TONE IS LOAD-BEARING HERE. This reaches someone who stopped opening a
// mental-health app two years ago, and the reason may not be a happy one. It
// must read as housekeeping, not as a threat or a guilt trip, and it must not
// imply anything about why they left. No urgency language, no "we miss you",
// no streak-breaking. State the fact, give the one action, stop.

import "server-only";

import { sendOne, envIdentities, type SendOutcome } from "@/lib/broadcast/resendClient";
import { RETENTION_INACTIVE_MONTHS, RETENTION_GRACE_DAYS } from "./retentionPolicy";

const SITE = "https://www.imotara.com";

function from(): string {
    const [first] = envIdentities();
    if (!first) return "";
    return first.name ? `"${first.name}" <${first.email}>` : first.email;
}

/** True when a notice could actually be sent. ⛔ Enforcement must check this. */
export function isRetentionNoticeConfigured(): boolean {
    return from().length > 0;
}

export function retentionNoticeSubject(): string {
    return "Your Imotara data is scheduled to be removed";
}

export function retentionNoticeText(): string {
    return [
        "Hello,",
        "",
        `This is an automated note about an Imotara account that has not been used for ${RETENTION_INACTIVE_MONTHS} months.`,
        "",
        `We do not keep data we are not using, so this account and everything synced to it is scheduled to be permanently deleted in ${RETENTION_GRACE_DAYS} days.`,
        "",
        "If you would like to keep it, simply sign in — that is all it takes, and nothing will be removed.",
        "",
        `  ${SITE}`,
        "",
        "If you would rather it went now, you can delete it yourself in Settings.",
        "",
        "If you no longer use this address and do nothing, the data will be removed on schedule. You do not need to reply.",
        "",
        "— Imotara",
    ].join("\n");
}

function html(): string {
    // Plain and unstyled on purpose — matches the house style for Imotara mail:
    // no images, no buttons, at most one link.
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1f2937">
<p>Hello,</p>
<p>This is an automated note about an Imotara account that has not been used for ${RETENTION_INACTIVE_MONTHS} months.</p>
<p>We do not keep data we are not using, so this account and everything synced to it is scheduled to be permanently deleted in ${RETENTION_GRACE_DAYS} days.</p>
<p>If you would like to keep it, simply sign in — that is all it takes, and nothing will be removed.</p>
<p><a href="${SITE}" style="color:#4f46e5">${SITE}</a></p>
<p>If you would rather it went now, you can delete it yourself in Settings.</p>
<p>If you no longer use this address and do nothing, the data will be removed on schedule. You do not need to reply.</p>
<p>— Imotara</p>
</div>`;
}

/**
 * Send one warning.
 *
 * 🔴 THE CALLER MUST ONLY RECORD THE WARNING WHEN THIS RETURNS ok.
 * Erasure is gated on a warning row existing, so writing that row after a
 * failed send would schedule a silent deletion — notice promised at /privacy
 * and never given. Re-warning someone because the row was not written is a
 * nuisance; deleting a mental-health history with no warning is not.
 */
export async function sendRetentionNotice(to: string): Promise<SendOutcome> {
    const sender = from();
    if (!sender) {
        return {
            ok: false,
            email: to,
            kind: "fatal",
            code: "no_sender_identity",
            message: "BROADCAST_FROM_EMAIL is not set, so no retention notice can be sent",
        };
    }
    return sendOne({
        from: sender,
        to,
        subject: retentionNoticeSubject(),
        text: retentionNoticeText(),
        html: html(),
        // ⛔ No List-Unsubscribe. See the header.
    });
}
