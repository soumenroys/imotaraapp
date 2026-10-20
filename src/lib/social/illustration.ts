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
 * 🔴 THE SAFETY CLAUSE, AND IT IS NOT OPTIONAL.
 *
 * ⛔ This is a MENTAL-HEALTH brand. A generated picture that shows distress, a
 * clinical setting or a face that reads as a real person is not a bad card —
 * it is a liability and a betrayal of the reader. The same class of risk as
 * the regulated-title copy that has been caught FOUR times in material written
 * by people who knew the rules ⇒ trap_marketing_copy_claims_a_regulated_title.
 *
 * 🔑 NO LETTERS, EITHER. The renderer draws the words. A picture with its own
 * text produces two headlines on one card, in a typeface nobody chose, often
 * misspelled — and in a script the model cannot shape.
 */
export const SAFETY_CLAUSE =
  "Absolute requirements: no people, no faces, no human figures, no hands. " +
  "No text, letters, numbers, words or lettering of any kind anywhere in the image. " +
  "No logos, watermarks or brand marks. " +
  "Nothing clinical or medical: no hospitals, pills, syringes, therapy couches or doctors. " +
  "Nothing depicting distress, crying, self-harm, violence, isolation as suffering, or illness. " +
  "Nothing frightening, sad or bleak. Calm, quiet and gentle throughout.";

export type IllustrationStyle = {
  id: string;
  /** What a person would call it in the admin. */
  label: string;
  /** One line, so the owner can choose without reading the prompt. */
  note: string;
  /** The style half of the prompt. ⚠️ Never contains the subject. */
  look: string;
};

/**
 * 🔑 FIVE LOOKS, NOT FIFTY. The point is for the owner to choose ONE house
 * style from real samples — a feed drawn in five styles at random is a
 * different kind of incoherent from a feed drawn in one.
 *
 * ⚠️ All five are deliberately NON-LITERAL. An illustration that depicts the
 * subject ("someone awake at 3am") lands on exactly the imagery the safety
 * clause forbids. These describe a MOOD and a MATERIAL, and let the words
 * carry the meaning.
 */
export const ILLUSTRATION_STYLES: IllustrationStyle[] = [
  {
    id: "soft-gouache",
    label: "Soft gouache",
    note: "Hand-painted abstract shapes, matte and muted. Warm, human, not digital.",
    look:
      "A soft gouache painting of large simple abstract shapes — gentle curves and overlapping " +
      "fields of flat matte colour, visible brush texture, slightly uneven edges. Muted, dusty " +
      "palette. Generous empty space. No subject, purely an abstract painted field.",
  },
  {
    id: "line-botanical",
    label: "Line botanical",
    note: "Single-weight line drawing of leaves and stems. Quiet, airy, lots of space.",
    look:
      "A minimal single-weight line drawing of leaves, stems and seed heads, drawn in one " +
      "continuous thin line on a plain ground. Sparse and airy, occupying one corner, with a " +
      "large area of empty background. Two colours at most.",
  },
  {
    id: "night-window",
    label: "Night window",
    note: "Quiet nocturnal light — windows, lamps, distant city. Calm, never lonely.",
    look:
      "A calm nocturnal scene rendered as simple flat shapes: soft lit windows in the distance, " +
      "a gentle glow, deep blue and warm amber. Peaceful and still, restful rather than lonely " +
      "or bleak. Simplified and graphic, not photographic.",
  },
  {
    id: "paper-collage",
    label: "Paper collage",
    note: "Torn-paper layers with soft shadows. Tactile and handmade.",
    look:
      "A torn-paper collage of layered organic shapes with soft drop shadows and visible paper " +
      "fibre at the edges. Muted recycled-paper tones with one warm accent. Flat lay, even " +
      "lighting, plenty of uncluttered ground.",
  },
  {
    id: "warm-minimal",
    label: "Warm minimal",
    note: "Big simple geometry in warm tones. Bold, modern, very clean.",
    look:
      "An extremely minimal geometric composition: two or three very large simple shapes — a " +
      "circle, an arc, a soft rectangle — in warm sand, clay and terracotta tones on a light " +
      "ground. Flat colour, no gradients, no detail, a great deal of empty space.",
  },
];

export function styleById(id: string): IllustrationStyle | undefined {
  return ILLUSTRATION_STYLES.find((s) => s.id === id);
}

/**
 * The prompt actually sent.
 *
 * ⛔ THE SAFETY CLAUSE GOES LAST, every time. A requirement buried in the
 * middle of a long prompt is one the model weighs against everything after it;
 * stated last it is the final instruction. ⚠️ And it is appended HERE rather
 * than written into each style, so a style added later cannot omit it
 * ⇒ trap_a_constraint_nobody_told_the_writer.
 */
export function illustrationPrompt(style: IllustrationStyle, mood?: string | null): string {
  const m = (mood ?? "").trim();
  return [
    style.look,
    m ? `The feeling to evoke, abstractly and without depicting it literally: ${m}.` : "",
    "The image will sit behind large text, so keep the composition open and uncluttered, " +
      "with low contrast and no busy detail in the upper half.",
    SAFETY_CLAUSE,
  ]
    .filter(Boolean)
    .join(" ");
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
