/**
 * scripts/preview-carousel.tsx — render every card of a carousel, locally.
 *
 * 🔴 WHY A SECOND PREVIEW SCRIPT. preview-card.tsx goes straight to
 * composePicture, which is the right thing for judging a LAYOUT and the wrong
 * thing for judging a POST: it skips renderPostPicture entirely, which is
 * where `media_kind` is checked, where the slide is looked up, and where the
 * QR codes are decided. So it would have rendered a beautiful carousel card
 * while the real route 404'd every one of them — and it did.
 *
 *   npx tsx scripts/preview-carousel.tsx
 *
 * ⚠️ Goes through renderPostPicture, the same function the admin preview and
 * the public card route call. What it shows is what publishes.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { renderPostPicture } from "@/lib/social/renderPicture";
import { cardsForPost } from "@/lib/social/cardUrl";
import { pickRecipe } from "@/lib/social/visualRecipe";

const POST = {
  platform: "instagram",
  language: "en",
  media_kind: "carousel",
  subject: "The ways restlessness actually shows up",
  body: "Not one of these is a problem to fix. They are just how it arrives.",
  slides: [
    "You reread the same message four times.",
    "You tidy a drawer that was already tidy.",
    "You say yes to a thing you have no room for.",
    "You cannot name what is wrong, so you say you are tired.",
  ],
};

async function main() {
  const dir = process.argv[2] ?? "/tmp/carousel";
  mkdirSync(dir, { recursive: true });

  const picked = pickRecipe({ language: POST.language, usedHashes: new Set() });
  if (!picked.ok) throw new Error(picked.reason);
  // ⚠️ Overridable, because the fault being chased is usually in ONE layout and
  // a random pick finds it one time in six.
  const recipe = {
    ...picked.recipe,
    ...(process.argv[3] ? { layout: process.argv[3] } : {}),
    ...(process.argv[4] ? { palette: process.argv[4] } : {}),
    ...(process.argv[5] ? { motif: process.argv[5] } : {}),
  };

  const cards = cardsForPost(POST);
  console.log(`${cards.length} cards · recipe ${recipe.layout}/${recipe.palette}/${recipe.motif}\n`);

  for (const [slide, text] of cards.entries()) {
    const out = await renderPostPicture({ ...POST, visual_recipe: recipe, slide });
    if (!out.ok) {
      console.log(`  ✗ card ${slide}: ${out.failure.status} ${out.failure.error}`);
      continue;
    }
    const bytes = Buffer.from(await out.picture.response.arrayBuffer());
    const path = `${dir}/card-${slide}.png`;
    writeFileSync(path, bytes);
    console.log(
      `  ✓ card ${slide}  ${out.picture.width}×${out.picture.height}  ` +
        `${(bytes.length / 1024).toFixed(0)}KB  ${path}\n      “${text}”`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
