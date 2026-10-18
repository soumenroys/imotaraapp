// GET /api/cron/social-publish — put approved posts on the timeline
//
// 🔴 THIS IS THE ONE THAT CANNOT BE UNDONE. Every other job in this feature
// writes rows somebody can read, change or throw away. This one makes words
// public under the brand's name, and there is no edit that un-shows a post to
// the people who already saw it. Everything below is shaped by that.
//
// ⛔ SEPARATE FROM social-queue ON PURPOSE. That job writes and gates drafts
// two hours ahead; this one publishes. One job doing both means a model
// outage at 9am stops the 9am post from going out, and a publish failure
// stops tomorrow's drafts from being written.
//
// ⚠️ GET with a Bearer, like every cron here. A route expecting POST 405s
// forever and nothing tells you ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { postingIsPaused } from "@/lib/social/store";
import { loadChannelCredential } from "@/lib/social/channelCredentials";
import { publishToFacebook } from "@/lib/social/adapters/facebook";
import { publishToInstagram } from "@/lib/social/adapters/instagram";
import { renderPostPictureBytes } from "@/lib/social/renderPicture";
import { cardUrlFor } from "@/lib/social/cardUrl";
import { platformSpec } from "@/lib/social/platforms";
import { markCronFired } from "@/lib/cron/heartbeat";

export const maxDuration = 300;

/**
 * ⛔ HOW MANY TIMES A POST MAY BE ATTEMPTED, EVER.
 *
 * Not per run — in total, counted in a column. A post that has failed three
 * times is failing for a reason a fourth attempt will not fix, and the cost of
 * being wrong about that is a duplicate on a public timeline.
 */
const MAX_ATTEMPTS = 3;

/**
 * ⚠️ A SMALL BATCH, DELIBERATELY. Publishing is the slow, irreversible part;
 * a run that tries twenty posts and times out half way has published an
 * unknown number of them. Five per minute is far more than this product will
 * ever schedule.
 */
const BATCH = 5;

type Outcome = {
  id: string;
  platform: string;
  language: string;
  result: "published" | "failed" | "held" | "unverified";
  detail?: string;
  url?: string;
};

/**
 * Can a stranger get a JPEG from this URL?
 *
 * 🔴 THE QUESTION INSTAGRAM WILL ASK, asked first and from here. Meta fetches
 * the card itself, so the failures that matter are the ones a local render
 * cannot see: a wrong NEXT_PUBLIC_SITE_URL, deployment protection in front of
 * the route, a signature that does not verify, a post whose status moved.
 *
 * ⚠️ GET rather than HEAD. A Next route handler that exports only GET does
 * not reliably answer HEAD, and a 405 here would stop every Instagram post
 * for a reason that has nothing to do with the card.
 *
 * ⛔ The content type is checked, not assumed. A route that answered 200 with
 * an HTML error page would otherwise look healthy, and Instagram would fail
 * later with a message about the media.
 */
