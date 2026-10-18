// src/lib/imotara/businessIdentity.ts
//
// 🏢 WHO WE LEGALLY ARE. One source for the merchant identity that has to appear
// on public, payment-facing pages.
//
// 🔴 WHY THIS EXISTS. Razorpay (and every payment aggregator) verifies that the
// website publishes a real legal name, a real postal address, a working phone
// number and an email before enabling International Payments. Those strings then
// have to match the KYC record EXACTLY — a mismatch is a rejection, not a
// warning. Keeping them in one module means /contact, /refunds and any invoice
// cannot drift apart from each other or from the KYC filing.
//
// 🔑 `LEGAL_NAME` is the canonical spelling: no full stop, all caps, one space.
// The partnership deed writes "M/S. IMOTARA" WITH a full stop, but the firm PAN
// and the Federal Bank account both say "M/S IMOTARA" without one — PAN and bank
// agree, and those two are what penny-drop and KYC match on. Do not "fix" it.
//
// ⚠️ KNOWN DUPLICATE, not yet folded in: `invoiceUtils.ts` renders the same
// address inline in its invoice HTML footer. Left alone deliberately — invoice
// rendering is a working payment surface and this pass had no reason to touch
// it. Fold it in the next time that file is edited for another reason.

export const BUSINESS = {
    /** Trading name, as users know us. */
    brand: "Imotara",

    /** Registered legal name — must match the firm PAN and bank account exactly. */
    legalName: "M/S IMOTARA",

    /** Constitution, as declared on the PAN (4th character "F" = firm). */
    entityType: "Registered Partnership Firm",

    address: {
        line1:      "6/B, Kalipada Mukherjee Road",
        locality:   "Barisha",
        city:       "Kolkata",
        state:      "West Bengal",
        postalCode: "700008",
        country:    "India",
    },

    // 🔑 ONE public address, deliberately. `support@` and `hello@` were both in
    // published copy — 13 and 11 uses — and neither is known to be monitored.
    // `info@` is: Google, BillDesk and Razorpay all write to it and we read it.
    // Owner, 2026-09-18: "info@ everywhere". The sweep covered /terms, settings,
    // the Connect wallet pages and every wallet/Connect mailer.
    /** The one public mailbox. Support, billing, privacy, legal — all of it. */
    email: "info@imotara.com",

    /** E.164 for tel: links. */
    phone: "+917003969936",
    phoneDisplay: "+91 70039 69936",

    /** Answering hours, confirmed by the owner 2026-09-18. */
    phoneHours: "Monday–Friday, 11:00–18:00 IST",

    /** What we commit to publicly for a first reply to support mail. */
    supportResponseTarget: "2 business days",

    website: "https://www.imotara.com",

    /**
     * 🔑 THE WIKIDATA ITEM — Q141751345, created 2026-10-17.
     *
     * Why it is here and not in `social`: it is not a channel anyone posts to.
     * It is the entity record assistants and search engines read to answer
     * "what IS Imotara" — which is the one question `sameAs` on a profile
     * cannot answer.
     *
     * ⚠️ The item's `instance of` is **mobile app / web application**, so it
     * belongs in the `sameAs` of the MobileApplication and SoftwareApplication
     * nodes — NOT the Organization node. The organisation is the publisher;
     * saying the publisher *is* the app would be a false identity claim, and
     * a wrong `sameAs` is worse than none ⇒ the note on `social` below.
     */
    wikidata: "https://www.wikidata.org/wiki/Q141751345",

    /**
     * 🔑 THE OFFICIAL SOCIAL CHANNELS — owner-supplied, 2026-10-16, and the
     * single source of truth for them.
     *
     * 🔴 WHY THIS EXISTS. The X handle was hardcoded as `imotara4x` in FOUR
     * places — the twitter card `creator` and `site`, the Organization schema's
     * `sameAs`, and the blog's tweet-intent `via=`. It is wrong: the real
     * account is `imotaraofficial`. A wrong handle in `sameAs` tells search
     * engines the wrong profile belongs to this entity, which is worse than
     * naming none at all, and a wrong `via=` credits a stranger every time
     * someone shares a post.
     *
     * ⛔ Owner's standing instruction: the social-channels table they maintain
     * is the right information. Do not take a handle from code, from a form's
     * autofill, or from memory — take it from here, and correct here first.
     *
     * 🔴 THIS COMMENT SAID "Facebook is deliberately absent", three lines
     * above a `facebook` key, while `sameAs`, `llms.txt` and the site footer
     * all carried the Page. It was true when written — the sheet held the
     * bare `facebook.com/` root — and it outlived that by a day.
     *
     * ⚠️ 18 Oct: the Page is `facebook.com/imotaraofficial` (id
     * 1222416224285686, confirmed by following the id, which redirects to the
     * vanity URL) and it now publishes daily by itself.
     *
     * ⛔ A sentence that states the world goes stale and nothing checks it
     * ⇒ trap_a_sentence_that_states_the_world_goes_stale. The rule above —
     * take the handle from the owner's table and correct HERE first — is the
     * one that still holds.
     */
    social: {
        x: "https://x.com/imotaraofficial",
        xHandle: "@imotaraofficial",
        instagram: "https://www.instagram.com/imotaraofficial/",
        youtube: "https://www.youtube.com/@Imotara",
        /**
         * 🔴 THE COMPANY PAGE, NOT THE PERSONAL PROFILE. Corrected 2026-10-17.
         *
         * This read `/in/imotara` — a LinkedIn MEMBER profile, display name
         * "Imotara App", 423 connections. Everything downstream inherited it:
         * the Organization's `sameAs`, `llms.txt`, the site footer and the
         * mobile app's links row.
         *
         * ⛔ WHY THAT WAS WRONG, AND NOT MERELY UNTIDY. `sameAs` on an
         * Organization asserts "these profiles ARE this organisation". A `/in/`
         * URL is a *person*. It is the same false identity claim the Wikidata
         * item is deliberately kept out of the Organization node to avoid.
         *
         * Two practical costs on top of the wrong claim: directories reject
         * `/in/` URLs for company listings, and the company page — the one that
         * actually carries the corrected tagline, industry and overview —
         * received none of the link equity.
         *
         * ⚠️ The personal profile has 17× the followers. It is still a real
         * asset and nothing here deletes it; it simply is not the organisation.
         */
        linkedin: "https://www.linkedin.com/company/imotara",
        // ⚠️ Claimed the username on 2026-10-16. Before that the Page had none
        // and lived at profile.php?id=61591783672102 — a URL that cannot go in
        // sameAs and that nobody can type. `imotara` was already taken, almost
        // certainly by one of the duplicate Pages; `imotaraofficial` matches
        // the X and Instagram handles, which is the better outcome anyway.
        facebook: "https://www.facebook.com/imotaraofficial",
    },
} as const;

/** "6/B, Kalipada Mukherjee Road, Barisha, Kolkata, West Bengal – 700008, India" */
export function formattedAddress(): string {
    const a = BUSINESS.address;
    return `${a.line1}, ${a.locality}, ${a.city}, ${a.state} – ${a.postalCode}, ${a.country}`;
}
