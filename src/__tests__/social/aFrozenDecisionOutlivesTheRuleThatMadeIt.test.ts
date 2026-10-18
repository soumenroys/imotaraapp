/**
 * 🔴 `media_kind` IS DECIDED WHEN A POST IS WRITTEN, AND THE RULES CHANGE.
 *
 * On 18 Oct the card's headline moved from the body's opening sentence to the
 * subject. Every post already in the queue had been composed under the old
 * rule, had failed to produce a headline, and carried `media_kind: "none"`.
 *
 * ⛔ So fixing the renderer changed nothing for them — and Imotara's first
 * public post went out as plain text into a feed of bold graphics. The fix was
 * live; the posts were frozen.
 *
 * ⚠️ I repaired four of them with a one-off script. That worked and left the
 * owner unable to do the same thing — the same "dependency, not a feature"
 * problem as the reschedule control. This is that script, as a feature.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const cron = read("src/app/api/cron/social-queue/route.ts");
const store = read("src/lib/social/store.ts");

describe("where the repair runs", () => {
  /**
   * 🔑 NOT IN THE PUBLISHER, and this is the load-bearing decision. Claiming a
   * recipe can fail against a unique index. The publish path is the one thing
   * in this feature that cannot be undone, and it does not need another way to
   * go wrong a second before it posts.
   */
  it("⛔ the publisher does not compose or claim anything", () => {
    const publisher = read("src/app/api/cron/social-publish/route.ts");
    expect(publisher).not.toMatch(/pickRecipe|attachCard|postsWantingACard/);
  });

  it("the queue cron does it", () => {
    expect(cron).toMatch(/const upgrades = await giveMissingCards\(deps\)/);
  });

  /**
   * ⚠️ A QUIET SUNDAY IS EXACTLY WHEN THE BACKLOG SHOULD BE REPAIRED. The
   * early return for "no schedule is due" used to sit above everything, so a
   * fix landing at the weekend would have waited until Monday.
   */
  it("runs even when no schedule is due", () => {
    expect(cron.indexOf("giveMissingCards(deps)")).toBeLessThan(cron.indexOf("const due = await dueSchedules"));
    // And the early-return answer still reports what it did.
    expect(cron).toMatch(/ran: true, due: 0, cards: upgrades/);
  });

  it("respects the master switch, like everything else here", () => {
    expect(cron.indexOf("postingIsPaused")).toBeLessThan(cron.indexOf("giveMissingCards(deps)"));
  });
});

describe("what it will and will not touch", () => {
  it("only queued posts — never a published one", () => {
    expect(store).toMatch(/\.in\("status", \["needs_review", "approved"\]\)/);
  });

  it("only posts that have no card at all", () => {
    expect(store).toMatch(/\.eq\("media_kind", "none"\)/);
    expect(store).toMatch(/\.is\("visual_recipe", null\)/);
  });

  /**
   * ⛔ A POST FROM A TEXT-ONLY SCHEDULE MUST NOT SPROUT A CARD it was never
   * meant to have. The post row does not carry the content type — the
   * schedule does — so this has to be looked up rather than assumed.
   */
  it("checks the SCHEDULE wanted a picture, not just that the post lacks one", () => {
    expect(store).toMatch(/wantsPicture\(wants\.get\(r\.schedule_id\)/);
  });

  it("⛔ changes no words — only the recipe and the media kind", () => {
    const fn = store.slice(store.indexOf("export async function attachCard"));
    const update = fn.slice(fn.indexOf(".update("), fn.indexOf(".eq(\"id\", post.id)"));
    expect(update).toMatch(/media_kind: "graphic"/);
    expect(update).toMatch(/visual_recipe: recipe/);
    expect(update).not.toMatch(/\bbody\b|\bsubject\b|\bstatus\b/);
  });

  it("⛔ invents no headline — it must still come from the post's own words", () => {
    expect(cron).toMatch(/if \(!headlineFor\(p\.subject \?\? "", p\.body\)\)/);
    expect(cron).toMatch(/result: "still-no-headline"/);
  });
});

describe("the uniqueness register is still the register", () => {
  /**
   * 🔑 The recipe is CLAIMED before the post is updated, never the other way
   * round — otherwise a failed claim leaves a post pointing at a recipe
   * nothing recorded, and a recipe could come round twice.
   */
  it("claims the recipe first, and only updates the post if the claim held", () => {
    const fn = store.slice(store.indexOf("export async function attachCard"));
    expect(fn.indexOf('from("social_visuals_used").insert')).toBeLessThan(fn.indexOf('from("social_posts")'));
    expect(fn).toMatch(/if \(claim\.error\)/);
  });

  it("treats a duplicate as another run winning, not as an error", () => {
    const fn = store.slice(store.indexOf("export async function attachCard"));
    expect(fn).toMatch(/23505/);
    expect(fn).toMatch(/Another run claimed that picture recipe first/);
  });

  it("⛔ will not overwrite a card attached between the read and the write", () => {
    const fn = store.slice(store.indexOf("export async function attachCard"));
    expect(fn).toMatch(/\.eq\("media_kind", "none"\)/);
  });

  /**
   * ⚠️ WITHIN ONE RUN TOO. Two posts repaired in the same pass would otherwise
   * be offered the same recipe, because the register has not caught up.
   */
  it("keeps its own view of what is used in step as it goes", () => {
    const fn = cron.slice(cron.indexOf("async function giveMissingCards"));
    expect(fn).toMatch(/used\.add\(picked\.recipe\.hash\)/);
    expect(fn).toMatch(/palettes\.unshift\(picked\.recipe\.palette\)/);
    expect(fn).toMatch(/layouts\.unshift\(picked\.recipe\.layout\)/);
  });
});
