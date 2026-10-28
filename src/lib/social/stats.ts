// src/lib/social/stats.ts
// Taking the stock of a channel, and of what it has published.
//
// 🔑 THE OWNER'S ASK, 18 Oct: capture a channel's figures when it is
// connected, update them after every day's post, and keep the series so the
// scheduler can be judged on whether anything actually moved.
//
// 🔴 THE BASELINE IS THE PART THAT CANNOT BE RECOVERED LATER. Without the
// figure from before the scheduler started, every later number is unreadable:
// 63 followers is a success or a disappointment depending entirely on what it
// was the day before. So it is taken the moment a channel is connected, not
// the day somebody first wants a chart.
//
// ⚠️ AND THE HONEST LIMIT. The Page had ~50 followers on 18 Oct. One person is
// 2%. For a long while anything that looks like a trend over a few days is
// noise, and this module's job is to record honestly, not to flatter.

import type { SupabaseClient } from "@supabase/supabase-js";
import { scrubRaw } from "@/lib/social/scrubRaw";
import { loadChannelCredential } from "@/lib/social/channelCredentials";
import {
  fetchPageStats,
  fetchPostStats,
  fetchPageInsights,
  fetchPostImpressions,
} from "@/lib/social/adapters/facebook";
import {
  fetchInstagramStats,
  fetchInstagramAccountInsights,
  fetchInstagramPostStats,
} from "@/lib/social/adapters/instagram";

/** ⚠️ UTC, matching the table's `captured_on` default, so a capture at 23:40
 *  IST does not land on yesterday's row or create tomorrow's. */
