// GET /api/admin/social/shaping-check — can this machine draw an Indic card?
//
// 🔴 WHY A DIAGNOSTIC AND NOT A CLAIM. The shaped renderer needs a browser,
// and a browser on a developer's Mac proves nothing about a serverless
// container: no Chromium, no system fonts, a read-only filesystem apart from
// /tmp, and a cold start. ⛔ Every one of those fails in a different way, and
// all of them would fail INVISIBLY — as a card that silently never renders
// for a language nobody is watching.
//
// ⚠️ So this answers the question out loud, on the machine that matters,
// before anything depends on it. It renders one real card in one real script
// and reports what happened and how long it took.
//
// 🔑 IT CHANGES NOTHING. No post, no row, no file. Running it is free.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin, cronAuthorised } from "@/app/api/admin/social/_guard";
import { composePicture } from "@/lib/social/compose";
import { renderShapedCard } from "@/lib/social/shapedRenderer";
import { SCRIPT_FONTS, SCRIPT_OF_LANGUAGE } from "@/lib/social/fonts";
import { SCRIPT_SAMPLES, SCRIPT_STRESS_WORDS } from "@/lib/social/scriptSamples";
import type { Recipe } from "@/lib/social/visualRecipe";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  /**
   * 🔑 AN ADMIN SESSION OR THE SCHEDULER'S BEARER — either opens this.
   *
   * ⛔ NOT A WEAKENING. It is the same secret every cron route here already
   * accepts ⇒ cronAuthorised, and this route changes nothing: no post, no
   * row, no file. It renders one card and describes it.
   *
   * ⚠️ THE REASON IS DIAGNOSTIC TURNAROUND. Finding out why a card is tofu
   * took three deploys, and every one of them ended with a person being asked
   * to open a URL in a browser and describe what they saw. A question that
   * can only be asked through somebody else's eyes gets asked less often than
   * it should, and gets answered with guesses in between.
   */
  const bearer = cronAuthorised(req);
  if (!bearer.ok) {
    const guard = await requireSocialAdmin(req);
    if (!guard.ok) return guard.response;
  }

  const language = req.nextUrl.searchParams.get("language") ?? "bn";
  const script = SCRIPT_OF_LANGUAGE[language] ?? "latin";
  const face = SCRIPT_FONTS[script];
  if (!face) {
    return NextResponse.json({ ok: false, error: `No font entry for script "${script}".` }, { status: 400 });
  }

  /**
   * ⚠️ A SAMPLE THAT ACTUALLY EXERCISES REORDERING. A Devanagari string with
   * no pre-base ि in it renders perfectly under a renderer that cannot shape
   * at all, and proves nothing ⇒ scriptSamples.ts, where that exact mistake
   * is recorded.
   */
  const sample = SCRIPT_SAMPLES[script];
  const stress = SCRIPT_STRESS_WORDS[script];

  const picture = composePicture({
    recipe: {
      layout: "rule-over",
      palette: "forest",
      typeTreatment: "display",
      motif: "arcs",
      script: "latin",
      hash: "shaping-check",
    } as Recipe,
    /**
     * 🔑 THE STRESS WORD AS THE HEADLINE, because that is the one that
     * exercises reordering. The friendly sample sentence is the support line
     * — useful to look at, and on its own it would prove nothing.
     */
    headline: stress?.word ?? sample?.text ?? "অভিমান",
    support: sample?.text,
    language,
    platform: "instagram",
  });

  const faces = [
    { family: SCRIPT_FONTS.latin.family, url: SCRIPT_FONTS.latin.url },
    { family: face.family, url: face.url },
  ];

  /**
   * ⚠️ `?debug=1` RETURNS WHAT THE BROWSER SAYS, not a picture.
   *
   * ⛔ Added after two deploys spent on two theories with no measurement
   * between them: tofu, guess, deploy, tofu again. A render that looks wrong
   * does not say WHICH step failed — the fetch, the @font-face, the family
   * name, or the element's own style.
   */
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  const out = await renderShapedCard({
    root: picture.root,
    width: picture.width,
    height: picture.height,
    faces,
    diagnose: debug,
  });

  if (!out.ok) {
    return NextResponse.json(
      {
        ok: false,
        language,
        script,
        error: out.error,
        hint:
          "⛔ Nothing depends on this yet — every script is still shapingVerified: false, so no card " +
          "uses this path. ▶️ If the browser cannot start here, the fallback is to render in the " +
          "admin's own browser at approval instead.",
      },
      { status: 500 },
    );
  }

  if (debug) {
    return NextResponse.json({
      ok: true,
      language,
      script,
      ms: out.ms,
      asked: faces,
      probe: out.probe,
      /**
       * 🔑 HOW TO READ THIS. `faces[].bytes` near zero means the fetch gave
       * nothing. `loaded` missing a family means the @font-face never
       * registered. `usable` false with the family present means the name or
       * the weight does not match what the element asks for. And
       * `headlineFamily` not naming the script's face means the stack never
       * reached it.
       */
      hint:
        "bytes≈0 → the fetch failed · family absent from `loaded` → @font-face did not register · " +
        "`usable` false → name or weight mismatch · headlineFamily without the script face → the stack is wrong.",
    });
  }

  /**
   * ⚠️ RETURNS THE PICTURE ITSELF, not a "looks fine". Nobody here can judge
   * a Bengali render from a success flag, and that is the entire reason this
   * script is not verified yet ⇒ /admin/social/scripts.
   */
  return new NextResponse(Buffer.from(out.bytes), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store",
      "x-shaping-ms": String(out.ms),
      "x-shaping-script": script,
      "x-shaping-faces": faces.map((f) => f.family).join(", "),
    },
  });
}
