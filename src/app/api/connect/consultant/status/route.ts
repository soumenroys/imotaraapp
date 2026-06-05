// PATCH /api/connect/consultant/status
// Auth required. Approved consultants toggle their is_online status.
// Body: { is_online: boolean }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function PATCH(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body.is_online !== "boolean") {
    return NextResponse.json({ ok: false, error: "is_online (boolean) required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Consultant profile not found" }, { status: 404 });
  }
  if (consultant.status !== "approved") {
    return NextResponse.json({ ok: false, error: "Account not approved yet" }, { status: 403 });
  }

  const { error } = await supabase
    .from("connect_consultants")
    .update({ is_online: body.is_online })
    .eq("id", consultant.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_online: body.is_online });
}
