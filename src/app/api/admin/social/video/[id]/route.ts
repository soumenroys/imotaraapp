// GET /api/admin/social/video/[id] — let the REVIEWER see a video post before approving it
//
// 🔴 26 Nov 2026: the admin showed nothing at all for a short_video or animated_gif draft —
// no video, no picture, only the words. The owner approved the Sun 6 Dec Instagram video
// without seeing it ("preview not generated"). The video is only encoded at APPROVAL
// (ensureCard), so before approval there was nothing to show, and the public route
// (/api/social/video/[id]) deliberately serves approved/published posts only.
//
// 🔑 What this answers:
//   1. The STORED video when one exists (after approval) — the exact bytes that publish.
//   2. Otherwise a PREVIEW rendered now with the same renderer approval uses, NOT stored.
//      ⛔ Without the animated background (ensureAnimatedPicture): that one is a PAID clip
//      rationed to one per two weeks, and a preview must never spend it. Approval may add
//      it, so the final can have a moving background where the preview's is still — the
//      `x-imotara-preview` header says which one this is, and the admin page says so.
//
// ⛔ Admin-only (requireSocialAdmin), like the picture route — a draft's media is not public.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getVideo } from "@/lib/social/cardStore";
import { renderAnimation, formatForChannel } from "@/lib/social/renderAnimation";
import type { PictureSource } from "@/lib/social/renderPicture";

// Rendering a preview is seconds of ffmpeg.
export const maxDuration = 120;

const VIDEO_KINDS = new Set(["short_video", "animated_gif"]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const { data: post, error } = await db
    .from("social_posts")
    .select("id, platform, language, subject, body, media_kind, visual_recipe, topic_pool, illustration")
    .eq("id", id)
    .single();
  if (error || !post) return NextResponse.json({ error: "no such post" }, { status: 404 });
  if (!VIDEO_KINDS.has((post.media_kind as string) ?? "")) {
    return NextResponse.json({ error: "This post is not a video." }, { status: 404 });
  }

  const format = formatForChannel(post.platform as string, post.media_kind as string);
  const contentType = format === "mp4" ? "video/mp4" : "image/gif";

  const stored = await getVideo(id, format);
  if (stored) {
    return new NextResponse(Buffer.from(stored), {
      headers: {
        "content-type": contentType,
        "content-length": String(stored.byteLength),
        "cache-control": "private, no-store",
        "x-imotara-preview": "stored",
      },
    });
  }

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
    console.error("[admin/social/video] preview failed", { id, format, error: made.error });
    return NextResponse.json({ error: made.error }, { status: made.status });
  }
  return new NextResponse(Buffer.from(made.bytes), {
    headers: {
      "content-type": contentType,
      "content-length": String(made.bytes.byteLength),
      "cache-control": "private, no-store",
      "x-imotara-preview": "rendered",
    },
  });
}
