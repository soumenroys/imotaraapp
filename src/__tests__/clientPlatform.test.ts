// resolvePlatform decides whether an event goes in the "Website" or the
// "iPhone / iPad" column on /admin/analytics. The failure mode it exists to
// prevent is not a crash — it is a dashboard that confidently shows the wrong
// split, which nobody would catch by looking at it.

import { describe, it, expect } from "vitest";
import { resolvePlatform, PLATFORM_HEADER } from "@/lib/imotara/clientPlatform";

const req = (headers: Record<string, string>) => ({
  headers: {
    get: (n: string) => headers[n.toLowerCase()] ?? null,
  },
});

describe("resolvePlatform — the app's own declaration wins", () => {
  it("trusts the header the mobile app sets", () => {
    expect(resolvePlatform(req({ [PLATFORM_HEADER]: "android" }))).toBe("android");
    expect(resolvePlatform(req({ [PLATFORM_HEADER]: "ios" }))).toBe("ios");
  });

  it("prefers the header over a contradicting User-Agent", () => {
    // An app build behind a proxy that rewrites UA must still count as the app.
    expect(resolvePlatform(req({
      [PLATFORM_HEADER]: "ios",
      "user-agent": "Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36",
    }))).toBe("ios");
  });

  it("ignores a header value that is not one of the four known surfaces", () => {
    expect(resolvePlatform(req({ [PLATFORM_HEADER]: "smart-fridge" }))).toBe("unknown");
  });
});

describe("resolvePlatform — User-Agent fallback for pre-1.4.1 installs", () => {
  // THE ORDERING TRAP. React Native on iOS sends a UA containing CFNetwork and,
  // on several versions, the string "Mozilla" as well. Test browsers first and
  // every iOS app request is filed as web — silently, and permanently, because
  // 1.3.2 is on both stores and will be installed for months.
  it("reads an iOS app UA as ios even though it also says Mozilla", () => {
    expect(resolvePlatform(req({
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CFNetwork/1498 Darwin/24.0.0",
    }))).toBe("ios");
  });

  it("reads a bare CFNetwork UA as ios", () => {
    expect(resolvePlatform(req({ "user-agent": "Imotara/1.3.2 CFNetwork/1498.700.2 Darwin/23.6.0" }))).toBe("ios");
  });

  it("reads okhttp as android", () => {
    expect(resolvePlatform(req({ "user-agent": "okhttp/4.12.0" }))).toBe("android");
  });

  it("does NOT read Android Chrome as the app — that is a mobile web visitor", () => {
    expect(resolvePlatform(req({
      "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36",
    }))).toBe("web");
  });

  it("reads desktop browsers as web", () => {
    expect(resolvePlatform(req({
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
    }))).toBe("web");
    expect(resolvePlatform(req({
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/131.0",
    }))).toBe("web");
  });
});

describe("resolvePlatform — admits ignorance rather than guessing", () => {
  it("returns unknown with no signal at all", () => {
    expect(resolvePlatform(req({}))).toBe("unknown");
  });

  it("never defaults an unrecognised client to web", () => {
    // Defaulting to web would quietly inflate the website number with traffic
    // that may well be the app, and nothing downstream would ever reveal it.
    expect(resolvePlatform(req({ "user-agent": "curl/8.4.0" }))).toBe("unknown");
    expect(resolvePlatform(req({ "user-agent": "PostmanRuntime/7.39" }))).toBe("unknown");
  });
});
