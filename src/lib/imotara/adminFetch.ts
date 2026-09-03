// src/lib/imotara/adminFetch.ts
// Shared auth options for admin-panel fetches.
//
// Extracted from src/app/admin/page.tsx so components in other files use the
// same rule. Duplicating this is how the two copies drift, and a drift here
// means requests that silently authenticate the wrong way.

/**
 * Session login → cookie only (credentials: same-origin, NO Bearer header).
 * Legacy secret key → Authorization: Bearer.
 *
 * Worth knowing for broadcast: requireOwner() REJECTS the legacy bearer path
 * outright, because it yields a synthetic identity that is not a row in
 * super_admins. So every /api/admin/broadcast/* call must come from a real
 * session — which this returns automatically when the token is a session one.
 */
export function adminFetchOpts(token: string, extra?: RequestInit): RequestInit {
  const isSession = token.startsWith("session:");
  return {
    credentials: "same-origin",
    ...extra,
    headers: {
      ...(isSession ? {} : { Authorization: `Bearer ${token}` }),
      ...(extra?.headers ?? {}),
    },
  };
}

/** True when this token is a real admin session rather than the emergency key. */
export function isSessionToken(token: string): boolean {
  return token.startsWith("session:");
}
