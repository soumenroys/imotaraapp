// src/lib/social/platforms.ts
// What each channel is, in the only terms that change what we make for it.
//
// 🔑 THE DISTINCTION THIS FILE HAS TO HOLD, and it is a fine one.
//
// The owner asked for posts shaped to the channel: "LinkedIn posts should
// catch professionals, facebook posts should catch facebook user types". The
// standing editorial rule says a post must be written for everyone and must
// never address a segment — no "students —", no "for HR leaders".
//
// ⇒ Those are not in conflict, and the difference is REGISTER versus ADDRESS.
// On LinkedIn the angle can be what a thing means for people at work, in the
// register of somewhere people are working. It still may not say "HR leaders,"
// or assume the reader manages anybody. The channel changes how it is said and
// which true thing is chosen; it never changes who is welcome to read it.
//
// ⛔ So every `voice` below describes an ANGLE and a REGISTER. None of them
// names a job, an age, a country or a kind of person.

export type PlatformId = "facebook" | "linkedin" | "instagram" | "x" | "youtube";

export type PlatformSpec = {
  id: PlatformId;
  label: string;
  /** The picture, at the size this channel actually renders. */
  picture: { width: number; height: number; note: string };
  /** The ceiling the platform enforces, and the point a reader sees "see more". */
  limits: { hard: number; soft: number };
  /** How many hashtags are normal here. ⚠️ Not a licence — fewer is still better. */
  hashtags: number;
  /** The angle and register. ⛔ Never a segment. */
  voice: string;
  /** Whether a QR code earns its place on this channel's picture. */
  qr: boolean;
  /** Built and able to publish? ⛔ Honest, and shown in the admin. */
  canPublish: false;
  /** What is actually needed before it could. */
  blockedBy: string;
};

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  facebook: {
    id: "facebook",
    label: "Facebook Page",
    picture: { width: 1200, height: 630, note: "the link-card size Facebook renders" },
    limits: { hard: 63206, soft: 500 },
    hashtags: 0,
    voice:
      "Everyday register. Somebody is between other things — a queue, a sofa, a bus — so the post " +
      "has to be worth stopping for in one line. Concrete over abstract: a moment, an hour of the " +
      "day, a specific thing the product does. Warm, unhurried, no jargon. ⛔ No hashtags here; " +
      "they read as advertising on this channel.",
    qr: true,
    canPublish: false,
    blockedBy:
      "A Business Manager system user token, and encryption to store it. No App Review needed.",
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn Page",
    picture: { width: 1200, height: 627, note: "LinkedIn's own card ratio" },
    limits: { hard: 3000, soft: 1300 },
    hashtags: 2,
    voice:
      "The register of somewhere people are working, and an angle about what a thing means for " +
      "people at work or for the organisations they are in — the cost of a team with nowhere to " +
      "put how a day went, what it means to support people in a language they think in. Plain and " +
      "unshowy; this channel is full of performance and the quiet thing stands out. " +
      "⛔ Never address a job title, never assume the reader manages anyone, no case-study framing, " +
      "no 'thrilled to announce'.",
    qr: true,
    canPublish: false,
    blockedBy: "Community Management API approval from LinkedIn, then a token and encryption.",
  },

  instagram: {
    id: "instagram",
    label: "Instagram",
    picture: { width: 1080, height: 1080, note: "square; the feed crops anything else" },
    limits: { hard: 2200, soft: 125 },
    hashtags: 2,
    voice:
      "The picture carries it and the caption follows. One line that makes somebody look again, " +
      "then one that says what it is. ⚠️ The first 125 characters are all most people see, so the " +
      "post cannot depend on its second half.",
    qr: false, // ⛔ Nobody scans a square in a phone feed they are already holding.
    canPublish: false,
    blockedBy:
      "Instagram publishing is a separate permission set from the Page token, and the account only " +
      "joined the business portfolio on 17 Oct.",
  },

  x: {
    id: "x",
    label: "X",
    picture: { width: 1600, height: 900, note: "16:9; X crops to it anyway" },
    limits: { hard: 280, soft: 280 },
    hashtags: 1,
    voice:
      "One thought, finished, inside 280 characters. ⛔ No thread, no 'a 🧵', no hook that promises " +
      "a payoff further down. If it needs a second post it is the wrong thought for this channel.",
    qr: false, // A timeline image at thumbnail size: a QR is unreadable.
    canPublish: false,
    blockedBy: "X's API is paid, and the account has 2 followers — worth asking whether it is worth it.",
  },

  youtube: {
    id: "youtube",
    label: "YouTube community",
    picture: { width: 1280, height: 720, note: "the community-post and thumbnail ratio" },
    limits: { hard: 1500, soft: 300 },
    hashtags: 0,
    voice:
      "A community post, to people who already chose to be there. It can assume they know what " +
      "Imotara is, so it says something new rather than reintroducing it.",
    qr: true,
    canPublish: false,
    blockedBy:
      "The COPPA audience setting is still unresolved on the channel, and Studio opens the wrong " +
      "channel for this account.",
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

export function isPlatform(id: string): id is PlatformId {
  return Object.prototype.hasOwnProperty.call(PLATFORMS, id);
}

/**
 * ⛔ Throws rather than falling back to Facebook. A post composed at the wrong
 * size for its channel is cropped by the channel, usually through the words.
 */
export function platformSpec(id: string): PlatformSpec {
  if (!isPlatform(id)) {
    throw new Error(
      `social/platforms: ${id} is not a channel this product posts to. ` +
        `Known: ${PLATFORM_IDS.join(", ")}.`,
    );
  }
  return PLATFORMS[id];
}

/**
 * ⚠️ Every channel is `canPublish: false` today, and the admin says so per
 * channel rather than with one blanket banner — because the REASONS differ and
 * only one of them is work we can do alone. Collapsing them into "coming soon"
 * would hide that LinkedIn is waiting on LinkedIn while Facebook is waiting on
 * fifteen minutes in a portfolio.
 */
export function publishableToday(): PlatformId[] {
  return PLATFORM_IDS.filter((id) => PLATFORMS[id].canPublish);
}
