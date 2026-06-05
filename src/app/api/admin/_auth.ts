// src/app/api/admin/_auth.ts
// Admin authentication — supports two modes:
//   1. Session cookie (new multi-user system) — preferred
//   2. ADMIN_SECRET Bearer token (legacy / emergency fallback)
// All existing routes using adminAuthorized() continue to work unchanged.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/imotara/adminCrypto";

// ── adminAuthorized: checks ADMIN_SECRET Bearer OR session cookie ─────────────
// connect_reviewer role is intentionally excluded — they use connectAdminAuthorized().
export async function adminAuthorized(req: NextRequest): Promise<boolean> {
  // 1. Check session cookie first (preferred)
  const cookieResult = await requireSuperAdmin(req);
  if (cookieResult.ok) {
    // connect_reviewer is scoped only to Connect routes
    if (cookieResult.admin.role === "connect_reviewer") return false;
    return true;
  }

  // 2. Legacy ADMIN_SECRET Bearer — disabled when ADMIN_SECRET_DISABLED=true
  if (process.env.ADMIN_SECRET_DISABLED === "true") return false;

  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth     = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

// ── New: session-based multi-user super-admin ─────────────────────────────────

export interface SuperAdminInfo {
  id:    string;
  email: string;
  name:  string;
  role:  "owner" | "admin" | "connect_reviewer";
}

export type SuperAdminResult =
  | { ok: true;  admin: SuperAdminInfo }
  | { ok: false; response: NextResponse };

/**
 * Validates a super-admin request via:
 *   1. httpOnly session cookie (new system)
 *   2. ADMIN_SECRET Bearer fallback (legacy / emergency)
 *
 * Use this for any new admin API routes.
 * Existing routes using adminAuthorized() remain unchanged.
 */
export async function requireSuperAdmin(req: NextRequest): Promise<SuperAdminResult> {
  // ── 1. Try session cookie ──────────────────────────────────────────────────
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      const tokenHash = hashSessionToken(token);
      const supabase  = getSupabaseAdmin();

      const { data: session } = await supabase
        .from("admin_sessions")
        .select("admin_id, expires_at")
        .eq("token_hash", tokenHash)
        .single();

      if (session && new Date(session.expires_at) > new Date()) {
        const { data: admin } = await supabase
          .from("super_admins")
          .select("id, email, name, role, active")
          .eq("id", session.admin_id)
          .single();

        if (admin?.active) {
          return {
            ok:    true,
            admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role as "owner" | "admin" },
          };
        }
      }
    }
  } catch {
    // DB not ready or table doesn't exist — fall through to legacy
  }

  // ── 2. Legacy ADMIN_SECRET fallback ───────────────────────────────────────
  const secret = process.env.ADMIN_SECRET?.trim();
  if (secret) {
    const auth     = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret}`;
    if (auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
      return {
        ok:    true,
        admin: { id: "legacy", email: "admin@imotara.com", name: "Admin (legacy key)", role: "owner" as const },
      };
    }
  }

  return {
    ok:       false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  };
}

/**
 * Like adminAuthorized but also allows connect_reviewer role.
 * Use this on all /api/admin/connect/* routes.
 */
export async function connectAdminAuthorized(req: NextRequest): Promise<boolean> {
  const cookieResult = await requireSuperAdmin(req);
  if (cookieResult.ok) return true;

  if (process.env.ADMIN_SECRET_DISABLED === "true") return false;
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth     = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}
