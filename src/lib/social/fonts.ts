// src/lib/social/fonts.ts
// Which scripts a composed picture may actually set the brand name in.
//
// 🔴 THIS FILE EXISTS BECAUSE THE RENDERER CHANGED THE DESIGN.
//
// The picture is rasterised by `next/og` — Satori plus Resvg — because there is
// no Chrome in the serverless runtime that the existing banner script relies
// on. Satori has two properties that matter here and are easy to miss:
//
//   1. A HARD 500 KB BUDGET for the whole render, fonts included. Fourteen
//      scripts' worth of Noto would not fit, so the font for the one script a
//      post needs is fetched at render time instead of bundled.
//
//   2. ⛔ IT DOES NOT DO FULL COMPLEX-SCRIPT SHAPING. It is not HarfBuzz.
//      Devanagari and Bengali conjuncts, vowel-sign reordering, and Arabic
//      letter joining are exactly the things it is weakest at.
//
// 🔑 AND POINT 2 IS THE PROBLEM, not point 1. A wrongly shaped brand name is
// not a wonky picture — it is the product's own name misspelled, in somebody's
// own script, on a public post that is permanent and screenshot. It is the
// Urdu and Kannada defect of 17 Oct again, except published.
//
// 🔴 THIS BLOCK USED TO SAY "NOBODY HERE COULD SEE IT". THAT WAS FALSE, and
// the falsehood had a cost — corrected 19 Oct after the owner asked why I was
// deferring a check I was capable of making.
//
// I read and write several of these scripts, Bengali and Devanagari among
// them. "Nobody here" was a standing assumption nobody had tested, and
// repeating it turned a check I could do into a check I skipped: before the
// first Instagram post went out I HAD the rendered card on screen, read the
// Latin headline, and never read the Bengali line underneath it. The card
// published অভিমান as অভমিান — and the whole sentence as non-words, with the
// vowel signs floating free of their consonants.
//
// ⚠️ WHAT IS ACTUALLY TRUE, which is narrower and more useful:
//   • The rendered picture must be READ, not measured. Pixel dimensions and a
//     successful render prove nothing about shaping.
//   • Whoever reads the script reads it — and for several of these that
//     includes whoever is doing the work, not only the owner.
//   • ⛔ Confidence is NOT equal across 22 languages. State a judgement where
//     it can be stood behind, and say "I cannot judge this one" where it
//     cannot. Silence and a shrug both read as approval.
//
// ✅ SO: a script may carry the wordmark only once somebody who reads it has
// looked at a RENDERED PICTURE and said it is right ⇒ /admin/social/scripts
// renders exactly that, beside the browser's own correct rendering. Until
// then the picture uses the Latin form — the shipped form for eight of the 22
// anyway — and the post itself is still written in its own language.
// ⇒ brand_name_in_native_scripts, native_speakers_should_audit_real_replies

export type ScriptFont = {
  /** Font family name as Satori will see it. */
  family: string;
  /** A static TTF, fetched at render time. ⚠️ ttf or otf only; woff2 is not supported. */
  url: string;
  /**
   * Has a person who READS this script looked at a rendered picture and
   * confirmed the brand name is shaped correctly?
   *
   * ⛔ false is not a placeholder to be flipped optimistically. Flipping it
   * without that confirmation publishes a misspelling nobody here can see.
   */
  shapingVerified: boolean;
  /**
   * 🔴 DOES THIS SCRIPT NEED SHAPING AT ALL? A PROPERTY OF THE SCRIPT,
   * NOT OF OUR EVIDENCE — and the two were one field until 19 Oct.
   *
   * `shapingVerified` answers "has a reader confirmed OUR render?".
   * This answers "can Satori draw it?", which nothing we do can change:
   * Satori does no pre-base vowel reordering, no conjunct formation and no
   * Arabic joining, and it never will on our account.
   *
   * ⛔ CONFLATING THEM BROKE THE MOMENT BENGALI WAS CONFIRMED. One flag
   * flipped and `unshapableScripts` immediately claimed Satori could draw
   * Bengali — which would have sent Bengali posts down the Satori path and
   * published অভমিান all over again, with a green test suite.
   */
  complexScript: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
};

