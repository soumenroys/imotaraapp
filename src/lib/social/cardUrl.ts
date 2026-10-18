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
export function signCardId(id: string): string {
  return createHmac("sha256", subkey()).update(`card:${id}`).digest("hex").slice(0, 32);
}

/**
 * ⛔ CONSTANT TIME. A plain `===` on a signature leaks, byte by byte, how much
 * of a guess was right — which turns 128 bits of unguessable into something a
 * patient attacker can walk. The length check first, because timingSafeEqual
 * throws on a length mismatch.
 */
export function cardSignatureValid(id: string, given: string | null | undefined): boolean {
  if (!given) return false;
  const expected = signCardId(id);
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

/** The absolute URL to hand a platform that fetches images for itself. */
export function cardUrlFor(id: string, origin: string = publicOrigin()): string {
  return `${origin}/api/social/card/${id}?t=${signCardId(id)}`;
}

/**
 * 🔑 WHICH POSTS MAY BE FETCHED, and the reason the list is short.
 *
 * A signed URL is only as careful as the thing it unlocks. These three are
 * the states in which the words have been approved for publication:
 * `approved` is waiting to go out, `publishing` is the state the row is in at
 * the exact moment Instagram comes to collect the image, and `published` is
 * already public.
 *
 * ⛔ `draft` and `needs_review` are deliberately absent. Those are words a
 * person has not signed off — including, by design, every confession post
 * ⇒ productMistakes.ts — and a signed link to one could be forwarded.
 */
export const FETCHABLE_STATUSES = ["approved", "publishing", "published"] as const;

export function cardIsFetchable(status: string | null | undefined): boolean {
  return (FETCHABLE_STATUSES as readonly string[]).includes(status ?? "");
}
