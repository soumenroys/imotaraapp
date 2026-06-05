// GET   /api/admin/connect/consultants — list all (all statuses)
// PATCH /api/admin/connect/consultants — suspend / reinstate / reject a consultant
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("connect_consultants")
    .select(
      "id, user_id, display_name, gender, photo_url, status, bio, expertise_tags, " +
      "languages, rate_per_min, currency_code, is_online, rating_avg, " +
      "sessions_completed, availability_note, availability_windows, " +
      "contact_email, contact_phone, website_url, social_links, " +
      "payout_info, digital_signature, rejection_reason, approval_note, created_at"
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, consultants: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.id || !body.action) {
    return NextResponse.json({ ok: false, error: "id and action required" }, { status: 400 });
  }

  const { id, action, reason } = body;
  const VALID_ACTIONS = ["suspend", "reinstate", "reject"];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "action must be suspend, reinstate, or reject" }, { status: 400 });
  }

  const statusMap: Record<string, string> = {
    suspend:   "suspended",
    reinstate: "approved",
    reject:    "rejected",
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("connect_consultants")
    .update({
      status:           statusMap[action],
      rejection_reason: reason?.trim() ?? null,
      is_online:        action !== "reinstate" ? false : undefined,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: statusMap[action] });
}
