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

/**
 * 🔴 THE SCHEMA PROMISED THE BASELINE FLAG "MAY NOT BE ERASED" AND THE CODE
 * ERASED IT.
 *
 * `is_baseline` was written as `(count === 0)` on every capture. The first
 * capture found no rows and set true; the second capture the same day found
 * one row and wrote FALSE over it. The starting line — the one figure that
 * cannot be recovered later — was silently lost within hours.
 *
 * ⛔ A comment stating a guarantee the code does not enforce is worse than no
 * comment at all: it stops the next person checking.
 */
describe("the baseline flag survives a correction", () => {
  const src = read("src/lib/social/stats.ts");

  it("⛔ keeps the flag when today's row already carries it", () => {
    expect(src).toMatch(/const baseline = \(count \?\? 0\) === 0 \|\| today\?\.is_baseline === true;/);
  });

  it("reads today's row back rather than assuming", () => {
    // The row being corrected may BE the baseline row.
    expect(src).toMatch(/\.eq\("captured_on", capturedOn\(opts\.now\)\)/);
  });
});

/**
 * 🔴 THE FIRST DASHBOARD WAS SINGLE-CHANNEL SHAPED.
 *
 * The owner, 18 Oct: "we will connect multiple social media from this… you are
 * not showing the social media name or post language or post type etc. is the
 * dashboard okay from all perspective?"
 *
 * ⛔ It was not. One followers figure taken from whichever row happened to be
 * last, one chart mixing every account, and no language, shape or angle
 * anywhere. With two channels recording it would not have LOOKED broken — it
 * would have looked fine and been wrong, which is worse.
 *
 * 🔴 And underneath it, the angle was never stored at all: nextPool chose one
 * per post, handed it to the writer, and dropped it. "Which angle actually
 * lands" — the question the rotation exists to answer — was unanswerable.
 */
