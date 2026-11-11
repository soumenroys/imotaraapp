/**
 * #128 (11 Nov 2026): ten public pages told search engines "my real address is the homepage"
 * because the ROOT layout set canonical = homepage and they inherited it.
 * ⛔ The root layout must never set a canonical; every public sitemap page sets its own.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";

const read = (p: string) => readFileSync(p, "utf8");
const own = (dir: string) => [`${dir}/page.tsx`, `${dir}/layout.tsx`].filter(existsSync).map(read).join("\n");

describe("canonicals point to themselves", () => {
  it("the root layout sets NO canonical and no language links", () => {
    const meta = read("src/app/layout.tsx");
    expect(meta).not.toMatch(/canonical:\s*siteUrl/);
    expect(meta).not.toMatch(/languages:\s*\{/);
  });
  it("the homepage declares its own canonical + language links", () => {
    const home = read("src/app/page.tsx");
    expect(home).toMatch(/canonical:\s*SITE/);
    expect(home).toMatch(/"x-default": SITE/);
  });
  for (const path of ["/blog", "/privacy", "/terms", "/contact", "/refunds", "/donate", "/help", "/pricing/corporate", "/tutorial", "/upgrade"]) {
    it(`${path} declares canonical = itself`, () => {
      expect(own(`src/app${path}`)).toContain(`canonical: "https://www.imotara.com${path}"`);
    });
  }
});
