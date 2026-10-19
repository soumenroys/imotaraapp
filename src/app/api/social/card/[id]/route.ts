// GET /api/social/card/[id]?t=<signature> — the post's card, to a stranger
//
// 🔴 THE ONLY PUBLIC ROUTE IN THIS FEATURE, and it exists for one reason.
// Facebook takes the picture as bytes; Instagram does not. Instagram's
// Content Publishing API is handed an `image_url` and FETCHES IT ITSELF, from
// Meta's servers, carrying none of our credentials. So the card has to be
// reachable without signing in, or Instagram cannot publish ⇒ cardUrl.ts.
//
// ⛔ PUBLIC IS NOT THE SAME AS OPEN. Three things narrow it, and all three
// matter:
//   1. the signature — 128 bits, constant-time compared, so the route cannot
//      be walked by trying ids;
//   2. the status — only words already approved for publication
//      ⇒ FETCHABLE_STATUSES. A draft is not fetchable even with a valid link;
//   3. the content — a card is the post's own words plus the brand marks.
//      Nothing about a reader, an account or a conversation is reachable here.
//
// ⚠️ NO `noindex` HEADER WOULD HELP and none is relied on: the protection is
// that the URL cannot be guessed, not that crawlers are asked politely.
// ⛔ It is served without `Vary` games or cookies — a response that depended
// on a session would be a response Instagram's fetcher never sees.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { renderPostPictureJpeg } from "@/lib/social/renderPicture";
import { cardSignatureValid, cardIsFetchable } from "@/lib/social/cardUrl";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  /**
   * ⚠️ THE SIGNATURE IS CHECKED BEFORE THE DATABASE IS TOUCHED. Otherwise
   * this route answers "does a post with this id exist?" to anybody who asks,
   * which is a small leak that costs nothing to close.
   */
  /**
   * ⚠️ THE SLIDE IS PART OF WHAT WAS SIGNED ⇒ cardUrl.ts, so a signature for
   * card 2 does not open card 5. ⛔ A non-numeric or negative `s` resolves to
   * 0 and will simply fail the signature, which is the right outcome: an
   * unreadable request is not a request for card 0.
   */
  const slide = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get("s") ?? "0", 10) || 0);

  if (!cardSignatureValid(id, req.nextUrl.searchParams.get("t"), slide)) {
    // ⛔ 404, not 403. A wrong signature and a missing post must look
    // identical from outside; "forbidden" confirms the id was real.
    return new NextResponse("Not found", { status: 404 });
  }

  const db = getSupabaseAdmin();
  const { data: post, error } = await db
    .from("social_posts")
    .select("id, language, platform, subject, body, slides, media_kind, visual_recipe, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !post) return new NextResponse("Not found", { status: 404 });

  if (!cardIsFetchable(post.status as string)) {
    // ⛔ Again 404. A signed link to a post that was later un-approved stops
    // working, and says nothing about why.
    return new NextResponse("Not found", { status: 404 });
  }

  /**
   * 🔴 JPEG, AND THAT IS THE WHOLE REASON THIS ROUTE IS NOT THE ADMIN ONE.
   * Instagram's Content Publishing API documents JPEG and rejects PNG — and
   * `ImageResponse` emits PNG with no format option. Serving PNG here would
   * fail at Instagram's media-container call with an error about the image,
   * which reads like a broken card rather than a wrong container.
   */
  const rendered = await renderPostPictureJpeg({
    platform: post.platform as string,
    language: post.language as string,
    subject: post.subject as string | null,
    body: post.body as string,
    slides: post.slides as string[] | null,
    slide,
    media_kind: post.media_kind as string | null,
    visual_recipe: post.visual_recipe,
  });

  if (!rendered.ok) {
    /**
     * ⛔ A PLACEHOLDER IMAGE WOULD BE THE WORST POSSIBLE ANSWER. Instagram
     * would accept it and publish it, and the first anybody knew would be a
     * broken card on the timeline. An error status makes the publish fail,
     * which is the outcome we want.
     */
    return new NextResponse(rendered.failure.error, { status: rendered.failure.status });
  }

  return new NextResponse(Buffer.from(rendered.bytes), {
    headers: {
      "content-type": "image/jpeg",
      /**
       * ⚠️ `public`, because the fetcher is Meta's cache and not a browser
       * with a session. Five minutes: long enough that the media-container
       * call and any retry inside one publish hit the same bytes, short
       * enough that a card corrected after approval is not served stale to a
       * second attempt.
       */
      "cache-control": "public, max-age=300",
      // ⛔ Asked anyway, though nothing is relied on it: the protection is
      // that the URL cannot be guessed.
      "x-robots-tag": "noindex, noimageindex",
    },
  });
}
