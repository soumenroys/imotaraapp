/**
 * #162 (owner 21 Nov 2026, option A): imotara.com/get-app — the Facebook Page
 * "Use app" button points here. ⛔ An iPhone user must never land in Google Play.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAppTarget, deviceOf, cleanFrom, sourceOf, GET_APP_SOURCES, PLAY_URL, APP_STORE_URL } from "@/lib/analytics/getAppLink";
import { FUNNEL_STEPS } from "@/lib/analytics/visitTally";

const ANDROID_FB = "Mozilla/5.0 (Linux; Android 14; SM-A256E Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/490.0]";
const IPHONE_FB = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0]";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

describe("get-app sends each phone to its own store", () => {
  it("Android (inside Facebook's browser) ⇒ Google Play, with the install referrer", () => {
    const t = getAppTarget(ANDROID_FB, "facebook");
    expect(t.device).toBe("android");
    expect(t.url.startsWith(PLAY_URL + "&referrer=")).toBe(true);
    expect(decodeURIComponent(t.url.split("referrer=")[1])).toBe(
      "utm_source=facebook&utm_medium=social&utm_campaign=get_app",
    );
  });

  it("⛔ iPhone ⇒ the App Store, never Google Play", () => {
    const t = getAppTarget(IPHONE_FB, "facebook");
    expect(t.device).toBe("ios");
    expect(t.url).toBe(APP_STORE_URL);
  });

  it("a computer ⇒ the website, tagged", () => {
    const t = getAppTarget(DESKTOP, "facebook");
    expect(t.device).toBe("other");
    expect(t.url).toBe("https://www.imotara.com/?utm_source=facebook&utm_medium=social&utm_campaign=get_app");
  });

  it("iPad counts as iOS", () => {
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("ios");
  });
});

describe("⛔ only our own labels go into the URL", () => {
  it("keeps short lowercase labels", () => {
    expect(cleanFrom("instagram")).toBe("instagram");
    expect(cleanFrom("Facebook")).toBe("facebook");
  });
  it("anything else becomes 'direct'", () => {
    for (const bad of [null, "", "a&b", "x".repeat(40), "<script>", "1abc", "fb page"]) {
      expect(cleanFrom(bad)).toBe("direct");
    }
  });
});

describe("counted anonymously, never at the cost of the redirect", () => {
  const route = readFileSync(join(process.cwd(), "src/app/get-app/route.ts"), "utf8");

  it("new funnel steps are appended, not renumbered", () => {
    expect(FUNNEL_STEPS.app_header_click).toBe(17);
    expect(FUNNEL_STEPS.get_app_android).toBe(18);
    expect(FUNNEL_STEPS.get_app_ios).toBe(19);
    expect(FUNNEL_STEPS.get_app_web).toBe(20);
  });

  it("skips robots (Facebook's link checker) when counting", () => {
    expect(route).toMatch(/if \(!refuseAsRobot\("web", ua\)\)/);
  });

  it("the count is in a try/catch and the redirect is always returned", () => {
    expect(route).toMatch(/try \{[\s\S]*imotara_record_visit_tally[\s\S]*\} catch/);
    expect(route).toContain("NextResponse.redirect(url, 302)");
    expect(route).toContain('"Cache-Control", "no-store"');
  });

  it("⛔ stores nothing about the person — only platform, kind, bucket, delta", () => {
    const args = route.slice(route.indexOf('rpc("imotara_record_visit_tally", {'), route.indexOf("});", route.indexOf("imotara_record_visit_tally")));
    const keys = [...args.matchAll(/(p_[a-z]+):/g)].map((m) => m[1]);
    expect(keys).toEqual(["p_platform", "p_kind", "p_bucket", "p_delta"]);
  });

});

describe("#162 (22 Nov 2026): which link brought them is counted too", () => {
  const route = readFileSync(join(process.cwd(), "src/app/get-app/route.ts"), "utf8");

  it("the four links we hand out are told apart; anything else is 'other'", () => {
    expect([...GET_APP_SOURCES]).toEqual(["fb_button", "fb_pinned", "fb_story", "ig_story"]);
    for (const s of GET_APP_SOURCES) expect(sourceOf(s)).toBe(s);
    expect(sourceOf("FB_Button")).toBe("fb_button");
    for (const other of [null, "", "facebook", "instagram", "<script>", "fb button"]) expect(sourceOf(other)).toBe("other");
  });

  it("source steps are appended after 20, never renumbered", () => {
    expect(FUNNEL_STEPS.get_app_from_fb_button).toBe(21);
    expect(FUNNEL_STEPS.get_app_from_fb_pinned).toBe(22);
    expect(FUNNEL_STEPS.get_app_from_fb_story).toBe(23);
    expect(FUNNEL_STEPS.get_app_from_ig_story).toBe(24);
    expect(FUNNEL_STEPS.get_app_from_other).toBe(25);
  });

  it("every source has a step, and the route counts BOTH the device and the source", () => {
    for (const s of [...GET_APP_SOURCES, "other"]) expect(route).toMatch(new RegExp(`${s}: FUNNEL_STEPS\\.get_app_from_${s}`));
    expect(route).toMatch(/\[STEP\[device\], source\]\.map/);
    expect(route).toContain('sourceOf(req.nextUrl.searchParams.get("from"))');
  });
});
