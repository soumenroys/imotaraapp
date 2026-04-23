// POST /api/license/verify-apple-purchase
// Called after a successful Apple IAP purchase on iOS.
// Auth: Bearer token.
// Body: { productId: string, transactionId: string }
// → { ok, tier, tokenBalance, expiresAt }
//
// Idempotent: re-running with the same transactionId returns current license state.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
    grantLicense,
    isValidProductId,
    PRODUCT_CATALOG,
    type LicenseProductId,
} from "@/lib/imotara/grantLicense";

async function resolveUserId(req: Request): Promise<string | null> {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    const { data } = await getSupabaseAdmin().auth.getUser(token);
    return data?.user?.id ?? null;
}

export async function POST(req: Request) {
    try {
        const userId = await resolveUserId(req);
        if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const body        = await req.json().catch(() => ({}));
        const productId   = String(body?.productId   ?? "").trim();
        const transactionId = String(body?.transactionId ?? "").trim();

        if (!isValidProductId(productId)) {
            return NextResponse.json({ ok: false, error: "Invalid productId" }, { status: 400 });
        }
        if (!transactionId) {
            return NextResponse.json({ ok: false, error: "transactionId required" }, { status: 400 });
        }

        const admin = getSupabaseAdmin();

        // Idempotency — if this transactionId was already processed, return current license
        const { data: existingPayment } = await admin
            .from("payment_licenses")
            .select("payment_id")
            .eq("payment_id", transactionId)
            .maybeSingle();

        if (existingPayment) {
            const { data: lic } = await admin
                .from("licenses")
                .select("tier, token_balance, expires_at")
                .eq("user_id", userId)
                .maybeSingle();
            const res = NextResponse.json({
                ok: true,
                tier:         lic?.tier         ?? "free",
                tokenBalance: lic?.token_balance ?? 0,
                expiresAt:    lic?.expires_at    ?? null,
            });
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        // Record transaction first (prevents double-grant on retry)
        const product = PRODUCT_CATALOG[productId as LicenseProductId];
        await admin.from("payment_licenses").upsert({
            payment_id:   transactionId,
            user_id:      userId,
            product_id:   productId,
            tier:         product.type === "subscription" ? product.tier : "free",
            amount_paise: product.type === "subscription" ? product.paise : (product as any).paise,
            currency:     "INR",
        }, { onConflict: "payment_id", ignoreDuplicates: true });

        const result = await grantLicense(userId, productId as LicenseProductId, admin);
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

        // Mark source as apple
        await admin.from("licenses").update({ source: "apple" }).eq("user_id", userId);

        const res = NextResponse.json({
            ok:           true,
            tier:         result.tier,
            tokenBalance: result.tokenBalance,
            expiresAt:    result.expiresAt,
        });
        res.headers.set("Cache-Control", "no-store");
        return res;
    } catch (err: any) {
        if (process.env.NODE_ENV !== "production") console.warn("[verify-apple-purchase]", String(err));
        return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
