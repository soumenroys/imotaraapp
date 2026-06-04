// src/lib/imotara/adminCrypto.ts
// Password hashing and session token utilities for the super-admin system.
// Uses Node.js built-in crypto only — no extra dependencies.
// Password algorithm: scrypt (N=16384, r=8, p=1) — much stronger than bcrypt for brute-force resistance.
// Session tokens: 32 random bytes, stored as SHA-256 hash in DB.

import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1 };
const KEY_LENGTH = 64;

/** Hash a plaintext password. Returns "salt:hash" string for storage. */
export function hashPassword(password: string): string {
  const salt = randomBytes(32).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS).toString("hex");
  return `${salt}:${hash}`;
}

/** Verify a plaintext password against a stored "salt:hash" string. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const hashBuf  = Buffer.from(hash, "hex");
    const testHash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
    return timingSafeEqual(hashBuf, testHash);
  } catch {
    return false;
  }
}

/** Generate a new session token. Returns { token, tokenHash }.
 *  Send `token` to the browser (httpOnly cookie).
 *  Store `tokenHash` in the DB — never the raw token. */
export function generateSessionToken(): { token: string; tokenHash: string } {
  const token     = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

/** Hash a session token for DB lookup. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_COOKIE = "imotara_admin_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1_000; // 8 hours

// ── Account lockout constants ────────────────────────────────────────────────
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1_000; // 15 minutes

// ── Password complexity ───────────────────────────────────────────────────────
export interface PasswordCheckResult {
  ok:     boolean;
  reason?: string;
}

/**
 * Enforces password complexity policy:
 *   - Minimum 12 characters
 *   - At least one uppercase letter (A-Z)
 *   - At least one number (0-9)
 *   - At least one special character (!@#$%^&* etc.)
 */
export function checkPasswordComplexity(password: string): PasswordCheckResult {
  if (!password || password.length < 12)
    return { ok: false, reason: "Password must be at least 12 characters long." };
  if (!/[A-Z]/.test(password))
    return { ok: false, reason: "Password must contain at least one uppercase letter (A–Z)." };
  if (!/[0-9]/.test(password))
    return { ok: false, reason: "Password must contain at least one number (0–9)." };
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(password))
    return { ok: false, reason: "Password must contain at least one special character (!@#$%^&* etc.)." };
  return { ok: true };
}

/** Human-readable password policy string for UI display. */
export const PASSWORD_POLICY =
  "Minimum 12 characters · At least 1 uppercase · 1 number · 1 special character (!@#$%^&*)";

/** Returns true if account is currently locked. */
export function isAccountLocked(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

/** Returns seconds remaining on lockout (0 if not locked). */
export function lockoutSecondsRemaining(lockedUntil: string | null): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
}
