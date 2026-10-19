// src/lib/social/cardUrl.ts
// A public, unguessable URL for one post's card.
//
// 🔴 WHY THIS EXISTS AT ALL, because it is not a convenience. Facebook takes
// the picture as BYTES — we render the card and upload it ⇒ publishToFacebook.
// Instagram has no such call. Its Content Publishing API is handed an
// `image_url` and FETCHES THE IMAGE ITSELF, from Meta's own servers, with no
// credential of ours. So the card must be reachable by a stranger, or
// Instagram cannot publish at all.
//
// ⚠️ "Reachable by a stranger" is not the same as "listed". The admin
// renderer sits behind `requireSocialAdmin`, which Instagram cannot pass; this
// route is open, so the thing standing between a crawler and every draft we
// have ever written is the signature below.
//
// ⛔ AND IT IS ONLY EVER THE CARD. The picture is words somebody approved for
// publication plus the brand marks. Nothing about a reader, an account or a
// conversation is reachable here — which is the property that makes a public
// route acceptable in a product whose whole claim is that conversations stay
// on the device.

import { createHmac, timingSafeEqual } from "crypto";

/**
 * ⚠️ RE-EXPORTED, NOT DEFINED HERE. This module imports `crypto`, so a
 * client component that reads `cardsForPost` from it drags Node's crypto
 * into the browser bundle — the same shape of problem that produced
 * contentTypes.ts and topicPools.ts. ⇒ The card list is pure string logic
 * and lives where anything can read it; the signing stays here.
 */
export { cardsForPost } from "./cards";

/**
 * 🔑 A SUBKEY, not the token key itself.
 *
 * `SOCIAL_TOKEN_KEY` encrypts the platform tokens. Using the same bytes
 * directly to sign URLs would mean one secret doing two unrelated jobs, and a
 * weakness found in either use would be a weakness in both. Deriving through
 * a fixed label costs nothing and keeps the two apart.
 *
 * ⚠️ The label is versioned. Change it and every previously issued URL stops
 * verifying — which is the correct behaviour for a deliberate rotation and a
 * disaster for an accidental edit, so it is spelled out here rather than
 * inlined somewhere it looks like a string nobody depends on.
 */
const LABEL = "imotara/social/card-url/v1";

function subkey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_KEY?.trim();
  if (!raw) {
    throw new Error(
      "SOCIAL_TOKEN_KEY is not set, so a card URL cannot be signed. ⛔ Refusing rather than " +
        "serving the card unsigned: an unsigned route is every draft this system has ever written, " +
        "readable by anybody who can count.",
    );
  }
  return createHmac("sha256", Buffer.from(raw, "base64")).update(LABEL).digest();
}

/**
 * The signature for one post id.
 *
 * ⚠️ 32 hex characters — 128 bits. Not a shortened "it is only an image"
 * length: the whole protection here is that the tag cannot be guessed, and a
 * public route is something anybody may try as often as they like.
 */
export function signCardId(id: string, slide = 0): string {
  /**
   * 🔑 THE SLIDE IS PART OF WHAT IS SIGNED.
   *
   * ⛔ A signature over the post id alone would authorise every card in the
   * carousel at once, so one leaked link would open all of them. More
   * practically: it would let the slide number be edited freely on a URL the
   * renderer trusts, which is the kind of loose end that becomes a bug later.
   *
   * ⚠️ Slide 0 signs exactly as before, so every link already issued for a
   * single-card post keeps working.
   */
  const scope = slide > 0 ? `card:${id}:${slide}` : `card:${id}`;
  return createHmac("sha256", subkey()).update(scope).digest("hex").slice(0, 32);
}

/**
 * ⛔ CONSTANT TIME. A plain `===` on a signature leaks, byte by byte, how much
 * of a guess was right — which turns 128 bits of unguessable into something a
 * patient attacker can walk. The length check first, because timingSafeEqual
 * throws on a length mismatch.
 */
export function cardSignatureValid(
  id: string,
  given: string | null | undefined,
  slide = 0,
): boolean {
  if (!given) return false;
  const expected = signCardId(id, slide);
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

/** ⚠️ The public origin, which must be the real one: Instagram fetches this
 *  from outside, so a localhost or preview URL silently fails at publish. */
export function publicOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://www.imotara.com";
}

/**
 * The absolute URL to hand a platform that fetches images for itself.
 *
 * ⚠️ `slide` 0 is the post's own card — and for a carousel it is the SUBJECT,
 * the first thing swiped past ⇒ cardsForPost.
 */
export function cardUrlFor(id: string, origin: string = publicOrigin(), slide = 0): string {
  // ⛔ Slide 0 keeps the original URL shape exactly: no stray `&s=0` on the
  // millions of single-card posts, and no second format to support.
  const q = slide > 0 ? `?t=${signCardId(id, slide)}&s=${slide}` : `?t=${signCardId(id)}`;
  return `${origin}/api/social/card/${id}${q}`;
}

/**
 * The absolute URL for a post's MOVING card.
 *
 * 🔑 SIGNED WITH THE SAME SCOPE AS THE STILL — slide 0, one post, one secret
 * — because it authorises the same thing: this post's media, to a stranger.
 * ⛔ A second signing scheme would be a second place to get HMAC wrong.
 */
export function videoUrlFor(id: string, origin = publicOrigin()): string {
  return `${origin}/api/social/video/${id}?t=${signCardId(id)}`;
}

export const FETCHABLE_STATUSES = ["approved", "publishing", "published"] as const;

export function cardIsFetchable(status: string | null | undefined): boolean {
  return (FETCHABLE_STATUSES as readonly string[]).includes(status ?? "");
}
