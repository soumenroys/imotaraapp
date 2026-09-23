// src/lib/imotara/pricing.ts
//
// 💰 THE PRICE LIST. One source, in paise, for the whole web app.
//
// 🔴 WHY THIS EXISTS. Prices were written out by hand in at least five places —
// the catalog here, /upgrade's PLANS and TOKEN_PACKS, the tutorial page, the
// admin guide and the audience pages — plus 23 files of docs and KB content.
// They drifted: licensing_strategy carried "Plus ₹79" for months after the real
// price became ₹99. Stage C reprices the merged tier, so every copy is a chance
// to publish a number we do not charge.
//
// ⚠️ MOBILE HAS ITS OWN COPY — `src/payments/upgradePlans.ts` (PLAN_DEFS) in the
// imotara-mobile repo. Two repos cannot share a module, so the two must be
// changed in the SAME pass, and `pricingCatalog.test.ts` in each repo pins the
// amounts so a one-sided change fails loudly.
//
// 🔴 And on Android the app RENDERS this number rather than asking Play Console
// (UpgradeSheet.tsx — iOS reads the store, Android does not). Reprice in the
// console without shipping a matching PLAN_DEFS and Android shows one price
// while Play charges another.

// 🔗 Every subscription grants `plus` — the one paid consumer tier. The SKU ids
// still say plus_/pro_ because store product IDs are immutable once a product
// exists, and pro_* has (or will have) live subscribers. The id a customer
// never sees is not worth risking their subscription over.
type SubscriptionDef = { type: "subscription"; tier: "plus"; days: number; paise: number };
type TokenPackDef    = { type: "token_pack"; tokens: number; paise: number };
type ProductDef      = SubscriptionDef | TokenPackDef;

export const PRODUCT_CATALOG = {
    // ✅ THE SKUs ON SALE. Display name in both stores: "Imotara Plus".
    //
    // 🔄 FLIPPED 2026-09-25. These used to be the RETIRED pair at ₹99/₹699,
    // while `pro_*` was live. The flip was possible — and worth doing — because
    // **nobody had ever purchased `pro_monthly` or `pro_annual`**: zero rows in
    // `payment_licenses`, verified 2026-09-18. An empty name costs nothing to
    // abandon, and `plus_*` is the name that matches what users are sold.
    //
    // 🔑 Play sells exactly these two ids (`plus_monthly`, `plus_annual`, bare,
    // no bundle prefix). Apple sells the same suffixes, bundle-prefixed. The
    // ids now agree with the label on all three platforms.
    plus_monthly:  { type: "subscription", tier: "plus", days: 31,   paise: 14_900  },
    plus_annual:   { type: "subscription", tier: "plus", days: 366,  paise: 129_900 },

    // 🔴 RETIRED for new purchases (L12) — deactivate in both consoles, never
    // delete. They grant the same tier at the same price; they are simply not
    // offered. Kept so a stray in-flight purchase still resolves.
    //
    // ⚠️ `plus_monthly` carries ONE live paying Apple subscriber, grandfathered
    // at the old ₹99. Apple bills him, not us — and there is no App Store Server
    // Notifications handler, so his renewals never reach this backend at all.
    // His licence was made permanent (`expires_at = null`) on 2026-09-18.
    // ⇒ Raising `plus_monthly` here does NOT change what he pays.
    //
    // ⇒ **Never delete these SKUs.** Deleting a store product with a live
    // subscriber is how you break a paying customer's renewal.
    pro_monthly:   { type: "subscription", tier: "plus", days: 31,   paise: 14_900  },
    pro_annual:    { type: "subscription", tier: "plus", days: 366,  paise: 129_900 },

    tokens_100:    { type: "token_pack",   tokens: 100,  paise: 4_900   },
    tokens_250:    { type: "token_pack",   tokens: 250,  paise: 9_900   },
    tokens_600:    { type: "token_pack",   tokens: 600,  paise: 19_900  },
    tokens_1800:   { type: "token_pack",   tokens: 1800, paise: 49_900  },
} as const satisfies Record<string, ProductDef>;

export type LicenseProductId = keyof typeof PRODUCT_CATALOG;

export function isValidProductId(id: string): id is LicenseProductId {
    return id in PRODUCT_CATALOG;
}

/** Price in paise for a product. The only way UI should learn a price. */
export function paiseFor(id: LicenseProductId): number {
    return PRODUCT_CATALOG[id].paise;
}

/** 9_900 → "₹99". Whole rupees only; every price we sell is a round rupee. */
export function inr(paise: number): string {
    return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}
