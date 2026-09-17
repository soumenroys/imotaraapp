// src/lib/imotara/grantLicense.ts
// LIC-5: product catalog + license grant helper.
// Called by webhook (server-trust) and verify-payment (user-initiated confirm).

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Product catalog ────────────────────────────────────────────────────────────
// Moved to ./pricing so client pages can read prices without importing this
// module. Re-exported so the eight server call sites keep working unchanged.

import { PRODUCT_CATALOG, type LicenseProductId } from "./pricing";

export {
    PRODUCT_CATALOG,
    isValidProductId,
    paiseFor,
    inr,
    type LicenseProductId,
} from "./pricing";

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
