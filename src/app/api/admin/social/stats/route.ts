// GET /api/admin/social/stats — the series behind the analytics screen
//
// 🔑 THE OWNER'S ASK, 18 Oct: "so that we can do analytics to check how this
// scheduler is performing. whether likes/dislikes/followers are increasing or
// decreasing or how the posts are effecting that specific social media."
//
// ⛔ IT COMPUTES NOTHING IT CANNOT DEFEND. Where a figure is missing it stays
// null and the screen says so — a chart that quietly interpolates a gap is
// how a dashboard ends up lying to the person who built it.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();

  const [channels, days, posts, postStats] = await Promise.all([
    db.from("social_accounts").select("id, platform, display_name, status"),
    db
      .from("social_channel_stats")
      .select("account_id, platform, captured_on, is_baseline, followers, fans, impressions, reach, posts_live")
      .order("captured_on", { ascending: true }),
    db
      .from("social_posts")
      .select("id, platform, subject, published_at, external_post_id, media_kind")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60),
    db
      .from("social_post_stats")
      .select("post_id, captured_on, reactions, comments, shares, impressions")
      .order("captured_on", { ascending: true }),
  ]);

  /**
   * ⚠️ THE LATEST READING PER POST, not the sum. Each row is a snapshot of the
   * same post on a different day — adding them together would multiply one
   * post's four reactions into twelve.
   */
  const latest = new Map<string, { reactions: number | null; comments: number | null; shares: number | null; impressions: number | null; captured_on: string }>();
  for (const s of postStats.data ?? []) {
    latest.set(s.post_id as string, {
      reactions: s.reactions as number | null,
      comments: s.comments as number | null,
      shares: s.shares as number | null,
      impressions: s.impressions as number | null,
      captured_on: s.captured_on as string,
    });
  }

  return NextResponse.json({
    channels: channels.data ?? [],
    days: days.data ?? [],
    posts: (posts.data ?? []).map((p) => ({
      id: p.id,
      platform: p.platform,
      subject: p.subject,
      publishedAt: p.published_at,
      url: p.external_post_id ? `https://www.facebook.com/${p.external_post_id}` : null,
      hadCard: p.media_kind === "graphic",
      // ⛔ null, not 0, when nothing has been captured for it yet — the daily
      // run may simply not have reached it.
      stats: latest.get(p.id as string) ?? null,
    })),
    note:
      "⚠️ A figure shown as “—” was never captured, which is not the same as zero. Page reach " +
      "needs read_insights on the token; post figures are collected daily at 19:30 IST.",
  });
}
