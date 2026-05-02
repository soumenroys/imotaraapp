// src/app/api/admin/licenses/route.ts
// GET  /api/admin/licenses?search=&page=0&limit=20  — list/search users with licenses
// POST /api/admin/licenses                          — assign or create a license (upsert)
// Protected by ADMIN_SECRET Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim() || null;
  const page   = Math.max(0, parseInt(req.nextUrl.searchParams.get("page")  ?? "0",  10));
  const limit  = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10));

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("admin_search_users_with_licenses", {
    search_email: search,
    page_offset:  page * limit,
    page_limit:   limit,
  });

  if (error) {
    console.error("[admin/licenses GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  const { userId, userEmail, tier, status, expiresAt, tokenBalance, notes, adminLabel } = body as {
    userId: string;
    userEmail: string;
    tier: string;
    status: string;
    expiresAt?: string | null;
    tokenBalance?: number;
    notes?: string | null;
    adminLabel?: string;
  };

  if (!userId || !userEmail || !tier || !status) {
    return NextResponse.json(
      { error: "userId, userEmail, tier, and status are required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  // Read existing row for history diff
  const { data: existing } = await supabase
    .from("licenses")
    .select("tier, status, expires_at, token_balance")
    .eq("user_id", userId)
    .maybeSingle();

  // Upsert (insert or overwrite) the license row
  const { error: upsertErr } = await supabase.from("licenses").upsert(
    {
      user_id:       userId,
      tier,
      status,
      expires_at:    expiresAt ?? null,
      token_balance: tokenBalance ?? 0,
      source:        "manual",
      notes:         notes ?? null,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertErr) {
    console.error("[admin/licenses POST upsert]", upsertErr.message);
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Derive action label for the history record
  let action = "assign";
  if (existing) {
    if (status === "invalid")                        action = "withdraw";
    else if (tier !== existing.tier)                 action = "tier_change";
    else if (expiresAt !== (existing.expires_at ?? null)) action = "extend";
    else if ((tokenBalance ?? 0) !== (existing.token_balance ?? 0)) action = "token_adjust";
    else                                             action = "status_change";
  }

  // Write history record (non-fatal if it fails)
  await supabase.from("admin_license_history").insert({
    admin_label:        adminLabel ?? "admin",
    user_id:            userId,
    user_email:         userEmail,
    action,
    old_tier:           existing?.tier ?? null,
    new_tier:           tier,
    old_status:         existing?.status ?? null,
    new_status:         status,
    old_expires_at:     existing?.expires_at ?? null,
    new_expires_at:     expiresAt ?? null,
    old_token_balance:  existing?.token_balance ?? null,
    new_token_balance:  tokenBalance ?? 0,
    notes:              notes ?? null,
  }).then(({ error: hErr }) => {
    if (hErr) console.error("[admin/licenses POST history]", hErr.message);
  });

  return NextResponse.json({ ok: true, action });
}
