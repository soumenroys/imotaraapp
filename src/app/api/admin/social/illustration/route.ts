// GET  /api/admin/social/illustration  — which image models this key can use
// POST /api/admin/social/illustration  — draw one sample, return it inline
//
// 🔴 A PREVIEW SURFACE, BUILT BEFORE THE FEATURE. The owner has to choose a
// house style for the illustrations, and choosing from five paragraphs of
// prose is not choosing — three defects this month were invisible from the
// desk and only found by rendering the thing and looking at it.
//
// ⛔ THIS IS WHY IT EXISTS AT ALL: `GEMINI_API_KEY` is an empty string in
// `.env.local` and the real key lives only in Vercel, which `vercel env pull`
// would clobber ⇒ feedback_vercel_env_pull_clobbers_local. So the only place
// a sample can be drawn is production, and the only honest way to let somebody
// choose is to put the samples on a screen.
//
// ⚠️ NOTHING HERE PUBLISHES, STORES OR QUEUES. It draws an image and hands it
// back. Wiring illustrations into the pipeline is a separate change, after a
// style has been chosen.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import {
  ILLUSTRATION_STYLES,
  styleById,
  illustrationPrompt,
  listImageModels,
  generateIllustration,
} from "@/lib/social/illustration";
import { planBackground } from "@/lib/social/backgroundPlan";
import { giveAPicture, stylesUsedOn } from "@/lib/social/giveAPicture";
import { istDayWindow } from "@/lib/social/pipeline";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
/** ⚠️ A drawing call is slow. The default would cut it off mid-request. */
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const models = await listImageModels();
  return NextResponse.json({
    styles: ILLUSTRATION_STYLES.map((s) => ({
      id: s.id,
      label: s.label,
      note: s.note,
      // 🔑 The medium and where the quiet area is — both are what the owner is
      // actually choosing between ⇒ illustrationStyles.ts.
      family: s.family,
      textZone: s.textZone,
      ground: s.ground,
    })),
    /**
     * 🔑 MEASURED, NOT ASSUMED. Vertex and the Gemini API name the same model
     * differently, and an id invented from memory reads as a broken
     * integration ⇒ trap_a_model_invents_specifics_it_cannot_have.
     */
    ...(models.ok ? { models: models.models } : { modelsError: models.reason }),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  let payload: {
    style?: string;
    mood?: string;
    model?: string;
    aspectRatio?: string;
    /**
     * 🔑 GIVE THIS REAL POST A PICTURE, rather than drawing a sample.
     *
     * ⛔ The queue cron chooses the style by rotation, which is right for
     * normal running and useless for checking a SPECIFIC style against real
     * words. Fourteen of the fifteen have never been composed with a real
     * headline, and finding out across a whole backfill at once is the
     * expensive way to learn it.
     *
     * ⚠️ Additive and reversible: it writes one column on one post, and the
     * post publishes with or without it.
     */
    postId?: string;
    /**
     * 🔑 GIVE PICTURES TO THE POSTS THAT HAVE NONE, by the NORMAL rotation.
     *
     * ⛔ NOT the forced-style path above. That one exists to check a named
     * style against real words; a backfill must go through the same choosing
     * the cron does — narrowed by what the day already spent and by what each
     * post is about — or it proves nothing about how the feed will look.
     *
     * ⚠️ BOUNDED PER CALL. A drawing takes about five seconds and this route
     * has 120, so twenty-five in one request would be cut off mid-way with
     * some posts updated and no report of which.
     */
    backfill?: boolean;
    limit?: number;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a style id." }, { status: 400 });
  }

  /**
   * ⛔ HANDLED BEFORE THE STYLE IS RESOLVED, because a backfill names no
   * style — the rotation does.
   */
  if (payload.backfill) {
    const model = (payload.model ?? "").trim();
    if (!model) {
      return NextResponse.json({ error: "Name a model. GET this route first." }, { status: 400 });
    }
    const db = getSupabaseAdmin();
    const { data: posts, error } = await db
      .from("social_posts")
      .select("id, subject, topic_pool, scheduled_for")
      .is("illustration", null)
      .in("status", ["needs_review", "approved"])
      .not("scheduled_for", "is", null)
      .order("scheduled_for")
      .limit(Math.min(Math.max(payload.limit ?? 6, 1), 8));
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });

    const done: string[] = [];
    for (const [i, post] of (posts ?? []).entries()) {
      const day = istDayWindow(post.scheduled_for as string);
      const given = await giveAPicture({
        postId: post.id as string,
        // ⚠️ The index within this run keeps the rotation moving; the day's
        // own spend is what stops two channels sharing a style.
        postsSoFar: i,
        usedToday: await stylesUsedOn(day.from, day.to),
        angle: post.topic_pool as string | null,
        mood: post.subject as string | null,
        model,
      });
      done.push(
        given.ok
          ? `✅ ${given.illustration.style} — ${post.subject}`
          : `❌ ${post.subject}: ${given.reason.slice(0, 160)}`,
      );
    }
    const { count } = await db
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .is("illustration", null)
      .in("status", ["needs_review", "approved"])
      .not("scheduled_for", "is", null);
    return NextResponse.json({ drawn: done.length, results: done, stillWithout: count ?? null });
  }

  const style = styleById((payload.style ?? "").trim());
  if (!style) {
    return NextResponse.json(
      {
        error: `Unknown style. The ones that exist are: ${ILLUSTRATION_STYLES.map((s) => s.id).join(", ")}.`,
      },
      { status: 400 },
    );
  }

  /**
   * ⛔ NO DEFAULT MODEL. A guessed id that happens to 404 looks exactly like a
   * broken feature; the GET above lists what this key can actually draw with,
   * and the caller passes one of those.
   */
  const model = (payload.model ?? "").trim();
  if (!model) {
    return NextResponse.json(
      { error: "Name a model. GET this route first — it lists the image models this key can use." },
      { status: 400 },
    );
  }

  /**
   * ⛔ A REAL POST TAKES A DIFFERENT PATH, because it must go through exactly
   * the same code the cron uses — `giveAPicture` stores the JPEG, measures
   * THAT, and records it. A second path that drew, measured and stored
   * slightly differently would mean the card checked here is not the card that
   * publishes.
   */
  if (payload.postId) {
    const given = await giveAPicture({
      postId: payload.postId.trim(),
      postsSoFar: 0,
      // 🔑 Forcing one style is the whole point of this branch, so the day's
      // spend and the angle narrowing are deliberately bypassed: everything
      // except the named style is excluded.
      usedToday: ILLUSTRATION_STYLES.filter((x) => x.id !== style.id).map((x) => x.id),
      angle: null,
      mood: payload.mood ?? null,
      model,
    });
    return NextResponse.json(
      given.ok
        ? { postId: payload.postId, illustration: given.illustration }
        : { error: given.reason, postId: payload.postId },
      { status: given.ok ? 200 : 502 },
    );
  }

  const started = Date.now();
  const out = await generateIllustration({
    style,
    mood: payload.mood ?? null,
    model,
    aspectRatio: payload.aspectRatio,
  });

  if (!out.ok) {
    // ⚠️ The raw refusal, on purpose. This cannot be run anywhere but
    // production, so the first call IS the experiment and a tidied-up message
    // would waste it.
    return NextResponse.json(
      { error: out.reason, detail: out.detail, model, style: style.id, promptSent: illustrationPrompt(style, payload.mood) },
      { status: 502 },
    );
  }

  /**
   * 🔑 THE SAMPLE IS MEASURED TOO, and shown beside it.
   *
   * ⛔ The whole safety argument for text over a picture is that the pixels
   * under the words are read rather than guessed — so a preview that shows the
   * picture but not the reading is only half of what there is to judge. It
   * also answers the question nobody could otherwise answer: the owner's own
   * reference photographs are busy enough that 18 of 27 would need a veil, and
   * the only way to know whether OUR art is quieter is to measure ours.
   */
  const plan = await planBackground(out.bytes, style.textZone);

  return NextResponse.json({
    style: style.id,
    label: style.label,
    model: out.model,
    ms: Date.now() - started,
    mimeType: out.mimeType,
    zone: style.textZone,
    plan,
    /**
     * 🔑 WHAT THE STYLE INTENDED, beside what the picture actually measured.
     * ⛔ A style that declares `dark` and comes back taking dark ink is a
     * prompt that did not work — and without this comparison nobody would ever
     * find out, because the card would still be perfectly legible. It would
     * just be the fifteenth light card in a row.
     */
    ground: style.ground,
    groundAsIntended: (style.ground === "dark") === (plan.ink === "light"),
    /** Inline, because nothing here is stored — it is a sample, not an asset. */
    dataUrl: `data:${out.mimeType};base64,${Buffer.from(out.bytes).toString("base64")}`,
  });
}
