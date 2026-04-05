// src/app/api/admin/comments/[id]/route.ts
// PATCH  → approve comment
// DELETE → delete comment
// Protected by ADMIN_SECRET env var (Bearer token)

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = supabaseServer();

  const { error } = await supabase
    .from("blog_comments")
    .update({ approved: true })
    .eq("id", id);

  if (error) {
    console.error("[admin/comments PATCH]", error.message);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = supabaseServer();

  const { error } = await supabase
    .from("blog_comments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[admin/comments DELETE]", error.message);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
