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

// Tier rank — higher number = higher tier. Never write a lower tier over a higher one.
const TIER_RANK: Record<string, number> = { free: 0, plus: 1, pro: 2, family: 3, edu: 3, enterprise: 4 };

/**
 * Upgrade or top-up a user's license row.
 * - Subscriptions: extends expiry (stacks on active subscription, resets if expired).
 *   Never downgrades tier — a Pro user who buys Plus keeps Pro tier with stacked expiry.
 * - Token packs: increments token_balance without touching tier/expiry
 * Caller must pass the admin (service-role) client.
 */
export async function grantLicense(
    userId: string,
    productId: LicenseProductId,
    admin: SupabaseClient,
    source: "apple" | "razorpay" | "webhook" | "stripe" | "google_play" = "razorpay",
): Promise<GrantResult> {
    try {
        const product = PRODUCT_CATALOG[productId];

        const { data: existing } = await admin
            .from("licenses")
            .select("tier, status, expires_at, token_balance")
            .eq("user_id", userId)
            .maybeSingle();

        if (product.type === "subscription") {
            const now       = Date.now();
            const expMs     = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
            const baseMs    = expMs > now ? expMs : now; // stack renewals when still active
            const newExpiry = new Date(baseMs + product.days * 86_400_000).toISOString();
            const balance   = existing?.token_balance ?? 0;

            // Never downgrade: if the user already holds a higher tier, keep it.
            const currentRank = TIER_RANK[existing?.tier ?? "free"] ?? 0;
            const newRank     = TIER_RANK[product.tier] ?? 0;
            const tierToWrite = newRank >= currentRank ? product.tier : (existing!.tier);

            if (existing) {
                const { error } = await admin.from("licenses")
                    .update({ tier: tierToWrite, status: "valid", expires_at: newExpiry, source, updated_at: new Date().toISOString() })
                    .eq("user_id", userId);
                if (error) throw new Error(`licenses update failed: ${error.message}`);
            } else {
                const { error } = await admin.from("licenses").insert({
                    user_id: userId, tier: product.tier, status: "valid",
                    expires_at: newExpiry, token_balance: 0, source,
                });
                if (error) throw new Error(`licenses insert failed: ${error.message}`);
            }

            return { ok: true, tier: tierToWrite, tokenBalance: balance, expiresAt: newExpiry };
        } else {
            // Token pack — increment balance only; leave tier/expiry untouched
            const balance    = (existing?.token_balance ?? 0) + product.tokens;
            const tier       = existing?.tier ?? "free";
            const expiresAt  = existing?.expires_at ?? null;

            if (existing) {
                const { error } = await admin.from("licenses")
                    .update({ token_balance: balance, updated_at: new Date().toISOString() })
                    .eq("user_id", userId);
                if (error) throw new Error(`licenses update failed: ${error.message}`);
            } else {
                const { error } = await admin.from("licenses").insert({
                    user_id: userId, tier: "free", status: "valid",
                    token_balance: balance, source,
                });
                if (error) throw new Error(`licenses insert failed: ${error.message}`);
            }

            return { ok: true, tier, tokenBalance: balance, expiresAt };
        }
    } catch (err) {
        console.error("[grantLicense] error:", err);
        return { ok: false, error: String(err) };
    }
}
