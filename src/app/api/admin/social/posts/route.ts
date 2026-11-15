// GET /api/admin/social/posts — the queue, and what has happened
//
// ⛔ Returns no token and no credential. This is the only shape of these rows a
// browser ever sees.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { gateNowFor, RECHECKED_STATUSES } from "@/lib/social/gateNow";
import { loadOverlay } from "@/lib/social/store";

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
      "id, origin, schedule_id, author_id, platform, language, scheduled_for, status, subject, body, slides, " +
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

  /**
   * 🔴 #154 (15 Nov 2026): THE STORED VERDICT IS FROM THE DAY THE POST WAS
   * WRITTEN. A draft written on 4 Nov showed "privacy ✓", but the rule against
   * "chat history stays on your phone" arrived on 11 Nov — so pressing Approve
   * was refused by the server (which re-checks the text) while the card still
   * said it had passed. The owner saw a button that "does nothing".
   * ⇒ every post that can still be approved or published is checked again
   * here, against today's rules, and the screen shows THAT result.
   * ⚠️ Pure string checks — no network per post, one overlay read per request.
   */
  const rows = (posts.data ?? []) as unknown as Record<string, unknown>[];
  const needsNow = rows.some((r) => RECHECKED_STATUSES.includes(r.status as (typeof RECHECKED_STATUSES)[number]));
  const overlay = needsNow ? await loadOverlay() : undefined;
  const withNow = rows.map((r) => {
    const gateNow = overlay ? gateNowFor(r, overlay) : undefined;
    return gateNow ? { ...r, gateNow } : r;
  });

  return NextResponse.json({
    view,
    posts: withNow,
    byStatus,
    scheduleNames,
    actorRole: guard.actor.role,
  });
}
