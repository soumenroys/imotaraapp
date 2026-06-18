// GET /api/connect/consultants
// Public — list approved consultants with optional filters.
// Query params: gender, tag, lang, online (true/false), category (role_category)

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const MAX_PAGE_LIMIT = 50;
const DEFAULT_LIMIT  = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const gender   = searchParams.get("gender");
  const tag      = searchParams.get("tag");
  const lang     = searchParams.get("lang");
  const online   = searchParams.get("online");
  const category = searchParams.get("category");
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit    = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset   = (page - 1) * limit;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("connect_consultants")
    .select(
      "id, display_name, gender, photo_url, bio, expertise_tags, languages, role_category, session_types, " +
      "rate_per_min, currency_code, rate_per_min_inr, availability_note, availability_windows, " +
      "is_online, is_busy, rating_avg, rating_count, sessions_completed, preferred_lang",
      { count: "exact" }
    )
    .eq("status", "approved")
    .order("is_online", { ascending: false })
    .order("rating_avg", { ascending: false })
    .range(offset, offset + limit - 1);

  if (gender)          query = query.eq("gender", gender);
  if (online === "true") query = query.eq("is_online", true);
  if (tag)             query = query.contains("expertise_tags", [tag]);
  if (lang)            query = query.contains("languages", [lang]);
  if (category)        query = query.eq("role_category", category);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const total      = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  type ConsultantRow = { id: string; [key: string]: unknown };
  const consultants = (data ?? []) as unknown as ConsultantRow[];

  // If the caller is authenticated, attach their pre-purchased balance per consultant.
  // balance_minutes > 0 means they already have paid minutes to use with that consultant.
  const user = await getConnectUser(req);
  if (user && consultants.length > 0) {
    const consultantIds = consultants.map((c) => c.id);

    const [{ data: recharges }, { data: usedSessions }] = await Promise.all([
      supabase
        .from("connect_recharges")
        .select("consultant_id, minutes_credited")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .in("consultant_id", consultantIds),
      supabase
        .from("connect_sessions")
        .select("consultant_id, minutes_used")
        .eq("user_id", user.id)
        .in("status", ["completed", "active"])
        .in("consultant_id", consultantIds),
    ]);

    // Aggregate credited and used minutes per consultant
    const creditedMap: Record<string, number> = {};
    for (const r of recharges ?? []) {
      creditedMap[r.consultant_id] = (creditedMap[r.consultant_id] ?? 0) + Number(r.minutes_credited);
    }
    const usedMap: Record<string, number> = {};
    for (const s of usedSessions ?? []) {
      usedMap[s.consultant_id] = (usedMap[s.consultant_id] ?? 0) + Number(s.minutes_used);
    }

    const enriched = consultants.map((c) => ({
      ...c,
      balance_minutes: Math.max(0, (creditedMap[c.id] ?? 0) - (usedMap[c.id] ?? 0)),
    }));

    return NextResponse.json({ ok: true, consultants: enriched, page, limit, total, totalPages });
  }

  return NextResponse.json({ ok: true, consultants, page, limit, total, totalPages });
}
