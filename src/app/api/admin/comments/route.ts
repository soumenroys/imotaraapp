// src/app/api/admin/comments/route.ts
// GET /api/admin/comments?status=pending|approved|all
// Protected by ADMIN_SECRET env var (Bearer token)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("blog_comments")
    .select("id, slug, name, message, approved, created_at")
    .order("created_at", { ascending: false });

  if (status === "pending") query = query.eq("approved", false);
  else if (status === "approved") query = query.eq("approved", true);
  // "all" — no filter

  const { data, error } = await query;
  if (error) {
    console.error("[admin/comments GET]", error.message);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  return NextResponse.json({ comments: data ?? [] });
}
