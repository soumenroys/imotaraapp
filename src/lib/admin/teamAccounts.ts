// src/lib/admin/teamAccounts.ts
//
// #76 (owner, 10 Nov 2026): our own team's and test accounts' chats must not
// count as product usage in Admin → Analytics.
//
// ⛔ THE EMAILS ARE NOT IN THIS FILE. The repository is public; the list lives
// in the database: app_settings, key "team_accounts", value { "emails": [...] }.
// Edit that row to add or remove an account — no deploy needed.
//
// ⚠️ Read-only for the admin dashboard. Nothing here touches the reply path,
// quotas or what any user sees.

import type { SupabaseClient } from "@supabase/supabase-js";

export const TEAM_ACCOUNTS_KEY = "team_accounts";

/** The configured emails, lower-cased; [] when the row is missing or malformed. */
export function teamEmailsFrom(value: unknown): string[] {
  const emails = (value as { emails?: unknown } | null | undefined)?.emails;
  if (!Array.isArray(emails)) return [];
  return emails
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/**
 * The user ids behind the team emails. ⛔ Any failure ⇒ an empty set: the
 * dashboard then shows everyone, exactly as before — never an error page.
 */
export async function teamUserIds(db: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const { data } = await db.from("app_settings").select("value").eq("key", TEAM_ACCOUNTS_KEY).maybeSingle();
    const emails = new Set(teamEmailsFrom(data?.value));
    if (emails.size === 0) return ids;
    for (let page = 1; page <= 50; page++) {
      const { data: list, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !list) break;
      for (const u of list.users) {
        if (u.email && emails.has(u.email.toLowerCase())) ids.add(u.id);
      }
      if (list.users.length < 1000) break;
    }
  } catch {
    return new Set();
  }
  return ids;
}
