// src/lib/broadcast/templates/types.ts
//
// Ready-made message bodies an admin picks from, so a broadcast starts from
// something considered rather than a blank box.
//
// 🔴 THE HOUSE STYLE IS A DELIVERABILITY DECISION, NOT A TASTE ONE.
// Gmail routes mail to Promotions on the signals that make an email look like
// a campaign: hero images, CTA buttons, multi-column layout, many links,
// promotional vocabulary. Every one of those is therefore BANNED here, and the
// ban is enforced by src/__tests__/broadcast/templateHouseStyle.test.ts rather
// than left to whoever writes the next template.
//
// ⚠️ Measured 2026-10-15, which is why this matters now: a 20.6% bounce rate
// and 10.2% hard bounces had already spent much of the domain's reputation.
// With reputation that thin, a message that merely LOOKS like bulk marketing
// risks Spam rather than Promotions.
//
// 🔑 EVERY TEMPLATE ENDS WITH A REAL QUESTION. 233 broadcasts have been
// delivered and not one person has replied. A reply is the single strongest
// signal a mailbox provider has that the sender is wanted, so asking something
// answerable is both the courteous thing and the one lever that compounds.
//
// ⛔ The templates are STARTING POINTS. They land in the composer as ordinary
// markup the admin can edit before sending; nothing here is sent as-is.

/** The five audiences. ⚠️ Four of these are organisations — see the note below. */
export type Audience =
    | "individuals"
    | "ngos"
    | "education"
    | "corporates"
    | "eldercare";

export const AUDIENCE_LABEL: Record<Audience, string> = {
    individuals: "Individual users",
    ngos: "NGOs",
    education: "Educational institutes",
    corporates: "Corporates",
    eldercare: "Old age homes",
};

/**
 * ⚠️ READ BEFORE BULK-SENDING THE FOUR ORGANISATIONAL SETS.
 *
 * Only `individuals` is a newsletter audience. The other four are SALES
 * OUTREACH, and the 2026-10-15 measurement is unambiguous about the
 * difference: individual addresses bounced at 4.8%, organisational generic
 * inboxes at 30.1%. Bulk-sending to `info@` addresses is what put the domain's
 * reputation at risk in the first place.
 *
 * These templates exist for the organisational sets because a considered
 * opening letter is worth having either way — but they should be sent as
 * ONE-TO-ONE mail to a named person, not fanned out to a list.
 */
export const ORGANISATIONAL: ReadonlySet<Audience> = new Set<Audience>([
    "ngos", "education", "corporates", "eldercare",
]);

export type Template = {
    /** Stable id, `audience-slug`. Used by the picker and by the tests. */
    id: string;
    audience: Audience;
    /** What the admin sees in the picker. */
    title: string;
    /** One line on when this one is the right choice. */
    note: string;
    /** The subject line. ⛔ No ALL CAPS, no "free", no exclamation marks. */
    subject: string;
    /** Composer markup. Rendered by lib/broadcast/markup.ts. */
    body: string;
};

/**
 * The one link every template is allowed.
 *
 * ⚠️ Kept as a constant so the house-style test can count links by looking for
 * a single known URL, and so a domain change is one edit rather than fifty.
 */
export const SITE = "https://www.imotara.com";
