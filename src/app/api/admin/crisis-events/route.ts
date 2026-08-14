// src/app/api/admin/crisis-events/route.ts
// GET /api/admin/crisis-events — list recent crisis-detection events (metadata only, no message text).
// owner/admin only — excludes connect_reviewer, which is scoped to Connect moderation, not general user safety.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized } from "@/app/api/admin/_auth";

const MAX_ROWS = 200;

export async function GET(req: NextRequest) {
  if (!(await adminAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("crisis_events")
    .select("id, user_id, platform, preferred_lang, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error("[admin/crisis-events GET]", error.message);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  // Resolve each user_id to an email so admins can actually identify who to
  // follow up with — auth.admin.getUserById has no bulk-by-ID-list variant,
  // so resolve in parallel. MAX_ROWS caps this at a bounded fan-out.
  const events = await Promise.all(
    (rows ?? []).map(async (row) => {
      let email: string | null = null;
      if (row.user_id) {
        try {
          const { data } = await supabase.auth.admin.getUserById(row.user_id);
          email = data?.user?.email ?? null;
        } catch {
          // user may have been deleted since the event was logged
        }
      }
      return { ...row, email };
    }),
  );

  return NextResponse.json({ events });
}
