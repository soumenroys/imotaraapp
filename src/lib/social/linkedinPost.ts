// src/lib/social/linkedinPost.ts
// One LinkedIn post, card and all, in the shape the publisher acts on.
//
// 🔑 WHY THIS IS NOT INLINE IN social-publish. The route can only be read, not
// run, in a test; this can be run against a fake LinkedIn. And the one rule
// here that matters most — which failures may have left a post live — is the
// kind of thing that must be shown working, not just written.

import {
  publishToLinkedIn,
  uploadLinkedInImage,
  type LinkedInFailure,
} from "@/lib/social/adapters/linkedin";

export type LinkedInPostResult =
  | { ok: true; postId: string; url: string }
  | { ok: false; kind: LinkedInFailure | "network"; message: string };

export async function postToLinkedIn(args: {
  token: string;
  organizationId: string;
  text: string;
  /** The rendered card. ⚠️ Absent ⇒ a text-only post, by the post's own choice. */
  picture?: Uint8Array;
  /** What the card says, for somebody who cannot see it ⇒ the post's headline. */
  altText?: string;
  fetchImpl?: typeof fetch;
  waitMs?: (ms: number) => Promise<void>;
}): Promise<LinkedInPostResult> {
  let imageUrn: string | undefined;

  if (args.picture) {
    const up = await uploadLinkedInImage({
      token: args.token,
      organizationId: args.organizationId,
      bytes: args.picture,
      contentType: "image/png",
      fetchImpl: args.fetchImpl,
      waitMs: args.waitMs,
    });
    /**
     * ⛔ A POST THAT WAS MEANT TO HAVE A CARD DOES NOT GO OUT WITHOUT ONE —
     * the same rule as Facebook and X. And no post call has been made yet, so
     * any failure here, `transient` included, is KNOWN not to be live.
     */
    if (!up.ok) {
      return { ok: false, kind: up.kind, message: `The card could not be put on LinkedIn, so nothing was posted. ${up.message}` };
    }
    imageUrn = up.imageUrn;
  }

  const r = await publishToLinkedIn({
    token: args.token,
    organizationId: args.organizationId,
    text: args.text,
    imageUrn,
    imageAltText: imageUrn ? args.altText : undefined,
    fetchImpl: args.fetchImpl,
  });
  if (r.ok) return r;

  /**
   * 🔴 `transient` FROM THE POST CALL IS AN UNKNOWN, NOT A FAILURE. It covers
   * "could not be reached", a 5xx, and a 201 with no `x-restli-id` — each of
   * which may have left a live post. The publisher treats `network` as
   * "unverified: look before re-approving", so it is mapped to that. ⛔ Left as
   * `transient`, a post that went out would read as one that did not.
   */
  return { ok: false, kind: r.kind === "transient" ? "network" : r.kind, message: r.message };
}
