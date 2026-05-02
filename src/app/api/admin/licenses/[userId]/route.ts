// src/app/api/admin/licenses/[userId]/route.ts
// GET   — user auth info + license row + payment history + admin history
// PATCH — partial update: tier / status / expiresAt / tokenBalance (absolute) / tokenDelta (relative) / notes

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized } from "@/app/api/admin/_auth";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const supabase = getSupabaseAdmin();

  const [licenseRes, historyRes, userRes, paymentRes] = await Promise.all([
    supabase.from("licenses").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("admin_license_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("payment_licenses")
      .select("payment_id, product_id, tier, amount_paise, currency, granted_at")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false })
      .limit(20),
  ]);

  const authUser = userRes.data?.user ?? null;

  return NextResponse.json({
    user: authUser
      ? {
          id:               authUser.id,
          email:            authUser.email ?? null,
          emailVerified:    !!authUser.email_confirmed_at,
          lastSignInAt:     authUser.last_sign_in_at ?? null,
          provider:         (authUser.app_metadata?.provider as string) ?? null,
          providers:        (authUser.app_metadata?.providers as string[]) ?? [],
          createdAt:        authUser.created_at,
        }
      : null,
    license:  licenseRes.data ?? null,
    history:  historyRes.data ?? [],
    payments: paymentRes.data ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  const {
    userEmail,
    tier,
    status,
    expiresAt,
    tokenBalance,   // absolute — set token_balance to this value
    tokenDelta,     // relative — add this amount (positive or negative) to existing balance
    notes,
    adminLabel,
  } = body as {
    userEmail: string;
    tier?: string;
    status?: string;
    expiresAt?: string | null;
    tokenBalance?: number;
    tokenDelta?: number;
    notes?: string | null;
    adminLabel?: string;
  };

  if (!userEmail) {
    return NextResponse.json({ error: "userEmail is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch or create license row
  const { data: existing } = await supabase
    .from("licenses")
    .select("tier, status, expires_at, token_balance")
    .eq("user_id", userId)
    .maybeSingle();

  // Auto-create a free license row if none exists yet
  if (!existing) {
    await supabase.from("licenses").insert({
      user_id:       userId,
      tier:          tier ?? "free",
      status:        status ?? "valid",
      expires_at:    expiresAt ?? null,
      token_balance: tokenBalance ?? (tokenDelta ?? 0),
      source:        "manual",
      notes:         notes ?? null,
    });

    await supabase.from("admin_license_history").insert({
      admin_label:       adminLabel ?? "admin",
      user_id:           userId,
      user_email:        userEmail,
      action:            "assign",
      old_tier:          null,
      new_tier:          tier ?? "free",
      old_status:        null,
      new_status:        status ?? "valid",
      old_expires_at:    null,
      new_expires_at:    expiresAt ?? null,
      old_token_balance: null,
      new_token_balance: tokenBalance ?? (tokenDelta ?? 0),
      notes:             notes ?? null,
    });

    return NextResponse.json({ ok: true, action: "assign" });
  }

  // Resolve new token balance
  let resolvedBalance = existing.token_balance ?? 0;
  if (tokenBalance !== undefined) {
    resolvedBalance = tokenBalance; // absolute override
  } else if (tokenDelta !== undefined) {
    resolvedBalance = Math.max(0, resolvedBalance + tokenDelta); // relative, floor at 0
  }

  // Build update payload
  const updates: Record<string, unknown> = {
    source:     "manual",
    updated_at: new Date().toISOString(),
  };
  if (tier         !== undefined)                              updates.tier          = tier;
  if (status       !== undefined)                              updates.status        = status;
  if (expiresAt    !== undefined)                              updates.expires_at    = expiresAt;
  if (tokenBalance !== undefined || tokenDelta !== undefined)  updates.token_balance = resolvedBalance;
  if (notes        !== undefined)                              updates.notes         = notes;

  const { error: updateErr } = await supabase
    .from("licenses")
    .update(updates)
    .eq("user_id", userId);

  if (updateErr) {
    console.error("[admin/licenses PATCH]", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Derive action label for history
  const resolvedTier   = tier   ?? existing.tier;
  const resolvedStatus = status ?? existing.status;
  const resolvedExpiry = expiresAt !== undefined ? expiresAt : (existing.expires_at ?? null);

  let action = "status_change";
  if (resolvedStatus === "invalid")                                              action = "withdraw";
  else if (tier !== undefined && tier !== existing.tier)                         action = "tier_change";
  else if (expiresAt !== undefined && expiresAt !== (existing.expires_at ?? null)) action = "extend";
  else if (tokenBalance !== undefined || tokenDelta !== undefined)               action = "token_adjust";

  await supabase.from("admin_license_history").insert({
    admin_label:       adminLabel ?? "admin",
    user_id:           userId,
    user_email:        userEmail,
    action,
    old_tier:          existing.tier          ?? null,
    new_tier:          resolvedTier,
    old_status:        existing.status        ?? null,
    new_status:        resolvedStatus,
    old_expires_at:    existing.expires_at    ?? null,
    new_expires_at:    resolvedExpiry,
    old_token_balance: existing.token_balance ?? null,
    new_token_balance: resolvedBalance,
    notes:             notes ?? null,
  }).then(({ error: hErr }) => {
    if (hErr) console.error("[admin/licenses PATCH history]", hErr.message);
  });

  return NextResponse.json({ ok: true, action });
}
