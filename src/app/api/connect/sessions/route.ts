// GET  /api/connect/sessions — user's session list
// POST /api/connect/sessions — create a new session
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("connect_sessions")
    .select(
      "id, user_id, consultant_id, type, status, scheduled_note, scheduled_at, scheduled_duration_min, " +
      "started_at, ended_at, minutes_used, amount_charged, currency_code, rate_per_min, " +
      "rating, review_text, review_submitted_at, created_at, " +
      "connect_consultants(display_name, photo_url, gender, rate_per_min)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const { consultant_id, type, scheduled_note, scheduled_at, scheduled_duration_min } = body;

  if (!consultant_id) {
    return NextResponse.json({ ok: false, error: "consultant_id required" }, { status: 400 });
  }
  if (!["instant", "scheduled"].includes(type)) {
    return NextResponse.json({ ok: false, error: "type must be instant or scheduled" }, { status: 400 });
  }
  if (type === "scheduled" && !scheduled_note?.trim()) {
    return NextResponse.json({ ok: false, error: "scheduled_note required for scheduled sessions" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Prevent duplicate open sessions with the same consultant
  const { data: existing } = await supabase
    .from("connect_sessions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("consultant_id", consultant_id)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: false,
      error: "You already have an open session with this companion.",
      existing_session_id: existing.id,
      redirect: true,
    }, { status: 409 });
  }

  // Verify consultant is approved
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, status, currency_code")
    .eq("id", consultant_id)
    .eq("status", "approved")
    .single();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found or not approved" }, { status: 404 });
  }

  // Check if this user is blocked by the consultant
  const { data: block } = await supabase
    .from("connect_blocks")
    .select("id")
    .eq("consultant_id", consultant.id)
    .eq("blocked_user_id", user.id)
    .maybeSingle();

  if (block) {
    return NextResponse.json({ ok: false, error: "Unable to request a session with this companion." }, { status: 403 });
  }

  // For instant sessions: verify user has balance
  if (type === "instant") {
    const { data: recharges } = await supabase
      .from("connect_recharges")
      .select("minutes_credited")
      .eq("user_id", user.id)
      .eq("consultant_id", consultant_id)
      .eq("status", "completed");

    const { data: sessions } = await supabase
      .from("connect_sessions")
      .select("minutes_used")
      .eq("user_id", user.id)
      .eq("consultant_id", consultant_id)
      .in("status", ["completed", "active"]);

    const totalCredited = (recharges ?? []).reduce((s, r) => s + Number(r.minutes_credited), 0);
    const totalUsed     = (sessions ?? []).reduce((s, r) => s + Number(r.minutes_used), 0);
    const balance       = totalCredited - totalUsed;

    if (balance < 1) {
      return NextResponse.json(
        { ok: false, error: "Insufficient balance. Please recharge first.", needs_recharge: true },
        { status: 402 }
      );
    }
  }

  // Fetch rate so it is locked in the session row at creation time
  const { data: consultantFull } = await supabase
    .from("connect_consultants")
    .select("rate_per_min")
    .eq("id", consultant_id)
    .single();

  const user_timezone = typeof body.user_timezone === "string" && body.user_timezone.length > 0
    ? body.user_timezone
    : "Asia/Kolkata";

  const { data: session, error } = await supabase
    .from("connect_sessions")
    .insert({
      user_id:        user.id,
      consultant_id,
      type,
      status:         "pending",
      scheduled_note:         scheduled_note?.trim() ?? null,
      scheduled_at:           scheduled_at ?? null,
      scheduled_duration_min: type === "scheduled" && Number.isInteger(scheduled_duration_min) ? scheduled_duration_min : null,
      currency_code:  consultant.currency_code,
      rate_per_min:   Number(consultantFull?.rate_per_min ?? 0),
      user_timezone,
    })
    .select("id, status, created_at")
    .single();

  if (error || !session) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session }, { status: 201 });
}