async function cardReaches(url: string): Promise<{ ok: true } | { ok: false; why: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      return {
        ok: false,
        why:
          `${url} answered ${res.status}. ▶️ Check NEXT_PUBLIC_SITE_URL and that the card route is ` +
          `publicly reachable — Instagram fetches it with none of our credentials.`,
      };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/jpeg")) {
      return {
        ok: false,
        why: `${url} answered ${res.status} but with "${type}". ⛔ Instagram accepts JPEG and nothing else.`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, why: `The card URL could not be fetched from here (${(e as Error).message}).` };
  }
}

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  // 🔵 It fired. Recorded before the work, so a job that crashes half-way
  // still proves Vercel invoked it. Never throws.
  void markCronFired("/api/cron/social-publish");

  const now = new Date();
  const db = getSupabaseAdmin();

  /**
   * 🔑 THE MASTER SWITCH IS READ FIRST AND IT MEANS THIS JOB. "Stop
   * everything" that still published would be the worst lie this admin could
   * tell — and the switch exists precisely for the moment somebody needs
   * posting to stop NOW.
   */
  const paused = await postingIsPaused();
  if (paused.paused) {
    return NextResponse.json({
      ran: false,
      reason: "Posting is paused.",
      note: paused.note ?? null,
      at: now.toISOString(),
    });
  }

  const { data: due, error } = await db
    .from("social_posts")
    .select("id, platform, language, subject, body, media_kind, visual_recipe, attempts, scheduled_for")
    .eq("status", "approved")
    // ⚠️ `scheduled_for` null means "as soon as it is approved" ⇒ the schema.
    .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) {
    return NextResponse.json({ ran: true, due: 0, at: now.toISOString() });
  }

  // ⚠️ Loaded once per run rather than per post: the channel row is the same
  // for every post on a platform, and decrypting a token five times is five
  // chances to log it.
  const channels = new Map<string, Awaited<ReturnType<typeof loadChannelCredential>>>();
  const { data: accounts } = await db.from("social_accounts").select("id, platform, status");

  const outcomes: Outcome[] = [];

  for (const post of due) {
    const platform = post.platform as string;

    /**
     * ⚠️ ASKED OF platforms.ts RATHER THAN HARD-CODED. This was
     * `platform !== "facebook"`, which meant adding a channel needed an edit
     * in a file nobody would think to open ⇒ everyShapeIsReachable.
     *
     * ⛔ Said out loud rather than skipped silently. A post waiting forever on
     * a channel that cannot publish is exactly the kind of nothing this
     * feature was built to stop happening quietly.
     */
    if (!platformSpec(platform).canPublish) {
      outcomes.push({
        id: post.id as string,
        platform,
        language: post.language as string,
        result: "held",
        detail:
          `There is no publisher for ${platform} yet (${platformSpec(platform).blockedBy ?? "not enabled"}). ` +
          `The post stays approved and waits.`,
      });
      continue;
    }

    if (!channels.has(platform)) {
      const account = (accounts ?? []).find((a) => a.platform === platform);
      channels.set(
        platform,
        account
          ? await loadChannelCredential(db, account.id as string)
          : { ok: false, reason: `No ${platform} channel is connected.` },
      );
    }
    const cred = channels.get(platform)!;
    if (!cred.ok) {
      outcomes.push({
        id: post.id as string,
        platform,
        language: post.language as string,
        result: "held",
        detail: cred.reason,
      });
      continue;
    }

    /**
     * 🔑 CLAIM IT BEFORE CALLING FACEBOOK, and count the attempt at the same
     * time. The cron runs every minute; two overlapping invocations reading
     * the same `approved` row would both publish it. Moving it to
     * `publishing` first means the second run does not see it at all — and if
     * this process dies mid-call the row stays `publishing`, which is a
     * visible stuck state rather than an invisible double post.
     */
    const { error: claimError, count } = await db
      .from("social_posts")
      .update({
        status: "publishing",
        attempts: (post.attempts as number) + 1,
        updated_at: now.toISOString(),
      }, { count: "exact" })
      .eq("id", post.id)
      // ⛔ The guard that makes this a claim rather than a write: only the run
      // that still sees `approved` gets it.
      .eq("status", "approved");

    if (claimError || count === 0) {
      outcomes.push({
        id: post.id as string,
        platform,
        language: post.language as string,
        result: "held",
        detail: claimError ? claimError.message : "Another run claimed this post first.",
      });
      continue;
    }

    /**
     * 🔑 ONE SHAPE FOR BOTH CHANNELS, so everything after this point — the
     * success write, the failure write, the unverified rule — is written
     * once. ⛔ Two copies of "what to do when a publish fails" is two places
     * to get the duplicate-post rule wrong.
     */
    type PublishResult =
      | { ok: true; postId: string; url: string }
      | { ok: false; kind: string; message: string };
    let result: PublishResult;

    if (platform === "instagram") {
      /**
       * 🔴 THERE IS NO TEXT-ONLY INSTAGRAM POST. Facebook will take words on
       * their own; Instagram will not. A post that arrives here without a
       * card is not a post that goes out as words — it is a post that does
       * not go out.
       */
      if (post.media_kind !== "graphic") {
        await db
          .from("social_posts")
          .update({ status: "approved", last_error: "Instagram needs a picture", updated_at: new Date().toISOString() })
          .eq("id", post.id);
        outcomes.push({
          id: post.id as string,
          platform,
          language: post.language as string,
          result: "failed",
          detail:
            "Instagram has no text-only post, and this one has no card. ⛔ Nothing was published. " +
            "▶️ Give it a graphic in the composer.",
        });
        continue;
      }

      /**
       * 🔴 THE CARD IS CHECKED BY FETCHING IT, not by rendering it again.
       *
       * Instagram fetches `image_url` ITSELF, from Meta's servers, with none
       * of our credentials. So the question that matters is not "does this
       * card render here?" — it is "can a stranger on the internet get a JPEG
       * from this URL?". A local re-render answers the wrong question and
       * would pass happily with the site URL wrong, the signature mismatched,
       * or deployment protection in front of the route.
       */
      const cardUrl = cardUrlFor(post.id as string);
      const reachable = await cardReaches(cardUrl);
      if (!reachable.ok) {
        await db
          .from("social_posts")
          .update({ status: "approved", last_error: reachable.why, updated_at: new Date().toISOString() })
          .eq("id", post.id);
        outcomes.push({
          id: post.id as string,
          platform,
          language: post.language as string,
          result: "failed",
          detail: `Instagram would not have been able to fetch the card, so nothing was posted: ${reachable.why}`,
        });
        continue;
      }

      const r = await publishToInstagram({
        token: cred.token,
        igUserId: cred.externalId,
        caption: post.body as string,
        imageUrl: cardUrl,
      });
      result = r.ok
        ? { ok: true, postId: r.mediaId, url: r.url }
        : { ok: false, kind: r.kind, message: r.message };
    } else {
      let picture: Uint8Array | undefined;
      if (post.media_kind === "graphic") {
        const rendered = await renderPostPictureBytes({
          platform,
          language: post.language as string,
          // ⛔ The card's headline ⇒ headlineFor. Omitting it here and not in the
          // admin would mean the published card differs from the one approved.
          subject: post.subject as string | null,
          body: post.body as string,
          media_kind: post.media_kind as string | null,
          visual_recipe: post.visual_recipe,
        });
        if (!rendered.ok) {
          /**
           * ⛔ A POST THAT WAS MEANT TO HAVE A PICTURE DOES NOT GO OUT WITHOUT
           * ONE. The card carries the brand marks and, on several shapes, the
           * line that makes the words make sense. Publishing the text alone
           * would be publishing something nobody approved.
           */
          await db
            .from("social_posts")
            .update({ status: "approved", last_error: rendered.failure.error, updated_at: new Date().toISOString() })
            .eq("id", post.id);
          outcomes.push({
            id: post.id as string,
            platform,
            language: post.language as string,
            result: "failed",
            detail: `The picture could not be rendered, so nothing was posted: ${rendered.failure.error}`,
          });
          continue;
        }
        picture = rendered.bytes;
      }

      result = await publishToFacebook({
        token: cred.token,
        pageId: cred.externalId,
        message: post.body as string,
        picture,
      });
    }

    if (result.ok) {
      await db
        .from("social_posts")
        .update({
          status: "published",
          external_post_id: result.postId,
          external_url: result.url,
          published_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);
      outcomes.push({
        id: post.id as string,
        platform,
        language: post.language as string,
        result: "published",
        url: result.url,
      });
      continue;
    }

    /**
     * 🔴 A TIMEOUT ON THE POST CALL IS NOT A FAILURE — IT IS AN UNKNOWN.
     * The request may have been received and the post may exist. ⛔ Putting
     * the row back to `approved` would publish it twice on the next run, so
     * it stays `failed` with the attempt spent and a sentence telling a human
     * to look. A duplicate on a timeline cannot be un-seen; a post that needed
     * one click to re-approve can.
     */
    const unverified = result.kind === "network";
    await db
      .from("social_posts")
      .update({
        status: "failed",
        last_error: result.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    outcomes.push({
      id: post.id as string,
      platform,
      language: post.language as string,
      result: unverified ? "unverified" : "failed",
      detail: result.message,
    });
  }

  const published = outcomes.filter((o) => o.result === "published").length;
  return NextResponse.json({
    ran: true,
    at: now.toISOString(),
    due: due.length,
    published,
    outcomes,
    note:
      published > 0
        ? `${published} post(s) are live.`
        : "Nothing was published this run.",
  });
}
