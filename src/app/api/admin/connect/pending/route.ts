// GET /api/admin/connect/pending
// Admin only. Lists pending consultant applications.

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  if (!(await adminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("connect_consultants")
    .select(
      "id, user_id, display_name, gender, photo_url, bio, expertise_tags, " +
      "languages, rate_per_min, currency_code, availability_note, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  type ConsultantRow = {
    id: string; user_id: string; display_name: string; gender: string | null;
    photo_url: string | null; bio: string | null; expertise_tags: string[] | null;
    languages: string[] | null; rate_per_min: number; currency_code: string;
    availability_note: string | null; created_at: string;
  };

  // Fetch emails from auth.users — best effort
  const rows = (data ?? []) as unknown as ConsultantRow[];
  const emailMap: Record<string, string> = {};
  for (const row of rows) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
      if (authUser?.user?.email) emailMap[row.user_id] = authUser.user.email;
    } catch {
      // skip
    }
  }

  const consultants = rows.map((c) => ({
    ...c,
    email: emailMap[c.user_id] ?? null,
  }));

  return NextResponse.json({ ok: true, consultants });
}
