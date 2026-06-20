export const preferredRegion = ["sin1"];

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

  if ("display_name" in updates) {
    const dn = updates.display_name as string;
    if (typeof dn !== "string" || !dn.trim() || dn.trim().length > 100) {
      return NextResponse.json({ ok: false, error: "display_name must be 1–100 characters" }, { status: 400 });
    }
  }
  if ("bio" in updates && (typeof updates.bio !== "string" || (updates.bio as string).length > 500)) {
    return NextResponse.json({ ok: false, error: "bio max 500 chars" }, { status: 400 });
  }
  if ("availability_note" in updates && typeof updates.availability_note === "string" && (updates.availability_note as string).length > 500) {
    return NextResponse.json({ ok: false, error: "availability_note max 500 chars" }, { status: 400 });
  }
  if ("expo_push_token" in updates && typeof updates.expo_push_token === "string" && (updates.expo_push_token as string).length > 200) {
    return NextResponse.json({ ok: false, error: "expo_push_token too long" }, { status: 400 });
  }
  if ("currency_code" in updates && !SUPPORTED_CURRENCIES.includes(updates.currency_code as string)) {
    return NextResponse.json({ ok: false, error: "Unsupported currency" }, { status: 400 });
  }
  if ("rate_per_min" in updates && (isNaN(Number(updates.rate_per_min)) || Number(updates.rate_per_min) <= 0 || Number(updates.rate_per_min) > 10000)) {
    return NextResponse.json({ ok: false, error: "rate_per_min must be greater than 0 and at most 10000" }, { status: 400 });
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
  if ("languages" in updates) {
    const langs = updates.languages;
    if (!Array.isArray(langs) || langs.length === 0 || langs.length > 20 || langs.some((l) => typeof l !== "string" || l.length > 20)) {
      return NextResponse.json({ ok: false, error: "languages: 1–20 items, each max 20 characters" }, { status: 400 });
    }
  }
  if ("expertise_tags" in updates) {
    const tags = updates.expertise_tags;
    if (!Array.isArray(tags) || tags.length === 0 || tags.length > 20 || tags.some((t) => typeof t !== "string" || t.length > 50)) {
      return NextResponse.json({ ok: false, error: "expertise_tags: 1–20 items, each max 50 characters" }, { status: 400 });
    }
  }
  if ("photo_url" in updates) {
    const u = updates.photo_url;
    if (u !== null && u !== undefined && u !== "") {
      const scheme = String(u).trim().toLowerCase();
      if (!scheme.startsWith("https://") && !scheme.startsWith("http://")) {
        return NextResponse.json({ ok: false, error: "photo_url must be a valid https:// URL or null" }, { status: 400 });
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "No updatable fields provided" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify the profile exists before updating — without this check the update
  // silently matches 0 rows and returns ok:true, which is misleading to callers.
  const { data: existing } = await supabase
    .from("connect_consultants")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Consultant profile not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("connect_consultants")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    console.error("[consultant/profile PATCH] update failed:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to update profile. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
