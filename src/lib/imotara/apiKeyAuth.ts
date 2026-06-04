// src/lib/imotara/apiKeyAuth.ts
// Validates API keys for /api/v1/* routes.
// Keys are sent as: Authorization: Bearer imk_<random>

import { NextRequest } from "next/server";
import { createHash } from "crypto";
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

/** Generate a new API key. Returns { key, prefix, hash }. key is shown once. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const random = Array.from(
    { length: 32 },
    () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
      Math.floor(Math.random() * 62)
    ]
  ).join("");

  const key    = `imk_${random}`;
  const prefix = key.slice(0, 8);
  const hash   = createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}
