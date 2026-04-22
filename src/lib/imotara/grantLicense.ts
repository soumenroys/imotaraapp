// src/lib/imotara/grantLicense.ts
// LIC-5: product catalog + license grant helper.
// Called by webhook (server-trust) and verify-payment (user-initiated confirm).

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Product catalog ────────────────────────────────────────────────────────────

type SubscriptionDef = { type: "subscription"; tier: "plus" | "pro"; days: number; paise: number };
type TokenPackDef   = { type: "token_pack"; tokens: number; paise: number };
type ProductDef     = SubscriptionDef | TokenPackDef;

export const PRODUCT_CATALOG: Record<string, ProductDef> = {
    plus_monthly:  { type: "subscription", tier: "plus", days: 31,   paise: 7_900   },
    plus_annual:   { type: "subscription", tier: "plus", days: 366,  paise: 69_900  },
    pro_monthly:   { type: "subscription", tier: "pro",  days: 31,   paise: 14_900  },
    pro_annual:    { type: "subscription", tier: "pro",  days: 366,  paise: 119_900 },
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
 * - Subscriptions: extends expiry (stacks on active subscription, resets if expired)
 * - Token packs: increments token_balance without touching tier/expiry
 * Caller must pass the admin (service-role) client.
 */
export async function grantLicense(
    userId: string,
    productId: LicenseProductId,
    admin: SupabaseClient,
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

            if (existing) {
                await admin.from("licenses")
                    .update({ tier: product.tier, status: "valid", expires_at: newExpiry, source: "razorpay" })
                    .eq("user_id", userId);
            } else {
                await admin.from("licenses").insert({
                    user_id: userId, tier: product.tier, status: "valid",
                    expires_at: newExpiry, token_balance: 0, source: "razorpay",
                });
            }

            return { ok: true, tier: product.tier, tokenBalance: balance, expiresAt: newExpiry };
        } else {
            // Token pack — increment balance only; leave tier/expiry untouched
            const balance    = (existing?.token_balance ?? 0) + product.tokens;
            const tier       = existing?.tier ?? "free";
            const expiresAt  = existing?.expires_at ?? null;

            if (existing) {
                await admin.from("licenses")
                    .update({ token_balance: balance })
                    .eq("user_id", userId);
            } else {
                await admin.from("licenses").insert({
                    user_id: userId, tier: "free", status: "valid",
                    token_balance: balance, source: "razorpay",
                });
            }

            return { ok: true, tier, tokenBalance: balance, expiresAt };
        }
    } catch (err) {
        console.error("[grantLicense] error:", err);
        return { ok: false, error: String(err) };
    }
}
