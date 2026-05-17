// POST /api/license/verify-apple-purchase
// Called after a successful Apple IAP purchase on iOS.
// Auth: Bearer token.
// Body: { productId: string, transactionId: string }
// → { ok, tier, tokenBalance, expiresAt }
//
// Idempotent: re-running with the same transactionId returns current license state.
// Verifies the transaction with Apple App Store Server API before granting.

import { NextResponse } from "next/server";
import { createSign, createVerify, createPublicKey } from "crypto";
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
    // Vercel sometimes stores PEM keys with literal \n instead of real newlines.
    const privateKey = (process.env.APPLE_IAP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

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
    // JWT ES256 requires IEEE P1363 format (raw r‖s), not DER — same as JWS verification.
    const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }, "base64url");
    return `${message}.${signature}`;
}

// ── JWS signature verification ────────────────────────────────────────────────
// Apple signs signedTransactionInfo with their own EC private key.
// The x5c header field carries the leaf certificate whose public key we use
// to verify the ES256 signature. This confirms the payload was not tampered
// with even if HTTPS were somehow compromised.

function verifyAppleJWS(jws: string): boolean {
    try {
        const parts = jws.split(".");
        if (parts.length !== 3) return false;

        const header = JSON.parse(
            Buffer.from(parts[0], "base64url").toString("utf8")
        ) as { alg?: string; x5c?: string[] };

        if (header.alg !== "ES256") return false;
        if (!Array.isArray(header.x5c) || header.x5c.length === 0) return false;

        // Reconstruct PEM from the leaf DER certificate (base64-encoded in x5c[0])
        const leafPem = [
            "-----BEGIN CERTIFICATE-----",
            ...(header.x5c[0].match(/.{1,64}/g) ?? []),
            "-----END CERTIFICATE-----",
        ].join("\n");

        const publicKey  = createPublicKey(leafPem);
        const signedData = `${parts[0]}.${parts[1]}`;
        const signature  = Buffer.from(parts[2], "base64url");

        // JWS ES256 signatures use IEEE P1363 format (raw 64-byte R‖S),
        // NOT the DER-encoded format that Node.js expects by default.
        // Without dsaEncoding: 'ieee-p1363', verification always fails.
        const verifier = createVerify("SHA256");
        verifier.update(signedData);
        return verifier.verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, signature);
    } catch {
        return false;
    }
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
        let res: Response | undefined;
        // Retry up to 3 times with 1s delay — StoreKit can fire onPurchaseSuccess
        // before Apple's servers have indexed the transaction (race condition).
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
            try {
                res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: AbortSignal.timeout(8_000),
                });
                if (res.status !== 404) break;
            } catch {
                res = undefined;
            }
        }

        if (!res || res.status === 404) continue;

        if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error(`[verify-apple-purchase] Apple API ${env} returned ${res.status}:`, errText);
            return { ok: false, error: `Apple API ${env} returned ${res.status}` };
        }

        const json = await res.json() as { signedTransactionInfo?: string };
        const jws  = json?.signedTransactionInfo;
        if (!jws) return { ok: false, error: "No signedTransactionInfo in Apple response" };

        // Verify the ES256 signature using the x5c leaf certificate from the JWS header.
        // This ensures the payload was signed by Apple and was not tampered with.
        if (!verifyAppleJWS(jws)) {
            console.error("[verify-apple-purchase] JWS signature verification failed for transaction", transactionId);
            return { ok: false, error: "Apple JWS signature verification failed" };
        }

        const parts = jws.split(".");
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

        console.log(`[verify-apple-purchase] userId=${userId} productId=${productId} transactionId=${transactionId}`);

        if (!isValidProductId(productId)) {
            return NextResponse.json({ ok: false, error: "Invalid productId" }, { status: 400 });
        }
        if (!transactionId) {
            return NextResponse.json({ ok: false, error: "transactionId required" }, { status: 400 });
        }

        const admin = getSupabaseAdmin();

        // Idempotency — if this transactionId was already processed, return current license.
        // Also select tier so we can detect a prior failed grantLicense and recover.
        const { data: existingPayment } = await admin
            .from("payment_licenses")
            .select("payment_id, tier")
            .eq("payment_id", transactionId)
            .maybeSingle();

        if (existingPayment) {
            const { data: lic } = await admin
                .from("licenses")
                .select("tier, token_balance, expires_at")
                .eq("user_id", userId)
                .maybeSingle();

            const currentTier = (lic?.tier ?? "free") as string;
            const paymentTier = (existingPayment.tier ?? "free") as string;

            // If the payment was for a subscription tier but the license row still shows
            // "free", the previous grantLicense call must have failed after the payment
            // record was written. Re-run the grant now so the user's purchase is honoured.
            if (paymentTier !== "free" && currentTier === "free") {
                const reGrant = await grantLicense(userId, productId as LicenseProductId, admin);
                if (!reGrant.ok) {
                    return NextResponse.json({ ok: false, error: reGrant.error }, { status: 500 });
                }
                const res = NextResponse.json({
                    ok:           true,
                    tier:         reGrant.tier,
                    tokenBalance: reGrant.tokenBalance,
                    expiresAt:    reGrant.expiresAt,
                });
                res.headers.set("Cache-Control", "no-store");
                return res;
            }

            const res = NextResponse.json({
                ok: true,
                tier:         currentTier,
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
            // Confirm Apple's productId matches what the client claimed.
            // App Store Connect stores the full bundle-prefixed SKU (e.g.
            // "com.imotara.imotara.plus_monthly"), but the client sends the
            // short catalog key ("plus_monthly"). Strip the bundle prefix
            // before comparing so both forms match correctly.
            if (verification.appleProductId) {
                const normalizedAppleId = verification.appleProductId.startsWith(`${APPLE_BUNDLE_ID}.`)
                    ? verification.appleProductId.slice(`${APPLE_BUNDLE_ID}.`.length)
                    : verification.appleProductId;
                if (normalizedAppleId !== productId) {
                    return NextResponse.json(
                        { ok: false, error: "productId mismatch with Apple transaction" },
                        { status: 400 },
                    );
                }
            }
        }

        // Record transaction first (prevents double-grant on retry)
        const product = PRODUCT_CATALOG[productId as LicenseProductId];
        const { error: upsertErr } = await admin.from("payment_licenses").upsert({
            payment_id:   transactionId,
            user_id:      userId,
            product_id:   productId,
            tier:         product.type === "subscription" ? product.tier : "free",
            amount_paise: product.paise,
            currency:     "INR",
        }, { onConflict: "payment_id", ignoreDuplicates: true });
        if (upsertErr) {
            console.error("[verify-apple-purchase] payment_licenses upsert failed:", upsertErr.message);
            return NextResponse.json({ ok: false, error: "Could not record transaction" }, { status: 500 });
        }

        const result = await grantLicense(userId, productId as LicenseProductId, admin);
        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

        const res = NextResponse.json({
            ok:           true,
            tier:         result.tier,
            tokenBalance: result.tokenBalance,
            expiresAt:    result.expiresAt,
        });
        res.headers.set("Cache-Control", "no-store");
        return res;
    } catch (err: any) {
        console.error("[verify-apple-purchase]", String(err));
        return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
