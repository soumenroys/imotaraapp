// src/lib/auth/cleanupUnconfirmed.ts — #134 (12 Nov 2026): remove email sign-ups that were never finished.
//
// Asking for a sign-in code creates the account first (lib/auth/issueEmailCode.ts). Someone who asks
// and never types the code leaves an empty, unconfirmed account behind — this tidies those away
// every night (api/cron/data-retention).
//
// ⛔ SAFE BY CONSTRUCTION — only an account that:
//    · signed up by EMAIL only (no Google / Apple / other identity),
//    · never confirmed its email AND never signed in (so it never had a session and cannot have
//      written any history or data of its own),
//    · is more than 24 hours old (a code is valid for one hour; an org invite for 24),
//    · is NOT in any organisation (admin-invited people wait unconfirmed until they accept),
//    · holds no licence above free.
// Pure filter tested ⇒ emailSignupCleanup.test.ts
import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;
export const MAX_DELETES_PER_RUN = 200;

/** The account-only checks (no database). */
export function looksAbandoned(u: Pick<User, "email_confirmed_at" | "last_sign_in_at" | "created_at" | "identities" | "is_anonymous">, now: number): boolean {
  if (u.is_anonymous) return false;
  if (u.email_confirmed_at || u.last_sign_in_at) return false;
  if (!u.created_at || now - new Date(u.created_at).getTime() < ABANDON_AFTER_MS) return false;
  const ids = (u.identities ?? []).map((i) => i.provider);
  return ids.length === 0 || ids.every((p) => p === "email");
}

export async function cleanupUnconfirmedEmailAccounts(admin: SupabaseClient, now = Date.now()): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  const candidates: string[] = [];
  for (let page = 1; page <= 50 && candidates.length < MAX_DELETES_PER_RUN; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { errors.push(`list p${page}: ${error.message}`); break; }
    for (const u of data.users) if (looksAbandoned(u, now)) candidates.push(u.id);
    if (data.users.length < 1000) break;
  }
  if (candidates.length === 0) return { deleted: 0, errors };

  const ids = candidates.slice(0, MAX_DELETES_PER_RUN);
  // Anyone in an organisation, or with a licence above free, is kept — whatever their state.
  const [{ data: members }, { data: lic }] = await Promise.all([
    admin.from("org_members").select("user_id").in("user_id", ids),
    admin.from("licenses").select("user_id, tier").in("user_id", ids),
  ]);
  const keep = new Set<string>([
    ...((members ?? []) as { user_id: string }[]).map((m) => m.user_id),
    ...((lic ?? []) as { user_id: string; tier: string }[]).filter((l) => l.tier && l.tier !== "free").map((l) => l.user_id),
  ]);

  let deleted = 0;
  for (const id of ids) {
    if (keep.has(id)) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) errors.push(`delete ${id}: ${error.message}`); else deleted += 1;
  }
  return { deleted, errors };
}
