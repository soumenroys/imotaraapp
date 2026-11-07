// src/__tests__/latestAppVersion.test.ts
// Owner, 7 Nov 2026: the phone app offers an update when a newer version is in
// the store. The number comes from two env vars set by hand AFTER each store
// shows the version live — unset means the app shows nothing.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { latestAppVersions } from "@/lib/imotara/latestAppVersion";

describe("latestAppVersions", () => {
  it("unset ⇒ null for both (the default: nothing is offered)", () => {
    expect(latestAppVersions({})).toEqual({ ios: null, android: null });
  });
  it("reads each store separately — one store can be live before the other", () => {
    expect(latestAppVersions({ IMOTARA_LATEST_APP_VERSION_IOS: "1.6.6" })).toEqual({ ios: "1.6.6", android: null });
    expect(latestAppVersions({ IMOTARA_LATEST_APP_VERSION_ANDROID: " 1.6.6 " })).toEqual({ ios: null, android: "1.6.6" });
  });
  it("a value that is not a version ⇒ null, never a guess", () => {
    expect(latestAppVersions({ IMOTARA_LATEST_APP_VERSION_IOS: "latest", IMOTARA_LATEST_APP_VERSION_ANDROID: "1.6" })).toEqual({ ios: null, android: null });
  });
  it("a build suffix is dropped", () => {
    expect(latestAppVersions({ IMOTARA_LATEST_APP_VERSION_IOS: "1.6.6+166" }).ios).toBe("1.6.6");
  });
});

describe("⛔ never tied to our release number", () => {
  const src = readFileSync("src/lib/imotara/latestAppVersion.ts", "utf8");
  it("does not read NEXT_PUBLIC_APP_VERSION or package.json (those move before review)", () => {
    expect(src).not.toMatch(/NEXT_PUBLIC_APP_VERSION|package\.json/);
  });
});
