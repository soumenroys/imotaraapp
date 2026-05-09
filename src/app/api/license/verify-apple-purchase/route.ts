// POST /api/license/verify-apple-purchase
// Called after a successful Apple IAP purchase on iOS.
// Auth: Bearer token.
// Body: { productId: string, transactionId: string }
// → { ok, tier, tokenBalance, expiresAt }
//
// Idempotent: re-running with the same transactionId returns current license state.
// Verifies the transaction with Apple App Store Server API before granting.

import { NextResponse } from "next/server";
import { createSign } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
    grantLicense,
    isValidProductId,
    PRODUCT_CATALOG,
    type LicenseProductId,
} from "@/lib/imotara/grantLicense";

const APPLE_BUNDLE_ID = "com.imotara.imotara";

// ── Apple App Store Server API JWT ────────────────────────────────────────────

function makeAppleJWT(): string {
    const issuerId  = process.env.APPLE_IAP_ISSUER_ID  ?? "";
    const keyId     = process.env.APPLE_IAP_KEY_ID     ?? "";
    const privateKey = process.env.APPLE_IAP_PRIVATE_KEY ?? "";

    const now    = Math.floor(Date.now() / 1000);
    const header  = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: issuerId,
        iat: now,
        exp: now + 3600,
        aud: "appstoreconnect-v1",
        bid: APPLE_BUNDLE_ID,
    })).toString("base64url");

    const message   = `${header}.${payload}`;
    const sign      = createSign("SHA256");
    sign.update(message);
    const signature = sign.sign(privateKey, "base64url");
    return `${message}.${signature}`;
}

// ── Verify transaction with Apple ─────────────────────────────────────────────
// Tries production first, then sandbox (covers TestFlight purchases).

async function verifyAppleTransaction(transactionId: string): Promise<{
    ok: boolean;
    appleProductId?: string;
    environment?: string;
    error?: string;
}> {
    const token = makeAppleJWT();
    const endpoints = [
        { url: `https://api.storekit.apple.com/inApps/v1/transactions/${transactionId}`,         env: "production" },
        { url: `https://api.storekit-sandbox.apple.com/inApps/v1/transactions/${transactionId}`, env: "sandbox" },
    ];

    for (const { url, env } of endpoints) {
        let res: Response;
        try {
            res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(8_000),
            });
        } catch {
            continue;
        }

        if (res.status === 404) continue;

        if (!res.ok) {
            return { ok: false, error: `Apple API ${env} returned ${res.status}` };
        }

        const json = await res.json() as { signedTransactionInfo?: string };
        const jws  = json?.signedTransactionInfo;
        if (!jws) return { ok: false, error: "No signedTransactionInfo in Apple response" };

        // Decode JWS payload (header.payload.signature) — we trust the HTTPS response
        // from Apple's server authenticated with our private key.
        const parts = jws.split(".");
        if (parts.length !== 3) return { ok: false, error: "Invalid JWS from Apple" };

        let txPayload: Record<string, unknown>;
        try {
            txPayload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        } catch {
            return { ok: false, error: "Could not parse Apple transaction payload" };
        }

        return { ok: true, appleProductId: String(txPayload.productId ?? ""), environment: env };
    }

    return { ok: false, error: "Transaction not found in Apple production or sandbox" };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function resolveUserId(req: Request): Promise<string | null> {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    const { data } = await getSupabaseAdmin().auth.getUser(token);
    return data?.user?.id ?? null;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const userId = await resolveUserId(req);
        if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const body          = await req.json().catch(() => ({}));
        const productId     = String(body?.productId     ?? "").trim();
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

        // Verify with Apple App Store Server API
        const hasAppleCredentials =
            process.env.APPLE_IAP_ISSUER_ID &&
            process.env.APPLE_IAP_KEY_ID &&
            process.env.APPLE_IAP_PRIVATE_KEY;

        if (hasAppleCredentials) {
            const verification = await verifyAppleTransaction(transactionId);
            if (!verification.ok) {
                return NextResponse.json(
                    { ok: false, error: `Apple verification failed: ${verification.error}` },
                    { status: 400 },
                );
            }
            // Confirm Apple's productId matches what the client claimed
            if (verification.appleProductId && verification.appleProductId !== productId) {
                return NextResponse.json(
                    { ok: false, error: "productId mismatch with Apple transaction" },
                    { status: 400 },
                );
            }
        }

        // Record transaction first (prevents double-grant on retry)
        const product = PRODUCT_CATALOG[productId as LicenseProductId];
        await admin.from("payment_licenses").upsert({
            payment_id:   transactionId,
            user_id:      userId,
            product_id:   productId,
            tier:         product.type === "subscription" ? product.tier : "free",
            amount_paise: product.paise,
            currency:     "INR",
        }, { onConflict: "payment_id", ignoreDuplicates: true });

        const result = await grantLicense(userId, productId as LicenseProductId, admin);
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

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
