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
      .select("account_id, platform, captured_on, is_baseline, followers, fans, impressions, reach, follower_change, posts_live")
      .order("captured_on", { ascending: true }),
    db
      .from("social_posts")
      // 🔑 Every dimension somebody would want to slice by. ⛔ `topic_pool` is
      // NULL on anything written before 18 Oct — the angle was not recorded,
      // and it cannot be reconstructed ⇒ docs/sql/social_post_angle.sql.
      .select("id, platform, language, topic_pool, subject, published_at, external_post_id, external_url, media_kind")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60),
    db
      .from("social_post_stats")
      .select("post_id, captured_on, reactions, comments, shares, impressions, saves, reach")
      .order("captured_on", { ascending: true }),
  ]);

  /**
   * ⚠️ THE LATEST READING PER POST, not the sum. Each row is a snapshot of the
   * same post on a different day — adding them together would multiply one
   * post's four reactions into twelve.
   */
  const latest = new Map<
    string,
    {
      reactions: number | null;
      comments: number | null;
      shares: number | null;
      impressions: number | null;
      /** 🔑 Instagram's own two. `saves` is the number that channel ranks on
       *  and the number its voice was written for ⇒ platforms.ts. */
      saves: number | null;
      reach: number | null;
      captured_on: string;
    }
  >();
  for (const s of postStats.data ?? []) {
    latest.set(s.post_id as string, {
      reactions: s.reactions as number | null,
      comments: s.comments as number | null,
      shares: s.shares as number | null,
      impressions: s.impressions as number | null,
      saves: s.saves as number | null,
      reach: s.reach as number | null,
      captured_on: s.captured_on as string,
    });
  }

  return NextResponse.json({
    channels: channels.data ?? [],
    days: days.data ?? [],
    posts: (posts.data ?? []).map((p) => ({
      id: p.id,
      platform: p.platform,
      language: p.language,
      angle: p.topic_pool ?? null,
      shape: p.media_kind,
      subject: p.subject,
      publishedAt: p.published_at,
      /**
       * 🔴 THE LINK USED TO BE BUILT AS facebook.com/<id> FOR EVERY POST.
       *
       * Harmless with one channel. The moment Instagram published, every
       * Instagram post pointed at a Facebook URL that does not exist — and
       * somebody clicks a link.
       *
       * ⚠️ Instagram's permalink CANNOT be constructed: the shortcode is not
       * derivable from the media id, so it is captured at publish time
       * ⇒ docs/sql/social_post_url.sql. ⛔ Null for anything published before
       * that column existed, and NOT backfilled with a guess.
       */
      url:
        (p.external_url as string | null) ??
        (p.platform === "facebook" && p.external_post_id
          ? `https://www.facebook.com/${p.external_post_id}`
          : null),
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
