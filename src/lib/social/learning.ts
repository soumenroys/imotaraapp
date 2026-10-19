// src/lib/social/learning.ts
// What the numbers say about which angle works, and what to do about it.
//
// 🔴 THE OWNER, 19 Oct: "Ensure the statistics of those content from those
// social media are collected properly, stored, analysed and actions are taken
// for the next post automatically."
//
// Collection and storage already existed ⇒ src/lib/social/stats.ts. Nothing
// read them. The stats reached a chart and stopped — which is a report, not a
// feedback loop, and a report nobody acts on is indistinguishable from one
// nobody reads.
//
// ⛔ THE TWO WAYS A LOOP LIKE THIS GOES WRONG, both guarded below.
//
//   1. ACTING ON NOISE. One post with four impressions is not evidence of
//      anything. An angle's number does not count until there are enough
//      posts behind it, and until then the rotation is EXACTLY what it was.
//
//   2. COLLAPSING TO A MONOCULTURE. "Do more of what works" run to its
//      conclusion picks one angle and never leaves it — the rich-get-richer
//      failure. That is precisely what the round-robin was built to prevent
//      ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation, where a model handed
//      a menu picked the safest option every single time. ⇒ So evidence
//      TILTS the rotation; it never replaces it, and every angle keeps a turn.

/** One post's measured outcome, flattened from social_post_stats. */
export type PostOutcome = {
  platform: string;
  pool: string | null;
  saves: number | null;
  shares: number | null;
  reactions: number | null;
  comments: number | null;
  reach: number | null;
  impressions: number | null;
  /**
   * 🔴 THE SIGN OF THE REACTION ⇒ docs/sql/social_reaction_sign.sql.
   * ⚠️ NULL = not measured (Instagram never reports these; older rows have
   * none), which is NOT the same as nobody having reacted that way.
   */
  angry?: number | null;
  sad?: number | null;
  love?: number | null;
};

/**
 * 🔴 WHEN A POST'S REACTION IS A WARNING RATHER THAN A SCORE.
 *
 * ⛔ THE FAILURE THIS EXISTS TO PREVENT is the best-documented one in
 * recommender systems: a loop that rewards ENGAGEMENT without reading its SIGN
 * learns that posts people are upset by perform well, and asks for more of
 * them. On a mental-health brand that is not a bad quarter, it is harm.
 *
 * ⚠️ `angry` is weighted and `sad` is NOT, and that is a judgement about this
 * brand specifically. A sad reaction to a post about the hours nobody staffs
 * is very often the post landing exactly as intended — somebody recognising
 * themselves. Anger is not: on a post like ours it means the post misread
 * someone, or claimed something it should not have.
 *
 * ⛔ AND IT NEVER AUTO-CORRECTS. It takes the post out of the learning signal
 * and raises it to a person. A machine rewriting the brand's voice because
 * eleven people were annoyed is exactly the wrong correction — the right one
 * is somebody reading the comments.
 */
export const ANGRY_SHARE_ALARM = 0.2;
export const ANGRY_MIN_COUNT = 3;

export function upsetSignal(o: PostOutcome): { upset: boolean; checked: boolean; why?: string } {
  const angry = o.angry ?? null;
  /**
   * 🔴 THREE STATES, NOT TWO — and I had this wrong first time.
   *
   * I wrote "not measured is not calm" and then returned `{upset: false}` for
   * both, which makes the two IDENTICAL to every caller. A mutation replacing
   * `o.angry ?? null` with `o.angry ?? 0` survived the tests, correctly: the
   * rule I had written in the comment was not in the code.
   *
   * ⛔ AND THE DIFFERENCE IS NOT ACADEMIC. Instagram reports no reaction
   * breakdown at all, so EVERY Instagram post is unmeasurable here. Collapsed
   * into "not upset", a whole channel silently looks safe and nothing
   * anywhere says that it was never examined.
   */
  if (angry === null) return { upset: false, checked: false };

  const positive = (o.love ?? 0) + Math.max(0, (o.reactions ?? 0) - angry - (o.sad ?? 0));
  const total = angry + positive;
  if (total <= 0) return { upset: false, checked: false };

  const share = angry / total;
  if (angry < ANGRY_MIN_COUNT || share < ANGRY_SHARE_ALARM) return { upset: false, checked: true };

  return {
    upset: true,
    checked: true,
    why:
      `${angry} angry reaction(s) out of ${total} — ${(share * 100).toFixed(0)}%. ` +
      `⛔ This post is excluded from the learning signal and needs a person to read its comments. ` +
      `⚠️ Nothing is auto-corrected: a machine changing the brand's voice because people were ` +
      `annoyed is the wrong correction.`,
  };
}

