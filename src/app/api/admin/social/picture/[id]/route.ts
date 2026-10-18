// GET /api/admin/social/picture/[id] — render a post's picture as a PNG
//
// 🔑 RENDERED ON DEMAND, NOT STORED. The recipe is stored; the pixels are
// derived from it. So a palette fix or a layout correction improves every past
// picture, and nothing has to be re-rendered or migrated.
//
// 🔴 THE RENDERER ITSELF MOVED OUT ⇒ src/lib/social/renderPicture.ts, because
// the publisher needs the same bytes and cannot be handed a URL behind
// `requireSocialAdmin`. ⛔ Two renderers would mean the card a reviewer
// approved and the card the world sees could differ — silently, and only on
// the one nobody can check afterwards.
//
// ⚠️ The constraints that shaped it still live in src/lib/social/fonts.ts: a
// hard 500 KB `next/og` budget including fonts, which is why the font is
// fetched per render rather than bundled, and no full complex-script shaping,
// which is why a wordmark is set in Latin until somebody who reads the script
// has confirmed a rendered picture.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { renderPostPicture } from "@/lib/social/renderPicture";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const { data: post, error } = await db
    .from("social_posts")
    .select("id, language, platform, subject, body, media_kind, visual_recipe")
    .eq("id", id)
    .single();

  if (error || !post) return NextResponse.json({ error: "no such post" }, { status: 404 });

  const rendered = await renderPostPicture(
    {
      platform: post.platform as string,
      language: post.language as string,
      subject: post.subject as string | null,
      body: post.body as string,
      media_kind: post.media_kind as string | null,
      visual_recipe: post.visual_recipe,
    },
    {
      // Derived from a stored recipe and the post's body: safe to cache, and
      // invalidated by the post id changing when the words are edited.
      "cache-control": "private, max-age=300",
    },
  );

  if (!rendered.ok) {
    return NextResponse.json({ error: rendered.failure.error }, { status: rendered.failure.status });
  }
  return rendered.picture.response;
}
