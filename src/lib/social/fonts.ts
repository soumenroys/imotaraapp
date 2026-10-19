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
// ⚠️ AND NOBODY HERE COULD SEE IT. I can render a PNG and measure its pixels. I
// cannot tell whether ইমোতারা came out shaped correctly, and neither can anyone
// else on this side. That is the same reason the abuse lists stop at English.
// ⇒ brand_name_in_native_scripts, native_speakers_should_audit_real_replies
//
// ✅ SO: a script may carry the wordmark only once somebody who reads it has
// looked at a rendered picture and said it is right. Until then the picture
// uses the Latin form — which is the shipped form for eight of the 22 anyway —
// and the post itself is still written in its own language. ⛔ The alternative
// is publishing a possibly mangled brand name and not knowing.

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
  verifiedBy?: string;
  verifiedAt?: string;
};

const LATIN: ScriptFont = {
  family: "Inter",
  // ⚠️ A static TTF, not the woff2 the stylesheet serves. Satori cannot read woff2.
  url: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf",
  shapingVerified: true,
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
     */
    shapingVerified: false,
  },
  tamil: {
    family: "Noto Sans Tamil",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tamil@latest/tamil-600-normal.ttf",
    shapingVerified: false,
  },
  telugu: {
    family: "Noto Sans Telugu",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-telugu@latest/telugu-600-normal.ttf",
    shapingVerified: false,
  },
  gujarati: {
    family: "Noto Sans Gujarati",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-gujarati@latest/gujarati-600-normal.ttf",
    shapingVerified: false,
  },
  gurmukhi: {
    family: "Noto Sans Gurmukhi",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-gurmukhi@latest/gurmukhi-600-normal.ttf",
    shapingVerified: false,
  },
  kannada: {
    family: "Noto Sans Kannada",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kannada@latest/kannada-600-normal.ttf",
    shapingVerified: false,
  },
  malayalam: {
    family: "Noto Sans Malayalam",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-malayalam@latest/malayalam-600-normal.ttf",
    shapingVerified: false,
  },
  oriya: {
    family: "Noto Sans Oriya",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-oriya@latest/oriya-600-normal.ttf",
    shapingVerified: false,
  },
  arabic: {
    family: "Noto Sans Arabic",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-600-normal.ttf",
    shapingVerified: false,
  },
  hebrew: {
    family: "Noto Sans Hebrew",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-hebrew@latest/hebrew-600-normal.ttf",
    shapingVerified: false,
  },
  japanese: {
    family: "Noto Sans JP",
    url: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-600-normal.ttf",
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