/**
 * 🔑 WHICH NUMBER A CHANNEL IS JUDGED ON, and why it differs.
 *
 * ⛔ NOT REACTIONS EVERYWHERE. A like is the cheapest possible response and
 * the one least related to whether a post was worth making. The signals here
 * are the ones each platform's own ranking is known to weigh, and the ones
 * that mean a human did something deliberate:
 *
 *   · INSTAGRAM — SAVES. Mosseri's named signals are watch time, likes per
 *     reach and sends per reach; vendor data puts carousels at roughly 9× the
 *     saves of a single image. Instagram's voice here was deliberately
 *     rewritten FOR saves ⇒ social_platform_rules_reviewed_2026_10_19.
 *   · FACEBOOK — SHARES. Instagram does not report shares per post on this
 *     edge and Facebook does; a share is a person putting their own name to
 *     it, which is the strongest thing a post can earn.
 *
 * ⚠️ `fallback` is used when the primary is null — NOT when it is zero. Zero
 * saves is a measurement; a null is a missing one, and treating the two alike
 * is how an absent metric quietly becomes a bad score.
 */
export const CHANNEL_METRIC: Record<string, { primary: keyof PostOutcome; fallback: keyof PostOutcome; why: string }> = {
  instagram: { primary: "saves", fallback: "reactions", why: "saves — the signal Instagram ranks on and the voice is written for" },
  facebook: { primary: "shares", fallback: "reactions", why: "shares — a person putting their own name to it" },
  linkedin: { primary: "shares", fallback: "reactions", why: "shares" },
  x: { primary: "shares", fallback: "reactions", why: "reposts" },
};

/**
 * The signal, per person who actually saw it.
 *
 * 🔴 A RATE, NOT A COUNT. A post seen by 40 people and saved twice is better
 * than one seen by 4,000 and saved three times — and as the account grows,
 * raw counts rise for every angle at once, so counts would rank angles by WHEN
 * THEY WERE POSTED rather than by how good they were.
 *
 * ⚠️ Returns null, never 0, when there is nothing to divide by. "No audience
 * recorded" and "nobody responded" are different facts and must not average
 * together.
 */
export function engagementRate(o: PostOutcome): number | null {
  const metric = CHANNEL_METRIC[o.platform];
  if (!metric) return null;

  const primary = o[metric.primary] as number | null;
  const signal = primary === null || primary === undefined ? (o[metric.fallback] as number | null) : primary;
  if (signal === null || signal === undefined) return null;

  // ⚠️ Reach before impressions: reach is PEOPLE, impressions counts the same
  // person twice. ⛔ A post with 0 reach has not been measured, not failed.
  const audience = o.reach ?? o.impressions ?? null;
  if (audience === null || audience <= 0) return null;

  return signal / audience;
}

/**
 * 🔑 HOW MANY POSTS BEFORE AN ANGLE'S NUMBER MEANS ANYTHING.
 *
 * ⛔ Five is a judgement, not a calculation, and it is deliberately on the
 * cautious side. With one post per angle the ordering is almost entirely the
 * accident of which day it went out — a public holiday, a news event, the
 * hour. ⚠️ Said out loud wherever a score is shown, so nobody reads an
 * early ranking as a finding ⇒ angleReport.
 */
export const MIN_POSTS_PER_ANGLE = 5;

export type AngleScore = {
  platform: string;
  pool: string;
  posts: number;
  /** Mean engagement rate across the posts that had a measurable audience. */
  rate: number;
  /** ⚠️ False until `posts` reaches MIN_POSTS_PER_ANGLE. */
  trusted: boolean;
};

/** What each angle has actually achieved, per channel. */
export function angleScores(rows: PostOutcome[]): AngleScore[] {
  const buckets = new Map<string, { platform: string; pool: string; rates: number[] }>();

  for (const row of rows) {
    if (!row.pool) continue;
    /**
     * ⛔ AN UPSET POST IS NOT A DATA POINT ⇒ upsetSignal. Its engagement may
     * be high — anger travels — and feeding that back would teach the
     * rotation to prefer whatever caused it.
     */
    if (upsetSignal(row).upset) continue;
    const rate = engagementRate(row);
    // ⛔ A post with no measurable audience is NOT a zero. It is excluded, and
    // it does not count towards the sample either — otherwise an angle could
    // reach "trusted" on five posts nobody can measure.
    if (rate === null) continue;

    const key = `${row.platform}|${row.pool}`;
    if (!buckets.has(key)) buckets.set(key, { platform: row.platform, pool: row.pool, rates: [] });
    buckets.get(key)!.rates.push(rate);
  }

  return [...buckets.values()]
    .map(({ platform, pool, rates }) => ({
      platform,
      pool,
      posts: rates.length,
      rate: rates.reduce((a, b) => a + b, 0) / rates.length,
      trusted: rates.length >= MIN_POSTS_PER_ANGLE,
    }))
    .sort((a, b) => b.rate - a.rate);
}

/**
 * 🔑 HOW MANY TURNS EACH ANGLE GETS IN THE CYCLE.
 *
 * ⛔ EVERY ANGLE KEEPS AT LEAST ONE. That is the floor, and it is the whole
 * difference between tilting a rotation and abandoning it. An angle that is
 * behind today may be behind because of three bad drafts, a season, or one
 * post that happened to land on a holiday — and an angle dropped entirely can
 * never produce the evidence that would bring it back.
 *
 * ⚠️ THE CEILING IS DELIBERATELY LOW. The best angle gets three turns to the
 * worst angle's one — not thirty. A feed that is three-quarters one angle is
 * a monoculture even if that angle is the best one, and "best" here is
 * measured on a few dozen posts.
 */
