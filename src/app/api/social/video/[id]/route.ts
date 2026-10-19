// GET /api/social/video/[id] — the moving card, for a platform to fetch
//
// 🔴 THE SAME REASON THE CARD ROUTE EXISTS, and the same risks. Meta fetches
// this URL ITSELF, from its own servers, with no credential of ours — both
// Facebook's /videos (file_url) and Instagram's Reels (video_url) do. So the
// bytes must be reachable by a stranger, or nothing can publish.
//
// ⛔ WHICH MEANS THE SIGNATURE IS THE ONLY THING standing between a crawler
// and every draft this system has ever animated ⇒ cardUrl.ts.
//
// ⚠️ SERVED FROM STORAGE, NEVER ENCODED HERE. Five frames plus an MP4 is
// seconds of ffmpeg, and this is the one request that must not be slow. The
// bytes are made when a human approves the post ⇒ ensureCard.ts.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getVideo } from "@/lib/social/cardStore";
import { cardSignatureValid, cardIsFetchable } from "@/lib/social/cardUrl";
import { formatForChannel } from "@/lib/social/renderAnimation";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  /**
   * ⚠️ THE SIGNATURE IS CHECKED BEFORE THE DATABASE IS TOUCHED, so this route
   * does not answer "does a post with this id exist?" to anybody who asks.
   * ⛔ Slide 0, the same scope a still card signs — one post, one secret.
   */
  if (!cardSignatureValid(id, req.nextUrl.searchParams.get("t"), 0)) {
    // ⛔ 404, not 403: a wrong signature and a missing post must look the same.
    return new NextResponse("Not found", { status: 404 });
  }

  const db = getSupabaseAdmin();
  const { data: post, error } = await db
    .from("social_posts")
    .select("id, platform, media_kind, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !post) return new NextResponse("Not found", { status: 404 });
  if (!cardIsFetchable(post.status as string)) return new NextResponse("Not found", { status: 404 });

  const format = formatForChannel(post.platform as string, post.media_kind as string | null);
  const bytes = await getVideo(id, format);

  /**
   * ⛔ A MISSING VIDEO IS A 404, NOT AN ENCODE. Rendering it here would work
   * — and would mean a post could publish a video nobody approved, made from
   * whatever the words say now rather than when they were reviewed.
   */
  if (!bytes) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": format === "mp4" ? "video/mp4" : "image/gif",
      // ⚠️ Meta may fetch this more than once while it transcodes.
      "cache-control": "public, max-age=600",
      "content-length": String(bytes.byteLength),
    },
  });
}
