// src/lib/admin/userListFilters.ts
// Admin ⇒ Licenses ⇒ User Licenses: the filters, and the Indian-time display
// (owner, 6 Nov 2026 — task #86). ⇒ docs/sql/admin_v5_users_activity.sql
//
// Every value is checked against a fixed list here, so nothing the browser
// sends reaches the database except one of these words, a whole number of
// days, or a date the server built itself.

export const TIERS = ["free", "plus", "family", "none"] as const;
export const STATUSES = ["trial", "valid", "cancelling", "expired", "invalid"] as const;
export const PLATFORMS = ["web", "android", "ios", "unknown"] as const;
export const ACTIVE_DAYS = [0, 1, 7, 30, 90] as const; // 0 = never active
export const SORTS = ["updated", "last_active", "messages", "joined"] as const;

export type UserListFilters = {
  tier: (typeof TIERS)[number] | null;
  status: (typeof STATUSES)[number] | null;
  platform: (typeof PLATFORMS)[number] | null;
  activeDays: (typeof ACTIVE_DAYS)[number] | null;
  joinedFrom: string | null; // ISO instant, start of that day in IST
  joinedTo: string | null;   // ISO instant, start of the NEXT day in IST (exclusive)
  sort: (typeof SORTS)[number];
};

function pick<T extends readonly (string | number)[]>(list: T, v: string | null | undefined): T[number] | null {
  if (v == null || v === "") return null;
  const hit = list.find((x) => String(x) === v);
  return hit === undefined ? null : hit;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-06" ⇒ the instant that day starts in India (IST = UTC+5:30, no DST). */
export function istDayStart(day: string | null | undefined, addDays = 0): string | null {
  const m = day ? DAY.exec(day) : null;
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3] + addDays) - 330 * 60_000;
  const d = new Date(utc);
  // Reject 2026-02-31 and the like: the day must survive the round trip.
  const back = new Date(utc + 330 * 60_000);
  if (addDays === 0 && (back.getUTCMonth() !== +m[2] - 1 || back.getUTCDate() !== +m[3])) return null;
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function parseUserListFilters(q: URLSearchParams): UserListFilters {
  const fromOk = istDayStart(q.get("joinedFrom"));
  const toOk = istDayStart(q.get("joinedTo"));
  return {
    tier: pick(TIERS, q.get("tier")),
    status: pick(STATUSES, q.get("status")),
    platform: pick(PLATFORMS, q.get("platform")),
    activeDays: pick(ACTIVE_DAYS, q.get("activeDays")),
    joinedFrom: fromOk,
    joinedTo: toOk ? istDayStart(q.get("joinedTo"), 1) : null,
    sort: pick(SORTS, q.get("sort")) ?? "updated",
  };
}

/** True when the old (v4) query could answer this exactly. */
export function needsActivityQuery(f: UserListFilters): boolean {
  return !!(f.tier || f.status || f.platform || f.activeDays !== null || f.joinedFrom || f.joinedTo || f.sort !== "updated");
}

/** "7 Nov 2026, 9:05 pm IST" — always India time, whatever the admin's computer says. */
export function formatIST(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const s = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(t));
  return `${s} IST`;
}
