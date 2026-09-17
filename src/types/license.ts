// src/types/license.ts
//
// Shared types for Imotara licensing.
// These are future-facing and do NOT enforce anything by themselves.

/**
 * The canonical tier list — the single source of truth for every tier
 * enumeration in this product. Ordered least → most privileged.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-09-17 seven separate hardcoded lists spelled
 * out the tiers, and four of them silently omitted "family". That was not
 * cosmetic: the org license-pool API validated against one of the short lists,
 * so issuing a Family pool was rejected with
 *   "tier must be one of: free, plus, pro, edu, enterprise"
 * — a tier the product sells, unreachable through its own admin panel.
 *
 * Derive from this. Never re-type the list; `tierListsDeriveFromOrder.test.ts`
 * fails the build if you do.
 *
 * 🔗 `pro` IS NOT HERE ANY MORE. Plus and Pro merged (L10) and `plus` is the
 * canonical id for the one paid consumer tier, matching the name users see.
 * `pro` and the mobile spelling `premium` are accepted as LEGACY ALIASES that
 * normalise to `plus` — see TIER_ALIASES. Nothing is stored as `pro`: the
 * database had zero `pro` rows when this was done, which is why it could be
 * done at all.
 */
export const TIER_ORDER = ["free", "plus", "family", "edu", "enterprise"] as const;

export type LicenseTier = (typeof TIER_ORDER)[number];

/**
 * Ordering rank for "is tier A at least tier B" comparisons, derived from
 * TIER_ORDER so the two can never disagree.
 */
export const TIER_RANK: Record<LicenseTier, number> = Object.fromEntries(
    TIER_ORDER.map((t, i) => [t, i]),
) as Record<LicenseTier, number>;

/** Narrowing guard for untrusted input (request bodies, query params). */
export function isLicenseTier(value: unknown): value is LicenseTier {
    return typeof value === "string" && (TIER_ORDER as readonly string[]).includes(value);
}

export type LicenseStatusCode = "valid" | "invalid" | "expired" | "trial";

export type LicenseSource = "manual" | "stripe" | "razorpay" | "promo" | "internal";

export type LicenseRecord = {
    id: string; // UUID or Supabase-generated
    userId: string; // future: link to auth user ID
    tier: LicenseTier;
    status: LicenseStatusCode;
    /**
     * ISO timestamps as strings for JSON friendliness
     */
    createdAt: string;
    updatedAt: string;
    validFrom: string | null;
    validUntil: string | null;
    /**
     * Optional metadata for future integrations
     */
    source?: LicenseSource;
    externalRef?: string | null; // e.g. Stripe/Razorpay subscription id
    notes?: string | null;
};

/**
 * Safe lookup for a per-tier map keyed by an untrusted string — tier values
 * arriving from the database or an API response are plain strings, and an
 * unknown one (or a tier added later) must fall back rather than render
 * `undefined` into a className.
 */
export function byTier<T>(map: Record<LicenseTier, T>, tier: unknown, fallback: T): T {
    return isLicenseTier(tier) ? map[tier] : fallback;
}

/**
 * The one place a tier is turned into words for a user.
 *
 * 🔴 WHY THIS EXISTS. Two label maps existed and disagreed: the settings page
 * rendered `edu` as "Education" while LicenseBadge rendered the same tier as
 * "EDU". The mobile repo had the worse version of this — the same tier read
 * "Pro" on one screen and "Premium" on another.
 *
 * Typed as Record<LicenseTier, string>, so adding a tier to TIER_ORDER will not
 * compile until it has a label.
 *
 * ⚠️ Stage C renames the public paid tier to "Imotara Plus". This map is the
 * edit — but see the note on prettyTier below before changing it.
 */
export const TIER_LABELS: Record<LicenseTier, string> = {
    free:       "Free",
    // The one paid consumer tier. In-app the brand prefix is redundant, so the
    // label is "Plus"; prose and marketing say "Imotara Plus".
    plus:       "Plus",
    family:     "Family",
    edu:        "Education",
    enterprise: "Enterprise",
};

/**
 * Mobile spellings that reach the web as tier strings. The settings page
 * already tolerated these; keeping them here preserves that exactly.
 */
const TIER_ALIASES: Record<string, LicenseTier> = {
    // 🔗 Legacy ids that must keep resolving. `pro` was the internal id for the
    // paid tier before it was renamed to match its public name; `premium` is
    // what the mobile app calls the same thing and what sits in AsyncStorage on
    // installed devices. Both mean "plus" and must never fall through to free.
    pro:       "plus",
    premium:   "plus",
    education: "edu",
};

/**
 * Display label for a tier. Unknown or missing values read "Free".
 *
 * ⚠️ Do NOT branch behaviour on the return value of this. `settings/page.tsx`
 * does (`tierLabel === "Pro" ? … : tierLabel === "Plus" ? …`) and that coupling
 * breaks silently the moment the label is renamed. Compare tiers, not labels.
 */
export function normaliseTier(tier: unknown): LicenseTier {
    const raw = String(tier ?? "free").toLowerCase();
    const key = TIER_ALIASES[raw] ?? raw;
    return isLicenseTier(key) ? key : "free";
}

export function prettyTier(tier: unknown): string {
    return TIER_LABELS[normaliseTier(tier)];
}
