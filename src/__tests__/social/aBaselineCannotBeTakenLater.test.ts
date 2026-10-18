/**
 * 🔑 THE OWNER'S ASK, 18 Oct: "whenever you connect any social media channel,
 * take the stock of that channel and store that. then after everyday's post
 * update the statistics ... so that we can do analytics to check how this
 * scheduler is performing."
 *
 * 🔴 THE BASELINE IS THE PART THAT CANNOT BE RECOVERED. Without the figure
 * from BEFORE the scheduler did anything, every later number is unreadable:
 * 63 followers is a success or a disappointment depending entirely on what it
 * was the day we started, and Facebook will not tell us that afterwards.
 *
 * ⚠️ AND THE HONEST LIMIT, which these tests exist partly to keep visible: the
 * Page had ~50 followers. One person is 2%. Anything that looks like a trend
 * over a few days is noise, and the job of this code is to record honestly
 * rather than to flatter.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capturedOn } from "@/lib/social/stats";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const stats = read("src/lib/social/stats.ts");
const adapter = read("src/lib/social/adapters/facebook.ts");
const sql = read("docs/sql/social_channel_stats.sql");

describe("one figure per channel per day", () => {
  it("keys the day in UTC, matching the table's own default", () => {
    // ⚠️ A capture at 23:40 IST must not land on yesterday's row.
    expect(capturedOn(new Date("2026-10-18T18:10:00Z"))).toBe("2026-10-18");
    expect(capturedOn(new Date("2026-10-18T23:59:59Z"))).toBe("2026-10-18");
    expect(capturedOn(new Date("2026-10-19T00:00:01Z"))).toBe("2026-10-19");
  });

  /**
   * ⛔ TWO CAPTURES IN A DAY ARE ONE FIGURE, corrected — not two readings. An
   * insert would turn a retry into a duplicate data point and make every
   * average wrong.
   */
  it("upserts on (account, day) rather than inserting", () => {
    expect(stats).toMatch(/onConflict: "account_id,captured_on"/);
    expect(stats).toMatch(/onConflict: "post_id,captured_on"/);
    expect(sql).toMatch(/unique \(account_id, captured_on\)/);
    expect(sql).toMatch(/unique \(post_id, captured_on\)/);
  });

  it("asks whether a baseline exists BEFORE writing one", () => {
    const order = stats.indexOf("const baseline = (count ?? 0) === 0");
    const write = stats.indexOf('from("social_channel_stats").upsert');
    expect(order).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(order, "it asks after writing, so the answer is always no").toBeLessThan(write);
  });

  it("records how many posts were live, so the follower line can be read", () => {
    // 🔑 A jump with no posts behind it came from somewhere else entirely.
    expect(stats).toMatch(/posts_live: live \?\? 0/);
  });
});

/**
 * ⛔ THE DISTINCTION THIS WHOLE FILE TURNS ON: a number Facebook declined to
 * give is NOT zero. Storing 0 would drag every average down and read as a
 * collapse rather than a gap.
 */
describe("a missing number is null, never zero", () => {
  it("page figures fall back to null", () => {
    expect(adapter).toMatch(/typeof json\.followers_count === "number" \? json\.followers_count : null/);
    expect(adapter).toMatch(/typeof json\.fan_count === "number" \? json\.fan_count : null/);
  });

  it("⛔ impressions are null, because the token cannot ask for them", () => {
    // read_insights is not on this token; pretending otherwise with a 0 would
    // be the most misleading column in the table.
    expect(adapter).toMatch(/impressions: null/);
    expect(sql).toMatch(/NULL until the token carries `read_insights`/);
  });

  /**
   * ⚠️ THE ONE EXCEPTION, and it is reasoned rather than assumed: Facebook
   * OMITS `shares` when a post has none. There, absent really does mean none.
   */
  it("treats an absent share count as genuinely none", () => {
    expect(adapter).toMatch(/typeof json\.shares\?\.count === "number" \? json\.shares\.count : 0/);
  });

  it("asks for counts, not for pages of objects", () => {
    // 🔑 Without summary(true) this fetches reactions one by one and counts 25.
    expect(adapter).toMatch(/reactions\.summary\(true\)\.limit\(0\)/);
    expect(adapter).toMatch(/comments\.summary\(true\)\.limit\(0\)/);
  });
});

