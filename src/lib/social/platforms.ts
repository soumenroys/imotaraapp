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
  /**
   * How many emoji the body may carry.
   *
   * 🔴 THIS USED TO BE ZERO EVERYWHERE, as house style rather than as a reason.
   * The owner asked on 18 Oct for anything that costs reach to come out unless
   * it is there for safety — and a total ban is a taste, not a safeguard. One
   * is what a person types; a row of them is decoration, and decoration around
   * a sentence about feeling bad reads as flippant.
   */
  emoji: number;
  /**
   * May a link sit in the body?
   *
   * 🔴 FALSE IS NOT A STYLE RULE — it is how these platforms work. Facebook and
   * LinkedIn both demote a post that sends people off-platform, so a link in
   * the body costs the post most of its distribution. ⛔ On Instagram a link in
   * the caption is not even clickable: it is pure noise that buys nothing.
   *
   * ⚠️ Where this is false the destination still has somewhere to live — the
   * composed picture carries the QR codes, and the profile carries the link.
   */
  linksInBody: boolean;
  /** The angle and register. ⛔ Never a segment. */
  voice: string;
  /** Whether the three QR codes go on this channel's picture. */
  qr: boolean;
  /**
   * Built and able to publish?
   *
   * 🔴 THIS WAS TYPED AS THE LITERAL `false`, which was accurate for exactly
   * as long as nothing could publish — and then became a type error standing
   * in the way of telling the truth. ⚠️ A field whose type encodes today's
   * answer is a field that cannot record tomorrow's.
   */
  canPublish: boolean;
  /** What is actually needed before it could. ⚠️ Empty once it can. */
  blockedBy: string;
};

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  facebook: {
    id: "facebook",
    label: "Facebook Page",
    picture: { width: 1200, height: 630, note: "the link-card size Facebook renders" },
    limits: { hard: 63206, soft: 500 },
    hashtags: 0,
    emoji: 1,
    linksInBody: false,
    voice:
      "Everyday register. Somebody is between other things — a queue, a sofa, a bus — so the post " +
      "has to be worth stopping for in one line. Concrete over abstract: a moment, an hour of the " +
      "day, a specific thing the product does. Warm, unhurried, no jargon. ⛔ No hashtags here; " +
      "they read as advertising on this channel.",
    qr: true,
    // ✅ 18 Oct 2026. System user token stored and verified against the Graph
    // API, and the publisher is live ⇒ src/app/api/cron/social-publish.
    canPublish: true,
    blockedBy: "",
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn Page",
    picture: { width: 1200, height: 627, note: "LinkedIn's own card ratio" },
    /**
     * 🔴 `soft` WAS 1300 AND THAT WAS SIMPLY WRONG — and it was handed to the
     * writer as a fact: "keep the body under 1300, that is where this channel
     * folds it". LinkedIn folds at roughly **210 characters on desktop and
     * ~140 on a phone**, not 1300. So every post was written past the fold
     * with the instruction's blessing, and the only words most people ever saw
     * were the first two lines nobody had been asked to make count.
     */
    limits: { hard: 3000, soft: 210 },
    hashtags: 3,
    emoji: 1,
    linksInBody: false,
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
    // ⚠️ Five, not two. Instagram is the one channel here where a handful of
    // specific tags still reaches people who do not follow us — and the
    // product's own subject matter supplies them honestly. ⛔ Not thirty: a
    // wall of tags reads as spam and the platform treats it as such.
    hashtags: 5,
    emoji: 2,
    linksInBody: false,
    voice:
      "The picture carries it and the caption follows. One line that makes somebody look again, " +
      "then one that says what it is. ⚠️ The first 125 characters are all most people see, so the " +
      "post cannot depend on its second half.",
    // ⚠️ I had this off, reasoning that a square in a phone feed is on the
    // same phone that would scan it. The owner wants the codes on posts, and
    // they are right that a card without them gives a reader nowhere to go.
    // The labels are what make three codes worth the space.
    qr: true,
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
    emoji: 1,
    // ⚠️ True here and nowhere else on this list: X does not punish an
    // outbound link the way Meta and LinkedIn do.
    linksInBody: true,
    voice:
      "One thought, finished, inside 280 characters. ⛔ No thread, no 'a 🧵', no hook that promises " +
      "a payoff further down. If it needs a second post it is the wrong thought for this channel.",
    qr: true,
    canPublish: false,
    blockedBy: "X's API is paid, and the account has 2 followers — worth asking whether it is worth it.",
  },

  youtube: {
    id: "youtube",
    label: "YouTube community",
    picture: { width: 1280, height: 720, note: "the community-post and thumbnail ratio" },
    limits: { hard: 1500, soft: 300 },
    hashtags: 0,
    emoji: 1,
    // 🔑 These are people who already subscribed. A link is a service to them,
    // not a leak of reach.
    linksInBody: true,
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

/**
 * One sentence about whether approving a post does anything yet.
 *
 * 🔴 THIS EXISTS BECAUSE EIGHT PLACES SAID "nothing publishes yet" and all
 * eight were true on 17 Oct and false on 18 Oct. Hard-coding the state of the
 * world into a sentence means the sentence has to be remembered — and the one
 * nobody remembers is the one a reader trusts most, because it is phrased as
 * a fact ⇒ the Today banner still said no channel was connected an hour after
 * one was.
 *
 * ⚠️ It says what IS BUILT, not what is switched on. The pause switch and a
 * dead token are live state and belong to the screens that can read them;
 * this answers only "does a publisher exist for anything".
 */
export function publishingSentence(): string {
  const live = publishableToday();
  if (live.length === 0) {
    return (
      "⛔ Nothing publishes yet — no channel has a publisher built, so an approved post waits. " +
      "You can post it by hand in the meantime."
    );
  }
  const names = live.map((id) => PLATFORMS[id].label);
  const rest = PLATFORM_IDS.filter((id) => !PLATFORMS[id].canPublish).map((id) => PLATFORMS[id].label);
  return (
    `✅ An approved post publishes to ${names.join(" and ")} at its scheduled time` +
    (rest.length > 0
      ? `. ⚠️ ${rest.join(", ")} have no publisher yet, so a post for one of those waits to be sent by hand.`
      : ".") +
    " ⛔ Unless posting is paused, in which case nothing goes out at all."
  );
}
