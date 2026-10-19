/**
 * scripts/preview-shaped.tsx — the same card, drawn by a browser.
 *
 * 🔴 THE POINT IS THE COMPARISON. Satori draws the Latin cards that publish
 * today and cannot shape a single Indic script. This draws the SAME composed
 * tree through Chromium, which can. Run it beside preview-card.tsx and the
 * difference is the whole argument.
 *
 *   npx tsx scripts/preview-shaped.tsx out.png bn "অভিমান" "মন খারাপ লাগছে"
 */
import { writeFileSync } from "node:fs";
import { composePicture } from "@/lib/social/compose";
import { renderShapedCard } from "@/lib/social/shapedRenderer";
import { SCRIPT_FONTS, SCRIPT_OF_LANGUAGE } from "@/lib/social/fonts";
import { allQrCodes } from "@/lib/social/brandMarks";
import type { Recipe } from "@/lib/social/visualRecipe";

async function main() {
  const [, , out = "shaped.png", language = "bn", headline = "অভিমান", // ⚠️ আমার, not bare লাগছে — the owner has corrected exactly this.
    support = "আমার মন খারাপ লাগছে"] = process.argv;

  const picture = composePicture({
    recipe: {
      layout: "rule-over",
      palette: "forest",
      typeTreatment: "display",
      motif: "arcs",
      script: "latin",
      hash: "preview",
    } as Recipe,
    headline,
    support,
    language,
    platform: "instagram",
    qrCodes: await allQrCodes("instagram"),
  });

  /**
   * ⚠️ THROUGH renderShapedCard, the same function production calls — not a
   * local copy of its steps. A preview that takes a different path answers a
   * different question, and the question here is "what will publish?".
   */
  const script = SCRIPT_OF_LANGUAGE[language] ?? "latin";
  const faces = [SCRIPT_FONTS.latin, SCRIPT_FONTS[script]]
    .filter(Boolean)
    .map((f) => ({ family: f.family, url: f.url }));

  const shaped = await renderShapedCard({
    root: picture.root,
    width: picture.width,
    height: picture.height,
    faces,
  });
  if (!shaped.ok) {
    console.error(shaped.error);
    process.exit(1);
  }
  writeFileSync(out, Buffer.from(shaped.bytes));

  console.log(`${out}  ${picture.width}×${picture.height}  ${language}`);
  if (picture.notes.length) console.log(picture.notes.map((n) => `  ⚠️ ${n}`).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
