// src/lib/imotara/ipRateLimit.ts
// Simple in-memory fixed-window rate limiter for public, unauthenticated POST
// routes (careers/apply, blog/comments) — same pattern already used per-file
// in connect/translate/route.ts, centralized so it isn't copy-pasted again.
// Best-effort only: resets on cold start and isn't shared across serverless
// instances, but still blunts basic single-origin spam/abuse scripts.

import type { NextRequest } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: NextRequest): string {
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