describe("when stock is taken", () => {
  it("on connect — the only moment a baseline is possible", () => {
    const route = read("src/app/api/admin/social/channels/route.ts");
    expect(route).toMatch(/captureChannelStats\(db, row\.id as string, \{ note: "taken at connect" \}\)/);
  });

  /**
   * ⛔ AND IT MUST NOT BE ABLE TO BREAK THE CONNECT. A channel connected and
   * unmeasured is far better than a channel that could not be connected
   * because a statistics call timed out.
   */
  it("⛔ a failed capture never fails the connect", () => {
    const route = read("src/app/api/admin/social/channels/route.ts");
    const block = route.slice(route.indexOf("let baselineNote"), route.indexOf("const replaced"));
    expect(block).toMatch(/try \{/);
    expect(block).toMatch(/catch \(e\)/);
    expect(block).not.toMatch(/return NextResponse\.json\(\s*\{\s*error/);
  });

  it("on 'Check it now' too — the only way to backfill a channel connected earlier", () => {
    const check = read("src/app/api/admin/social/channels/[id]/check/route.ts");
    expect(check).toMatch(/captureChannelStats\(db, cred\.id, \{ note: "taken at check" \}\)/);
  });

  it("daily, after the posting hour rather than before it", () => {
    const crons = JSON.parse(read("vercel.json")).crons as { path: string; schedule: string }[];
    const job = crons.find((c) => c.path === "/api/cron/social-stats");
    expect(job, "an undeclared cron never runs and never alarms").toBeTruthy();
    // 14:00 UTC = 19:30 IST, an hour after the 17:30 IST posting slot. Figures
    // taken before the post would describe yesterday and be filed under today.
    expect(job?.schedule).toBe("0 14 * * *");
  });

  /**
   * ⛔ "Stop everything" means stop PUBLISHING. It does not mean stop knowing
   * what is happening — and a pause is exactly when somebody wants to see
   * whether anything changed.
   */
  it("does NOT stop when posting is paused", () => {
    expect(read("src/app/api/cron/social-stats/route.ts")).not.toMatch(/postingIsPaused/);
  });
});

describe("what it refuses to pretend", () => {
  it("says plainly there is no reader for the other channels", () => {
    expect(stats).toMatch(/There is no way to read \$\{cred\.platform\} figures yet/);
  });

  it("one post failing does not lose the rest of the day", () => {
    const fn = stats.slice(stats.indexOf("export async function capturePostStats"));
    expect(fn).toMatch(/problems\.push/);
    expect(fn).toMatch(/continue;/);
  });

  it("⚠️ asks only about recent posts, so a daily run cannot become a rate limit", () => {
    expect(stats).toMatch(/const days = opts\.days \?\? 14/);
    expect(stats).toMatch(/\.limit\(50\)/);
  });
});

/**
 * 🔴 A FALLBACK THAT SWALLOWS THE REAL ERROR IS WORSE THAN NO FALLBACK.
 *
 * The metric-name search returned `{ value: null, invalid: false }` for every
 * error that was not "retired metric" — and the caller read that as "the
 * metric answered and there was no data". So
 * `(#190) This method must be called with a Page Access Token` surfaced in the
 * admin as a cheerful "Reach yesterday: unknown".
 *
 * ⚠️ A real, fixable error reported as an empty number. Found by reading the
 * stored `raw`, not by the message on screen — which is the whole reason the
 * unparsed response is kept.
 */
describe("the metric search tells retirement apart from failure", () => {
  const adapter = read("src/lib/social/adapters/facebook.ts");

  it("⛔ returns a non-retirement error instead of a null value", () => {
    expect(adapter).toMatch(/error: invalid \? undefined : json\.error/);
  });

  it("stops the search on a real error rather than walking the whole list", () => {
    expect(adapter).toMatch(/if \(got\.error\) \{\s*\n\s*failure = got\.error;\s*\n\s*return null;/);
  });

  it("⛔ a real error wins over the 'update the metric list' message", () => {
    const fn = adapter.slice(adapter.indexOf("export async function fetchPageInsights"));
    const real = fn.indexOf("if (failure) return { ok: false, ...classifyGraphError(failure) }");
    const retired = fn.indexOf("None of these are metrics Facebook still recognises");
    /**
     * ⚠️ `> -1` FIRST. `indexOf` returns −1 when the line is DELETED, and −1
     * is less than any position — so the ordering assertion passed with the
     * guard removed entirely. Second time today
     * ⇒ trap_mutation_harness_can_report_false_caught.
     */
    expect(real, "the real-error guard is gone").toBeGreaterThan(-1);
    expect(retired).toBeGreaterThan(-1);
    expect(real).toBeLessThan(retired);
  });

  /**
   * 🔑 Insights need the PAGE's own token, exactly like publishing. Asked with
   * the system user's token, Facebook answers #190 — nothing to do with the
   * metric, the scope, or the Page id.
   */
  it("mints a Page token before asking for insights", () => {
    const page = adapter.slice(adapter.indexOf("export async function fetchPageInsights"));
    const minted = page.indexOf("await pageAccessToken(");
    expect(minted, "no Page token is minted at all").toBeGreaterThan(-1);
    expect(minted).toBeLessThan(page.indexOf("firstThatWorks"));
    const post = adapter.slice(adapter.indexOf("export async function fetchPostImpressions"));
    expect(post).toMatch(/await pageAccessToken\(/);
  });

  /**
   * ⛔ MINTING IT IS NOT USING IT. The first version of the test above passed
   * with every metric still requested using the SYSTEM USER's token — which
   * is the exact #190 this change exists to fix.
   */
  it("⛔ and actually passes that Page token to every metric call", () => {
    expect(adapter).toMatch(/readMetric\(doFetch, args\.pageId, metric, window, page\.token\)/);
    expect(adapter).toMatch(/readMetric\(doFetch, args\.postId, metric, "", page\.token\)/);
    expect(adapter).not.toMatch(/readMetric\([^)]*args\.token\)/);
  });

  it("derives the page from the post id rather than taking it twice", () => {
    // A post id is `{pageId}_{postId}` — one less argument to get wrong.
    expect(adapter).toMatch(/const pageId = args\.postId\.split\("_"\)\[0\]/);
  });
});
