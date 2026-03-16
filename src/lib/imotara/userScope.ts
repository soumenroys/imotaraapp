// src/lib/imotara/userScope.ts
//
// Shared utility to derive a stable per-user scope id.
// Used by chat/page.tsx and EmotionHistory for /api/history scoped requests.

const PROFILE_KEY = "imotara.profile.v1";
const LOCAL_USER_KEY = "imotara.localUserId.v1";

function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(LOCAL_USER_KEY);
  if (existing && existing.trim()) return existing.trim();
  const created =
    Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
  window.localStorage.setItem(LOCAL_USER_KEY, created);
  return created;
}

/** Returns the profile id if available, else a stable device-local id. */
export function getUserScopeId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const prof = JSON.parse(raw) as { id?: string };
      const pid = typeof prof?.id === "string" ? prof.id.trim() : "";
      if (pid) return pid;
    }
  } catch {
    // ignore parse error
  }
  return getOrCreateLocalUserId();
}
