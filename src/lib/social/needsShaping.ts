// src/lib/social/needsShaping.ts
// Which renderer a post needs, and whether it may publish at all.
//
// 🔴 ONE QUESTION, ONE PLACE. Three things have to agree: the approval step
// (which renders and stores), the card route (which serves), and the admin
// (which says why a post is held). Three copies of "can Satori draw this?" is
// how a post gets approved down one path and refused down another.

import { SCRIPT_FONTS, SCRIPT_OF_LANGUAGE } from "@/lib/social/fonts";

export type CardPlan =
  /** Satori draws it on demand, as it always has. */
  | { how: "derive"; script: string }
  /** A browser must draw it, and the bytes are stored ⇒ cardStore.ts. */
  | { how: "shape"; script: string; family: string; url: string }
  /**
   * ⛔ Nobody may draw it yet. The renderer can shape the script, but no human
   * who READS it has looked at a rendered card and said it is right.
   */
  | { how: "refuse"; script: string; why: string };

/**
 * 🔑 THE GATE IS A READER, NOT A RENDERER, AND THAT DOES NOT CHANGE.
 *
 * A browser shapes every script correctly — measured. ⛔ That is not the same
 * as the card being RIGHT. Satori rendered অভিমান as অভমিান and looked
 * entirely plausible to everyone here; the only thing that caught it was
 * somebody who reads Bengali seeing a published post. A renderer that is
 * correct in general can still meet a font without the glyph, a conjunct the
 * face does not carry, or a line break in the wrong place.
 *
 * ⇒ `shapingVerified` keeps meaning exactly what it meant: a person who reads
 * this script has looked at a rendered picture and said yes ⇒ fonts.ts and
 * /admin/social/scripts. Shaping unlocks the POSSIBILITY; a reader unlocks
 * the language.
 */
export function cardPlan(language: string): CardPlan {
  const script = SCRIPT_OF_LANGUAGE[language] ?? "latin";
  const font = SCRIPT_FONTS[script];

  if (!font) {
    return {
      how: "refuse",
      script,
      why: `${language} claims script "${script}", which has no font entry at all.`,
    };
  }

  /**
   * 🔴 TWO QUESTIONS, AND I HAD THEM AS ONE.
   *
   * ⛔ This used to read `if (font.shapingVerified) return derive` — which
   * sent a CONFIRMED script to SATORI, the renderer that cannot draw it. The
   * moment Bengali was confirmed, `cardPlan("bn")` answered "derive" and the
   * jumbled card would have published again. Caught by four tests that had
   * been written for the old single flag and were right to fail.
   *
   * ⇒ `complexScript` decides WHICH renderer; `shapingVerified` decides
   * whether the shaped one is allowed yet.
   */
  if (!font.complexScript) return { how: "derive", script };

  if (font.shapingVerified) {
    return { how: "shape", script, family: font.family, url: font.url };
  }

  return {
    how: "refuse",
    script,
    why:
      `No one who reads ${script} has confirmed a rendered card yet, so ${language} is held. ` +
      `⚠️ The renderer CAN now shape it — a browser draws it correctly ⇒ shapedRenderer.ts — ` +
      `but a correct renderer is not a correct card. ▶️ Look at one on /admin/social/scripts ` +
      `and set shapingVerified in src/lib/social/fonts.ts.`,
  };
}

/**
 * The same question, once a reader has said yes.
 *
 * ⚠️ SEPARATE FROM `cardPlan` ON PURPOSE. This is what the approval step will
 * call the day a script is confirmed; keeping it apart means flipping one flag
 * in fonts.ts changes behaviour everywhere at once, rather than needing this
 * file edited too.
 */
export function shapedFaces(language: string): { family: string; url: string }[] {
  const script = SCRIPT_OF_LANGUAGE[language] ?? "latin";
  const font = SCRIPT_FONTS[script];
  const latin = SCRIPT_FONTS.latin;

  /**
   * ⛔ LATIN IS ALWAYS INCLUDED, even on a Bengali card. The wordmark, the QR
   * labels and the domain are Latin, and a card whose script loaded but whose
   * brand name did not is the failure that looks deliberate — measured on
   * Vercel, where exactly one face was missing and "Imotara" was the part
   * that still looked perfect.
   */
  const faces = [{ family: latin.family, url: latin.url }];
  if (font && script !== "latin") faces.push({ family: font.family, url: font.url });
  return faces;
}
