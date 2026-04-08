// src/app/api/account/delete/route.ts
//
// Permanently deletes a user's account and all associated data.
// Required for Apple App Store Guideline 5.1.1(v) — apps that support
// account creation must offer in-app account deletion.
//
// Steps performed:
//  1. Authenticate the caller via Bearer token (mobile) or cookie session (web)
//  2. Delete all synced history records for the user
//  3. Delete all companion memory entries for the user
//  4. Delete any push subscriptions for the user
//  5. Delete the Supabase auth user (permanent)
//
// The mobile app also clears local AsyncStorage before calling this endpoint.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";

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

  const admin = getSupabaseAdmin();
  const errors: string[] = [];

  // 1. Delete synced history records
  try {
    const { error } = await admin
      .from("imotara_history")
      .delete()
      .like("id", `${userId}:%`);
    if (error) errors.push(`history: ${error.message}`);
  } catch (e) {
    errors.push(`history: ${String(e)}`);
  }

  // 2. Delete companion memory entries
  try {
    const { error } = await admin
      .from("imotara_memory")
      .delete()
      .eq("user_id", userId);
    if (error) errors.push(`memory: ${error.message}`);
  } catch (e) {
    errors.push(`memory: ${String(e)}`);
  }

  // 3. Delete push subscriptions
  try {
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId);
    if (error) errors.push(`push: ${error.message}`);
  } catch (e) {
    errors.push(`push: ${String(e)}`);
  }

  // 4. Delete the auth user (must be last)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json(
      { error: "failed_to_delete_auth_user", detail: authError.message, partialErrors: errors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    deletedAt: new Date().toISOString(),
    partialErrors: errors.length > 0 ? errors : undefined,
  });
}
