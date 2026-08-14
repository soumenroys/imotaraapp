// src/lib/imotara/ipRateLimit.ts
// Two rate-limiting mechanisms, pick based on what the route is protecting:
//
// 1. checkIpRateLimit() — simple in-memory fixed-window limiter for public,
//    low-cost POST routes (careers/apply, blog/comments). Best-effort only:
//    resets on cold start and isn't shared across Vercel's multiple warm
//    serverless instances, so the effective limit is limit × (warm instance
//    count), not a precise per-IP cap. Fine for spam/abuse-blunting on cheap
//    routes; NOT fine for routes that spend real OpenAI/Azure tokens per call.
//
// 2. checkPersistentIpRateLimit() — atomic, row-locked Postgres counter
//    (see docs/sql/ip_rate_limits.sql), shared across every instance. Use
//    this for any route where a request costs real money — chat-reply,
//    respond, tts, voice/transcribe, analyze all use this (added 2026-08-14
//    per code_review_audit_2026_08_14's P0-2: these routes had literally no
//    rate limiting of any kind before). Same underlying pattern already
//    proven in production for /api/help-chat.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

const buckets = new Map<string, { count: number; resetAt: number }>();

// Accepts plain Request or NextRequest (NextRequest extends Request) — some
// routes type their handler param as one, some the other.
export function getClientIp(req: { headers: Headers }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
}

/** Returns true if allowed, false if the caller should get a 429. */
export function checkIpRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/**
 * Persistent, atomic, per-IP rate limit backed by the ip_rate_limits table —
 * safe under concurrent requests and Vercel's multi-instance serverless
 * model, unlike checkIpRateLimit() above. `bucket` scopes the counter to a
 * specific route (e.g. "chat-reply") so different routes never share a
 * counter. Fails OPEN (returns true) on a DB error — a rate limiter that
 * itself takes the route down on a transient DB hiccup would be worse than
 * the abuse risk it's guarding against; the route's own auth/quota logic is
 * the primary defense, this is a secondary layer.
 */
export async function checkPersistentIpRateLimit(
  bucket: string,
  ip: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("check_bucketed_rate_limit", {
      p_bucket: bucket,
      p_ip_key: ip,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error(`[checkPersistentIpRateLimit] RPC error for bucket=${bucket}:`, error.message);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.error(`[checkPersistentIpRateLimit] unexpected error for bucket=${bucket}:`, err);
    return true;
  }
}
