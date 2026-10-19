// GET /api/cron/social-stats — today's figures for every connected channel
//
// 🔑 THE OWNER'S ASK, 18 Oct: "after everyday's post update the statistics of
// that channel and save the everyday's statistics so that we can do analytics
// to check how this scheduler is performing."
//
// ⚠️ RUNS AFTER THE POSTING HOUR, not before. Figures taken at 09:00 would
// describe yesterday's channel and be filed under today, which is the kind of
// quiet off-by-one that makes a chart confidently wrong.
//
// ⛔ IT DOES NOT RESPECT THE PAUSE SWITCH, deliberately. "Stop everything"
// means stop PUBLISHING; it does not mean stop knowing what is happening — and
// a pause is exactly when somebody wants to see whether anything changed.
//
// ⚠️ GET with a Bearer, like every cron here
// ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { captureChannelStats, capturePostStats } from "@/lib/social/stats";
import { measuredPostsWithIds } from "@/lib/social/store";
import { postsNeedingAPerson } from "@/lib/social/learning";
import { sendUpsetAlert } from "@/lib/social/alert";
import { markCronFired } from "@/lib/cron/heartbeat";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  void markCronFired("/api/cron/social-stats");

  const db = getSupabaseAdmin();
  const { data: accounts, error } = await db
    .from("social_accounts")
    .select("id, platform, display_name, status");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const channels: unknown[] = [];
  for (const a of accounts ?? []) {
    /**
     * ⚠️ Even a channel reading `dead` is asked. Its follower count is still a
     * fact, and a gap in the series at exactly the moment something went wrong
     * is the gap somebody will most want filled.
     */
    const stats = await captureChannelStats(db, a.id as string);
    const posts = await capturePostStats(db, a.id as string);
    channels.push({
      channel: a.display_name,
      platform: a.platform,
      ...(stats.ok
        ? { followers: stats.followers, baseline: stats.baseline, note: stats.note }
        : { problem: stats.reason }),
      posts: { captured: posts.captured, skipped: posts.skipped, problems: posts.problems.slice(0, 5) },
    });
  }

  /**
   * 🔴 THE ONE ALARM IN THIS FEATURE THAT CANNOT WAIT FOR SOMEBODY TO LOOK.
   *
   * Everything else here fails towards silence — a slot passes, a draft is
   * refused, a chart stays thin. This means a post live under the brand's
   * name has landed badly on a mental-health audience, and the machine has
   * already done the only thing it should: stopped treating it as a success
   * ⇒ src/lib/social/learning.ts.
   *
   * ⚠️ RUN AFTER THE CAPTURE, in the same job, because the numbers it reads
   * are the ones just written. A separate cron would be a second thing to
   * notice had stopped.
   *
   * ⛔ Never throws. A failed alert must not lose the capture that produced it.
   */
  let upset: { postId?: string; platform: string; pool: string | null; why: string }[] = [];
  try {
    upset = postsNeedingAPerson(await measuredPostsWithIds());
    if (upset.length > 0) await sendUpsetAlert(upset);
  } catch (e) {
    console.error("[social-stats] the upset check threw:", (e as Error).message);
  }

  return NextResponse.json({
    ran: true,
    at: new Date().toISOString(),
    channels,
    upset,
    note:
      "⛔ Page reach and impressions are NOT included — they need the read_insights scope, and " +
      "this token carries pages_manage_posts, pages_read_engagement and pages_show_list. They are " +
      "stored as NULL rather than 0, because “we could not ask” and “nobody saw it” are different.",
  });
}
