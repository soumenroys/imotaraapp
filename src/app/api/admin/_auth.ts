// src/app/api/admin/_auth.ts
// Shared Bearer-token check for all admin API routes.
// Token = ADMIN_SECRET env var (set in .env.local / Vercel).

import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

export function adminAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // Constant-time comparison prevents byte-by-byte timing attacks.
  if (auth.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}
