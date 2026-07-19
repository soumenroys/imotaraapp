// src/lib/imotara/passwordPolicy.ts
// Password complexity policy — pure logic, safe to import from both server
// code and client components (unlike adminCrypto.ts, which pulls in
// Node's `crypto` module via `server-only` for hashing). Extracted so the
// end-user password-set flow (src/app/auth/accept) can reuse the exact same
// policy the super-admin system enforces, without duplicating it and
// risking the two silently drifting apart.

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
