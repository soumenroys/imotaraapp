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
import { loadChannelCredential, loadCredentialFor } from "@/lib/social/channelCredentials";
import { publishToFacebook, publishVideoToFacebook } from "@/lib/social/adapters/facebook";
import { publishShortToYouTube, youtubeTitleFrom, TITLE_MAX } from "@/lib/social/adapters/youtube";
import { publishToInstagram, publishCarouselToInstagram, publishReelToInstagram } from "@/lib/social/adapters/instagram";
import { publishToX, uploadXMedia } from "@/lib/social/adapters/x";
import { postToLinkedIn } from "@/lib/social/linkedinPost";
import { renderPostPictureBytes, type PictureSource } from "@/lib/social/renderPicture";
import { publicOrigin, videoUrlFor } from "@/lib/social/cardUrl";
import { instagramCardPlan } from "@/lib/social/instagramCardPlan";
import { platformSpec } from "@/lib/social/platforms";
import { mediaPlan } from "@/lib/social/mediaPlan";
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
 * 🔴 A PRE-FLIGHT FAILURE HANDS THE POST BACK — UNTIL ITS ATTEMPTS ARE SPENT.
 * Each run claims the post and spends one attempt; the query only takes posts
 * under MAX_ATTEMPTS. A post released as 'approved' on its last attempt was
 * never selected again and still read "Ready to go" — for ever (review, 24 Oct).
 * ⇒ On the last attempt it becomes 'failed', with the reason, where Today's
 * Problems view and the admin's To do show it.
 */
