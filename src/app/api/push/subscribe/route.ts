// src/app/api/push/subscribe/route.ts
// POST — save a push subscription for the authenticated user
// DELETE — remove the subscription

import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";

async function getAuthedUserId(req: Request): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (bearerToken) {
    const { data } = await admin.auth.getUser(bearerToken);
    if (data?.user?.id) return data.user.id;
  }
  try {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch { /* no session */ }
  return null;
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let subscription: any;
  try {
    subscription = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await admin.from("user_memory").upsert(
    {
      user_id: userId,
      type: "push",
      key: "subscription",
      value: JSON.stringify(subscription),
      confidence: 1,
      updated_at: now,
    },
    { onConflict: "user_id,type,key" },
  );

  if (error) {
    console.error("[push/subscribe] upsert error:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  await admin
    .from("user_memory")
    .delete()
    .eq("user_id", userId)
    .eq("type", "push");

  return NextResponse.json({ ok: true });
}
