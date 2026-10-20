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

/**
 * 🔴 THE TONE A STYLE CAN CARRY — added 20 Oct 2026, and the owner's words are
 * the whole reason: *"be careful, whatever you write on the image, that should
 * be aligned with the background image."*
 *
 * ⛔ THE FAILURE THIS PREVENTS is not subtle and it is not cosmetic. The
 * angles include `quiet-hours` — posts about three in the morning, about the
 * phone sitting silent, about nobody being awake. Rotating styles blindly
 * would eventually set one of those over the children's-book fox picnic, and
 * a post that cheerful over a sentence that lonely does not read as variety.
 * It reads as nobody looking.
 *
 * ⚠️ `quiet` is NOT "sad". Imotara never publishes bleak imagery. It means
 * still, unhurried, low-key — a dusk field rather than a party.
 */
export type StyleTone = "quiet" | "warm" | "bright";

export type IllustrationStyle = {
  id: string;
  label: string;
  /** One line, so a style can be chosen without reading the prompt. */
  note: string;
  family: StyleFamily;
  /**
   * 🔑 WHICH TONES THIS STYLE CAN HONESTLY CARRY. Several carry more than one
   * — a pen-and-ink botanical is as at home under a still sentence as a warm
   * one. ⛔ Never empty: a style no post can use is a style that should have
   * been deleted.
   */
  tones: StyleTone[];
  /**
   * 🔑 HOW DARK THIS STYLE IS MEANT TO COME OUT — and therefore which ink it
   * expects. ⛔ A DECLARATION, NOT A DECISION: the ink is still measured from
   * the real pixels ⇒ backgroundPlan. This exists so the two can be COMPARED.
   *
   * ⚠️ WHY IT EXISTS AT ALL. Drawing all twelve and reading the measurements
   * showed every single one landing light enough for dark ink — consistent,
   * and a monotony creeping back in by the side door, since several of the
   * owner's own references are white-on-dark. A style that intends to be dark
   * and measures light is a prompt that is not working, and without this field
   * nobody would ever find out.
   */
  ground: "light" | "dark";
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
  "Drawn characters SHOULD have simple friendly features — small dot eyes, a soft smile — " +
  "never blank or featureless faces. " +
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
/**
 * ⛔ TWO STYLES WERE REMOVED AFTER BEING RENDERED ON REAL POSTS, 20 Oct 2026 —
 * both by looking, neither by any test.
 *
 * • `photo-field` asked for a photograph and returned a painted illustration
 *   BOTH times, the second with odd pale figures standing in a meadow. ⇒ A
 *   style that does not do what its name says will keep producing surprises,
 *   and the surprise lands on a published post.
 * • `flat-vector-scene` composed perfectly — hard yellow/blue split, smiling
 *   blob character — and read like a SaaS landing page rather than a quiet
 *   companion. ⚠️ LEGIBLE IS NOT THE SAME AS RIGHT, and only the owner can
 *   make that call.
 *
 * ⚠️ `childrens-book` was narrowed to `bright` alone for the same reason. It
 *   is a fine picture and it landed behind "How wanting to be alone can show
 *   up" — a cheerful fox-and-badger picnic under an introspective sentence.
 *   `warm` let it reach `the-unsaid`, which is exactly the wrong place for it.
 */
export const ILLUSTRATION_STYLES: IllustrationStyle[] = [
  {
    id: "oil-pastel-landscape",
    label: "Oil pastel landscape",
    note: "Autumn woods, a quiet shore. Rich, textured, hand-worked.",
    family: "painted",
    tones: ["quiet", "warm"],
    ground: "light",
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
    tones: ["quiet", "warm"],
    ground: "light",
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
    tones: ["warm", "bright"],
    ground: "light",
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
    tones: ["quiet", "warm"],
    ground: "light",
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
    tones: ["warm", "bright"],
    ground: "light",
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
    tones: ["bright", "warm"],
    ground: "light",
    textZone: "centre",
    look:
      "A field of broad waxy oil-crayon strokes covering the whole sheet in a gentle spectrum — " +
      "greens, blues, warm yellows — blended by hand with visible crayon texture and uneven " +
      "edges. Even tone throughout, no focal object, nothing busy anywhere.",
  },
  {
    id: "childrens-book",
    label: "Children's book",
    note: "Warm storybook art — animals, trees, soft sunlight.",
    family: "vector",
    tones: ["bright"],
    ground: "light",
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
    tones: ["bright", "quiet"],
    ground: "light",
    textZone: "centre",
    look:
      "A soft 3D render of simple rounded geometric objects — spheres, rings, rounded cubes — " +
      "floating on a single-colour studio background, matte clay-like materials, gentle shadows, " +
      "a monochrome scheme in one warm or cool hue. Objects around the edges; the middle is open.",
  },
  {
    id: "paper-collage",
    label: "Paper collage",
    note: "Torn-paper layers with soft shadows. Tactile and handmade.",
    family: "painted",
    tones: ["quiet", "warm", "bright"],
    ground: "light",
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
    tones: ["warm", "quiet", "bright"],
    ground: "light",
    textZone: "top",
    look:
      "An extremely minimal geometric composition — two or three very large simple shapes, a " +
      "circle, an arc, a soft rectangle, in warm sand clay and terracotta tones on a light " +
      "ground. Flat colour, no detail. The shapes sit low; the top is empty ground.",
  },
  /**
   * 🔑 THE THREE DARK-GROUND STYLES — added 20 Oct 2026 at the owner's
   * agreement, after the measurements showed all twelve coming out light.
   *
   * ⛔ THEY MUST BE GENUINELY DARK, not merely "moody". The ink is chosen by
   * measurement, so a style that *says* night and renders a pale blue sky will
   * simply take dark ink like all the rest and this will have achieved
   * nothing. ⇒ each one names deep, low-key values explicitly.
   */
  {
    id: "night-window",
    label: "Night window",
    note: "Lit windows in the dark, a far-off city. Calm, never lonely.",
    family: "painted",
    tones: ["quiet"],
    ground: "dark",
    textZone: "top",
    look:
      "A deep nocturnal scene in very dark navy and near-black — distant lit windows and a soft " +
      "amber glow low on the horizon, everything else in deep shadow. Dark, low-key and restful " +
      "rather than bleak. The upper half is almost black night sky with only a faint star or two.",
  },
  {
    id: "deep-vector-ground",
    label: "Deep colour ground",
    note: "Bold shapes on a rich dark field. Modern, graphic, confident.",
    family: "vector",
    tones: ["bright", "warm"],
    ground: "dark",
    textZone: "top",
    look:
      "A flat vector illustration on a deep saturated background — rich indigo, forest green or " +
      "aubergine, very dark overall — with simple bright geometric shapes and small friendly " +
      "characters gathered along the bottom edge. No gradients. The whole upper half is plain " +
      "deep colour with nothing on it.",
  },
  {
    id: "dusk-landscape",
    label: "Dusk landscape",
    note: "Hills after sunset. Deep, warm, quiet.",
    family: "painted",
    tones: ["quiet", "warm"],
    ground: "dark",
    textZone: "top",
    look:
      "A painted landscape just after sunset — dark layered hills in deep blues and purples " +
      "against a dusky sky, the last warm light sitting low behind the ridges. Deep and shadowed " +
      "throughout, soft brushwork. The sky above is dark and plain.",
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

/**
 * 🔴 WHAT A POST IS ABOUT → WHAT ITS PICTURE MAY LOOK LIKE.
 *
 * The owner: *"whatever you write on the image, that should be aligned with
 * the background image."* This is the tonal half of that; `textZone` is the
 * positional half.
 *
 * ⛔ THE ONE THAT MATTERS MOST IS `quiet-hours`. Those posts are about three
 * in the morning, the phone sitting silent, nobody being awake — "Quiet
 * company at 2:46 in the morning", "The hour nobody answers". A bright
 * children's-book fox picnic behind one of those does not read as variety; it
 * reads as nobody having looked.
 *
 * ⚠️ `the-unsaid` is the same shape — the reply you give to close the
 * conversation, the pause before "I'm fine". Still and warm, never jolly.
 *
 * 🔑 THE REST ARE GENUINELY OPEN. `privacy` and `built-wrong` are product
 * explanations and can take any tone; `untranslatable` is about a feeling
 * having a name, which is warm by nature. ⛔ Listing every tone for those is
 * the honest answer, not a lazy one — a constraint invented where none exists
 * would narrow the variety this whole feature is for.
 */
export const TONES_FOR_ANGLE: Record<string, StyleTone[]> = {
  "quiet-hours": ["quiet"],
  "the-unsaid": ["quiet", "warm"],
  untranslatable: ["warm", "bright"],
  privacy: ["quiet", "warm", "bright"],
  "built-wrong": ["quiet", "warm", "bright"],
  "ways-of-saying": ["warm", "bright"],
};

/**
 * The styles that suit what this post is about.
 *
 * ⛔ NEVER EMPTY. An angle nobody thought to map, or a new one added later,
 * must not leave a post with no picture at all — a missing illustration is
 * worse than a mildly off one, and silence is the failure this project keeps
 * relearning. An unknown angle gets the whole catalogue.
 */
export function stylesForAngle(
  angle: string | null | undefined,
  styles: IllustrationStyle[] = ILLUSTRATION_STYLES,
): IllustrationStyle[] {
  const wanted = TONES_FOR_ANGLE[(angle ?? "").trim()];
  if (!wanted || wanted.length === 0) return styles;
  const fit = styles.filter((s) => s.tones.some((t) => wanted.includes(t)));
  return fit.length > 0 ? fit : styles;
}
