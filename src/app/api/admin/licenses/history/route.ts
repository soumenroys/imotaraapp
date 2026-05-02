// src/app/api/admin/licenses/history/route.ts
// GET /api/admin/licenses/history?userId=&page=0&limit=50
// Returns paginated admin_license_history rows; optionally filtered to one user.
// Protected by ADMIN_SECRET Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || null;
  const page   = Math.max(0, parseInt(req.nextUrl.searchParams.get("page")  ?? "0",  10));
  const limit  = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10));

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("admin_license_history")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;

  if (error) {
    console.error("[admin/licenses/history GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
