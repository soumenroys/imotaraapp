// GET /api/admin/social/posts — the queue, and what has happened
//
// ⛔ Returns no token and no credential. This is the only shape of these rows a
// browser ever sees.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const VIEWS: Record<string, string[]> = {
  queue: ["needs_review"],
  approved: ["approved", "publishing"],
  published: ["published"],
  trouble: ["failed", "rejected_by_gate"],
  all: [],
};

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const view = req.nextUrl.searchParams.get("view") ?? "queue";
  const statuses = VIEWS[view];
  if (!statuses) {
    return NextResponse.json({ error: `view must be one of ${Object.keys(VIEWS).join(", ")}` }, { status: 400 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);

  const db = getSupabaseAdmin();
  let q = db
    .from("social_posts")
    .select(
      "id, origin, schedule_id, author_id, platform, language, scheduled_for, status, subject, body, " +
        "media_kind, visual_recipe, gate_result, reviewed_by, reviewed_at, external_post_id, attempts, " +
        "last_error, generated_at, published_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statuses.length > 0) q = q.in("status", statuses);

  const [posts, counts, schedules] = await Promise.all([
    q,
    db.from("social_posts").select("status"),
    db.from("social_schedules").select("id, name"),
  ]);

  if (posts.error) return NextResponse.json({ error: posts.error.message }, { status: 500 });

  const byStatus: Record<string, number> = {};
  for (const row of counts.data ?? []) {
    byStatus[row.status as string] = (byStatus[row.status as string] ?? 0) + 1;
  }
  const scheduleNames: Record<string, string> = {};
  for (const s of schedules.data ?? []) scheduleNames[s.id as string] = s.name as string;

  return NextResponse.json({
    view,
    posts: posts.data ?? [],
    byStatus,
    scheduleNames,
    actorRole: guard.actor.role,
  });
}
