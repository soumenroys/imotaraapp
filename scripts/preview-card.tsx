/**
 * scripts/preview-card.tsx — render one social card to a PNG, locally.
 *
 * 🔴 WHY THIS EXISTS. Until 19 Oct the only way to see a card was to deploy,
 * sign into the admin and open the picture route. So the design was changed by
 * reasoning about numbers rather than by looking — and it showed: the headline
 * rendered at 59px on a 1080 square with two thirds of the frame empty, and
 * the "bands" motif drew four full-width bars straight through the middle.
 * Both were obvious in one render and invisible in the code.
 *
 *   npx tsx scripts/preview-card.tsx
 *   npx tsx scripts/preview-card.tsx instagram offset-quote plum tight-display concentric
 *   npx tsx scripts/preview-card.tsx facebook rule-over sand display arcs "A headline" "A support line."
 *
 * ⚠️ It renders through composePicture and next/og — the same path the real
 * card takes — so what it shows is what publishes. ⛔ A preview drawn any
 * other way would be a reassuring picture of a different question.
 */
import { writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";
import { composePicture } from "@/lib/social/compose";
import { toElement } from "@/lib/social/renderPicture";
import { allQrCodes } from "@/lib/social/brandMarks";
import type { Recipe } from "@/lib/social/visualRecipe";

const [
  ,
  ,
  platform = "instagram",
  layout = "rule-over",
  palette = "teal",
  treatment = "display",
  motif = "arcs",
  headline = "The answer that's easier than the truth",
  support = "You say you're fine because it's faster than explaining what's really on your mind. Nobody asks twice.",
] = process.argv;

async function main() {
  const picture = composePicture({
    recipe: { layout, palette, typeTreatment: treatment, motif, script: "latin", hash: "preview" } as Recipe,
    headline,
    support,
    language: "en",
    platform,
    qrCodes: await allQrCodes(platform),
  });

  // ⚠️ Latin only. A script this renderer cannot shape must be judged on
  // /admin/social/scripts, beside the browser's correct rendering — not here
  // ⇒ src/lib/social/shaping.ts.
  const font = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf",
  ).then((r) => r.arrayBuffer());

  const res = new ImageResponse(toElement(picture.root), {
    width: picture.width,
    height: picture.height,
    fonts: [{ name: picture.wordmark.font.family, data: font, weight: 600, style: "normal" }],
  });

  const out = `card-${platform}-${layout}-${palette}-${motif}.png`;
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`${out}  ${picture.width}×${picture.height}`);
  if (picture.notes.length) console.log(picture.notes.map((n) => `  ⚠️ ${n}`).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