function release(post: Record<string, unknown>, why: string) {
  const spent = (Number(post.attempts) || 0) + 1 >= MAX_ATTEMPTS;
  return { status: spent ? "failed" : "approved", last_error: why, updated_at: new Date().toISOString() };
}

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
async function cardReaches(
  url: string,
  /**
   * ⚠️ WHAT THE ANSWER MUST BE, because the two media types have different
   * requirements and getting it wrong fails at the platform rather than here.
   * ⛔ Instagram accepts JPEG and nothing else for a picture; a video must be
   * video/* (or image/gif for X). A check that accepted anything would pass a
   * JSON error page as a card.
   */
  expect: RegExp = /^image\/jpeg/,
): Promise<{ ok: true } | { ok: false; why: string }> {
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
    if (!expect.test(type)) {
      return {
        ok: false,
        why: `${url} answered ${res.status} but with "${type}", which is not what this post needs.`,
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
    .select("id, platform, language, subject, body, slides, media_kind, visual_recipe, attempts, scheduled_for, topic_pool, illustration")
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
          ? platform === "youtube"
            /**
             * 🔴 YOUTUBE IS THE ONE CHANNEL WHERE THE STORED SECRET IS NOT THE
             * ONE WE SEND. Google's access tokens last about an hour, so the
             * row holds a REFRESH token and an access token is minted here,
             * immediately before use ⇒ youtubeAuth.ts.
             *
             * 🔑 Inside the per-platform cache deliberately: one refresh per
             * run, however many Shorts are due, for the same reason the other
             * channels decrypt once — fewer chances to mishandle a credential.
             */
            ? await loadCredentialFor(db, account.id as string, "youtube", publicOrigin())
            : platform === "x"
              // 🔴 X mints per use too, and ROTATES its refresh token ⇒ loadCredentialFor stores the new one.
              ? await loadCredentialFor(db, account.id as string, "x", publicOrigin())
              : await loadChannelCredential(db, account.id as string)
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

    /**
     * 🔴 CAN THIS CHANNEL PUBLISH WHAT THIS POST IS MADE OF? ASKED FIRST,
     * FOR BOTH CHANNELS, BECAUSE ONE OF THEM WAS NOT ASKING ⇒ mediaPlan.ts.
     *
     * ⛔ THE HOLE: the Facebook branch rendered a picture only `if
     * (media_kind === "graphic")` and then published whatever it had. Every
     * other kind fell through with no media and no complaint — so a
     * `short_video` post would have gone out as BARE TEXT, under the brand's
     * name, with the video it was written around simply absent. Nothing would
     * have logged, warned or failed.
     *
     * ⚠️ The shapes exist and the publish paths do not: animate.ts encodes
     * MP4 and GIF, the admin previews them, the schedule form offers them,
     * and no adapter has ever called Facebook's /videos or Instagram's Reels
     * flow. A feature half-built is fine; one that FAILS OPEN is not.
     */
    const media = mediaPlan(platform, post.media_kind as string | null);
    if (!media.ok) {
      await db
        .from("social_posts")
        .update(release(post, media.why))
        .eq("id", post.id);
      outcomes.push({
        id: post.id as string,
        platform,
        language: post.language as string,
        result: "failed",
        detail: media.why,
      });
      continue;
    }

    /**
     * 🔴 MOTION TAKES A DIFFERENT CALL ON BOTH CHANNELS, and it is answered
     * BEFORE the picture branches — because the picture branches would
     * otherwise happily publish a video post's words with a still card, or
     * with nothing at all.
     *
     * ⚠️ Meta fetches the file ITSELF, so the bytes must already be stored
     * and reachable ⇒ /api/social/video/[id], written at approval.
     */
    if (post.media_kind === "short_video" || post.media_kind === "animated_gif") {
      const videoUrl = videoUrlFor(post.id as string, publicOrigin());
      const reachable = await cardReaches(videoUrl, /^video\/|^image\/gif/);
      if (!reachable.ok) {
        await db
          .from("social_posts")
          .update(release(post, reachable.why))
          .eq("id", post.id);
        outcomes.push({
          id: post.id as string,
          platform,
          language: post.language as string,
          result: "failed",
          detail: `The video could not be fetched, so nothing was posted: ${reachable.why}`,
        });
        continue;
      }

      /**
       * 🔴 YOUTUBE DOES NOT FETCH — IT IS FED. Meta and Instagram take a URL
       * and collect the file themselves, which is why the reachability check
       * above exists. Google's `videos.insert` wants the BYTES in the request.
       *
       * ⚠️ So the fetch that the other two channels make from the outside, we
       * make from the inside — and a failure here is ours, not Google's, which
       * is why it is reported separately rather than as a refused upload.
       */
      let r:
        | { ok: true; postId?: string; mediaId?: string; videoId?: string; url: string }
        | { ok: false; kind: string; message: string };

      if (platform === "youtube") {
        /**
         * ⛔ ASKED BEFORE THE BYTES ARE FETCHED. Downloading a video and then
         * discovering there is no usable title wastes the transfer and, worse,
         * puts the failure after the expensive step where it reads like an
         * upload problem.
         */
        const title = youtubeTitleFrom(post.subject as string | null, post.body as string);
        if (!title) {
          outcomes.push({
            id: post.id as string,
            platform,
            language: post.language as string,
            result: "held",
            detail:
              `No title under ${TITLE_MAX} characters could be taken from this post's own approved words, ` +
              `and a Short must have one. ⛔ Nothing was invented to fill it. ▶️ Give the post a shorter ` +
              `subject, or a shorter opening sentence.`,
          });
          // ⛔ The row was claimed as 'publishing'; leaving it there stranded it for ever.
          await db.from("social_posts").update({ ...release(post, "No title short enough for a YouTube Short."), status: "failed" }).eq("id", post.id);
          continue;
        }

        let bytes: Uint8Array;
        try {
          const res = await fetch(videoUrl);
          if (!res.ok) throw new Error(`${res.status} from our own video route`);
          bytes = new Uint8Array(await res.arrayBuffer());
        } catch (e) {
          outcomes.push({
            id: post.id as string,
            platform,
            language: post.language as string,
            result: "failed",
            detail: `The video could not be read for upload, so nothing was posted: ${(e as Error).message}`,
          });
          await db.from("social_posts").update(release(post, `The video could not be read for upload: ${(e as Error).message}`)).eq("id", post.id);
          continue;
        }

        r = await publishShortToYouTube({
          accessToken: cred.token,
          /**
           * ⛔ THE TITLE IS THE POST'S OWN FIRST LINE, never an invention.
           * YouTube requires a title and the body is written as a post, so the
           * headline is taken from it rather than generated — a title nobody
           * approved is a title nobody approved
           * ⇒ trap_a_model_invents_specifics_it_cannot_have.
           */
          title,
          description: post.body as string,
          videoBytes: bytes,
          /**
           * 🔴 DECLARED EXPLICITLY ON EVERY UPLOAD, both of them. Imotara is
           * not child-directed and its own minimum age is 18; and an omitted
           * privacy value defaults to public only on SOME accounts, which is
           * not a thing to leave to a default when the result is a video
           * appearing on a live channel.
           */
          madeForKids: false,
          privacyStatus: "public",
        });
      } else if (platform === "instagram") {
        r = await publishReelToInstagram({
          token: cred.token,
          igUserId: cred.externalId,
          caption: post.body as string,
          videoUrl,
        });
      } else {
        r = await publishVideoToFacebook({
          token: cred.token,
          pageId: cred.externalId,
          message: post.body as string,
          videoUrl,
        });
      }

      result = r.ok
        ? {
            ok: true,
            postId: ("mediaId" in r && r.mediaId) || ("videoId" in r && r.videoId) || r.postId || "",
            url: r.url,
          }
        : { ok: false, kind: r.kind, message: r.message };
    } else if (platform === "instagram") {
      /**
       * 🔑 THE DECISION IS MADE IN A FUNCTION THAT CAN BE TESTED, and this
       * route does the part that cannot be undone ⇒ instagramCardPlan.ts.
       * Its three refusals are the three ways a carousel publishes as
       * something nobody approved.
       */
      const plan = instagramCardPlan(
        {
          id: post.id as string,
          subject: post.subject as string | null,
          slides: post.slides as string[] | null,
          media_kind: post.media_kind as string | null,
        },
        publicOrigin(),
      );
      if (!plan.ok) {
        await db
          .from("social_posts")
          .update(release(post, plan.why))
          .eq("id", post.id);
        outcomes.push({
          id: post.id as string,
          platform,
          language: post.language as string,
          result: "failed",
          detail: plan.hint,
        });
        continue;
      }
      const cardUrls = plan.urls;

      /**
       * 🔴 THE CARDS ARE CHECKED BY FETCHING THEM, not by rendering again.
       *
       * Instagram fetches each `image_url` ITSELF, from Meta's servers, with
       * none of our credentials. So the question that matters is not "does
       * this card render here?" — it is "can a stranger on the internet get a
       * JPEG from this URL?". A local re-render answers the wrong question and
       * would pass happily with the site URL wrong, the signature mismatched,
       * or deployment protection in front of the route.
       *
       * ⚠️ EVERY CARD, not just the first. One unreachable slide fails the
       * whole post at Meta's end, after some children have already been
       * built — and the error it returns talks about "media".
       */
      let unreachable: { ok: false; why: string } | undefined;
      for (const [i, url] of cardUrls.entries()) {
        const reachable = await cardReaches(url);
        if (!reachable.ok) {
          unreachable = {
            ok: false,
            why: cardUrls.length > 1 ? `Card ${i + 1} of ${cardUrls.length}: ${reachable.why}` : reachable.why,
          };
          break;
        }
      }
      if (unreachable) {
        await db
          .from("social_posts")
          .update(release(post, unreachable.why))
          .eq("id", post.id);
        outcomes.push({
          id: post.id as string,
          platform,
          language: post.language as string,
          result: "failed",
          detail: `Instagram would not have been able to fetch the card, so nothing was posted: ${unreachable.why}`,
        });
        continue;
      }

      /**
       * ⚠️ DISPATCHED ON HOW MANY CARDS THERE ARE, not on `media_kind`. The
       * two are kept in step by the refusal above; branching on the count is
       * what makes "several cards" and "the carousel call" impossible to get
       * out of step here.
       */
      const r =
        cardUrls.length > 1
          ? await publishCarouselToInstagram({
              token: cred.token,
              igUserId: cred.externalId,
              caption: post.body as string,
              imageUrls: cardUrls,
            })
          : await publishToInstagram({
              token: cred.token,
              igUserId: cred.externalId,
              caption: post.body as string,
              imageUrl: cardUrls[0],
            });
      result = r.ok
        ? { ok: true, postId: r.mediaId, url: r.url }
        : { ok: false, kind: r.kind, message: r.message };
    } else if (platform === "facebook") {
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
          topic_pool: post.topic_pool as string | null,
          /**
           * 🔑 THE BACKGROUND, and the comment three lines above is exactly
           * why: a field passed in the admin and omitted here means the
           * PUBLISHED card differs from the one somebody approved.
           */
          illustration: post.illustration as PictureSource["illustration"],
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
            .update(release(post, rendered.failure.error))
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
    } else if (platform === "x") {
      let mediaId: string | undefined;
      let failed: PublishResult | null = null;
      if (post.media_kind === "graphic") {
        const rendered = await renderPostPictureBytes({
          platform,
          language: post.language as string,
          subject: post.subject as string | null,
          body: post.body as string,
          media_kind: post.media_kind as string | null,
          visual_recipe: post.visual_recipe,
          topic_pool: post.topic_pool as string | null,
          illustration: post.illustration as PictureSource["illustration"],
        });
        if (!rendered.ok) {
          await db
            .from("social_posts")
            .update(release(post, rendered.failure.error))
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
        const up = await uploadXMedia({ token: cred.token, bytes: rendered.bytes, contentType: "image/png" });
        if (up.ok) mediaId = up.mediaId;
        else failed = { ok: false, kind: up.kind, message: `The card could not be uploaded to X: ${up.message}` };
      }
      if (failed) {
        result = failed;
      } else {
        const r = await publishToX({ token: cred.token, text: post.body as string, mediaId });
        result = r.ok ? { ok: true, postId: r.postId, url: r.url } : { ok: false, kind: r.kind, message: r.message };
      }
    } else if (platform === "linkedin") {
      let picture: Uint8Array | undefined;
      if (post.media_kind === "graphic") {
        const rendered = await renderPostPictureBytes({
          platform,
          language: post.language as string,
          subject: post.subject as string | null,
          body: post.body as string,
          media_kind: post.media_kind as string | null,
          visual_recipe: post.visual_recipe,
          topic_pool: post.topic_pool as string | null,
          illustration: post.illustration as PictureSource["illustration"],
        });
        if (!rendered.ok) {
          await db
            .from("social_posts")
            .update(release(post, rendered.failure.error))
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

      // 🔑 Upload, wait for LinkedIn to finish processing, then post ⇒
      // linkedinPost.ts, which also decides which failures may be live.
      result = await postToLinkedIn({
        token: cred.token,
        organizationId: cred.externalId,
        text: post.body as string,
        picture,
        altText: (post.subject as string | null) ?? undefined,
      });
    } else {
      /**
       * ⛔ A CHANNEL THAT SAYS IT CAN PUBLISH AND HAS NO BRANCH HERE.
       *
       * 🔴 THE DEFECT THIS REPLACES. Until 19 Oct the Facebook branch above
       * had NO CONDITION — it was "Facebook" by position rather than by
       * name. Any platform reaching it would have been handed to
       * `publishToFacebook` WITH ITS OWN TOKEN, and the failure would have
       * read as a Facebook problem on a post that was never for Facebook.
       *
       * 🔑 THE CASE THAT IS ACTUALLY REACHABLE is this one: somebody flips
       * `canPublish` to true in platforms.ts — a one-word change that reads
       * like paperwork — and the posts go nowhere. ✅ LinkedIn flipped it on
       * 28 Oct 2026, with its branch above.
       *
       * ⚠️ I first wrote a `!canPublish` branch here too. It was DEAD: this
       * route already refuses such a post higher up, marking it `held` and
       * leaving it approved, which is better than failing it
       * ⇒ trap_code_after_an_early_return_is_dead_code. Found by reading the
       * route rather than by testing the branch I had just written.
       */
      result = {
        ok: false,
        kind: "config",
        message:
          `${platformSpec(platform).label} is marked as able to publish, but this route has no ` +
          `adapter branch for it. ⛔ Nothing was sent. ▶️ Wire it in social-publish, next to Facebook.`,
      };
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
