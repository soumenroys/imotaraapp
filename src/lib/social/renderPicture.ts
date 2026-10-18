// src/lib/social/renderPicture.ts
// The post's picture, as bytes, for anybody who needs them.
//
// 🔴 WHY THIS HAD TO COME OUT OF THE ROUTE. The picture is rendered on demand
// behind `requireSocialAdmin` ⇒ src/app/api/admin/social/picture/[id]/route.ts.
// That is right for the admin and useless for publishing: Facebook cannot be
// handed a URL it has to sign into. The publisher has to render the same
// picture itself and upload the bytes.
//
// ⛔ AND IT MUST BE THE SAME PICTURE, from the same code. Two renderers would
// mean the card a reviewer approved and the card the world sees could differ —
// silently, and only on the one that cannot be checked afterwards. So the
// route now calls this too, and there is one renderer.

import { ImageResponse } from "next/og";
import { createElement, type ReactElement } from "react";
import { composePicture, type Node } from "@/lib/social/compose";
import { platformSpec } from "@/lib/social/platforms";
import { allQrCodes, type QrCode } from "@/lib/social/brandMarks";
import { headlineFor, supportFromBody, recipeHash, type Recipe } from "@/lib/social/visualRecipe";

/** The tree from compose.ts, as React elements. ⚠️ Keys, because Satori
 *  renders a real React tree and an unkeyed list warns on every render. */
