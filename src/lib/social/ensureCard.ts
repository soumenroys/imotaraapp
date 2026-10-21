// src/lib/social/ensureCard.ts
// Draw and keep the cards a post needs, if it needs any kept.
//
// 🔑 CALLED AT APPROVAL. A human pressing approve can afford three seconds;
// Instagram fetching the picture it is about to publish cannot
// ⇒ docs/sql/social_card_store.sql.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { composePicture } from "@/lib/social/compose";
import { renderShapedCard } from "@/lib/social/shapedRenderer";
import { putCard, putVideo } from "@/lib/social/cardStore";
import { cardPlan, shapedFaces } from "@/lib/social/needsShaping";
import { renderAnimation, formatForChannel } from "@/lib/social/renderAnimation";
import type { PictureSource } from "@/lib/social/renderPicture";
import { cardsForPost } from "@/lib/social/cards";
import { allQrCodes, QR_COUNT } from "@/lib/social/brandMarks";
import { headlineFor, supportFromBody, type Recipe } from "@/lib/social/visualRecipe";
import { platformSpec } from "@/lib/social/platforms";
import { eyebrowFor } from "@/lib/social/topicPools";

export type EnsureResult =
  /** Nothing to do — Satori draws this one on demand, as always. */
  | { ok: true; kind: "derived" }
  | { ok: true; kind: "stored"; paths: string[]; ms: number }
  | { ok: false; error: string };

/**
 * Make sure this post has pictures it can actually publish.
 *
 * ⛔ REFUSES RATHER THAN APPROVING A POST THAT CANNOT PRODUCE A CARD. On
 * Instagram a card is not decoration — there is no text-only post — so
 * approving one whose script nobody has confirmed would queue something the
 * publisher must hold on every run forever, and the only symptom would be a
 * channel going quiet.
 */
export async function ensureCard(postId: string): Promise<EnsureResult> {
  const db = getSupabaseAdmin();
  const { data: post, error } = await db
    .from("social_posts")
    .select("id, platform, language, subject, body, slides, media_kind, visual_recipe, topic_pool, illustration")
    .eq("id", postId)
    .single();

  if (error || !post) return { ok: false, error: "That post could not be read." };

  /**
   * 🔑 A MOVING CARD IS ENCODED HERE TOO, and for the same reason the shaped
   * stills are: Meta fetches the URL itself and ffmpeg must not be on that
   * request ⇒ /api/social/video/[id].
   *
   * ⚠️ The FORMAT follows the channel, not the stored shape. An animated GIF
   * animates on X and nowhere else — LinkedIn strips it and Facebook converts
   * it, both silently ⇒ renderAnimation.formatForChannel.
   */
  if (post.media_kind === "animated_gif" || post.media_kind === "short_video") {
    const format = formatForChannel(post.platform as string, post.media_kind as string);
    const started = Date.now();
    const made = await renderAnimation(
      {
        platform: post.platform as string,
        language: post.language as string,
        subject: post.subject as string | null,
        body: post.body as string,
        media_kind: post.media_kind as string | null,
        visual_recipe: post.visual_recipe,
        topic_pool: post.topic_pool as string | null,
        illustration: post.illustration as PictureSource["illustration"],
      },
      format,
    );
    if (!made.ok) {
      // ⚠️ Logged as well as returned. The 422 body reaches the admin's
      // banner and is truncated there; nothing reached Vercel at all.
      console.error("[ensureCard] the animation failed", { postId, format, error: made.error });
      return { ok: false, error: made.error };
    }

    const put = await putVideo(postId, format, made.bytes);
    if (!put.ok) return { ok: false, error: put.error };

    await db.from("social_posts").update({ media_path: put.path }).eq("id", postId);
    return { ok: true, kind: "stored", paths: [put.path], ms: Date.now() - started };
  }

  // A post with no picture has nothing to store either way.
  if (post.media_kind !== "graphic" && post.media_kind !== "carousel") return { ok: true, kind: "derived" };

  const plan = cardPlan(post.language as string);
  if (plan.how === "derive") return { ok: true, kind: "derived" };
  if (plan.how === "refuse") return { ok: false, error: plan.why };

  const recipe = post.visual_recipe as Recipe | null;
  if (!recipe) return { ok: false, error: "This post has no stored recipe, so no card can be drawn." };

  const cards = cardsForPost({ subject: post.subject as string | null, slides: post.slides as string[] | null });
  const faces = shapedFaces(post.language as string);
  const spec = platformSpec(post.platform as string);
  const started = Date.now();
  const paths: string[] = [];

  for (const [slide, text] of cards.entries()) {
    /**
     * 🔑 THE SAME RULES AS THE DERIVED PATH, because the reviewer is
     * approving one card per slide and must see what publishes: the headline
     * comes from the subject on card 0 and from the slide after it, the
     * support line only ever appears on card 0, and the QR codes only on the
     * last card of a carousel ⇒ renderPicture.ts.
     */
    const isCarousel = cards.length > 1;
    const headline = slide > 0 ? text : (headlineFor(post.subject as string, post.body as string) ?? text);
    const support = slide > 0 ? undefined : (supportFromBody(post.body as string, 150, 0) ?? undefined);
    const onLast = !isCarousel || slide === cards.length - 1;

    const qrCodes =
      (QR_COUNT[post.platform as string] ?? 0) > 0 && spec.qr && onLast
        ? await allQrCodes(post.platform as string)
        : undefined;

    const picture = composePicture({
      recipe,
      headline,
      support,
      language: post.language as string,
      platform: post.platform as string,
      qrCodes,
      counter: isCarousel ? { index: slide + 1, total: cards.length } : undefined,
      /**
       * ⚠️ THE COMPILER CANNOT CATCH THIS ONE, which is why it is spelled out.
       * `ComposeInput.eyebrow` is optional — it has to be, because the
       * shaping-check diagnostic composes a synthetic card with no post
       * behind it. So omitting it here would compile, and the APPROVED card
       * stored in the bucket would quietly differ from the one the review
       * screen drew ⇒ pinned in aCardSaysOnlyWhatThePostIsAbout.
       */
      eyebrow: eyebrowFor(post.topic_pool as string | null, post.language as string),
    });

    const drawn = await renderShapedCard({
      root: picture.root,
      width: picture.width,
      height: picture.height,
      faces,
    });
    if (!drawn.ok) return { ok: false, error: `Card ${slide + 1}: ${drawn.error}` };

    const put = await putCard(postId, slide, drawn.bytes);
    if (!put.ok) return { ok: false, error: `Card ${slide + 1}: ${put.error}` };
    paths.push(put.path);
  }

  /**
   * ⚠️ `media_path` records the FIRST card only, as a marker that this post's
   * pictures are stored. The card route looks a slide up by path rather than
   * reading this ⇒ cardStore.cardPath, so a carousel does not need a column
   * per slide.
   */
  await db.from("social_posts").update({ media_path: paths[0] ?? null }).eq("id", postId);

  return { ok: true, kind: "stored", paths, ms: Date.now() - started };
}
