// #137 (owner, 12 Nov 2026): "vercel build always shows some warnings". Each one fixed at its cause:
// - preferredRegion (deprecated, and on Vercel's Node functions it was IGNORED — all 40 routes ran in
//   iad1, checked by x-vercel-id) ⇒ removed. A region is set in vercel.json "functions" if ever needed.
// - withSentryConfig from "@sentry/nextjs" (deprecated) ⇒ "@sentry/nextjs/config".
// - the sitemap ping (Google 404, Bing 410 — both retired those endpoints) ⇒ removed; IndexNow stays.
// - npm install scripts not covered by allowScripts ⇒ approved by name in package.json.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

describe("the build has nothing to warn about", () => {
  it("no route exports the deprecated preferredRegion", () => {
    const hits = execSync("grep -rln 'export const preferredRegion' src/app || true", { encoding: "utf8" }).trim();
    expect(hits).toBe("");
  });
  it("Sentry's config wrapper comes from its /config entry", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toMatch(/from "@sentry\/nextjs\/config"/);
    expect(cfg).not.toMatch(/import \{ withSentryConfig \} from "@sentry\/nextjs";/);
  });
  it("no retired sitemap ping after the build", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.postbuild).not.toMatch(/ping-sitemap/);
  });
  it("the packages that need install scripts are approved by name (Mac and Vercel's Linux)", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const name of ["@sentry/cli", "esbuild", "unrs-resolver", "@ffmpeg-installer/linux-x64", "@ffmpeg-installer/darwin-arm64"]) {
      expect(pkg.allowScripts?.[name], name).toBe(true);
    }
  });
});
