// src/lib/imotara/pricingBands.ts
//
// Purchasing-power bands, and the donation amounts that follow from them.
//
// 🔴 WHY THIS EXISTS. Until 2026-10-02 every market effectively paid India's
// price, because Apple and Play were mispriced. Those are now banded (175
// storefronts, verified), but the WEB still charged one flat rupee figure to
// everyone — so a US donor was offered ₹49 (~$0.55) for the same thing an
// Indian donor pays ₹49 for. That is not generosity, it is a pricing bug that
// only ran in one direction.
//
// 🔑 BANDING HERE NEEDS NO CURRENCY CONVERSION, and that is the whole point.
// Razorpay settles **INR only** (confirmed in writing, ticket 21077273), and
// International Cards have been ACTIVE on this account since 2026-09-23. A
// foreign card pays in INR and the customer's own bank converts. So the only
// decision is *how many rupees* to ask a given country for.
// ⛔ Do NOT add multi-currency here. PayPal is the only non-INR route and it is
//    deliberately unlinked.
//
// ⚠️ THE BAND LISTS MUST MATCH THE STORES. These are the same lists used for
// the Play and App Store price schedules. If a country moves band in one place
// it must move in all three, or the same person is quoted differently depending
// on which platform they opened.

export type Band = 1 | 2 | 3;

/** Band 3 — India's price level. India itself is here. */
const BAND_3 = new Set([
    "IN", "PK", "BD", "LK", "ID", "PH", "VN", "NG", "EG",
]);

/** Band 2 — mid purchasing power. */
const BAND_2 = new Set([
    "BR", "MX", "PL", "TR", "ZA", "MY", "TH", "CN",
]);

/**
 * Band for an ISO-3166 alpha-2 country code.
 *
 * ⚠️ Unknown or missing country → **Band 1**, deliberately. The alternative
 * (defaulting to Band 3) would hand everyone the lowest price the moment geo
 * detection fails — including every bot and every request without the header.
 * Band 1 is the honest default: a real low-band visitor is detected by Vercel's
 * edge header, which is present on every production request.
 */
export function bandForCountry(country?: string | null): Band {
    const cc = (country || "").trim().toUpperCase();
    if (!cc) return 1;
    if (BAND_3.has(cc)) return 3;
    if (BAND_2.has(cc)) return 2;
    return 1;
}

/**
 * Donation amounts in **paise**, by band, smallest first.
 *
 * 🔑 THE SHAPE: Band 2 ≈ 2× Band 3, Band 1 ≈ 4× Band 3 — the same ratio the
 * approved credit-pack ladder uses (tokens_100: ₹49 India / $0.99 B3 / $1.99 B2
 * / $3.99 B1). Band 3 is India's existing, unchanged price.
 *
 * ⚠️ These are ROUND RUPEE FIGURES, not a USD target converted at today's rate.
 * Pinning them to a dollar amount would make them drift every time the rupee
 * moves, and nobody would notice. Round numbers stay right.
 */
const DONATION_PAISE: Record<Band, readonly number[]> = {
    3: [4_900, 9_900, 19_900, 49_900, 99_900],          // ₹49 ₹99 ₹199 ₹499 ₹999
    2: [9_900, 19_900, 39_900, 99_900, 199_900],        // ₹99 ₹199 ₹399 ₹999 ₹1,999
    1: [19_900, 39_900, 79_900, 199_900, 399_900],      // ₹199 ₹399 ₹799 ₹1,999 ₹3,999
};

/** The five preset tiers, lowest to highest. Stable ids — the client sends these. */
export const DONATION_TIERS = ["t1", "t2", "t3", "t4", "t5"] as const;
export type DonationTier = (typeof DONATION_TIERS)[number];

/**
 * 🔴 LEGACY IDS. The web sent `inr_49…inr_999` and the mobile app sends
 * `d-49…d-999`, both of which encode India's AMOUNT in the id. Those clients are
 * already shipped — 1.4.5 is cut and the published app still sends `d-*` — so
 * the ids must keep working. They are now read as TIER POSITIONS, not amounts:
 * `d-99` means "the second preset", whatever that costs in the caller's band.
 * ⛔ Do not add new ids in this style.
 */
const LEGACY_TIER_BY_ID: Record<string, DonationTier> = {
    inr_49: "t1", "d-49": "t1",
    inr_99: "t2", "d-99": "t2",
    inr_199: "t3", "d-199": "t3",
    inr_499: "t4", "d-499": "t4",
    inr_999: "t5", "d-999": "t5",
};

/** Resolve any accepted preset id to a tier, or null if unrecognised. */
export function tierForPresetId(id: string | undefined | null): DonationTier | null {
    if (!id) return null;
    if ((DONATION_TIERS as readonly string[]).includes(id)) return id as DonationTier;
    return LEGACY_TIER_BY_ID[id] ?? null;
}

/**
 * 🔑 SERVER-AUTHORITATIVE. The amount is derived from (band, tier) on the
 * server — never taken from the request. A client that asks for tier 1 while
 * sitting in Band 1 is charged Band 1's tier-1 price, whatever it displayed.
 */
export function donationPaise(band: Band, tier: DonationTier): number {
    const i = DONATION_TIERS.indexOf(tier);
    return DONATION_PAISE[band][i];
}

/** The whole ladder for a band, for display. */
export function donationPresetsForBand(band: Band): { id: DonationTier; paise: number; label: string }[] {
    return DONATION_TIERS.map((id, i) => {
        const paise = DONATION_PAISE[band][i];
        return { id, paise, label: `₹${(paise / 100).toLocaleString("en-IN")}` };
    });
}
