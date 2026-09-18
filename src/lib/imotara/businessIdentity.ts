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
} as const;

/** "6/B, Kalipada Mukherjee Road, Barisha, Kolkata, West Bengal – 700008, India" */
export function formattedAddress(): string {
    const a = BUSINESS.address;
    return `${a.line1}, ${a.locality}, ${a.city}, ${a.state} – ${a.postalCode}, ${a.country}`;
}
