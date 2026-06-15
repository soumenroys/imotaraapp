// src/app/api/org/_auth.ts
// Auth guards for org API routes.
// Used in all /api/org/* route handlers to enforce membership and role.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";

export type OrgAuthResult =
  | { ok: true;  userId: string; orgId: string; role: string }
  | { ok: false; response: NextResponse };

/**
 * Resolves the current user's identity from cookie or Bearer token.
 * Returns null if no authenticated user found.
 */
async function resolveUserId(req: NextRequest): Promise<string | null> {
  // 1. Try Bearer token (mobile clients)
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await getSupabaseAdmin().auth.getUser(bearer);
    if (data?.user?.id) return data.user.id;
  }

  // 2. Try cookie-based session (web)
  const supabase = await getSupabaseUserServerClient();
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Reads the org_id the request is acting on.
 * Priority: X-Org-Id header → orgId path param → null.
 * Callers should pass the orgId from the URL when present.
 */
export function resolveOrgId(req: NextRequest, pathOrgId?: string): string | null {
  return pathOrgId ?? req.headers.get("x-org-id") ?? null;
}

/**
 * Guard: user must be an active member (any role) of the org.
 * Returns { ok: true, userId, orgId, role } or a 401/403 NextResponse.
 *
 * orgId resolution order:
 *   1. pathOrgId argument (explicit from URL)
 *   2. X-Org-Id request header (mobile clients)
 *   3. Auto-resolved from user's first active org membership (web dashboard — no header sent)
 */
export async function requireOrgMember(
  req:       NextRequest,
  pathOrgId?: string,
): Promise<OrgAuthResult> {
  const userId = await resolveUserId(req);
  if (!userId) {
    return {
      ok:       false,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }

  const admin = getSupabaseAdmin();
  const explicitOrgId = resolveOrgId(req, pathOrgId);

  if (explicitOrgId) {
    // Explicit org_id: verify membership directly
    const { data, error } = await admin
      .from("org_members")
      .select("role, status")
      .eq("org_id", explicitOrgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data || data.status !== "active") {
      return {
        ok:       false,
        response: NextResponse.json({ error: "not an org member" }, { status: 403 }),
      };
    }

    return { ok: true, userId, orgId: explicitOrgId, role: data.role };
  }

  // No explicit org_id — auto-resolve from user's active memberships.
  // Used by web dashboard pages that don't pass X-Org-Id.
  const { data: memberships, error: mErr } = await admin
    .from("org_members")
    .select("org_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1);

  if (mErr || !memberships || memberships.length === 0) {
    return {
      ok:       false,
      response: NextResponse.json({ error: "not an org member" }, { status: 403 }),
    };
  }

  const m = memberships[0];
  return { ok: true, userId, orgId: m.org_id, role: m.role };
}

/**
 * Guard: user must be an owner or admin of the org.
 * Returns { ok: true, userId, orgId, role } or a 401/403 NextResponse.
 */
export async function requireOrgAdmin(
  req:       NextRequest,
  pathOrgId?: string,
): Promise<OrgAuthResult> {
  const result = await requireOrgMember(req, pathOrgId);
  if (!result.ok) return result;

  if (result.role !== "owner" && result.role !== "admin") {
    return {
      ok:       false,
      response: NextResponse.json({ error: "org admin role required" }, { status: 403 }),
    };
  }

  return result;
}
