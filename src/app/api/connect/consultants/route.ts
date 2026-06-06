// GET /api/connect/consultants
// Public — list approved consultants with optional filters.
// Query params: gender, tag, lang, online (true/false), category (role_category)

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const gender   = searchParams.get("gender");
  const tag      = searchParams.get("tag");
  const lang     = searchParams.get("lang");
  const online   = searchParams.get("online");
  const category = searchParams.get("category");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("connect_consultants")
    .select(
      "id, display_name, gender, photo_url, bio, expertise_tags, languages, role_category, " +
      "rate_per_min, currency_code, rate_per_min_inr, availability_note, availability_windows, " +
      "is_online, is_busy, rating_avg, rating_count, sessions_completed"
    )
    .eq("status", "approved")
    .order("is_online", { ascending: false })
    .order("rating_avg", { ascending: false });

  if (gender)          query = query.eq("gender", gender);
  if (online === "true") query = query.eq("is_online", true);
  if (tag)             query = query.contains("expertise_tags", [tag]);
  if (lang)            query = query.contains("languages", [lang]);
  if (category)        query = query.eq("role_category", category);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, consultants: data ?? [] });
}
