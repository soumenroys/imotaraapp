// src/lib/imotara/apiKeyAuth.ts
// Validates API keys for /api/v1/* routes.
// Keys are sent as: Authorization: Bearer imk_<random>

import { NextRequest } from "next/server";
import { createHash, randomInt } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export interface ApiKeyContext {
  keyId:     string;
  orgId:     string;
  orgName:   string;
  orgTier:   string;
  scopes:    string[];
  rateLimit: number;
}

export async function verifyApiKey(req: NextRequest): Promise<ApiKeyContext | null> {
  const auth = req.headers.get("authorization") ?? "";
  const key  = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!key || !key.startsWith("imk_")) return null;

  const hash = createHash("sha256").update(key).digest("hex");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("verify_api_key", { p_key_hash: hash });

  if (error || !data || data.length === 0) return null;

  const row = data[0];

  // Update last_used_at (fire-and-forget)
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", hash);

  return {
    keyId:     row.key_id,
    orgId:     row.org_id,
    orgName:   row.org_name,
    orgTier:   row.org_tier,
    scopes:    row.scopes ?? [],
    rateLimit: row.rate_limit ?? 100,
  };
}

// Per-key rate limit, enforced against the org_api_keys.rate_limit column
// (requests per minute). Was fetched into ApiKeyContext but never checked —
// every Enterprise key had unlimited throughput regardless of its configured cap.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the request is within ctx.rateLimit (requests/minute), false if it should be rejected with 429. */
export function checkApiKeyRateLimit(ctx: ApiKeyContext): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ctx.keyId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ctx.keyId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= ctx.rateLimit) return false;
  entry.count++;
  return true;
}

/** Generate a new API key. Returns { key, prefix, hash }. key is shown once. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Math.random() is not cryptographically secure — these keys gate
  // Enterprise-tier /api/v1/org/* access, so they need the same guarantee
  // the admin session tokens already have (crypto.randomBytes). randomInt
  // gives an unbiased pick per character with no modulo-bias correction needed.
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = Array.from(
    { length: 32 },
    () => CHARSET[randomInt(0, CHARSET.length)]
  ).join("");

  const key    = `imk_${random}`;
  const prefix = key.slice(0, 8);
  const hash   = createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}
