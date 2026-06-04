// src/lib/googlePlay.ts
// Google Play Developer API — purchase verification using service account JWT.
// No extra packages needed — uses Node.js built-in crypto + fetch.
// Env var required: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (full service account JSON string)

import "server-only";
import { createSign } from "crypto";

/** Parse service account JSON from env var. */
function getServiceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error("[googlePlay] Failed to parse GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
    return null;
  }
}

/** Create a signed JWT for Google OAuth2. */
function createJwt(clientEmail: string, privateKey: string): string {
  const now   = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss:   clientEmail,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   expiry,
  })).toString("base64url");

  const unsigned  = `${header}.${payload}`;
  const sign      = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(privateKey, "base64url");

  return `${unsigned}.${signature}`;
}

/** Fetch a short-lived access token from Google OAuth2. */
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  const jwt = createJwt(clientEmail, privateKey);
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:  jwt,
      }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch (err) {
    console.error("[googlePlay] getAccessToken failed:", err);
    return null;
  }
}

export interface GooglePlayPurchaseResult {
  valid:       boolean;
  expiresAt?:  string | null;
  orderId?:    string;
  error?:      string;
}

/**
 * Verify a Google Play subscription purchase.
 * @param packageName  — e.g. "com.imotara.imotara"
 * @param productId    — subscription SKU e.g. "plus_monthly"
 * @param purchaseToken — from expo-iap purchase.purchaseToken
 */
export async function verifyGooglePlaySubscription(
  packageName:   string,
  productId:     string,
  purchaseToken: string,
): Promise<GooglePlayPurchaseResult> {
  const sa = getServiceAccount();
  if (!sa) return { valid: false, error: "Google Play service account not configured." };

  const accessToken = await getAccessToken(sa.client_email, sa.private_key);
  if (!accessToken) return { valid: false, error: "Could not obtain Google Play access token." };

  try {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();

    if (!res.ok) {
      return { valid: false, error: data.error?.message ?? "Google Play verification failed." };
    }

    // subscriptionState: ACTIVE | CANCELED | ON_HOLD | IN_GRACE_PERIOD | PAUSED | EXPIRED
    const state      = data.subscriptionState as string;
    const isActive   = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(state);
    const expiresAt  = data.lineItems?.[0]?.expiryTime ?? null;

    return {
      valid:      isActive,
      expiresAt:  expiresAt ? new Date(expiresAt).toISOString() : null,
      orderId:    data.latestOrderId ?? undefined,
    };
  } catch (err) {
    console.error("[googlePlay] verifySubscription error:", err);
    return { valid: false, error: String(err) };
  }
}

/**
 * Verify a Google Play one-time product purchase (token packs).
 */
export async function verifyGooglePlayProduct(
  packageName:   string,
  productId:     string,
  purchaseToken: string,
): Promise<GooglePlayPurchaseResult> {
  const sa = getServiceAccount();
  if (!sa) return { valid: false, error: "Google Play service account not configured." };

  const accessToken = await getAccessToken(sa.client_email, sa.private_key);
  if (!accessToken) return { valid: false, error: "Could not obtain Google Play access token." };

  try {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();

    if (!res.ok) {
      return { valid: false, error: data.error?.message ?? "Google Play verification failed." };
    }

    // purchaseState: 0=purchased, 1=canceled, 2=pending
    const isValid = data.purchaseState === 0;
    return { valid: isValid, orderId: data.orderId };
  } catch (err) {
    console.error("[googlePlay] verifyProduct error:", err);
    return { valid: false, error: String(err) };
  }
}

/** Acknowledge a Google Play purchase (required within 3 days or it's refunded). */
export async function acknowledgeGooglePlayPurchase(
  packageName:   string,
  productId:     string,
  purchaseToken: string,
  isSubscription: boolean,
): Promise<void> {
  const sa = getServiceAccount();
  if (!sa) return;

  const accessToken = await getAccessToken(sa.client_email, sa.private_key);
  if (!accessToken) return;

  const type = isSubscription ? "subscriptions" : "products";
  const url  = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/${type}/${productId}/tokens/${purchaseToken}:acknowledge`;

  await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body:    "{}",
  }).catch((err) => console.error("[googlePlay] acknowledge failed:", err));
}
