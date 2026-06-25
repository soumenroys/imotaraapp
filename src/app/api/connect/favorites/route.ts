// GET    /api/connect/favorites        — list user's favorited consultants
// POST   /api/connect/favorites        — add favorite  { consultant_id }
// DELETE /api/connect/favorites        — remove        { consultant_id }
// Auth required.

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  // Join connect_consultants to filter out soft-deleted consultants — a cascade
  // DELETE only fires on hard-delete, so soft-deleted (status='deleted') rows remain
  // in connect_favorites until explicitly removed. Returning deleted consultant IDs
  // breaks the browse UI with empty/missing cards.
  const { data, error } = await supabase
    .from("connect_favorites")
    .select("consultant_id, created_at, connect_consultants!inner(status)")
    .eq("user_id", user.id)
    .neq("connect_consultants.status", "deleted")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[favorites] DB error:", error.message);
    return NextResponse.json({ ok: false, error: "Operation failed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, favorites: (data ?? []).map((f) => f.consultant_id) });
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { consultant_id } = body ?? {};
  if (!consultant_id) return NextResponse.json({ ok: false, error: "consultant_id required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Validate consultant exists and is approved
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id")
    .eq("id", consultant_id)
    .eq("status", "approved")
    .maybeSingle();
  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  // Cap at 100 favorites per user
  const { count } = await supabase
    .from("connect_favorites")
    .select("consultant_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 100) {
    return NextResponse.json({ ok: false, error: "Favorites limit reached (100 max)" }, { status: 429 });
  }

  const { error } = await supabase
    .from("connect_favorites")
    .upsert({ user_id: user.id, consultant_id }, { onConflict: "user_id,consultant_id", ignoreDuplicates: true });

  if (error) {
    console.error("[favorites] DB error:", error.message);
    return NextResponse.json({ ok: false, error: "Operation failed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { consultant_id } = body ?? {};
  if (!consultant_id) return NextResponse.json({ ok: false, error: "consultant_id required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("connect_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("consultant_id", consultant_id);

  if (error) {
    console.error("[favorites] DB error:", error.message);
    return NextResponse.json({ ok: false, error: "Operation failed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
