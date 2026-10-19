// src/lib/social/contentTypes.ts
// The shapes a post can take — the one list, in a module a browser can import.
//
// 🔴 THERE WERE FIVE COPIES OF THIS LIST. A union in pipeline.ts, an array in
// the schedules route, another in the compose route, a radio-button list in
// NewSchedule, and a CHECK constraint in the database. `short_video` and
// `animated_gif` were added to four of the five. The one that was missed was
// the radio buttons — so the feature was built end to end, documented, tested
// and unreachable, while the page's own walkthrough told the reader to pick an
// option that was not on the screen.
//
// ⛔ WHY ITS OWN FILE RATHER THAN pipeline.ts. pipeline imports visualRecipe,
// which imports `crypto`. A client component importing the list from there
// drags Node's crypto into the browser bundle — the same shape of problem that
// put ffmpeg in the bundle and produced animationFacts.ts. ⇒ A list of five
// strings has no dependencies and belongs where anything can read it.
//
// ⚠️ The database's CHECK constraint is the one copy that cannot import this.
// It lives in docs/sql/social_autopost_v1.sql and has to be changed by hand.

/**
 * Every shape a schedule can be set to, in the order an admin should meet them.
 *
 * ⚠️ `animated_gif` animates on X and nowhere else — LinkedIn strips it and
 * Facebook converts it. `short_video` animates everywhere. Both exist because
 * the owner asked for the GIF and the video is what actually works; the form
 * says which channels will move before anything is saved ⇒ animationWarning.
 */
export const CONTENT_TYPES = [
  "text",
  "text_graphic",
  "graphic",
  "short_video",
  "animated_gif",
  /**
   * 🔑 ADDED 19 Oct. Several cards, swiped. ⚠️ NOT "the same post split up":
   * our posts run two or three sentences and splitting those is padding —
   * the "swipe for the obvious conclusion" shape readers resent. A carousel
   * needs writing that earns each swipe ⇒ the `ways-of-saying` pool, which is
   * the only angle shaped for it.
   *
   * ⛔ INSTAGRAM ONLY for now. Facebook takes multi-photo posts by a
   * different route, and nothing has been built for it.
   */
  "carousel",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * What each shape is called on screen.
 *
 * ⚠️ HERE, BESIDE THE LIST, because two screens show these and a label kept
 * next to only one of them is the next copy to drift. Typed against
 * ContentType, so a new shape without a name does not build.
 */
export const SHAPE_LABELS: Record<ContentType, string> = {
  text: "Text",
  text_graphic: "Text + graphic",
  graphic: "Graphic",
  short_video: "Short video",
  animated_gif: "Animated GIF",
  carousel: "Carousel",
};
