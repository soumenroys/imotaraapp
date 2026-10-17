// GET /api/admin/social/picture/[id] — render a post's picture as a PNG
//
// 🔑 RENDERED ON DEMAND, NOT STORED. The recipe is stored; the pixels are
// derived from it. So a palette fix or a layout correction improves every past
// picture, and nothing has to be re-rendered or migrated.
//
// ⚠️ `next/og` — Satori plus Resvg — because there is no Chrome in the
// serverless runtime that scripts/generate-youtube-banner.js relies on. Two
// consequences live in src/lib/social/fonts.ts: a hard 500 KB budget including
// fonts, which is why the font is fetched per render rather than bundled, and
// no full complex-script shaping, which is why a wordmark is set in Latin until
// somebody who reads the script has confirmed a rendered picture.

import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { createElement, type ReactElement } from "react";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { composePicture, type Node } from "@/lib/social/compose";
import { platformSpec } from "@/lib/social/platforms";
import { qrDataUri, qrTarget } from "@/lib/social/brandMarks";
import { headlineFromBody, recipeHash, type Recipe } from "@/lib/social/visualRecipe";

/** The tree from compose.ts, as React elements. ⚠️ Keys, because Satori
 *  renders a real React tree and an unkeyed list warns on every render. */
function toElement(node: Node, key = "root"): ReactElement {
  const children = node.children?.map((c, i) => toElement(c, `${key}.${i}`));
  // ⚠️ An <img> is void: passing children to it throws in React, and the
  // logo and the QR are both images.
  if (node.tag === "img") {
    return createElement("img", { key, style: node.style, src: node.src });
  }
  return createElement(
    node.tag,
    { key, style: node.style },
    ...(node.text ? [node.text] : []),
    ...(children ?? []),
  );
}

/**
 * Fonts are fetched, not bundled.
 *
 * ⛔ A FAILED FETCH IS A REFUSAL, not a render without the font. Satori draws
 * nothing at all for text in a family it does not have, so the fallback would
 * be a coloured rectangle with the brand name missing — published, and looking
 * deliberate.
 */
async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(
      `social/picture: the font at ${url} could not be fetched (${res.status}). ` +
        `Refusing to render — Satori draws nothing for text in a missing family, so the picture ` +
        `would come out as a coloured rectangle with no words on it.`,
    );
  }
  return res.arrayBuffer();
}

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
  if (post.media_kind !== "graphic" || !post.visual_recipe) {
    return NextResponse.json({ error: "This post has no picture." }, { status: 404 });
  }

  const stored = post.visual_recipe as Partial<Recipe>;
  if (!stored.layout || !stored.palette || !stored.typeTreatment || !stored.motif || !stored.script) {
    return NextResponse.json({ error: "The stored recipe is incomplete." }, { status: 422 });
  }
  const recipe: Recipe = {
    layout: stored.layout,
    palette: stored.palette,
    typeTreatment: stored.typeTreatment,
    motif: stored.motif,
    script: stored.script,
    hash: stored.hash ?? recipeHash(stored as Omit<Recipe, "hash">),
  };

  // ⛔ The headline is re-derived from the post's own body, not stored
  // separately. If the words were edited, the picture follows them — so a
  // picture can never show a sentence the gate did not read at approval.
  const headline = headlineFromBody(post.body as string);
  if (!headline) {
    return NextResponse.json(
      { error: "The post's opening sentence is too long to set as a headline, so there is no picture." },
      { status: 422 },
    );
  }

  // ⚠️ The QR is regenerated here rather than stored: it encodes only the
  // channel and a campaign tag, so it is derivable, and a stored data URI would
  // be a second copy to keep in step with nothing.
  const platform = post.platform as string;
  let qrImage: string | undefined;
  try {
    if (platformSpec(platform).qr) {
      qrImage = await qrDataUri(qrTarget(platform), "#111827", "#FFFFFF");
    }
  } catch {
    // ⛔ A missing code must not lose the picture. A card without a QR is a
    // card; no card is a blank space where one was promised.
    qrImage = undefined;
  }

  let picture;
  try {
    picture = composePicture({
      recipe,
      headline,
      language: post.language as string,
      platform,
      qrImage,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  let fontData: ArrayBuffer;
  try {
    fontData = await loadFont(picture.wordmark.font.url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  return new ImageResponse(toElement(picture.root), {
    // 🔑 The channel's own size. A LinkedIn card rendered at Facebook's
    // ratio, or a square cropped from a 16:9, loses the words first.
    width: picture.width,
    height: picture.height,
    fonts: [{ name: picture.wordmark.font.family, data: fontData, weight: 600, style: "normal" }],
    headers: {
      // Derived from a stored recipe and the post's body: safe to cache, and
      // invalidated by the post id changing when the words are edited.
      "cache-control": "private, max-age=300",
    },
  });
}