export const MAX_TURNS = 3;

export function turnsFor(pools: string[], scores: AngleScore[], platform: string): Map<string, number> {
  const out = new Map<string, number>(pools.map((p) => [p, 1]));

  const usable = scores.filter((s) => s.platform === platform && s.trusted && pools.includes(s.pool));
  // ⛔ Fewer than two trusted angles and there is nothing to compare: the
  // rotation stays exactly as it was. ⚠️ This is the state the system is in
  // today, and it must be the state in which NOTHING changes.
  if (usable.length < 2) return out;

  const best = usable[0].rate;
  const worst = usable[usable.length - 1].rate;
  if (!(best > worst)) return out;

  for (const s of usable) {
    // Linear between the worst trusted angle (1 turn) and the best (MAX_TURNS).
    const share = (s.rate - worst) / (best - worst);
    out.set(s.pool, 1 + Math.round(share * (MAX_TURNS - 1)));
  }
  return out;
}

/**
 * The rotation itself: every angle present, better ones more often.
 *
 * 🔑 DETERMINISTIC, from `postsSoFar` alone. ⛔ Not random, and not re-rolled
 * on a gate retry: an angle that changed mid-retry would mean the post that
 * eventually passes is about something other than the one chosen, and a pool
 * would be skipped for reasons nobody could see ⇒ pipeline.nextPool.
 */
export function weightedCycle(pools: string[], turns: Map<string, number>): string[] {
  const cycle: string[] = [];
  // ⚠️ Interleaved, not blocked. Laying out AAA BBB CCC would post the same
  // angle three days running, which reads as a rut however good it is.
  const max = Math.max(1, ...pools.map((p) => turns.get(p) ?? 1));
  for (let round = 0; round < max; round += 1) {
    for (const p of pools) if ((turns.get(p) ?? 1) > round) cycle.push(p);
  }
  return cycle;
}

/**
 * What the evidence says, in words, for the admin and the cron's answer.
 *
 * ⛔ SAYS "NOT YET" OUT LOUD. A feedback loop that is silently doing nothing
 * because it has no data looks exactly like one that is broken, and the
 * difference matters to whoever is deciding whether to trust it.
 */
export function angleReport(scores: AngleScore[], platform: string): string {
  const mine = scores.filter((s) => s.platform === platform);
  if (mine.length === 0) return `${platform}: no post has been measured yet, so the rotation is untouched.`;

  const trusted = mine.filter((s) => s.trusted);
  if (trusted.length < 2) {
    const n = mine.reduce((a, b) => a + b.posts, 0);
    return (
      `${platform}: ${n} measured post(s) across ${mine.length} angle(s), and ${trusted.length} angle(s) ` +
      `have reached ${MIN_POSTS_PER_ANGLE}. ⚠️ Not enough to rank anything — the rotation is untouched, ` +
      `and the ordering below is noise until it is not.`
    );
  }

  const metric = CHANNEL_METRIC[platform]?.why ?? "engagement";
  const line = trusted
    .map((s) => `${s.pool} ${(s.rate * 100).toFixed(2)}% (n=${s.posts})`)
    .join(" · ");
  return `${platform}: ranked on ${metric} — ${line}`;
}

/**
 * Every post that needs a person, with the reason.
 *
 * 🔑 RETURNED RATHER THAN LOGGED. A warning that only reaches a server log is
 * a warning nobody receives ⇒ trap_a_dead_cron_fails_where_nobody_is_watching,
 * and this is the one signal in the whole feature where being slow to notice
 * has a cost beyond a quiet feed.
 */
export function postsNeedingAPerson(rows: (PostOutcome & { postId?: string })[]): {
  postId?: string;
  platform: string;
  pool: string | null;
  why: string;
}[] {
  return rows
    .map((r) => ({ r, s: upsetSignal(r) }))
    .filter((x) => x.s.upset)
    .map((x) => ({ postId: x.r.postId, platform: x.r.platform, pool: x.r.pool, why: x.s.why! }));
}

/**
 * How much of the measured record could be checked for upset at all.
 *
 * ⛔ SAID OUT LOUD BECAUSE IT IS MOSTLY "NONE". Instagram reports no reaction
 * breakdown, so no Instagram post can ever be examined this way — and a
 * safety check that silently covers one channel out of two is worse than one
 * everybody knows is partial.
 */
export function upsetCoverage(rows: PostOutcome[]): { platform: string; checked: number; total: number }[] {
  const by = new Map<string, { checked: number; total: number }>();
  for (const r of rows) {
    if (!by.has(r.platform)) by.set(r.platform, { checked: 0, total: 0 });
    const b = by.get(r.platform)!;
    b.total += 1;
    if (upsetSignal(r).checked) b.checked += 1;
  }
  return [...by.entries()].map(([platform, b]) => ({ platform, ...b }));
}
