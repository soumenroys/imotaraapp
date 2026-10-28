/**
 * 🔴 THE PAGE TOKEN WAS IN THE STATS TABLE, IN PLAIN TEXT.
 *
 * 28 Oct 2026: all 20 `social_channel_stats` rows (18–27 Oct) held the
 * Facebook/Instagram token. Graph's insights reply carries `paging.next` and
 * `paging.previous` URLs with `access_token=…` in them, and `raw` stored the
 * reply whole — undoing the encryption every other copy of that token gets.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scrubRaw } from "@/lib/social/scrubRaw";

// ⚠️ The exact shape that leaked, with a fake token.
const GRAPH_REPLY = {
  page: { id: "17841427131490237", followers_count: 89 },
  insights: {
    data: [{ name: "reach", values: [{ value: 30 }] }],
    paging: {
      next: "https://graph.facebook.com/v26.0/1/insights?metric=reach&access_token=EAAfakeTOKEN123&since=1",
      previous: "https://graph.facebook.com/v26.0/1/insights?metric=reach&access_token=EAAfakeTOKEN123&since=0",
    },
  },
};

describe("scrubRaw", () => {
  it("keeps the figures and drops the token", () => {
    const out = scrubRaw(GRAPH_REPLY);
    expect(JSON.stringify(out)).not.toContain("EAAfakeTOKEN123");
    expect(out.insights.data[0].values[0].value).toBe(30);
    expect(out.page.followers_count).toBe(89);
  });

  it("removes a token in ANY url-shaped string, not only under `paging`", () => {
    const out = scrubRaw({ note: "see https://x.test/a?b=1&access_token=SECRET&c=2" });
    expect(out.note).toBe("see https://x.test/a?b=1&access_token=[removed]&c=2");
  });

  it("drops a token-named key outright", () => {
    expect(scrubRaw({ access_token: "SECRET", ok: 1 })).toEqual({ ok: 1 });
  });
});

describe("every stats write goes through it", () => {
  it("no `raw:` in stats.ts is stored unscrubbed", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/social/stats.ts"), "utf8");
    const writes = src.match(/^\s*raw: .*$/gm) ?? [];
    expect(writes.length).toBeGreaterThanOrEqual(3);
    for (const w of writes) expect(w, w.trim()).toMatch(/raw: scrubRaw\(/);
  });
});
