// src/lib/admin/insights.ts
// Turns the Activity numbers into statements a person can act on.
//
// 🔴 THE OWNER: "the information is there, but we need to add insights based on
// the data and suggested action points. for example i can see that out of 37
// people only 8 are returning. insight should be there that why they are not
// returning or what can be done."
//
// ⛔ AND THE HONEST LIMIT, WHICH IS PART OF THE FEATURE. This data CANNOT say
// why anybody did not come back. usage_events records that something costly
// happened — a cloud reply, a spoken reply, a transcription, a settings search
// — and nothing else. There is no message text, no screen, no funnel, no
// referrer. An insight that claimed to know the cause would be inventing it,
// and a dashboard that invents causes is worse than one that stays quiet,
// because it gets believed.
//
// ⇒ So each insight carries three separate things: WHAT the number is, what it
// is EVIDENCE of, and the next thing to DO — where "do" is usually "look at
// this narrower number", not "ship this feature". Every one of them names the
// figure it came from so the reader can disagree with it.
//
// 🔑 Pure, and deliberately separate from the page. The thresholds below are
// judgement calls; having them in a module means they can be argued with in a
// test rather than discovered in JSX.

export type Severity = "good" | "watch" | "act" | "info";

export type Insight = {
  id: string;
  severity: Severity;
  /** The finding, in one line. */
  headline: string;
  /** The figure it came from, so the reader can check the working. */
  evidence: string;
  /** The next thing to do. ⚠️ Never "why" unless the data actually says why. */
  action: string;
};

export type Cohort = { cohortDate: string; size: number; d1: number | null; d7: number | null; d30: number | null };

