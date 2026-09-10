// src/app/api/admin/licenses/route.ts
// GET  /api/admin/licenses?search=&page=0&limit=20&excludeAnonymous=1
//                                                   — list/search users with licenses
// POST /api/admin/licenses                          — assign or create a license (upsert)
// Protected by ADMIN_SECRET Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  if (!await adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim() || null;
  const rawPage  = parseInt(req.nextUrl.searchParams.get("page")  ?? "0",  10);
  const rawLimit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);
  const page  = Number.isFinite(rawPage)  ? Math.max(0, rawPage) : 0;
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;
  // The mobile app signs people in anonymously by default, so every guest
  // occupies a row in auth.users. Hiding them has to happen in the query, not
  // afterwards: filtering the returned page would return fewer than `limit`
  // rows AND still skip the people it excluded.
  const excludeAnonymous = req.nextUrl.searchParams.get("excludeAnonymous") === "1";

  const supabase = getSupabaseAdmin();

  let { data, error } = await supabase.rpc("admin_search_users_with_licenses", {
    search_email:      search,
    page_offset:       page * limit,
    page_limit:        limit,
    exclude_anonymous: excludeAnonymous,
  });

  // The exclude_anonymous argument, and the is_anonymous / total_count columns,
  // arrive with docs/sql/admin_v4_licenses_pagination.sql. If the code is
  // deployed before that migration is run, PostgREST cannot resolve the
  // four-argument signature and every request 404s — which would take the whole
  // licenses screen down rather than just this one filter. Retry once with the
  // old signature so the screen keeps working, unfiltered, until the migration
  // lands.
  let filterUnavailable = false;
  if (error && /Could not find the function|PGRST202|does not exist/i.test(`${error.message} ${error.code ?? ""}`)) {
    console.warn("[admin/licenses GET] admin_v4 migration not applied — falling back to the 3-arg RPC");
    filterUnavailable = true;
    ({ data, error } = await supabase.rpc("admin_search_users_with_licenses", {
      search_email: search,
      page_offset:  page * limit,
      page_limit:   limit,
    }));
  }

  if (error) {
    console.error("[admin/licenses GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = data ?? [];
  // total_count rides on every row (count(*) over ()). Absent on the fallback
  // path, in which case the UI pages by "did we get a full page?" instead.
  const total = users.length > 0 && typeof users[0]?.total_count === "number"
    ? Number(users[0].total_count)
    : null;

  return NextResponse.json({ users, total, page, limit, filterUnavailable });
}

export async function POST(req: NextRequest) {
  if (!await adminAuthorized(req)) {
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
