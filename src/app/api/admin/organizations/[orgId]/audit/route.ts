// src/app/api/admin/organizations/[orgId]/audit/route.ts
// GET /api/admin/organizations/:orgId/audit?page=0&limit=25 — super-admin read-only
// view of an org's audit log. The org's own admins already see this at
// /org/dashboard/audit; previously Imotara superadmin had no equivalent view
// anywhere and could only see it by querying the database directly.

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const page  = parseInt(req.nextUrl.searchParams.get("page")  ?? "0",  10);
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "25", 10));

  const admin = getSupabaseAdmin();
  const { data, count, error } = await admin
    .from("org_audit_log")
    .select("id, action, actor_email, actor_role, target_email, changes, notes, created_at", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [], total: count ?? 0, page, limit });
}
