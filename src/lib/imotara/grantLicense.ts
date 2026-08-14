// src/lib/imotara/grantLicense.ts
// LIC-5: product catalog + license grant helper.
// Called by webhook (server-trust) and verify-payment (user-initiated confirm).

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Product catalog ────────────────────────────────────────────────────────────

type SubscriptionDef = { type: "subscription"; tier: "plus" | "pro"; days: number; paise: number };
type TokenPackDef   = { type: "token_pack"; tokens: number; paise: number };
type ProductDef     = SubscriptionDef | TokenPackDef;

export const PRODUCT_CATALOG: Record<string, ProductDef> = {
    plus_monthly:  { type: "subscription", tier: "plus", days: 31,   paise: 9_900   },
    plus_annual:   { type: "subscription", tier: "plus", days: 366,  paise: 69_900  },
    pro_monthly:   { type: "subscription", tier: "pro",  days: 31,   paise: 14_900  },
    pro_annual:    { type: "subscription", tier: "pro",  days: 366,  paise: 129_900 },
    tokens_100:    { type: "token_pack",   tokens: 100,  paise: 4_900   },
    tokens_250:    { type: "token_pack",   tokens: 250,  paise: 9_900   },
    tokens_600:    { type: "token_pack",   tokens: 600,  paise: 19_900  },
    tokens_1800:   { type: "token_pack",   tokens: 1800, paise: 49_900  },
} as const;

export type LicenseProductId = keyof typeof PRODUCT_CATALOG;

export function isValidProductId(id: string): id is LicenseProductId {
    return id in PRODUCT_CATALOG;
}

// ── Grant ──────────────────────────────────────────────────────────────────────

export type GrantResult =
    | { ok: true;  tier: string; tokenBalance: number; expiresAt: string | null }
    | { ok: false; error: string };

/**
 * Upgrade or top-up a user's license row.
 * - Subscriptions: extends expiry (stacks on active subscription, resets if expired).
 *   Never downgrades tier — a Pro user who buys Plus keeps Pro tier with stacked expiry.
 * - Token packs: increments token_balance without touching tier/expiry
 * Caller must pass the admin (service-role) client.
 *
 * The read-compute-write is done atomically in a single SQL statement via the
 * grant_license_atomic RPC (docs/sql/connect_v42_grant_license_atomic.sql), not
 * in JS — two concurrent webhook deliveries for the same user (e.g. a Razorpay
 * retry racing the original delivery before either commits) previously raced
 * on a JS-level read-then-write and could lose or double an increment.
 * See [[code_review_audit_2026_08_14]] (finding A8).
 */
export async function grantLicense(
    userId: string,
    productId: LicenseProductId,
    admin: SupabaseClient,
    source: "apple" | "razorpay" | "webhook" | "stripe" | "google_play" = "razorpay",
): Promise<GrantResult> {
    try {
        const product = PRODUCT_CATALOG[productId];
        const isSubscription = product.type === "subscription";

        const { data, error } = await admin.rpc("grant_license_atomic", {
            p_user_id: userId,
            p_is_subscription: isSubscription,
            p_tier: isSubscription ? product.tier : "free",
            p_days: isSubscription ? product.days : 0,
            p_tokens: isSubscription ? 0 : product.tokens,
            p_source: source,
        }).single<{ out_tier: string; out_token_balance: number; out_expires_at: string | null }>();

        if (error || !data) throw new Error(`grant_license_atomic failed: ${error?.message ?? "no data"}`);

        return {
            ok: true,
            tier: data.out_tier,
            tokenBalance: data.out_token_balance,
            expiresAt: data.out_expires_at,
        };
    } catch (err) {
        console.error("[grantLicense] error:", err);
        return { ok: false, error: String(err) };
    }
}