export function capturedOn(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type CaptureResult =
  | { ok: true; followers: number | null; baseline: boolean; note: string }
  | { ok: false; reason: string };

/**
 * Take one day's figures for a channel.
 *
 * ⛔ UPSERT ON (account_id, captured_on). Two captures in a day are the same
 * day's figure — the second corrects the first. Inserting twice would turn a
 * retry into a second reading and make every average wrong.
 */
export async function captureChannelStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  accountId: string,
  opts: { note?: string; now?: Date } = {},
): Promise<CaptureResult> {
  const cred = await loadChannelCredential(db, accountId);
  if (!cred.ok) return { ok: false, reason: cred.reason };

  if (cred.platform !== "facebook" && cred.platform !== "instagram") {
    // ⛔ Said, not skipped. A channel silently absent from the record looks
    // identical to a channel that never grew.
    return { ok: false, reason: `There is no way to read ${cred.platform} figures yet.` };
  }

  /**
   * ⚠️ THE TWO CHANNELS REPORT DIFFERENT THINGS, and the differences are kept
   * rather than flattened into a shared lowest common denominator:
   *   • a Page has `fans` as well as followers; an Instagram account has only
   *     followers, so `fans` stays NULL rather than being filled with a copy;
   *   • Instagram reports NET FOLLOWER CHANGE for a day, which can be
   *     negative, and Facebook does not;
   *   • Facebook reports impressions and reach for the Page.
   * ⛔ Filling a column a platform does not report would make the two
   * channels look comparable in a chart where they are not.
   */
  const isInstagram = cred.platform === "instagram";

  const stats = isInstagram
    ? await fetchInstagramStats({ token: cred.token, igUserId: cred.externalId })
    : await fetchPageStats({ token: cred.token, pageId: cred.externalId });
  if (!stats.ok) return { ok: false, reason: stats.message };

  const day = capturedOn(opts.now);

  /**
   * 🔑 Is this the first capture this channel has ever had? Asked BEFORE the
   * write, because afterwards the answer is always no. ⛔ The flag records
   * which row is the starting line; a later capture on the same day may
   * correct the VALUES but must never erase that.
   */
  const { count } = await db
    .from("social_channel_stats")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);

  /**
   * 🔴 THE FLAG IS STICKY, AND IT WAS NOT.
   *
   * The schema comment promised the baseline "may not be erased" — and the
   * upsert wrote `is_baseline: (count === 0)` on EVERY capture. The second
   * capture of the same day found count = 1, wrote false over the true, and
   * the starting line was gone. ⛔ A comment stating a guarantee the code does
   * not enforce is worse than no comment: it stops the next person checking.
   *
   * ⚠️ Read back rather than assumed, because the row being corrected today
   * may be the baseline row itself.
   */
  const { data: today } = await db
    .from("social_channel_stats")
    .select("is_baseline")
    .eq("account_id", accountId)
    .eq("captured_on", capturedOn(opts.now))
    .maybeSingle();

  const baseline = (count ?? 0) === 0 || today?.is_baseline === true;

  // ⚠️ How many of OUR posts were live when this was taken. It is what makes
  // the follower line readable — a jump with no posts behind it came from
  // somewhere else entirely.
  const { count: live } = await db
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("platform", cred.platform)
    .eq("status", "published");

  /**
   * ⚠️ BEST EFFORT, AND ITS FAILURE IS RECORDED RATHER THAN HIDDEN. Reach
   * needs `read_insights`; without it Facebook answers with a permission
   * error. ⛔ The figures stay NULL — never 0 — and the reason is kept in the
   * note, because a column of zeros would read as "nobody saw anything".
   */
  const insights = isInstagram
    ? await fetchInstagramAccountInsights({ token: cred.token, igUserId: cred.externalId })
    : await fetchPageInsights({ token: cred.token, pageId: cred.externalId });
  const insightNote = insights.ok ? "" : ` ⚠️ Reach unavailable: ${insights.message}`;

  const reach = insights.ok ? insights.insights.reach : null;
  // ⚠️ Only Instagram reports these two, and only Facebook the other.
  const followerChange =
    insights.ok && "followerChange" in insights.insights ? insights.insights.followerChange : null;
  const impressions =
    insights.ok && "impressions" in insights.insights ? insights.insights.impressions : null;

  const { error } = await db.from("social_channel_stats").upsert(
    {
      account_id: accountId,
      platform: cred.platform,
      captured_on: day,
      is_baseline: baseline,
      followers: stats.stats.followers,
      // ⛔ NULL for Instagram rather than a copy of the follower count. A Page
      // "like" and a follow are different acts, and duplicating one into the
      // other would invent a number nobody measured.
      fans: "fans" in stats.stats ? stats.stats.fans : null,
      posts_live: live ?? 0,
      impressions,
      reach,
      follower_change: followerChange,
      // ⛔ Never stored whole ⇒ scrubRaw: Graph puts the token in its paging links.
      raw: scrubRaw({ page: stats.stats.raw, insights: insights.ok ? insights.insights.raw : { error: insights.message } }),
      note: (opts.note ?? "") + insightNote || null,
    },
    // ⛔ Named, so a correction lands on the same row rather than failing.
    { onConflict: "account_id,captured_on" },
  );
  if (error) return { ok: false, reason: error.message };

  return {
    ok: true,
    followers: stats.stats.followers,
    baseline,
    note:
      (baseline
        ? `Baseline taken: ${stats.stats.followers ?? "unknown"} followers before the scheduler has ` +
          `done anything. ⛔ This figure cannot be recovered later.`
        : `${stats.stats.followers ?? "unknown"} followers today.`) +
      (insights.ok
        ? ` Reach yesterday: ${reach ?? "unknown"}` +
          (impressions !== null ? `, impressions ${impressions}` : "") +
          (followerChange !== null ? `, net followers ${followerChange > 0 ? "+" : ""}${followerChange}` : "") +
          "."
        : insightNote),
  };
}

/**
 * Take today's figures for every post this channel has published recently.
 *
 * ⚠️ A post's numbers keep moving for days, so this is a SERIES per post, not
 * one final reading. The shape of that curve is the only way to tell a post
 * that landed from one that was merely seen early.
 */
