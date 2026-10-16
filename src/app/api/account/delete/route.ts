// src/app/api/account/delete/route.ts
//
// Permanently deletes a user's account and all associated data.
// Required for Apple App Store Guideline 5.1.1(v) — apps that support
// account creation must offer in-app account deletion.
//
// Steps performed:
//  1. Authenticate the caller via Bearer token (mobile) or cookie session (web)
//  2. Delete all synced history records for the user
//  3. Delete all companion memory entries (incl. push subscriptions in user_memory)
//  4. Delete license, payment_licenses, and usage_events rows
//  5. Delete the Supabase auth user (permanent)
//
// The mobile app also clears local AsyncStorage before calling this endpoint.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { purgeUserData } from "@/lib/account/purgeUserData";

async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // 1. Bearer token (mobile)
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (bearerToken) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.auth.getUser(bearerToken);
    if (data?.user?.id) return data.user.id;
  }

  // 2. Cookie session (web)
  try {
    const supabase = await supabaseUserServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {
    // no cookie session
  }

  return null;
}

export async function DELETE(req: Request) {
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 🔑 ONE shared cascade, also used by the retention cron. Two hand-kept
  // delete paths drift, and the one that drifts is the one nobody watches.
  // ⇒ src/lib/account/purgeUserData.ts
  const { errors, authDeleted } = await purgeUserData(userId);

  if (!authDeleted) {
    return NextResponse.json(
      { error: "failed_to_delete_auth_user", partialErrors: errors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    deletedAt: new Date().toISOString(),
    partialErrors: errors.length > 0 ? errors : undefined,
  });
}
