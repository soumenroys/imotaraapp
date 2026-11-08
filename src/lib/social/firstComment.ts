// src/lib/social/firstComment.ts
// Facebook FIRST-COMMENT TRIAL (owner, 7 Nov 2026 — #92).
//
// 🔑 WHY: a link in a Facebook post's TEXT costs the post reach
// (platforms.ts linksInBody = false), so our posts carried no clickable way to
// the website — GA counted 7 social visits in 28 days. Many Pages put the link
// in the FIRST COMMENT instead. The owner agreed to TRY it, cautiously:
// "remember this decision so we do not forget to compare reach and visits
// before and after … if we forget this step, it may be harmful".
//
// ⛔ SO IT SWITCHES ITSELF OFF. After TRIAL_UNTIL no comment is posted, whether
// or not anybody remembered — forgetting the review can only END the trial,
// never extend it. Continuing needs a deliberate code change after the
// before/after comparison (board #92, memory decision_fb_first_comment_trial).
//
// Measured by: GA sessions with utm_campaign=first_comment, and per-post
// Facebook reach in social_post_stats, against the 14 days before.

export const TRIAL_START = "2026-11-07T09:30:00.000Z"; // 7 Nov 15:00 IST
export const TRIAL_UNTIL = "2026-11-21T18:30:00.000Z"; // 22 Nov 00:00 IST

export const FIRST_COMMENT_CAMPAIGN = "first_comment";

export function firstCommentActive(now: number = Date.now()): boolean {
  return now >= Date.parse(TRIAL_START) && now < Date.parse(TRIAL_UNTIL);
}

export function firstCommentUrl(): string {
  return `https://www.imotara.com/?utm_source=facebook&utm_medium=social&utm_campaign=${FIRST_COMMENT_CAMPAIGN}`;
}

/** One short, plain line — house style: no "AI", no hype, one link. */
export function firstCommentText(): string {
  return `If you'd like somewhere to say it, Imotara listens — in your own language: ${firstCommentUrl()}`;
}

/** Our own first comment must never be read back as a visitor's comment. */
export function isOurFirstComment(text: string): boolean {
  return text.includes(`utm_campaign=${FIRST_COMMENT_CAMPAIGN}`);
}

/**
 * The id a Page post must be commented on: `{pageId}_{postId}`.
 * 🔴 8 Nov 2026: a VIDEO post comes back from Facebook as the bare post number
 * (e.g. 122139749793392789), a photo post as `{pageId}_{postId}`. Commenting on
 * the bare number is refused — "(#12) singular statuses API is deprecated" — so
 * every video post in the trial went out with no link comment, while the posts
 * themselves were fine. ⇒ qualify the id with the Page before commenting.
 */
export function commentTargetId(postId: string, pageId: string): string {
  const id = postId.trim();
  if (id.includes("_") || !pageId.trim()) return id;
  return `${pageId.trim()}_${id}`;
}
