// GET /api/admin/social/animation/[id] — the moving version of a post's card.
//
// 🔑 RENDERED ON DEMAND, like the still. The recipe is stored; the frames are
// derived from it. Measured end to end: five frames in ~1s, a GIF in ~0.1s and
// an MP4 in ~0.7s. ⇒ No storage bucket, nothing to migrate, and a palette fix
// improves every past post rather than only the next one.
//
// ⛔ Every frame is the SAME picture with fewer parts showing. No frame can
// introduce a word the gate has not read, because no frame introduces words.

import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { createElement, type ReactElement } from "react";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { storyboard } from "@/lib/social/frames";
import { type Node } from "@/lib/social/compose";
import { encode, MIME, type AnimationFormat } from "@/lib/social/animate";
import { platformSpec } from "@/lib/social/platforms";
import { allQrCodes, type QrCode } from "@/lib/social/brandMarks";
import { headlineFromBody, recipeHash, type Recipe } from "@/lib/social/visualRecipe";

// ⚠️ Encoding is the slow part, not rendering. 60s is generous for five frames
// and still well inside the platform ceiling.
export const maxDuration = 120;

function toElement(node: Node, key = "root"): ReactElement {
  if (node.tag === "img") return createElement("img", { key, style: node.style, src: node.src });
  const children = node.children?.map((c, i) => toElement(c, `${key}.${i}`));
  return createElement(node.tag, { key, style: node.style }, ...(node.text ? [node.text] : []), ...(children ?? []));
}

async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`the font at ${url} could not be fetched (${res.status}).`);
  return res.arrayBuffer();
}

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
    .select("id, language, platform, subject, body, media_kind, visual_recipe")
    .eq("id", id)
    .single();

  if (error || !post) return NextResponse.json({ error: "no such post" }, { status: 404 });
  if (!post.visual_recipe) return NextResponse.json({ error: "This post has no picture." }, { status: 404 });

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

  // ⛔ Re-derived from the post's own body, so an edit moves the animation too.
  const headline = headlineFromBody(post.body as string);
  if (!headline) {
    return NextResponse.json(
      { error: "The opening sentence is too long to set as a headline, so there is no card to animate." },
      { status: 422 },
    );
  }

  const platform = post.platform as string;
  let qrCodes: QrCode[] = [];
  try {
    if (platformSpec(platform).qr) qrCodes = await allQrCodes(platform);
  } catch {
    qrCodes = [];
  }

  let board;
  try {
    board = storyboard({ recipe, headline, language: post.language as string, platform, qrCodes });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  let fontData: ArrayBuffer;
  try {
    fontData = await loadFont(board.wordmark.font.url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const frames: Buffer[] = [];
  for (const frame of board.frames) {
    const image = new ImageResponse(toElement(frame), {
      width: board.width,
      height: board.height,
      fonts: [{ name: board.wordmark.font.family, data: fontData, weight: 600, style: "normal" }],
    });
    frames.push(Buffer.from(await image.arrayBuffer()));
  }

  let out: Buffer;
  try {
    out = await encode(format, { frames, holdMs: board.holdMs, width: board.width, height: board.height });
  } catch (e) {
    // ⚠️ Named plainly. "Could not render" would send somebody to the wrong
    // place: a missing ffmpeg binary is a deployment problem, not a content one.
    return NextResponse.json(
      { error: `The ${format.toUpperCase()} could not be encoded: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(out), {
    headers: {
      "content-type": MIME[format],
      "content-length": String(out.length),
      "cache-control": "private, max-age=300",
    },
  });
}
