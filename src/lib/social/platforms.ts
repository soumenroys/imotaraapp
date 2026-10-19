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
  /**
   * 🔴 HOW LONG A POST SHOULD ACTUALLY BE HERE — a FLOOR as well as a ceiling.
   *
   * ⛔ MEASURED 19 Oct, after the owner asked why every post is two
   * sentences: 23 of 30 posts were exactly two, Facebook's median was 163
   * characters against a 500-character fold. A third of the format, every
   * day. `limits` only ever said "do not exceed", so nothing in the system
   * could notice that a post was too SHORT to be worth the reader's tap.
   *
   * ⚠️ NOT "LONGER IS BETTER". The rule that the first line carries the post
   * is unchanged; this says how much room the rest of it has earned. On
   * Instagram the fold is at 125 and everything after it is behind "see
   * more", so its target stays where it is — the channels genuinely differ,
   * which is the whole reason this is per-channel and not one number.
   */
  bodyTarget: { min: number; max: number };
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
  /**
   * 🔴 DOES THIS CHANNEL REFUSE A POST WITHOUT A PICTURE?
   *
   * Instagram has no text-only post at all. Facebook does, and that
   * difference decides what happens when a card cannot be made: on Facebook
   * the words still go out, on Instagram the post can NEVER publish.
   *
   * ⛔ Without this, such a post is generated, saved, and then held by the
   * publisher on every run forever — and the only symptom is that Instagram
   * goes quiet, which looks exactly like a channel nobody scheduled
   * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
   */
  requiresPicture: boolean;
  /**
   * 🔑 IS A POST WITH NO TAGS A MISSED OPPORTUNITY HERE?
   *
   * ⚠️ Not the same question as "how many are allowed". LinkedIn permits
   * three and a good LinkedIn post often has none; Instagram permits five and
   * tags are close to the only way a stranger ever arrives — which on an
   * account of 81 followers is the whole difference between being read and
   * being posted.
   *
   * ⛔ So saying "you used none of your tags" on Facebook, whose right answer
   * is zero, would be advice to do the wrong thing.
   */
  tagsDriveDiscovery: boolean;
};

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  facebook: {
    id: "facebook",
    label: "Facebook Page",
    /**
     * 🔴 WAS 1200×630, "the link-card size Facebook renders" — and that is the
     * OPEN GRAPH LINK-PREVIEW size, for a shared URL. We upload a PHOTO, and
     * `linksInBody` is false, so this card had always been sized for a format
     * this product never posts.
     *
     * ⛔ WORSE THAN MERELY WRONG: 1200×630 is **1.91:1**, and Facebook's feed
     * accepts roughly 9:16 to 16:9 (1.78:1). Ours was WIDER THAN THE WIDEST
     * RATIO THE FEED TAKES, so the mobile feed cropped it — equal bites off
     * the left and right, leaving the middle of every sentence readable and
     * the start and end gone. The owner saw it on a phone; no screen here
     * showed it, because a desktop permalink renders the image in full.
     *
     * ⚠️ Instagram's spec has carried the lesson since it was written —
     * "square; the feed crops anything else" — and Facebook never got it
     * ⇒ trap_a_sentence_that_states_the_world_goes_stale.
     *
     * 🔑 4:5 is the owner's choice over square: it is never cropped AND it
     * occupies the most vertical space in a mobile feed, which is where this
     * is actually read.
     */
    picture: { width: 1080, height: 1350, note: "4:5 — the tallest a feed photo may be, never cropped" },
    limits: { hard: 63206, soft: 500 },
    // ⚠️ Room for a small story before the fold. Facebook is read with more
    // patience than Instagram and shows ~500 characters before "see more".
    bodyTarget: { min: 320, max: 460 },
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
    tagsDriveDiscovery: false,
    requiresPicture: false,
    canPublish: true,
    blockedBy: "",
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn Page",
    /**
     * 🔴 THE SAME DEFECT AS FACEBOOK'S, FOUND THE SAME MINUTE — and found only
     * because the Facebook fix came with a test that checks every channel.
     *
     * ⛔ 1200×627 is **1.914:1**, LinkedIn's LINK-CARD ratio, for a shared URL.
     * `publishToLinkedIn` uploads an IMAGE and `linksInBody` is false, so this
     * was sized for a format this product never posts — and it is wider than
     * the ~16:9 a feed will show without cropping.
     *
     * 🔑 FIXED BEFORE IT EVER PUBLISHED. LinkedIn is still waiting on
     * Community Management API approval, so this one cost nothing; Facebook's
     * identical mistake was found by the owner, on a phone, after weeks of
     * posts went out with their first and last words cut off.
     */
    picture: { width: 1080, height: 1350, note: "4:5 — never cropped in a feed, tallest on mobile" },
    /**
     * 🔴 `soft` WAS 1300 AND THAT WAS SIMPLY WRONG — and it was handed to the
     * writer as a fact: "keep the body under 1300, that is where this channel
     * folds it". LinkedIn folds at roughly **210 characters on desktop and
     * ~140 on a phone**, not 1300. So every post was written past the fold
     * with the instruction's blessing, and the only words most people ever saw
     * were the first two lines nobody had been asked to make count.
     */
    limits: { hard: 3000, soft: 210 },
    // ⚠️ ~210 on desktop, ~140 on a phone ⇒ finish before the shorter one.
    bodyTarget: { min: 140, max: 210 },
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
    tagsDriveDiscovery: false,
    requiresPicture: false,
    canPublish: false,
    blockedBy: "Community Management API approval from LinkedIn, then a token and encryption.",
  },

  instagram: {
    id: "instagram",
    label: "Instagram",
    picture: { width: 1080, height: 1080, note: "square; the feed crops anything else" },
    limits: { hard: 2200, soft: 125 },
    /**
     * ⛔ DELIBERATELY UNCHANGED at the measured median. Instagram folds at
     * about 125 characters; everything past it is behind "see more" and
     * mostly goes unread. This is the channel where two sentences is right.
     */
    bodyTarget: { min: 120, max: 200 },
    // ⚠️ Five, not two. Instagram is the one channel here where a handful of
    // specific tags still reaches people who do not follow us — and the
    // product's own subject matter supplies them honestly. ⛔ Not thirty: a
    // wall of tags reads as spam and the platform treats it as such.
    hashtags: 5,
    emoji: 2,
    linksInBody: false,
    /**
     * 🔑 WRITTEN FOR WHAT INSTAGRAM ACTUALLY REWARDS, not for what a caption
     * looks like. The owner's standing rule, 18 Oct: every post is customised
     * to its channel's audience and to what that platform ranks on
     * ⇒ feedback_social_content_standing_rules.
     *
     * ⚠️ Instagram ranks on SAVES and SHARES far more than on likes. A caption
     * worth keeping beats a caption worth agreeing with — which, for this
     * product, is the easier of the two to write honestly.
     */
    voice:
      "The picture carries it and the caption follows. ⚠️ The first 125 characters are all most " +
      "people see before “more”, so the post cannot depend on its second half — open on the thing " +
      "itself, never on a wind-up. " +
      "🔑 Write something worth SAVING rather than worth agreeing with: a specific feeling named " +
      "precisely, a word somebody will want to look up again, a sentence a person might screenshot " +
      "and send to one other person. That is what this channel ranks on, and it is also the only " +
      "kind of post this product should be making. " +
      "⛔ No “link in bio” — there is no link to go to and saying it trains people to ignore you. " +
      "⚠️ Tags at the END, specific ones a real person searches; never a wall, and never a tag " +
      "about a condition somebody might be living with.",
    // ⚠️ I had this off, reasoning that a square in a phone feed is on the
    // same phone that would scan it. The owner wants the codes on posts, and
    // they are right that a card without them gives a reader nowhere to go.
    // The labels are what make three codes worth the space.
    qr: true,
    /**
     * ✅ 18 Oct. `@imotaraofficial` is linked to the Page and is the BIGGER
     * audience of the two — 81 followers against the Page's 51.
     *
     * ⚠️ `canPublish` MEANS "THE CODE CAN", NOT "IT IS CONNECTED". The
     * publisher still holds a post, visibly, when no Instagram channel has a
     * token ⇒ social-publish. ⛔ The two must not be conflated: a flag that
     * also meant "connected" would make an unconnected channel look broken
     * and a broken one look unbuilt.
     *
     * 🔴 AND THE ONE THAT IS NOT A PERMISSION. Instagram has no byte upload:
     * it is handed a URL and fetches the image ITSELF, unauthenticated
     * ⇒ src/lib/social/cardUrl.ts. It also takes JPEG and nothing else.
     */
    tagsDriveDiscovery: true,
    requiresPicture: true,
    canPublish: true,
    // ⚠️ Empty, like Facebook's: nothing is blocking the code. What may still
    // be missing is a CONNECTED channel, and that is a different screen.
    blockedBy: "",
  },

  x: {
    id: "x",
    label: "X",
    picture: { width: 1600, height: 900, note: "16:9; X crops to it anyway" },
    limits: { hard: 280, soft: 280 },
    // ⚠️ The hard limit IS the fold here: there is nothing behind a "see more".
    bodyTarget: { min: 150, max: 270 },
    hashtags: 1,
    emoji: 1,
    // ⚠️ True here and nowhere else on this list: X does not punish an
    // outbound link the way Meta and LinkedIn do.
    /**
     * 🔴 FALSE FOR A REASON THAT IS BOTH EDITORIAL AND FINANCIAL — changed
     * 19 Oct when the owner chose pay-per-use.
     *
     * 💰 X's reported rate card charges **$0.015 to create a post and $0.200
     * if the post contains a URL**. One field, a thirteenfold difference:
     * ~45¢ a month against ~$6. ⚠️ Not from X — developer.x.com answers a
     * fetch with 402 — but several independent sources agree.
     *
     * ⛔ AND IT COSTS CHARACTERS TOO. A URL is 23 of 280 here, on the one
     * channel where the ceiling IS the format. The destination rides on the
     * card's QR codes, exactly as on every other channel.
     */
    linksInBody: false,
    voice:
      "One thought, finished, inside 280 characters. ⛔ No thread, no 'a 🧵', no hook that promises " +
      "a payoff further down. If it needs a second post it is the wrong thought for this channel.",
    qr: true,
    tagsDriveDiscovery: false,
    requiresPicture: false,
    canPublish: false,
    blockedBy: "X's API is paid, and the account has 2 followers — worth asking whether it is worth it.",
  },

  youtube: {
    id: "youtube",
    label: "YouTube Shorts",
    /**
     * 🔴 9:16, BECAUSE THE THING THIS WAS SIZED FOR CANNOT BE DONE.
     *
     * ⛔ This read 1280×720, "the community-post and thumbnail ratio" — and
     * the YouTube Data API HAS NO ENDPOINT FOR CREATING COMMUNITY POSTS.
     * Checked 19 Oct 2026: no official documentation describes one, and every
     * third-party source agrees it cannot be done. So the channel was
     * configured, and carried on the board, for a format no code could ever
     * reach ⇒ a plan built on an assumption nobody tested.
     *
     * ⚠️ WHAT THE API CAN DO IS UPLOAD A VIDEO — and this product now makes
     * narrated ones daily. ⇒ The YouTube path is SHORTS, which are vertical.
     * 1080×1920 is the shape YouTube asks for; anything else is letterboxed
     * or cropped, and a card cropped down its middle loses its headline.
     */
    picture: { width: 1080, height: 1920, note: "9:16 — the Shorts frame" },
    limits: { hard: 1500, soft: 300 },
    bodyTarget: { min: 180, max: 290 },
    hashtags: 0,
    emoji: 1,
    // 🔑 These are people who already subscribed. A link is a service to them,
    // not a leak of reach.
    linksInBody: true,
    /**
     * 🔴 REWRITTEN 19 Oct. This said "a community post, to people who already
     * chose to be there. It can assume they know what Imotara is."
     *
     * ⛔ Both halves were wrong, and they survived the format change that made
     * them wrong. Community posts cannot be created by the Data API at all —
     * the format is SHORTS — and a Short is served to STRANGERS in the Shorts
     * feed, not to the channel's 22 subscribers. An instruction to assume
     * recognition would have produced, on the one surface where almost nobody
     * recognises us, posts written for people who already do
     * ⇒ trap_a_sentence_that_states_the_world_goes_stale.
     */
    voice:
      "A short vertical video, shown to strangers scrolling the Shorts feed who have never heard " +
      "of Imotara and did not choose this. It has a few seconds to be worth staying for, so it " +
      "opens with the feeling rather than the product, and never assumes recognition.",
    qr: true,
    tagsDriveDiscovery: false,
    requiresPicture: false,
    /**
     * \ud83d\udfe2 TRUE SINCE 19 Oct 2026, when the upload path was actually built.
     *
     * \ud83d\udd34 THE THIRD RECORDED BLOCKER ON THIS CHANNEL THAT WAS NOT ONE. This
     * field used to read "Studio opens the wrong channel for this Google
     * account, so nobody can authorise an upload" \u2014 and Studio has nothing
     * whatever to do with an API upload. That is a nuisance when EDITING a
     * video by hand; `videos.insert` is authorised by an OAuth token and never
     * opens Studio at all.
     *
     * \u26a0\ufe0f The two before it were equally untested: COPPA (declared per video at
     * upload, so a channel default cannot stop anything) and community posts
     * (which the Data API cannot create, so the channel had been sized for a
     * format no code could ever reach)
     * \u21d2 trap_a_blocker_is_a_claim_nobody_tested.
     *
     * \ud83d\udd11 THE REAL GATE WAS A CREDENTIAL, and it is now built: a Google OAuth
     * client in its own Cloud project, consented once by the channel's account
     * \u21d2 youtube_oauth_setup_2026_10_19.
     *
     * \u26d4 `canPublish: true` does NOT mean a token exists. When the channel is
     * unconnected the publisher holds the post and says "No youtube channel is
     * connected" \u2014 a true statement about today \u2014 rather than this field
     * asserting a permanent obstacle that somebody then stops questioning.
     */
    canPublish: true,
    // ⚠️ Empty, like Facebook's and Instagram's: nothing blocks the CODE.
    // What may still be missing is a connected channel, which the publisher
    // reports as the temporary fact it is.
    blockedBy: "",
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
/**
 * 🔴 CHANNELS WHERE EVERY POST IS A PURCHASE, and how often they may run.
 *
 * ⛔ X IS THE ONLY ONE, and only since 19 Oct, when the owner moved it to
 * pay-per-use: the free tier is gone and both subscription plans are closed
 * to new signups, so each post is charged. The owner, the same day: "as X is
 * paid, we will post in X weekly, not daily."
 *
 * ⚠️ WHY THIS IS A RULE IN CODE AND NOT A NOTE. There is no X schedule yet,
 * so the instruction has nothing to attach to — and an instruction with
 * nothing to attach to is one somebody follows once and then forgets. The day
 * a schedule is made, this refuses the daily one.
 */
export const MAX_DAYS_PER_WEEK: Partial<Record<PlatformId, number>> = {
  x: 1,
};

export type CadenceProblem = { platform: PlatformId; allowed: number; asked: number; why: string };

/**
 * Does this schedule run a metered channel too often?
 *
 * ⛔ REFUSES, rather than quietly trimming the days. Trimming would publish a
 * schedule the admin did not write, on days they did not pick.
 */
export function cadenceProblems(platforms: readonly string[], days: readonly number[]): CadenceProblem[] {
  const out: CadenceProblem[] = [];
  for (const p of platforms) {
    const allowed = MAX_DAYS_PER_WEEK[p as PlatformId];
    if (allowed === undefined) continue;
    const asked = new Set(days).size;
    if (asked <= allowed) continue;
    out.push({
      platform: p as PlatformId,
      allowed,
      asked,
      why:
        `${PLATFORMS[p as PlatformId].label} charges for every post, so it runs at most ` +
        `${allowed} day${allowed === 1 ? "" : "s"} a week — this schedule asks for ${asked}. ` +
        `▶️ Choose fewer days, or give ${PLATFORMS[p as PlatformId].label} its own schedule.`,
    });
  }
  return out;
}

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
