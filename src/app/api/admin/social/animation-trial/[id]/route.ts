// POST /api/admin/social/animation-trial/[id] — animate one post's picture, once
//
// 🔑 A TRIAL SURFACE, BUILT BEFORE THE FEATURE — same reason as the
// illustration preview: `GEMINI_API_KEY` lives only in Vercel, so the only
// place a clip can be made is production, and the owner decides from a clip,
// not from a description of one.
//
// ⛔ POST, AND OWNER-ONLY, BECAUSE EVERY CALL COSTS MONEY (~$0.10 per second
// at 720p). A GET could be fired by opening a link or by a prefetch.
//
// ⛔ IT NEVER TOUCHES THE PUBLISHED VIDEO. The clip is stored beside it as
// `animation-trial.mp4`; `motion.mp4`, which the publisher serves, is not
// read or written here.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { CARD_BUCKET, getIllustration } from "@/lib/social/cardStore";
import { animatePicture, type AnimationAspect } from "@/lib/social/animatePicture";

export const runtime = "nodejs";
/** ⚠️ A video model is slow; the clip is made synchronously. */
export const maxDuration = 300;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialOwner(req, "make a paid animation trial");
  if (!guard.ok) return guard.response;

  let payload: { aspect?: string; prompt?: string } = {};
  try {
    payload = await req.json();
  } catch {
    // An empty body is fine: the defaults are the trial.
  }
  const aspect: AnimationAspect = payload.aspect === "16:9" ? "16:9" : "9:16";

  const picture = await getIllustration(id);
  if (!picture) return NextResponse.json({ error: "This post has no picture to animate." }, { status: 404 });

  const made = await animatePicture(picture, { aspect, prompt: payload.prompt });
  if (!made.ok) {
    console.error("[animation-trial] failed", { id, error: made.error });
    return NextResponse.json({ error: made.error }, { status: 502 });
  }

  const path = `${id}/animation-trial.mp4`;
  const db = getSupabaseAdmin();
  const { error } = await db.storage.from(CARD_BUCKET).upload(path, made.mp4, { contentType: "video/mp4", upsert: true });

  return NextResponse.json({
    ok: true,
    path,
    stored: !error,
    storeError: error?.message ?? null,
    bytes: made.mp4.byteLength,
    ms: made.ms,
  });
}
