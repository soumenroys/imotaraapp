// GET /api/admin/social/animation/[id] — the moving version of a post's card.
//
// 🔑 RENDERED ON DEMAND, like the still. The recipe is stored; the frames are
// derived from it. ⇒ No storage bucket, nothing to migrate, and a palette fix
// improves every past post rather than only the next one.
//
// 🔴 AND IT RENDERS THE SAME WAY THE PUBLISHER DOES, WHICH IT DID NOT UNTIL
// 19 OCT. This route had its own copy of the whole pipeline — its own
// `toElement`, its own `loadFont`, its own storyboard call and its own encode,
// about a hundred lines of it. Duplication is not a tidiness complaint; it is
// how two things that must agree stop agreeing. By the time it was read, the
// preview differed from what publishes in FOUR ways:
//
//   • no narration at all, so the admin approved a silent video and a spoken
//     one went out
//   • `supportFromBody` — ONE sentence — against the publisher's whole body,
//     so a four-scene post previewed as one scene
//   • `headlineFromBody(body)` against the publisher's
//     `headlineFor(subject, body)`, so the two could show different headlines
//   • the eyebrow, which had to be added here separately and would have been
//     missed if this file had not been opened for another reason
//
// ⇒ It now calls `renderAnimation`, the renderer that was extracted for
// exactly this and that `ensureCard` already used. ⛔ Nothing about a card may
// be decided in a route.
//
// ⛔ Every frame is the SAME picture with fewer parts showing. No frame can
// introduce a word the gate has not read, because no frame introduces words.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { renderAnimation } from "@/lib/social/renderAnimation";
import { MIME, type AnimationFormat } from "@/lib/social/animate";

// ⚠️ Encoding is the slow part, not rendering — and speaking the post adds a
// call per sentence before any of it ⇒ speech.ts.
export const maxDuration = 120;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const format = (req.nextUrl.searchParams.get("format") ?? "mp4") as AnimationFormat;
  if (format !== "gif" && format !== "mp4") {
    return NextResponse.json({ error: "format must be gif or mp4" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: post, error } = await db
    .from("social_posts")
    .select("id, language, platform, subject, body, media_kind, visual_recipe, topic_pool")
    .eq("id", id)
    .single();

  if (error || !post) return NextResponse.json({ error: "no such post" }, { status: 404 });

  const made = await renderAnimation(
    {
      platform: post.platform as string,
      language: post.language as string,
      subject: post.subject as string | null,
      body: post.body as string,
      media_kind: post.media_kind as string | null,
      visual_recipe: post.visual_recipe,
      topic_pool: post.topic_pool as string | null,
    },
    format,
  );

  if (!made.ok) {
    /**
     * ⚠️ LOGGED AS WELL AS RETURNED, and that was learned the hard way. A 422
     * carrying a body is not an exception: Vercel logged NOTHING for three
     * rounds of this while the browser had the message all along
     * ⇒ the same pairing in ensureCard.
     */
    console.error("[admin/animation] the animation failed", {
      postId: id,
      format,
      status: made.status,
      error: made.error,
    });
    return NextResponse.json({ error: made.error }, { status: made.status });
  }

  return new Response(new Uint8Array(made.bytes), {
    headers: {
      "content-type": MIME[format],
      "content-length": String(made.bytes.length),
      // ⚠️ `private` — it is a draft nobody has approved.
      "cache-control": "private, max-age=300",
      // 🔑 So a slow preview can be told from a slow network.
      "x-render-ms": String(made.ms),
    },
  });
}
