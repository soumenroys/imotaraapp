/**
 * 🔴 NOT ONE FACEBOOK POST HAD EVER BEEN MEASURED (found 28 Oct 2026).
 *
 * "Check it now" printed three failures, one per id shape:
 *   • picture posts  → "(#10) requires the 'pages_read_user_content' permission"
 *   • video post ids → "(#12) singular statuses API is deprecated" (bare id)
 *   • old video ids  → "(#100) nonexisting field (reactions)" (a video, not a post)
 * ⇒ figures are read from post INSIGHTS (read_insights + pages_read_engagement,
 *   both on the token), by `{pageId}_{postId}`.
 */

import { describe, it, expect } from "vitest";
import { fetchPostStats, facebookPostRef } from "@/lib/social/adapters/facebook";

const PAGE = "1222416224285686";

function fakeGraph(insights: unknown, shares: unknown = { shares: { count: 2 } }) {
  const urls: string[] = [];
  const fetchImpl = (async (u: string) => {
    urls.push(u);
    if (u.includes("fields=access_token")) return new Response(JSON.stringify({ access_token: "page-token", id: PAGE }));
    if (u.includes("/insights?metric=post_reactions_by_type_total")) return new Response(JSON.stringify(insights));
    if (u.includes("fields=shares")) return new Response(JSON.stringify(shares));
    throw new Error(`unexpected ${u}`);
  }) as unknown as typeof fetch;
  return { urls, fetchImpl };
}

describe("facebookPostRef", () => {
  it("prefixes a bare post id with the Page id", () => {
    expect(facebookPostRef("122137090209392789", PAGE)).toBe(`${PAGE}_122137090209392789`);
  });
  it("leaves a page_post id alone", () => {
    expect(facebookPostRef(`${PAGE}_122136888447392789`, PAGE)).toBe(`${PAGE}_122136888447392789`);
  });
});

describe("fetchPostStats reads insights", () => {
  it("sums the breakdown and keeps the sign of the reaction", async () => {
    const g = fakeGraph({ data: [{ name: "post_reactions_by_type_total", values: [{ value: { like: 5, love: 2, anger: 1 } }] }] });
    const r = await fetchPostStats({ token: "system", postId: `${PAGE}_1`, pageId: PAGE, fetchImpl: g.fetchImpl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.reactions).toBe(8);
    expect(r.stats.love).toBe(2);
    expect(r.stats.angry).toBe(1);
    // 🔑 The object answered and had no `sorry` ⇒ nobody was sad: 0, not NULL.
    expect(r.stats.sad).toBe(0);
    expect(r.stats.shares).toBe(2);
    // ⛔ Not available without user-content permission ⇒ NULL, never 0.
    expect(r.stats.comments).toBeNull();
    // ⛔ Never the user-content edge.
    expect(g.urls.some((u) => u.includes("comments.summary") || u.includes("reactions.summary"))).toBe(false);
  });

  it("an unrecognised value shape leaves every reaction figure NULL — not zero", async () => {
    const g = fakeGraph({ data: [{ name: "post_reactions_by_type_total", values: [{ value: 7 }] }] });
    const r = await fetchPostStats({ token: "system", postId: `${PAGE}_1`, pageId: PAGE, fetchImpl: g.fetchImpl });
    expect(r.ok && r.stats.reactions).toBeNull();
    expect(r.ok && r.stats.angry).toBeNull();
  });

  it("a refused share count does not lose the reactions", async () => {
    const g = fakeGraph(
      { data: [{ values: [{ value: { like: 1 } }] }] },
      { error: { message: "(#10) needs pages_read_user_content", code: 10 } },
    );
    const r = await fetchPostStats({ token: "system", postId: `${PAGE}_1`, pageId: PAGE, fetchImpl: g.fetchImpl });
    expect(r.ok && r.stats.reactions).toBe(1);
    expect(r.ok && r.stats.shares).toBeNull();
  });

  it("a refused insights call is a failure, said in Facebook's words", async () => {
    const g = fakeGraph({ error: { message: "(#100) Invalid metric", code: 100 } });
    const r = await fetchPostStats({ token: "system", postId: `${PAGE}_1`, pageId: PAGE, fetchImpl: g.fetchImpl });
    expect(r.ok).toBe(false);
  });
});