export type AnalyticsShape = {
  range: { days: number };
  totals: { events: number; activeUsers: number; newUsers: number; returningUsers: number };
  rolling: { dau: number; wau: number; mau: number };
  series: { date: string; events: number; activeUsers: number }[];
  byEventType: { key: string; events: number; users: number }[];
  byPlatform: { key: string; events: number; users: number }[];
  emotions: { emotion: string; count: number }[];
  retention: Cohort[];
  meta: { platformReady: boolean; truncated: boolean };
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * How many people came back, across every cohort old enough to answer.
 *
 * ⚠️ POOLED, NOT AVERAGED. Averaging the per-day percentages lets a cohort of
 * two people where one returned (50%) outweigh a cohort of eighty where twelve
 * did (15%). Pooling the counts weights each person once, which is the
 * question actually being asked.
 *
 * ⛔ A null is "this cohort is not old enough yet", which is not the same as
 * zero and must never be counted as one.
 */
export function pooledRetention(
  cohorts: Cohort[],
  day: "d1" | "d7" | "d30",
): { returned: number; of: number; pct: number } | null {
  let returned = 0;
  let of = 0;
  for (const c of cohorts) {
    const v = c[day];
    if (v === null || c.size === 0) continue;
    returned += v;
    of += c.size;
  }
  if (of === 0) return null;
  return { returned, of, pct: round(pct(returned, of)) };
}

/** The middle value, which is the point of using it. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Is activity rising or falling inside the window?
 *
 * ⚠️ TWO HALVES, NOT FIRST DAY AGAINST LAST. Comparing endpoints is how a
 * dashboard manufactures a trend out of one slow Sunday.
 *
 * 🔴 AND THE MEDIAN OF EACH HALF, NOT THE SUM — the first version summed
 * them and called a single quiet day in a ten-day window an 18% decline,
 * because one outlier is a fifth of a five-day half. The shorter the window
 * the worse it got, and the page offers a 7-day window. The median of a half
 * does not move when one day in it does, which is the entire property wanted
 * here: a TYPICAL day then against a typical day now.
 */
export function trend(series: { events: number }[]): { direction: "up" | "down" | "flat"; changePct: number } | null {
  if (series.length < 6) return null;
  const mid = Math.floor(series.length / 2);
  const first = median(series.slice(0, mid).map((d) => d.events));
  const second = median(series.slice(mid).map((d) => d.events));
  if (first === 0) return second === 0 ? { direction: "flat", changePct: 0 } : { direction: "up", changePct: 100 };
  const change = round(pct(second - first, first));
  if (Math.abs(change) < 15) return { direction: "flat", changePct: change };
  return { direction: change > 0 ? "up" : "down", changePct: change };
}

export function insightsFor(d: AnalyticsShape): Insight[] {
  const out: Insight[] = [];
  const people = d.totals.newUsers + d.totals.returningUsers;

  // ── Did they come back? ────────────────────────────────────────────────────
  if (people > 0) {
    const share = round(pct(d.totals.returningUsers, people));
    const sev: Severity = share < 25 ? "act" : share < 45 ? "watch" : "good";
    out.push({
      id: "returning-share",
      severity: sev,
      headline:
        sev === "good"
          ? `${share}% of the people active here had used Imotara before.`
          : `Only ${share}% of the people active here had used Imotara before.`,
      evidence: `${d.totals.returningUsers} returning and ${d.totals.newUsers} new, of ${people} people in ${d.range.days} days.`,
      action:
        sev === "good"
          ? "Hold it. The cheapest growth you have is the person who already came back once."
          : "This number alone cannot say why — nothing here records what anybody read or felt. " +
            "The next narrower question is below: of the people who arrived, how many came back the next day? " +
            "If day 1 is also low, the first conversation is where it is being decided, not the weeks after it.",
    });
  }

  // ── The first day, which is where it is usually decided ────────────────────
  const d1 = pooledRetention(d.retention, "d1");
  if (d1) {
    const sev: Severity = d1.pct < 10 ? "act" : d1.pct < 25 ? "watch" : "good";
    out.push({
      id: "d1",
      severity: sev,
      headline: `${d1.pct}% of new people came back the next day.`,
      evidence: `${d1.returned} of ${d1.of} people, counting only groups old enough to have had a next day.`,
      action:
        sev === "good"
          ? "Whatever the first conversation is doing, it is working. Change it carefully."
          : "A first session that did not earn a second is the most expensive thing in the product. " +
            "Two checks that this data can answer: are the non-returners concentrated on one platform " +
            "(see “Where it happened”), and did they ever get past a single reply (see “What people did” — " +
            "somebody who only ever fired one cloud reply never heard a spoken one).",
    });
  }

  const d7 = pooledRetention(d.retention, "d7");
  if (d7) {
    const sev: Severity = d7.pct < 8 ? "act" : d7.pct < 20 ? "watch" : "good";
    out.push({
      id: "d7",
      severity: sev,
      headline: `${d7.pct}% were still there a week later.`,
      evidence: `${d7.returned} of ${d7.of} people in groups at least seven days old.`,
      action:
        sev === "good"
          ? "A week is the point where a habit either formed or did not. This one is forming."
          : "Week-one is where a reason to return has to come from outside the app. " +
            "Broadcast is the lever you already have — but only to people who asked for mail, and " +
            "at most one link, per the house style.",
    });
  }

  // ── How often, not just how many ───────────────────────────────────────────
  if (d.rolling.mau > 0) {
    const sticky = round(pct(d.rolling.dau, d.rolling.mau));
    const sev: Severity = sticky < 10 ? "watch" : sticky < 20 ? "info" : "good";
    out.push({
      id: "stickiness",
      severity: sev,
      headline: `People who use Imotara use it on ${sticky}% of days.`,
      evidence: `${d.rolling.dau} active today against ${d.rolling.mau} active in 30 days.`,
      action:
        sticky < 10
          ? "Low for a companion, high for a journal. Decide which one Imotara is being used as before treating this as a problem — the hours nobody staffs are not daily hours."
          : "Healthy for something people reach for when they need it rather than every day.",
    });
  }

  // ── Where the people are ───────────────────────────────────────────────────
  const known = d.byPlatform.filter((p) => p.key !== "unknown");
  const totalKnown = known.reduce((a, b) => a + b.users, 0);
  if (totalKnown > 0) {
    const top = [...known].sort((a, b) => b.users - a.users)[0];
    const share = round(pct(top.users, totalKnown));
    if (share >= 70) {
      out.push({
        id: "platform-concentration",
        severity: "info",
        headline: `${share}% of identified people are on one platform.`,
        evidence: `${top.users} of ${totalKnown} on ${top.key}.`,
        action:
          "Not a fault on its own. It does mean a bug on that platform is a bug for almost everybody, " +
          "and that the other platforms are either undiscovered or not working as well.",
      });
    }
  }

  // ── Is it going up? ────────────────────────────────────────────────────────
  const t = trend(d.series);
  if (t && t.direction !== "flat") {
    out.push({
      id: "trend",
      severity: t.direction === "up" ? "good" : "watch",
      headline:
        t.direction === "up"
          ? `Activity is up ${Math.abs(t.changePct)}% across this window.`
          : `Activity is down ${Math.abs(t.changePct)}% across this window.`,
      evidence: `Second half of the ${d.range.days} days against the first half, by event count.`,
      action:
        t.direction === "up"
          ? "Check it is people and not one person doing more — compare against the active-people line."
          : "Look at whether it is fewer people or the same people doing less. " +
            "Fewer people is reach; the same people doing less is the product.",
    });
  }

  // ── Can we even answer the question? ───────────────────────────────────────
  const unknown = d.byPlatform.find((p) => p.key === "unknown");
  const allUsers = d.byPlatform.reduce((a, b) => a + b.users, 0);
  if (unknown && allUsers > 0 && pct(unknown.users, allUsers) > 30) {
    out.push({
      id: "unattributed",
      severity: "watch",
      headline: `${round(pct(unknown.users, allUsers))}% of activity cannot be attributed to a platform.`,
      evidence: `${unknown.users} of ${allUsers} people recorded as unattributed.`,
      action:
        "Mostly events from before the split existed, plus app versions older than 1.4.1. " +
        "It will fall on its own as people update. Until it does, read the platform split as a direction, not a count.",
    });
  }

  if (!d.meta.platformReady) {
    out.push({
      id: "platform-not-ready",
      severity: "act",
      headline: "Web and app cannot be told apart at all yet.",
      evidence: "The platform column is missing from usage_events.",
      action: "Run docs/sql/usage_events_platform.sql in the Supabase SQL editor, then redeploy. Everything else on this page already works.",
    });
  }

  if (d.meta.truncated) {
    out.push({
      id: "truncated",
      severity: "act",
      headline: "This range hit the row ceiling, so every number below is a floor.",
      evidence: `More rows than can be read in one pass over ${d.range.days} days.`,
      action: "Use a shorter range before drawing any conclusion. A floor read as a total understates everything equally and silently.",
    });
  }

  if (people === 0) {
    out.push({
      id: "no-people",
      severity: "info",
      headline: "Nobody was active in this window.",
      evidence: `0 people over ${d.range.days} days.`,
      action: "Try a longer range before treating this as a finding — a quiet week on a small base is noise.",
    });
  }

  // ⚠️ Most urgent first, and stable within a severity so the list does not
  // reshuffle under the reader between refreshes.
  const order: Record<Severity, number> = { act: 0, watch: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
