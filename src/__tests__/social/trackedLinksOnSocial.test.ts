// src/__tests__/social/trackedLinksOnSocial.test.ts
// 🔑 #92 (7 Nov 2026): GA — organic social sent 7 website sessions in 28 days,
// and visits without UTM tags land under "Direct". YouTube is the one channel
// whose text may carry a link: it must be tagged.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { trackedSiteUrl, withTrackedLink } from "@/lib/social/brandMarks";

const TAG = "https://www.imotara.com/?utm_source=youtube&utm_medium=social&utm_campaign=post";

describe("withTrackedLink", () => {
  it("no link ⇒ one tagged line at the end", () => {
    expect(withTrackedLink("Some days are heavy.  ", "youtube")).toBe(`Some days are heavy.\n\n${TAG}`);
  });
  it("a bare imotara.com link ⇒ tagged IN PLACE, never a second link", () => {
    const out = withTrackedLink("Try it at https://imotara.com/ today.", "youtube");
    expect(out).toBe(`Try it at ${TAG} today.`);
    expect(out.match(/imotara\.com/g)).toHaveLength(1);
  });
  it("www form and end-of-text are tagged too", () => {
    expect(withTrackedLink("Visit https://www.imotara.com", "youtube")).toBe(`Visit ${TAG}`);
  });
  it("a deeper page is tagged in place too — still one link", () => {
    expect(withTrackedLink("See https://www.imotara.com/faq.", "youtube"))
      .toBe("See https://www.imotara.com/faq?utm_source=youtube&utm_medium=social&utm_campaign=post.");
    expect(withTrackedLink("Read imotara.com/about", "youtube")).toBe(`Read imotara.com/about\n\n${TAG}`);
  });
  it("text already tagged ⇒ untouched", () => {
    const t = `Hi ${trackedSiteUrl("youtube")}`;
    expect(withTrackedLink(t, "youtube")).toBe(t);
  });
});

it("the YouTube upload uses it", () => {
  const route = readFileSync("src/app/api/cron/social-publish/route.ts", "utf8");
  expect(route).toMatch(/description: withTrackedLink\(post\.body as string, "youtube"\)/);
});
