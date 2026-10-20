// src/lib/social/illustration.ts
// An illustration behind the words, so two posts stop looking like one post.
//
// 🔴 WHY THIS EXISTS. The owner, 20 Oct 2026, looking at the live feed:
// *"all posts still looks very similar … we need to create more enriched
// content for Imotara not similar kind of posts everyday."* Nine queued cards
// were rendered and looked at together and he was right: the variation was
// almost entirely HUE. Every card is type on a flat colour field — no imagery
// of any kind.
//
// ⛔ CANVA WAS EVALUATED FIRST AND RULED OUT for this job: its Autofill API is
// Enterprise-only, which is priced for organisations far larger than Imotara
// at 51 and 81 followers ⇒ canva_evaluation_2026_10_20. Generating the picture
// through an API we already pay for costs cents.
//
// ⚠️ THIS DOES NOT SOLVE INDIC. Image models cannot render Bengali conjuncts —
// the illustration is the BACKGROUND and the renderer still draws the words
// ⇒ trap_a_card_cannot_draw_an_indic_script. Keep the two problems apart.

/**
 * ⛔ THE STYLES MOVED OUT, 20 Oct 2026 — see illustrationStyles.ts for why.
 * Short version: the owner sent 27 reference posts, and what I had built was
 * wrong in three ways at once. The catalogue is now long enough to deserve its
 * own file, and this one keeps the plumbing.
 */
export {
  SAFETY_CLAUSE,
  ILLUSTRATION_STYLES,
  styleById,
  illustrationPrompt,
  type IllustrationStyle,
  type StyleFamily,
} from "@/lib/social/illustrationStyles";

import {
  ILLUSTRATION_STYLES,
  illustrationPrompt,
  type IllustrationStyle,
} from "@/lib/social/illustrationStyles";

/**
 * 🔴 WHICH STYLE THIS POST GETS — and the lesson that shaped it.
 *
 * The owner chose, on 20 Oct, to rotate ALL FIVE rather than settle on one:
 * *"use all of those randomly in different posts."* ⚠️ He chose that after
 * hearing the argument for a single house style, so it is a decision, not an
 * oversight.
 *
 * ⛔ THE TRAP THIS AVOIDS WAS LIVE THIS MORNING. The ANGLE rotation uses
 * `nextPool(cycle, postsSoFar)` where `postsSoFar` is
 * `postCountFor(schedule.id)` — **per schedule**. Facebook's and YouTube's
 * pools are identical, so the two walked one cycle in lockstep and posted the
 * same idea thirty minutes apart. ⇒ A style rotation keyed the same way would
 * give all three channels ONE style per day, which is the exact failure this
 * whole feature exists to end.
 *
 * 🔑 SO IT TAKES WHAT THE DAY HAS ALREADY SPENT, across every channel — the
 * same shape as `poolsLeftForToday`. ⛔ And it is decided in CODE, never by
 * asking a model to pick: a menu handed to a model is not a rotation, it picks
 * the safest item every time ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
 */
export function styleForPost(
  postsSoFar: number,
  usedToday: string[] = [],
  styles: IllustrationStyle[] = ILLUSTRATION_STYLES,
): IllustrationStyle {
  if (styles.length === 0) {
    throw new Error("social/illustration: there are no styles to choose from.");
  }
  if (!Number.isFinite(postsSoFar) || postsSoFar < 0) {
    throw new Error(`social/illustration: postsSoFar must be a non-negative number, got ${postsSoFar}`);
  }

  const spent = new Set(usedToday);
  const fresh = styles.filter((s) => !spent.has(s.id));

  /**
   * ⛔ NEVER EMPTY — the same rule as the angle narrowing, for the same
   * reason. With more channels in a day than styles, dropping every style
   * would leave the post with no picture at all, and a missing illustration
   * is worse than a repeated one.
   */
  const pool = fresh.length > 0 ? fresh : styles;
  return pool[postsSoFar % pool.length];
}

