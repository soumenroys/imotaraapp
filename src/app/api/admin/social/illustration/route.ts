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

export const runtime = "nodejs";
/** ⚠️ A drawing call is slow. The default would cut it off mid-request. */
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const models = await listImageModels();
  return NextResponse.json({
    styles: ILLUSTRATION_STYLES.map((s) => ({ id: s.id, label: s.label, note: s.note })),
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

  let payload: { style?: string; mood?: string; model?: string; aspectRatio?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a style id." }, { status: 400 });
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

  return NextResponse.json({
    style: style.id,
    label: style.label,
    model: out.model,
    ms: Date.now() - started,
    mimeType: out.mimeType,
    /** Inline, because nothing here is stored — it is a sample, not an asset. */
    dataUrl: `data:${out.mimeType};base64,${Buffer.from(out.bytes).toString("base64")}`,
  });
}
