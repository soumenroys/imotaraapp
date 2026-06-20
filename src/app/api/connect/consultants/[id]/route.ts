export const preferredRegion = ["sin1"];

// GET /api/connect/consultants/[id]
// Public — full approved consultant profile.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("connect_consultants")
    .select(
      "id, display_name, gender, photo_url, bio, expertise_tags, languages, session_types, " +
      "rate_per_min, currency_code, availability_note, availability_windows, " +
      "is_online, rating_avg, rating_count, sessions_completed"
    )
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, consultant: data });
}
