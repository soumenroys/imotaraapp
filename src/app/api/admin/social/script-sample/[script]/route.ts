// GET /api/admin/social/script-sample/[script] — can the card renderer draw
// this script?
//
// 🔴 THE QUESTION THIS EXISTS TO MAKE ANSWERABLE. `fonts.ts` gates every
// complex script behind `shapingVerified`, meaning *"a person who reads this
// script has looked at a rendered picture and said it is right"*. Twelve of
// thirteen are false — and for eleven of them that is because **nobody has
// ever looked**, not because anything was proven. There was no picture to
// look at. This is that picture.
//
// 🔑 IT MUST BE THE SAME MACHINERY OR IT PROVES NOTHING: the same `next/og`
// (Satori + Resvg), the same static TTF from `SCRIPT_FONTS`, fetched the same
// way. ⛔ A sample drawn by anything else would be a reassuring picture of a
// different question.
//
// ⚠️ DELIBERATELY NOT composePicture. That calls `planWordmark`, which
// correctly refuses an unverified script — so the full card cannot draw the
// thing we need to see. ⛔ And the fix is NOT to add a bypass there: a door
// that lets an unverified script onto a card is a door somebody publishes
// through. Here there is no card and nothing is publishable.
//
// 🔐 Admin-only. It renders nothing private, but it is a diagnostic and the
// honest default for a diagnostic is the same guard as the rest of /admin.

import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { createElement } from "react";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { SCRIPT_FONTS } from "@/lib/social/fonts";
import { SCRIPT_SAMPLES, SCRIPT_STRESS_WORDS } from "@/lib/social/scriptSamples";

export async function GET(req: NextRequest, ctx: { params: Promise<{ script: string }> }) {
  const { script } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const font = SCRIPT_FONTS[script];
  const sample = SCRIPT_SAMPLES[script];
  if (!font || !sample) {
    return NextResponse.json(
      { error: `No font or sample for "${script}". Scripts: ${Object.keys(SCRIPT_FONTS).join(", ")}` },
      { status: 404 },
    );
  }

  let fontData: ArrayBuffer;
  try {
    const res = await fetch(font.url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`${res.status}`);
    fontData = await res.arrayBuffer();
  } catch (e) {
    /**
     * ⛔ Said, not drawn blank. Satori renders NOTHING for text in a missing
     * family, so a failed font fetch would produce a clean empty card — which
     * a reviewer would read as "this script renders as nothing" rather than
     * "the font did not download".
     */
    return NextResponse.json(
      { error: `The ${script} font could not be fetched from ${font.url} (${(e as Error).message}).` },
      { status: 502 },
    );
  }

  const stress = SCRIPT_STRESS_WORDS[script];

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
          padding: 56,
          background: "#FAF5EF",
          fontFamily: font.family,
        },
      },
      // ⚠️ Large. Shaping faults — a vowel sign on the wrong side, a broken
      // conjunct — are invisible at caption size and obvious here.
      createElement(
        "div",
        { key: "sample", style: { fontSize: 46, color: "#1B1B1B", lineHeight: 1.45 } },
        sample.text,
      ),
      stress
        ? createElement(
            "div",
            { key: "stress", style: { fontSize: 72, color: "#8A2B18" } },
            stress.word,
          )
        : null,
    ),
    {
      width: 1080,
      height: stress ? 520 : 360,
      fonts: [{ name: font.family, data: fontData, weight: 600, style: "normal" }],
      // ⚠️ Never cached by a shared cache: the answer changes the day a font
      // or the renderer changes, and a stale sample would be judged as current.
      headers: { "cache-control": "no-store" },
    },
  );
}
