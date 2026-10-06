// src/lib/connect/scope.ts
// Organisation scoping for all /api/connect/* routes. Step 2 of the Connect
// org-scoping plan (step 1 = docs/sql/connect_org_scoping_step1.sql).
//
// 🔴 WHY THIS IS ONE FILE AND NOT A FILTER PER ROUTE
// Connect has 28 route handlers. "Remember to add the org filter" is a rule that
// holds for 27 of them and then quietly fails on the 28th — and a missing scope
// filter does not throw, it just returns somebody else's data. So every read
// that can expose another organisation's people or sessions goes through the
// three helpers below, and the guard tests target THESE, not each call site.
//
// 🔑 FAIL CLOSED, in the direction that matters
// If we cannot establish which org the caller belongs to, we treat them as
// having none — which shows LESS (public only), never more. The session guard
// is stricter still: any error denies.

import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export interface ConnectScope {
  /** Authenticated user, or null for anonymous browsing. */
  userId: string | null;
  /** The caller's active organisation, or null if they are not in one. */
  orgId: string | null;
  /** Their role in that org ('owner' | 'admin' | 'member'), or null. */
  orgRole: string | null;
  /**
   * Whether this caller may see the public marketplace.
   * True for everyone without an org. For org members it follows the org's own
   * `connect_allow_public` setting (default true — see org_allows_public_connect).
   */
  allowsPublic: boolean;
}

/** Anonymous/no-org callers see the public marketplace and nothing else. */
const PUBLIC_ONLY: ConnectScope = {
  userId: null, orgId: null, orgRole: null, allowsPublic: true,
};

/**
 * Resolves who is asking and which organisation they are acting within.
 *
 * ⚠️ A user with several active memberships resolves to their earliest one, the
 * same rule requireOrgMember() already uses for the web dashboard. No user has
 * more than one active membership today; if that changes, this is the single
 * place that needs an explicit org selector rather than 28 of them.
 */
export async function getConnectScope(req: Request): Promise<ConnectScope> {
  const user = await getConnectUser(req);
  if (!user) return PUBLIC_ONLY;

  const { data, error } = await supabaseServer
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1);

  // Could not read membership → treat as no org. This shows public-only, i.e.
  // strictly less than they might be entitled to, never another org's people.
  if (error || !data?.length) {
    return { userId: user.id, orgId: null, orgRole: null, allowsPublic: true };
  }

  const orgId = data[0].org_id as string;
  const orgRole = (data[0].role as string) ?? null;

  // The per-org marketplace switch. Defaults to true inside the function, so an
  // org that has never touched the setting behaves exactly as it does today.
  const { data: allows, error: allowErr } = await supabaseServer
    .rpc("org_allows_public_connect", { p_org_id: orgId });

  return {
    userId: user.id,
    orgId,
    orgRole,
    allowsPublic: allowErr ? true : (allows as boolean) !== false,
  };
}

/**
 * The ONE visibility rule for reading consultants.
 *
 * - no org          → public only
 * - org + public on → public OR their own org's people
 * - org + public off→ their own org's people only
 *
 * 🔑 An org's OWN consultants are always included, whatever the switch says.
 * Turning off the marketplace must never leave a member with nobody to talk to.
 *
 * Typed loosely on purpose: Supabase's builder generics differ between a
 * select() and a select(..., { count }) chain, and this must apply to both.
 */
export function applyConsultantVisibility<T extends {
  eq: (col: string, val: unknown) => T;
  or: (filter: string) => T;
}>(query: T, scope: ConnectScope): T {
  if (!scope.orgId) {
    return query.eq("visibility", "public");
  }
  if (!scope.allowsPublic) {
    return query.eq("org_id", scope.orgId);
  }
  return query.or(`visibility.eq.public,org_id.eq.${scope.orgId}`);
}

export interface ScopedSession {
  id: string;
  user_id: string;
  consultant_id: string;
  /** The org the session belonged to AT CREATION. A historical fact, not a join. */
  org_id: string | null;
}

export type SessionAccess =
  | { ok: true;  session: ScopedSession }
  | { ok: false; status: 403 | 404 };

/**
 * The ONE rule for touching a session — and anything hanging off it (messages,
 * notes, reviews, ticks, balance).
 *
 * Allowed: the member whose session it is, the consultant who took it, or an
 * owner/admin of the org the session was STAMPED with at creation.
 *
 * ⚠️ Deliberately checks the session's stamped org_id, not the caller's current
 * org. A member who later leaves must not keep access, and an admin whose org
 * the session never belonged to must never gain it.
 *
 * Returns 404 rather than 403 for a session the caller may not see, so the API
 * does not confirm that someone else's session id exists.
 */
export async function assertSessionAccess(
  sessionId: string,
  scope: ConnectScope,
): Promise<SessionAccess> {
  if (!scope.userId) return { ok: false, status: 403 };

  const { data, error } = await supabaseServer
    .from("connect_sessions")
    .select("id, user_id, consultant_id, org_id")
    .eq("id", sessionId)
    .maybeSingle();

  // Any read failure denies. This is the strict direction: a session is private
  // by default, so "we don't know" must mean "no".
  if (error || !data) return { ok: false, status: 404 };

  const session = data as ScopedSession;

  if (session.user_id === scope.userId) return { ok: true, session };

  // The consultant who took the session, identified by their consultant row.
  const { data: consultant } = await supabaseServer
    .from("connect_consultants")
    .select("id")
    .eq("user_id", scope.userId)
    .maybeSingle();
  if (consultant && consultant.id === session.consultant_id) {
    return { ok: true, session };
  }

  // An org admin may see sessions stamped with THEIR org — and only those.
  if (
    session.org_id &&
    scope.orgId &&
    session.org_id === scope.orgId &&
    (scope.orgRole === "owner" || scope.orgRole === "admin")
  ) {
    return { ok: true, session };
  }

  return { ok: false, status: 404 };
}
