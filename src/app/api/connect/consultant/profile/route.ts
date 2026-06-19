// GET  /api/connect/consultant/profile — own profile (any status)
// PATCH /api/connect/consultant/profile — update own profile fields
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD"];
const SUPPORTED_LANGS      = ["en","hi","bn","mr","ta","te","gu","pa","kn","ml","or","ur","ar","he","ru","zh","ja","es","fr","de","pt"];

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("connect_consultants")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, consultant: data });
}

export async function PATCH(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const allowed = [
    "bio", "expertise_tags", "languages", "rate_per_min",
    "currency_code", "availability_note", "availability_windows", "photo_url", "display_name",
    "expo_push_token", // push token registered by mobile app for session-request notifications
    "preferred_lang",  // primary language for Connect sessions
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if ("bio" in updates && (typeof updates.bio !== "string" || (updates.bio as string).length > 500)) {
    return NextResponse.json({ ok: false, error: "bio max 500 chars" }, { status: 400 });
  }
  if ("currency_code" in updates && !SUPPORTED_CURRENCIES.includes(updates.currency_code as string)) {
    return NextResponse.json({ ok: false, error: "Unsupported currency" }, { status: 400 });
  }
  if ("rate_per_min" in updates && (isNaN(Number(updates.rate_per_min)) || Number(updates.rate_per_min) <= 0 || Number(updates.rate_per_min) > 10000)) {
    return NextResponse.json({ ok: false, error: "rate_per_min must be between 0 and 10000" }, { status: 400 });
  }
  if ("preferred_lang" in updates && !SUPPORTED_LANGS.includes(updates.preferred_lang as string)) {
    return NextResponse.json({ ok: false, error: "Unsupported language code" }, { status: 400 });
  }
  if ("availability_windows" in updates) {
    const aw = updates.availability_windows;
    if (!Array.isArray(aw) || aw.length > 28 || JSON.stringify(aw).length > 8192) {
      return NextResponse.json({ ok: false, error: "Invalid availability_windows" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "No updatable fields provided" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("connect_consultants")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
