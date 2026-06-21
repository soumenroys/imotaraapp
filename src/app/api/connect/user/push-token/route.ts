export const preferredRegion = ["sin1"];

// PATCH /api/connect/user/push-token
// Saves the caller's Expo push token to their auth user metadata so the server
// can send push notifications (session accepted, declined, force-closed).
// Auth required (any authenticated user, not consultant-only).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function PATCH(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== "string" || token.length === 0 || token.length > 200) {
    return NextResponse.json({ ok: false, error: "Invalid push token" }, { status: 400 });
  }
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
    return NextResponse.json({ ok: false, error: "Invalid push token format" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { expo_connect_push_token: token },
  });

  if (error) {
    console.error("[user/push-token] update failed:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to save push token" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
