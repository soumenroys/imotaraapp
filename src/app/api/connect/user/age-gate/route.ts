// PATCH /api/connect/user/age-gate
// Saves the user's age-gate status to Supabase user_metadata so Connect
// API routes can enforce age server-side.

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function PATCH(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { restricted } = body ?? {};
  if (typeof restricted !== "boolean") {
    return NextResponse.json({ ok: false, error: "restricted must be a boolean" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { connect_age_restricted: restricted },
  });

  if (error) {
    console.error("[age-gate] updateUser error:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to save age status" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
