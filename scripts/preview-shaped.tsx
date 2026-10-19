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
import { chromium } from "playwright";
import { composePicture } from "@/lib/social/compose";
import { cardHtml, SCRIPT_FONT_STACK } from "@/lib/social/toHtml";
import { allQrCodes } from "@/lib/social/brandMarks";
import type { Recipe } from "@/lib/social/visualRecipe";

async function main() {
  const [, , out = "shaped.png", language = "bn", headline = "অভিমান", support = "মন খারাপ লাগছে"] = process.argv;

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

  const html = cardHtml(picture.root, picture.width, picture.height, SCRIPT_FONT_STACK);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: picture.width, height: picture.height },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "networkidle" });
  writeFileSync(out, await page.screenshot({ type: "png" }));
  await browser.close();

  console.log(`${out}  ${picture.width}×${picture.height}  ${language}`);
  if (picture.notes.length) console.log(picture.notes.map((n) => `  ⚠️ ${n}`).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