export function toElement(node: Node, key = "root"): ReactElement {
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

/** Everything the renderer needs, as it comes out of `social_posts`. */
export type PictureSource = {
  platform: string;
  language: string;
  /** ⚠️ Needed now: it is the card's headline ⇒ headlineFor. */
  subject?: string | null;
  body: string;
  media_kind: string | null;
  visual_recipe: unknown;
};

export type RenderFailure = {
  /** 404 nothing to draw · 422 the recipe or the words cannot make one · 502 the machinery
   *  (fonts could not be fetched, or the encoder failed) ⇒ renderPostPictureJpeg. */
  status: 404 | 422 | 502;
  error: string;
};

export type RenderedPicture = { response: ImageResponse; width: number; height: number };

/**
 * ⚠️ RETURNS A FAILURE RATHER THAN THROWING, because both callers need to tell
 * "this post has no picture" from "this post should have one and it broke" —
 * and for the publisher the difference decides whether to post the words
 * anyway or to stop.
 */
export async function renderPostPicture(
  post: PictureSource,
  headers?: Record<string, string>,
): Promise<{ ok: true; picture: RenderedPicture } | { ok: false; failure: RenderFailure }> {
  if (post.media_kind !== "graphic" || !post.visual_recipe) {
    return { ok: false, failure: { status: 404, error: "This post has no picture." } };
  }

  const stored = post.visual_recipe as Partial<Recipe>;
  if (!stored.layout || !stored.palette || !stored.typeTreatment || !stored.motif || !stored.script) {
    return { ok: false, failure: { status: 422, error: "The stored recipe is incomplete." } };
  }
  const recipe: Recipe = {
    layout: stored.layout,
    palette: stored.palette,
    typeTreatment: stored.typeTreatment,
    motif: stored.motif,
    script: stored.script,
    hash: stored.hash ?? recipeHash(stored as Omit<Recipe, "hash">),
  };

  /**
   * ⛔ Re-derived from the post's own words, never stored separately — if the
   * words are edited the picture follows them, so a card can never show a
   * sentence the gate did not read at approval.
   *
   * 🔑 The SUBJECT first, because it was written to be this ⇒ headlineFor.
   * Using the body's opening sentence meant the card vanished precisely when
   * the opening was good and long.
   */
  const headline = headlineFor(post.subject ?? "", post.body);
  if (!headline) {
    return {
      ok: false,
      failure: {
        status: 422,
        error: "The post's opening sentence is too long to set as a headline, so there is no picture.",
      },
    };
  }

  // ⚠️ The QR is regenerated here rather than stored: it encodes only the
  // channel and a campaign tag, so it is derivable, and a stored data URI would
  // be a second copy to keep in step with nothing.
  let qrCodes: QrCode[] = [];
  try {
    if (platformSpec(post.platform).qr) qrCodes = await allQrCodes(post.platform);
  } catch {
    // ⛔ Missing codes must not lose the picture. A card without them is a
    // card; no card is a blank space where one was promised.
    qrCodes = [];
  }

  let picture;
  try {
    picture = composePicture({
      recipe,
      headline,
      /**
       * ⚠️ Derived here, exactly like the headline. Omitting it is what left
       * every published card with one line and an empty upper third.
       *
       * 🔑 FROM SENTENCE 0 when the headline came from the subject — otherwise
       * the post's strongest line, its opening, appears nowhere on the card.
       * ⛔ From sentence 1 when the headline IS the opening, or the card says
       * the same thing twice.
       */
      support:
        supportFromBody(post.body, 150, headline === (post.subject ?? "").trim() ? 0 : 1) ??
        undefined,
      language: post.language,
      platform: post.platform,
      qrCodes,
    });
  } catch (e) {
    return { ok: false, failure: { status: 422, error: (e as Error).message } };
  }

  let fontData: ArrayBuffer;
  try {
    fontData = await loadFont(picture.wordmark.font.url);
  } catch (e) {
    return { ok: false, failure: { status: 502, error: (e as Error).message } };
  }

  return {
    ok: true,
    picture: {
      // ⚠️ `picture.width/height`, which composePicture already set from the
      // channel's spec — NOT re-derived here. Extracting this function is a
      // move, not a redesign, and a second path to the same number is how the
      // two would eventually differ.
      width: picture.width,
      height: picture.height,
      // 🔑 The channel's own size. A LinkedIn card rendered at Facebook's
      // ratio, or a square cropped from a 16:9, loses the words first.
      response: new ImageResponse(toElement(picture.root), {
        width: picture.width,
        height: picture.height,
        fonts: [{ name: picture.wordmark.font.family, data: fontData, weight: 600, style: "normal" }],
        ...(headers ? { headers } : {}),
      }),
    },
  };
}

/**
 * The same picture, as bytes.
 *
 * ⚠️ `ImageResponse` is a streamed Response, so this drains it. A caller that
 * needs to UPLOAD the picture cannot hand a stream to a multipart body
 * reliably across runtimes — and a half-uploaded PNG is a post with a broken
 * image on it, which is worse than no post.
 */
export async function renderPostPictureBytes(
  post: PictureSource,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; failure: RenderFailure }> {
  const rendered = await renderPostPicture(post);
  if (!rendered.ok) return rendered;
  const buf = await rendered.picture.response.arrayBuffer();
  return { ok: true, bytes: new Uint8Array(buf) };
}

/**
 * The same picture again, as JPEG.
 *
 * 🔴 NOT A PREFERENCE — INSTAGRAM TAKES NOTHING ELSE. `ImageResponse` emits
 * PNG and has no format option (confirmed in this version's own docs:
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md
 * — "convert HTML and CSS into PNG", and the options list has no `format`).
 * Instagram's Content Publishing API documents JPEG and rejects the rest, so
 * without this step every Instagram post fails at the media-container call
 * with an error about the image, which reads like a broken card rather than a
 * wrong container.
 *
 * ⚠️ STILL ONE RENDERER. The pixels come from `renderPostPicture` exactly as
 * the admin preview and the Facebook upload do; only the container changes.
 * ⛔ A second drawing path for Instagram would mean the card a reviewer
 * approved and the card Instagram shows could differ, and nobody would find
 * out from inside the admin.
 *
 * 🔑 Quality 92 and `chromaSubsampling: "4:4:4"`. The card is flat colour with
 * type on it — the shape JPEG is worst at. Default subsampling smears coloured
 * text edges, and on a 1080px square the wordmark is where it shows.
 */
export async function renderPostPictureJpeg(
  post: PictureSource,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; failure: RenderFailure }> {
  const png = await renderPostPictureBytes(post);
  if (!png.ok) return png;
  try {
    // ⚠️ Imported here rather than at the top: sharp is a native module, and
    // the admin preview and the Facebook path have no reason to load it.
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(Buffer.from(png.bytes))
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    return { ok: true, bytes: new Uint8Array(jpeg) };
  } catch (e) {
    return {
      ok: false,
      failure: {
        // ⚠️ 502, not 422: the recipe and the words were fine — the machinery
        // underneath them failed, and the remedy is not to edit the post.
        status: 502,
        error:
          `The card was drawn but could not be converted to JPEG (${(e as Error).message}). ` +
          `⚠️ Instagram accepts no other format, so nothing was posted.`,
      },
    };
  }
}
