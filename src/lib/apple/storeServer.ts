// src/lib/apple/storeServer.ts
// Talking to Apple's App Store Server API: our signed request, Apple's signed answer.
//
// ⚠️ MOVED OUT of verify-apple-purchase/route.ts on 6 Nov 2026 so the daily
// renewal sweep (/api/cron/store-renewals) asks Apple the SAME way the
// purchase route does. ⛔ A second copy would be a second place to get the
// JWT or the JWS check wrong.

import { createSign, createVerify, createPublicKey } from "crypto";

export const APPLE_BUNDLE_ID = "com.imotara.imotara";

// ── Apple App Store Server API JWT ────────────────────────────────────────────

export function makeAppleJWT(): string {
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

export function verifyAppleJWS(jws: string): boolean {
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

export async function verifyAppleTransaction(transactionId: string): Promise<{
    ok: boolean;
    appleProductId?: string;
    environment?: string;
    /**
     * The store's own expiry, ISO 8601, for auto-renewable subscriptions.
     * 🔴 This payload always carried it and this function used to return only
     * productId — so the grant fell back to the catalog's 31/366 days and a
     * 7-day free trial would have granted a full month of Plus.
     */
    expiresAt?: string | null;
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

        // `expiresDate` is milliseconds since the epoch, and is absent on
        // consumables (token packs). Anything unparseable becomes null, which
        // means "fall back to the catalog" — never a wrong date.
        const rawExpiry = Number(txPayload.expiresDate ?? NaN);
        const expiresAt = Number.isFinite(rawExpiry) && rawExpiry > 0
            ? new Date(rawExpiry).toISOString()
            : null;

        return {
            ok: true,
            appleProductId: String(txPayload.productId ?? ""),
            environment: env,
            expiresAt,
        };
    }

    return { ok: false, error: "Transaction not found in Apple production or sandbox" };
}


// ── Subscription status (renewals) ───────────────────────────────────────────

/**
 * 🔑 THE RENEWAL QUESTION, added 6 Nov 2026. A renewal gets a NEW transaction
 * id, and the app sends one only when someone opens the upgrade sheet ⇒ an
 * iPhone subscriber would drop to Free after the first period while still
 * paying. Apple's "Get All Subscription Statuses" accepts ANY transaction id
 * of the subscription and answers with its latest renewal.
 *
 * Status: 1 active · 2 expired · 3 billing retry · 4 grace period · 5 revoked.
 * ⇒ Only 1 and 4 count; the answer is the LATEST expiry among them, or null.
 */
type StatusBody = {
  data?: { lastTransactions?: { status?: number; signedTransactionInfo?: string; signedRenewalInfo?: string }[] }[];
};

function decodeJws<T>(jws: string | undefined, verify: (jws: string) => boolean): T | null {
  if (!jws || !verify(jws)) return null;
  try {
    return JSON.parse(Buffer.from(jws.split(".")[1], "base64url").toString("utf8")) as T;
  } catch {
    return null; // an unreadable entry is skipped, never guessed
  }
}

/**
 * Apple's answer, reduced to the two dates we act on:
 *  • expiresAt  — the latest expiry among ACTIVE (1) or GRACE (4) entries ⇒ the grant;
 *  • graceUntil — when status is 4 (billing grace period, 6 Nov 2026), the date
 *    the grace ends (renewal info's gracePeriodExpiresDate, else the expiry) ⇒
 *    the person is told their payment failed ⇒ lib/imotara/billingIssue.ts.
 */
export function subscriptionSnapshot(
  body: StatusBody,
  verify: (jws: string) => boolean = verifyAppleJWS,
): { expiresAt: string | null; graceUntil: string | null } {
  let best = 0;
  let grace = 0;
  for (const group of body.data ?? []) {
    for (const t of group.lastTransactions ?? []) {
      if (t.status !== 1 && t.status !== 4) continue;
      const tx = decodeJws<{ expiresDate?: number }>(t.signedTransactionInfo, verify);
      if (!tx) continue;
      const ms = Number(tx.expiresDate ?? NaN);
      if (Number.isFinite(ms) && ms > best) best = ms;
      if (t.status === 4) {
        const renewal = decodeJws<{ gracePeriodExpiresDate?: number }>(t.signedRenewalInfo, verify);
        const g = Number(renewal?.gracePeriodExpiresDate ?? ms);
        if (Number.isFinite(g) && g > grace) grace = g;
      }
    }
  }
  const iso = (ms: number) => (ms > 0 ? new Date(ms).toISOString() : null);
  return { expiresAt: iso(best), graceUntil: iso(grace) };
}

/** The latest ACTIVE expiry (kept for callers that only need the grant date). */
export function latestActiveExpiry(body: StatusBody, verify: (jws: string) => boolean = verifyAppleJWS): string | null {
  return subscriptionSnapshot(body, verify).expiresAt;
}

export async function appleSubscriptionExpiry(
  transactionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; expiresAt: string | null; graceUntil: string | null } | { ok: false; error: string }> {
  const token = makeAppleJWT();
  for (const base of ["https://api.storekit.apple.com", "https://api.storekit-sandbox.apple.com"]) {
    const res = await fetchImpl(`${base}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => undefined);
    if (!res || res.status === 404) continue;
    if (!res.ok) return { ok: false, error: `Apple returned ${res.status}` };
    return { ok: true, ...subscriptionSnapshot(await res.json()) };
  }
  return { ok: false, error: "Subscription not found in Apple production or sandbox" };
}
