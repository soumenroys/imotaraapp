// src/lib/social/illustrationStyles.ts
// The backgrounds. One per post, and deliberately not one house style.
//
// 🔴 REWRITTEN 20 Oct 2026 FROM THE OWNER'S OWN REFERENCES. He sent 27 sample
// posts and said: *"find out the uploaded image patterns. see the variations
// of background images with text in the foreground. Try to do such variations
// … do not make all posts background monotonous."*
//
// ⛔ WHAT I HAD BUILT WAS WRONG, and the references are what showed it:
//   • I had the picture as a BAND with the words beneath it. In every sample
//     the image is the WHOLE background and the text sits on top of it.
//   • I had five tasteful abstracts. The samples vary by MEDIUM — oil pastel,
//     soft pastel, watercolour, pen and ink, coloured pencil, flat vector, 3D
//     render, children's-book illustration, photography. The medium is most of
//     the variety.
//   • I had banned people entirely. The warmth in those samples comes largely
//     FROM characters — a girl dancing, a child with a giraffe. The real risk
//     is a photorealistic face that reads as an identifiable person, not a
//     drawn one.
//
// 🔑 THE ONE THING EVERY SAMPLE HAS IN COMMON, and the reason text over a full
// background is safe at all: the artwork is COMPOSED to leave a quiet area —
// open sky, bare paper, a flat wash — and the words go there. So every prompt
// below demands that area. It is not decoration; it is what makes the card
// readable ⇒ and it is still MEASURED afterwards rather than trusted.

export type StyleFamily =
  | "painted"
  | "drawn"
  | "vector"
  | "photographic"
  | "dimensional";

export type IllustrationStyle = {
  id: string;
  label: string;
  /** One line, so a style can be chosen without reading the prompt. */
  note: string;
  family: StyleFamily;
  /**
   * 🔑 WHERE THE QUIET AREA IS. The composer needs to know which part of the
   * frame was reserved, or it will set the headline over the busy half.
   */
  textZone: "top" | "bottom" | "left" | "right" | "centre";
  /** The style half of the prompt. ⚠️ Never contains the subject. */
  look: string;
};

/**
 * 🔴 THE SAFETY CLAUSE — CORRECTED 20 Oct 2026.
 *
 * ⛔ THE VERSION BEFORE THIS BANNED PEOPLE OUTRIGHT, which was my caution and
 * not the brief. The owner's references are full of drawn characters and that
 * is where their warmth comes from. ⚠️ The real risk was never "a person" — it
 * is a PHOTOREALISTIC face that reads as an identifiable human being, which a
 * mental-health brand must not appear to be photographing.
 *
 * ⛔ WHAT DOES NOT CHANGE, because it is the part that could hurt somebody:
 * nothing depicting distress, crying, self-harm, violence or illness; nothing
 * clinical; and no lettering, because the renderer draws the words and a
 * picture carrying its own text puts two headlines on one card — often
 * misspelled, and in a script the model cannot shape.
 */
export const SAFETY_CLAUSE =
  "Requirements: no photorealistic human faces and nobody identifiable — any people must be " +
  "clearly illustrated or stylised, never photographic portraits. " +
  "No text, letters, numbers, words or lettering of any kind anywhere in the image. " +
  "No logos, watermarks, signatures or brand marks. " +
  "Nothing clinical or medical: no hospitals, pills, syringes, therapy couches or doctors. " +
  "Nothing depicting distress, crying, self-harm, violence or illness. " +
  "Warm, calm and gentle throughout.";

/**
 * ⚠️ EVERY PROMPT ENDS BY RESERVING ITS QUIET AREA. Stated per style rather
 * than appended globally, because WHERE the room is differs by style — a
 * landscape leaves sky at the top, a still life leaves the table below.
 */
