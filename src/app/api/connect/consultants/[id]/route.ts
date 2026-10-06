export const preferredRegion = ["sin1"];

// GET /api/connect/consultants/[id]
// An approved consultant's full profile, subject to org visibility.
//
// 🔴 This route used to apply no visibility rule at all. Once org-private
// companions exist, hiding one from the LIST is not enough — ids are guessable
// and enumerable, so a direct fetch would hand an outsider the profile the list
// had just withheld. The visibility predicate therefore belongs here too, and
// it is the same one the list uses (src/lib/connect/scope.ts), not a second
// copy that could drift from it.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectScope, applyConsultantVisibility } from "@/lib/connect/scope";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const scope = await getConnectScope(req);

  let query = supabase
    .from("connect_consultants")
    .select(
      "id, display_name, gender, photo_url, bio, expertise_tags, languages, session_types, " +
      "rate_per_min, currency_code, availability_note, availability_windows, " +
      "is_online, is_busy, rating_avg, rating_count, sessions_completed"
    )
    .eq("id", id)
    .eq("status", "approved");

  query = applyConsultantVisibility(query, scope);

  // maybeSingle(), not single(): a consultant the caller may not see is simply
  // absent, which is the answer we want anyway — and single() would turn that
  // into a PostgREST error rather than a clean 404.
  const { data, error } = await query.maybeSingle();

  // ⚠️ Same 404 for "no such consultant" and "not visible to you". A distinct
  // error for the second would confirm that an org's private companion exists.
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, consultant: data });
}