describe("the angle is recorded, because it cannot be reconstructed", () => {
  const pipeline = read("src/lib/social/pipeline.ts");
  const store = read("src/lib/social/store.ts");
  const sql = read("docs/sql/social_post_angle.sql");

  it("the prepared post carries the pool it was written from", () => {
    expect(pipeline).toMatch(/topicPool: pool,/);
  });

  it("and the store writes it", () => {
    expect(store).toMatch(/topic_pool: post\.topicPool \?\? null,/);
  });

  /**
   * ⛔ NULL FOR A HAND-WRITTEN POST, and for anything published before the
   * column existed. Defaulting to a pool would file posts under an angle they
   * were never written from — a guess wearing a fact's clothes.
   */
  it("⛔ stores null rather than inventing an angle", () => {
    expect(store).not.toMatch(/topic_pool: post\.topicPool \?\? "/);
    expect(sql).toMatch(/Never backfilled/);
    expect(sql).not.toMatch(/update social_posts set topic_pool/i);
  });
});

describe("the dashboard separates the channels", () => {
  const page = read("src/app/admin/social/stats/page.tsx");

  it("⛔ renders one section per measured channel, not one set of figures", () => {
    /**
     * ⚠️ The anchor moved from `measured.map` to `shown.map` when the channel
     * filter arrived, and the rule did not: one section per channel, never
     * one set of figures taken from whichever row happened to be last.
     *
     * ⛔ `shown` is pinned as derived FROM `measured`, so the filter cannot
     * start drawing a channel that has no readings.
     */
    expect(page).toMatch(/shown\.map\(\(c\) =>/);
    expect(page).toMatch(/const shown =[\s\S]{0,120}measured/);
    expect(page).toMatch(/days\.filter\(\(d\) => d\.account_id === c\.id\)/);
  });

  it("has a channel filter with an 'all' that consolidates", () => {
    // 🔑 The owner, 18 Oct: "separate filter to see different social media
    // reports and ... a consolidated report or overview as well with a
    // filter all."
    expect(page).toMatch(/only === "all"/);
    expect(page).toContain("<Consolidated");
    // ⛔ And the consolidated view only when there IS something to
    // consolidate — with one channel it would be the same numbers twice.
    expect(page).toMatch(/only === "all" && measured\.length > 1/);
  });

  it("⛔ never calls a summed reach 'distinct people'", () => {
    /**
     * 🔴 The one figure in the consolidated view that cannot honestly be
     * added: the same person may follow two channels, so a sum counts them
     * twice. Per channel it IS distinct people; across channels it is not.
     */
    const block = page.slice(page.indexOf("function Consolidated"));
    expect(block).toMatch(/summed, not distinct people/);
    expect(block).toMatch(/counted twice/);
  });

  it("⛔ only charts a channel that has readings", () => {
    // A channel with none must not be drawn as a flat line at zero.
    expect(page).toMatch(/channels\.filter\(\(c\) => days\.some\(\(d\) => d\.account_id === c\.id\)\)/);
  });

  it("breaks the posts down by angle, language and shape", () => {
    for (const t of ["By angle", "By language", "By shape"]) expect(page).toContain(t);
  });

  /**
   * ⚠️ `measured` IS CARRIED SEPARATELY FROM `count`. "3 posts, 2 measured,
   * 7 engagements" is honest; dividing 7 by 3 averages in a post nobody has
   * figures for and under-reports everything recent.
   */
  it("⛔ says how many posts in a breakdown actually have figures", () => {
    expect(page).toMatch(/row\.measured \+= 1/);
    expect(page).toContain("<th>Measured</th>");
    expect(page).toMatch(/v\.measured === 0 \? "—"/);
    /**
     * ⚠️ AND IT IS ACTUALLY RENDERED. Counting it, heading a column for it and
     * never printing it leaves a header over an empty cell — which is how the
     * first version of this test passed with the value deleted.
     */
    expect(page).toMatch(/\{v\.measured\}<\/td>/);
    expect(page).toMatch(/v\.measured < v\.count \? "text-amber-300"/);
  });

  it("shows an unrecorded angle as unrecorded, not as a pool", () => {
    expect(page).toMatch(/p\.angle \?\? <span[^>]*>not recorded/);
  });
});

/**
 * 🔑 VISUALS THAT WORK ON ONE DAY OF DATA.
 *
 * The owner asked for clearer graphics. ⛔ The obvious answer — more line
 * charts — would have shown nothing: a line needs at least two points, and on
 * day one there is one. So the figures that mean something from a single
 * reading are drawn instead, and the lines appear when there is a line to
 * draw.
 */
describe("the visuals are honest about sparse data", () => {
  const page = read("src/app/admin/social/stats/page.tsx");
  const charts = read("src/app/admin/_components/charts.tsx");

  it("shows reach as a share of the audience, which needs only one reading", () => {
    expect(page).toMatch(/<Proportion value=\{now\?\.reach \?\? null\} of=\{now\?\.followers \?\? null\}/);
  });

  /**
   * 🔴 OVER 100% IS NOT CLAMPED. Reach exceeding followers means people who do
   * NOT follow the page were shown a post — the single most interesting thing
   * this product's analytics can report. A bar that silently filled and
   * stopped would hide exactly the day worth celebrating.
   */
  it("⛔ says so when reach passes the whole audience", () => {
    expect(charts).toMatch(/const over = pct > 100;/);
    /**
     * ⚠️ RENDERED, not merely present. Checking that the sentence exists in
     * the file passed with its whole block disabled — the string sat there
     * unreachable. Third time today that "it is in the source" was mistaken
     * for "it reaches the screen"
     * ⇒ trap_text_assertions_cannot_see_reachability.
     */
    expect(charts).toMatch(/\{over && \(/);
    expect(charts).toMatch(/Past the whole audience/);
    // ⛔ And the colour changes too, so it is visible before it is read.
    expect(charts).toMatch(/over \? "#38BDF8"/);
    // The fill is capped for layout, but the FIGURE and the message are not.
    expect(charts).toMatch(/Math\.min\(100, pct\)/);
  });

  it("⚠️ computes frequency only when BOTH numbers were measured", () => {
    // A ratio built on one real number and one guess is not a ratio.
    expect(page).toMatch(/typeof now\?\.impressions === "number" && typeof now\?\.reach === "number" && now\.reach > 0/);
  });

  /**
   * ⛔ A NULL DRAWS NO BAR. A zero-width bar is indistinguishable from a real
   * zero, which is the distinction this whole screen is built on.
   */
  it("⛔ draws no bar for an unmeasured value", () => {
    expect(charts).toMatch(/\{r\.value !== null && \(/);
    expect(charts).toMatch(/r\.value === null \? "—"/);
  });

  it("says what the longest bar is worth, so nothing is read against an imagined 100", () => {
    expect(charts).toMatch(/Longest bar = \{max\.toLocaleString\(\)\}/);
  });

  it("keeps the exact figures beside the bars rather than replacing them", () => {
    // A bar cannot show "2 of 3 measured" without lying; the table can.
    const fn = page.slice(page.indexOf("function Breakdown"));
    expect(fn).toMatch(/<Bars/);
    expect(fn).toMatch(/<table/);
  });

  it("only draws a line once there is a line to draw", () => {
    expect(page).toMatch(/withFollowers\.length > 1 &&/);
    expect(page).toMatch(/withReach\.length > 1 &&/);
  });
});