export const ILLUSTRATION_STYLES: IllustrationStyle[] = [
  {
    id: "oil-pastel-landscape",
    label: "Oil pastel landscape",
    note: "Autumn woods, a quiet shore. Rich, textured, hand-worked.",
    family: "painted",
    textZone: "top",
    look:
      "An oil pastel landscape painting on textured paper — a quiet wood, a shoreline or open " +
      "fields, with visible pastel strokes and grain. Rich but gentle colour, soft light. " +
      "The upper third is open sky, almost plain, with no detail.",
  },
  {
    id: "soft-pastel-stilllife",
    label: "Soft pastel still life",
    note: "Flowers in a jar, chalky and tender. Lots of breathing room.",
    family: "painted",
    textZone: "top",
    look:
      "A soft chalk pastel still life — simple flowers in a glass jar on a plain surface, chalky " +
      "texture, muted blues greens and creams, loose edges. The arrangement sits low in the " +
      "frame and the top half is a plain soft wash.",
  },
  {
    id: "watercolour-character",
    label: "Watercolour character",
    note: "A small drawn figure, loose and happy. The warmest of the set.",
    family: "painted",
    textZone: "top",
    look:
      "A loose watercolour illustration of a single small stylised character — simple rounded " +
      "features, cheerful and relaxed, plenty of white paper around them. Soft washes, visible " +
      "paper texture, a few bright accents. The figure sits low and right; the upper left is " +
      "bare paper.",
  },
  {
    id: "pen-and-ink",
    label: "Pen and ink",
    note: "Fine black line work on white — botanical, delicate, graphic.",
    family: "drawn",
    textZone: "bottom",
    look:
      "A fine black pen and ink line drawing on white paper — botanical forms, a butterfly, " +
      "leaves and flowers, delicate hatching, no colour at all. The drawing occupies the upper " +
      "two thirds and the lower third is bare white paper.",
  },
  {
    id: "coloured-pencil",
    label: "Coloured pencil",
    note: "Bright pencil strokes on white, like a page from a sketchbook.",
    family: "drawn",
    textZone: "top",
    look:
      "A coloured pencil drawing on white sketchbook paper — one simple everyday object rendered " +
      "in bright overlapping pencil strokes, visible paper tooth, loose and hand-drawn. The " +
      "object sits in the lower half; the top is untouched white paper.",
  },
  {
    id: "crayon-colour-field",
    label: "Crayon colour field",
    note: "A rainbow of waxy strokes edge to edge. Bold and childlike.",
    family: "drawn",
    textZone: "centre",
    look:
      "A field of broad waxy oil-crayon strokes covering the whole sheet in a gentle spectrum — " +
      "greens, blues, warm yellows — blended by hand with visible crayon texture and uneven " +
      "edges. Even tone throughout, no focal object, nothing busy anywhere.",
  },
  {
    id: "flat-vector-scene",
    label: "Flat vector scene",
    note: "Clean modern shapes and characters. Bright, friendly, digital.",
    family: "vector",
    textZone: "left",
    look:
      "A flat vector illustration in a clean modern style — simple geometric characters and " +
      "objects, bold flat colour, no gradients or outlines, a bright friendly palette on a " +
      "strong coloured ground. The illustration sits on the right; the left half is plain " +
      "flat colour.",
  },
  {
    id: "childrens-book",
    label: "Children's book",
    note: "Warm storybook art — animals, trees, soft sunlight.",
    family: "vector",
    textZone: "top",
    look:
      "A warm children's storybook illustration — friendly stylised animals among trees and " +
      "grass under soft sunlight, rounded shapes, cheerful saturated colour, gentle shading. " +
      "The scene sits along the bottom; above it is open sky with only a cloud or two.",
  },
  {
    id: "3d-soft-render",
    label: "3D soft render",
    note: "Rounded 3D shapes in one colour. Modern and playful.",
    family: "dimensional",
    textZone: "centre",
    look:
      "A soft 3D render of simple rounded geometric objects — spheres, rings, rounded cubes — " +
      "floating on a single-colour studio background, matte clay-like materials, gentle shadows, " +
      "a monochrome scheme in one warm or cool hue. Objects around the edges; the middle is open.",
  },
  {
    id: "photo-field",
    label: "Photograph",
    note: "A real landscape — fields, sky, distant hills. Open and calm.",
    family: "photographic",
    textZone: "top",
    look:
      "A calm wide photograph of open landscape — fields, meadow flowers or a distant shoreline " +
      "under a big soft sky, natural daylight, gentle depth of field. The horizon " +
      "sits low and the upper half is uncluttered sky.",
  },
  {
    id: "paper-collage",
    label: "Paper collage",
    note: "Torn-paper layers with soft shadows. Tactile and handmade.",
    family: "painted",
    textZone: "centre",
    look:
      "A torn-paper collage of layered organic shapes with soft drop shadows and visible paper " +
      "fibre at the edges, muted recycled-paper tones with one warm accent, flat and evenly lit. " +
      "The shapes gather at the top and bottom edges, leaving the middle a clear plain sheet.",
  },
  {
    id: "warm-minimal",
    label: "Warm minimal",
    note: "Two or three huge simple shapes. Bold, clean, very modern.",
    family: "vector",
    textZone: "top",
    look:
      "An extremely minimal geometric composition — two or three very large simple shapes, a " +
      "circle, an arc, a soft rectangle, in warm sand clay and terracotta tones on a light " +
      "ground. Flat colour, no detail. The shapes sit low; the top is empty ground.",
  },
];

export function styleById(id: string): IllustrationStyle | undefined {
  return ILLUSTRATION_STYLES.find((s) => s.id === id);
}

/**
 * The prompt actually sent.
 *
 * ⛔ THE SAFETY CLAUSE GOES LAST, every time. A requirement buried mid-prompt
 * is weighed against everything after it; stated last it is the final word.
 * ⚠️ Appended HERE rather than written into each style, so a style added later
 * cannot omit it ⇒ trap_a_constraint_nobody_told_the_writer.
 */
export function illustrationPrompt(style: IllustrationStyle, mood?: string | null): string {
  const m = (mood ?? "").trim();
  return [
    style.look,
    m ? `The feeling to evoke, abstractly and without depicting it literally: ${m}.` : "",
    SAFETY_CLAUSE,
  ]
    .filter(Boolean)
    .join(" ");
}