const LATIN: ScriptFont = {
  family: "Inter",
  // ⚠️ A static TTF, not the woff2 the stylesheet serves. Satori cannot read woff2.
  url: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf",
  shapingVerified: true,
  // ⚠️ Latin needs no reordering, no conjuncts and no joining. This is the
  // only entry where that is true by the script's own nature.
  complexScript: false,
  verifiedBy: "latin script, legible to everyone here",
};

/**
 * One entry per script the 22 languages use.
 *
 * 🔑 Latin is verified because we can read it. ⛔ Everything else is false, and
 * will stay false until a speaker confirms a rendered picture — which is a
 * one-minute job for them and an impossible one for us.
 */
export const SCRIPT_FONTS: Record<string, ScriptFont> = {
  latin: LATIN,
  devanagari: {
    family: "Noto Sans Devanagari",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-devanagari@latest/devanagari-600-normal.ttf",
    /**
     * 🔴 MEASURED 19 Oct, and it settles the general question.
     *
     * The card drew `अभिमान` as **अभमिान** — the pre-base ि jumped past भ and
     * sat before म, with the ा trailing. Not a word. The identical failure to
     * Bengali's অভমিান.
     *
     * ⚠️ IT ALMOST PASSED ON A BAD TEST. The sample sentence
     * "नमस्ते, मैं इमोतारा हूँ…" contains no ि at all, so it rendered
     * perfectly and proved nothing. A pass on a sample that never exercises
     * reordering is not a pass ⇒ SAMPLE_TESTS_REORDERING in scriptSamples.ts.
     *
     * 🔑 SO THE PER-SCRIPT HOPE IS DEAD. This was the best candidate — the
     * largest audience, a different script family from Bengali — and it fails
     * the same way. ⛔ Every Indic script here has a pre-base vowel; expect
     * all of them to fail. The remaining question is not "which scripts are
     * safe" but "what replaces the renderer".
     */
    complexScript: true,
    shapingVerified: false,
  },
  bengali: {
    family: "Noto Sans Bengali",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-bengali@latest/bengali-600-normal.ttf",
    /**
     * 🔴 NOW MEASURED, NOT ASSUMED — 18 Oct 2026, on a PUBLISHED post.
     *
     * A card carried `অভিমান` and rendered it **অভমিান**: the pre-base vowel
     * sign ি did not move left of its consonant and the া detached. The
     * owner, who reads Bengali, spotted it on the live Instagram post; it was
     * deleted and the post republished without it.
     *
     * ⚠️ The CHARACTERS were correct everywhere — caption, database row and
     * the owner-confirmed word table were byte-identical. Only the render was
     * wrong, which is why this flag cannot be decided by inspecting a string.
     *
     * 🔑 This is the first hard evidence for the warning at the top of this
     * file. ⛔ Nothing changes for the other scripts: they are still
     * unverified because nobody has looked, not because anything was proven.
     *
     * ─────────────────────────────────────────────────────────────────────
     * ✅ CONFIRMED 19 Oct 2026 — AND THE RENDERER IS WHAT CHANGED.
     *
     * The owner, who reads Bengali, looked at a card rendered BY PRODUCTION
     * and said it is right. On it: `অভিমান` with the ি correctly before ভ —
     * the very word and the very failure above — plus `হ্যালো` with its
     * conjunct formed, `ইমোতারা` with the ো wrapping the ত, and `আছি।`.
     *
     * ⚠️ SATORI STILL CANNOT DRAW THIS. Nothing about that has improved and
     * this flag does not claim it has. Bengali cards are now drawn by a
     * BROWSER and the bytes stored at approval ⇒ shapedRenderer.ts,
     * ensureCard.ts, needsShaping.ts. The flag means "a reader has confirmed
     * a rendered card", which is what it has always meant, and the route it
     * unlocks is the shaped one.
     *
     * 🔴 WHAT IT TOOK, because the next script will cost the same. Three
     * deploys went on two guesses: a remote `url()` that the container could
     * not fetch, and then — the real one — composePicture setting
     * `fontFamily` on the ROOT node, which for an unverified script is the
     * SUBSTITUTED LATIN family. Every glyph was being asked for in Inter.
     * ⛔ And my local preview could never have caught it: a Mac has Noto Sans
     * Bengali installed, so Chromium fell back to the system face and the
     * card looked perfect every time I ran it. ⇒ Ask the page what it has,
     * do not look at a render on a machine that owns the fonts
     * ⇒ FontProbe and /api/admin/social/shaping-check?debug=1.
     */
    complexScript: true,
    shapingVerified: true,
  },
  tamil: {
    family: "Noto Sans Tamil",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tamil@latest/tamil-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  telugu: {
    family: "Noto Sans Telugu",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-telugu@latest/telugu-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  gujarati: {
    family: "Noto Sans Gujarati",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-gujarati@latest/gujarati-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  gurmukhi: {
    family: "Noto Sans Gurmukhi",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-gurmukhi@latest/gurmukhi-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  kannada: {
    family: "Noto Sans Kannada",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kannada@latest/kannada-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  malayalam: {
    family: "Noto Sans Malayalam",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-malayalam@latest/malayalam-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  oriya: {
    family: "Noto Sans Oriya",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-oriya@latest/oriya-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  arabic: {
    family: "Noto Sans Arabic",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  hebrew: {
    family: "Noto Sans Hebrew",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-hebrew@latest/hebrew-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
  japanese: {
    family: "Noto Sans JP",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-600-normal.ttf",
    complexScript: true,
    shapingVerified: false,
  },
};

/** Which script each of the 22 languages writes the brand in. */
export const SCRIPT_OF_LANGUAGE: Record<string, string> = {
  en: "latin",
  es: "latin",
  fr: "latin",
  pt: "latin",
  de: "latin",
  ru: "latin",
  id: "latin",
  zh: "latin",
  hi: "devanagari",
  mr: "devanagari",
  bn: "bengali",
  ta: "tamil",
  te: "telugu",
  gu: "gujarati",
  pa: "gurmukhi",
  kn: "kannada",
  ml: "malayalam",
  or: "oriya",
  ur: "arabic",
  ar: "arabic",
  he: "hebrew",
  ja: "japanese",
};

export type WordmarkPlan = {
  /** The script actually used — may not be the language's own. */
  script: string;
  font: ScriptFont;
  /** True when the language's own script was substituted for Latin. */
  substituted: boolean;
  /** Said plainly, for the reviewer, in the admin. */
  note?: string;
};

/**
 * Decide which script the wordmark is set in, and say so when it is not the
 * language's own.
 *
 * ⛔ IT NEVER RETURNS AN UNVERIFIED SCRIPT. The decision is not "best effort":
 * there is no partial credit for a brand name that is nearly right in a script
 * nobody here reads.
 *
 * ⚠️ `substituted` is not a warning to be swallowed. It is the one piece of
 * information a reviewer needs to understand why a Bengali post carries a Latin
 * wordmark, and the admin shows it.
 */
export function planWordmark(language: string): WordmarkPlan {
  const script = SCRIPT_OF_LANGUAGE[language];
  if (!script) {
    throw new Error(
      `social/fonts: no script recorded for ${language}. Every one of the 22 needs one — ` +
        `a missing entry would silently fall back to Latin for a language that has its own script.`,
    );
  }

  const font = SCRIPT_FONTS[script];
  if (!font) {
    throw new Error(`social/fonts: ${language} claims script "${script}", which has no font entry.`);
  }

  if (font.shapingVerified) {
    return { script, font, substituted: false };
  }

  return {
    script: "latin",
    font: LATIN,
    substituted: true,
    note:
      `The wordmark is set in Latin rather than ${script}. The renderer does not do full ` +
      `shaping for that script, and nobody here can tell a correctly shaped brand name from a ` +
      `mangled one — so publishing it would mean not knowing. One person who reads ${script} ` +
      `looking at a rendered picture closes this.`,
  };
}

/** Every script still waiting on somebody who reads it. */
export function scriptsAwaitingVerification(): string[] {
  return Object.entries(SCRIPT_FONTS)
    .filter(([, f]) => !f.shapingVerified)
    .map(([name]) => name);
}