export type IllustrationResult =
  | { ok: true; bytes: Uint8Array; mimeType: string; model: string }
  | { ok: false; reason: string; detail?: string };

/**
 * 🔑 TOLERANT OF BOTH SPELLINGS ON PURPOSE.
 *
 * The REST API returns camelCase (`inlineData`, `mimeType`); the Python SDK
 * documents snake_case (`inline_data`, `mime_type`), and the published
 * examples disagree about which the HTTP surface uses. ⛔ I could not verify
 * this locally — `GEMINI_API_KEY` is an empty string in `.env.local` and the
 * real key lives only in Vercel ⇒ feedback_vercel_env_pull_clobbers_local. So
 * rather than guess one and ship a parser that silently finds nothing, this
 * accepts either and the caller reports the raw body when it finds neither.
 */
export function firstInlineImage(
  body: unknown,
): { data: string; mimeType: string } | null {
  const parts =
    (body as { candidates?: { content?: { parts?: unknown[] } }[] })?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const p of parts) {
    const inline =
      (p as { inlineData?: { data?: string; mimeType?: string } }).inlineData ??
      (p as { inline_data?: { data?: string; mime_type?: string } }).inline_data;
    if (!inline) continue;
    const data = (inline as { data?: string }).data;
    if (!data) continue;
    const mimeType =
      (inline as { mimeType?: string }).mimeType ??
      (inline as { mime_type?: string }).mime_type ??
      "image/png";
    return { data, mimeType };
  }
  return null;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Ask the key what it can actually draw with.
 *
 * ⛔ SO THE MODEL ID IS MEASURED, NOT GUESSED. Vertex and the Gemini API use
 * different ids for the same model (`gemini-2.5-flash-image` vs
 * `…-image-preview`), and an unknown model id is the kind of wrong specific
 * that reads as a broken integration ⇒ trap_a_model_invents_specifics_it_cannot_have.
 */
export async function listImageModels(): Promise<
  { ok: true; models: string[] } | { ok: false; reason: string }
> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, reason: "GEMINI_API_KEY is not set in this environment." };

  const res = await fetch(`${ENDPOINT}/models?pageSize=200`, {
    headers: { "x-goog-api-key": key },
  });
  if (!res.ok) {
    return { ok: false, reason: `Gemini answered ${res.status}: ${(await res.text()).slice(0, 400)}` };
  }
  const body = (await res.json()) as { models?: { name?: string }[] };
  const models = (body.models ?? [])
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((n) => /image/i.test(n))
    .sort();
  return { ok: true, models };
}

/**
 * One illustration.
 *
 * ⚠️ RETURNS THE RAW REFUSAL RATHER THAN A TIDY MESSAGE. This cannot be run
 * locally, so the first production call is the experiment — and a swallowed
 * error would make it worthless ⇒ the refusal that promised its reasons were
 * recorded and threw them away.
 */
export async function generateIllustration(opts: {
  style: IllustrationStyle;
  mood?: string | null;
  model: string;
  aspectRatio?: string;
}): Promise<IllustrationResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, reason: "GEMINI_API_KEY is not set in this environment." };

  const prompt = illustrationPrompt(opts.style, opts.mood);
  const res = await fetch(`${ENDPOINT}/models/${encodeURIComponent(opts.model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        ...(opts.aspectRatio ? { imageConfig: { aspectRatio: opts.aspectRatio } } : {}),
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, reason: `Gemini answered ${res.status}`, detail: text.slice(0, 1200) };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Gemini's reply was not JSON", detail: text.slice(0, 600) };
  }

  const inline = firstInlineImage(body);
  if (!inline) {
    return {
      ok: false,
      reason: "Gemini answered 200 but the reply carried no image part",
      detail: text.slice(0, 1200),
    };
  }
  return {
    ok: true,
    bytes: new Uint8Array(Buffer.from(inline.data, "base64")),
    mimeType: inline.mimeType,
    model: opts.model,
  };
}