export async function capturePostStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  accountId: string,
  opts: { days?: number; now?: Date } = {},
): Promise<{ captured: number; skipped: number; problems: string[] }> {
  const problems: string[] = [];
  const cred = await loadChannelCredential(db, accountId);
  if (!cred.ok) return { captured: 0, skipped: 0, problems: [cred.reason] };
  if (cred.platform !== "facebook" && cred.platform !== "instagram") {
    return { captured: 0, skipped: 0, problems: [`No reader for ${cred.platform} yet.`] };
  }
  const isInstagram = cred.platform === "instagram";

  /**
   * ⚠️ A WINDOW, not every post ever. Engagement on a post older than a
   * fortnight does not move, and asking Facebook about hundreds of them every
   * day is a rate limit waiting to happen ⇒ classifyGraphError's `rate` case.
   */
  const days = opts.days ?? 14;
  const since = new Date((opts.now?.getTime() ?? Date.now()) - days * 86_400_000).toISOString();

  const { data: posts } = await db
    .from("social_posts")
    .select("id, external_post_id, published_at")
    .eq("platform", cred.platform)
    .eq("status", "published")
    .not("external_post_id", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(50);

  const day = capturedOn(opts.now);
  let captured = 0;
  let skipped = 0;

  for (const p of posts ?? []) {
    /**
     * 🔑 SAVES ARE THE INSTAGRAM NUMBER. The voice for that channel is written
     * to be worth KEEPING rather than worth agreeing with ⇒ platforms.ts, and
     * a metric we deliberately optimise for and never record is a claim
     * nobody can check afterwards.
     */
    if (isInstagram) {
      const ig = await fetchInstagramPostStats({
        token: cred.token,
        igUserId: cred.externalId,
        mediaId: p.external_post_id as string,
      });
      if (!ig.ok) {
        problems.push(`${p.external_post_id}: ${ig.message}`);
        skipped += 1;
        continue;
      }
      const { error: igError } = await db.from("social_post_stats").upsert(
        {
          post_id: p.id,
          captured_on: day,
          reactions: ig.stats.likes,
          comments: ig.stats.comments,
          // ⛔ NULL, not 0. Instagram does not report shares per post on this
          // edge, and a zero would read as "nobody shared it".
          shares: null,
          saves: ig.stats.saved,
          reach: ig.stats.reach,
          impressions: ig.stats.views,
          raw: scrubRaw(ig.stats.raw),
        },
        { onConflict: "post_id,captured_on" },
      );
      if (igError) {
        problems.push(`${p.id}: ${igError.message}`);
        skipped += 1;
        continue;
      }
      captured += 1;
      continue;
    }

    /**
     * 🔑 THE PAGE ID GOES WITH IT. Reading a Page post's engagement needs a
     * PAGE token, and these two readers are the only Facebook calls that were
     * using the raw system-user token ⇒ the note on fetchPostStats.
     */
    const stats = await fetchPostStats({
      token: cred.token,
      postId: p.external_post_id as string,
      pageId: cred.externalId,
    });
    if (!stats.ok) {
      // ⛔ One post failing must not lose the rest of the day's figures.
      problems.push(`${p.external_post_id}: ${stats.message}`);
      skipped += 1;
      continue;
    }
    // ⚠️ A second call, because impressions live on a different edge. Its
    // failure must not lose the reactions we already have.
    const seen = await fetchPostImpressions({
      token: cred.token,
      postId: p.external_post_id as string,
      pageId: cred.externalId,
    });

    const { error } = await db.from("social_post_stats").upsert(
      {
        post_id: p.id,
        captured_on: day,
        reactions: stats.stats.reactions,
        comments: stats.stats.comments,
        shares: stats.stats.shares,
        // ⚠️ `seen.ok` false means every candidate name was retired, not that
        // nobody saw it ⇒ NULL, never 0.
        impressions: seen.ok ? seen.impressions : null,
        /**
         * 🔑 THE SIGN OF THE REACTION ⇒ docs/sql/social_reaction_sign.sql.
         * ⛔ Passed through as-is, nulls included: a missing breakdown must
         * never be stored as "nobody was angry".
         */
        angry: stats.stats.angry,
        sad: stats.stats.sad,
        love: stats.stats.love,
        raw: scrubRaw(stats.stats.raw),
      },
      { onConflict: "post_id,captured_on" },
    );
    if (error) {
      problems.push(`${p.id}: ${error.message}`);
      skipped += 1;
      continue;
    }
    captured += 1;
  }

  return { captured, skipped, problems };
}
