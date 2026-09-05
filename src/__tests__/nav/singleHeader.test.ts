// src/__tests__/nav/singleHeader.test.ts
// UX-23. There used to be two headers on /chat, /history, /feel and /privacy:
// SiteHeader from the root layout, and TopBar from inside each page — with a
// different set of destinations, its own mobile bottom bar, and its own ⌘K
// handler, so pressing ⌘K opened two stacked search overlays.
//
// These tests read the source, because the failure is structural: a second
// header mounting is not something a unit test of a component would notice.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { APP_ROUTES } from "@/lib/appRoutes";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(full);
    return full.endsWith(".tsx") || full.endsWith(".ts") ? [full] : [];
  });

const SOURCES = walk(path.join(process.cwd(), "src"));

describe("only one header ships", () => {
  it("TopBar is gone, not merely unused", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/components/imotara/TopBar.tsx"))).toBe(false);
  });

  it("nothing imports it", () => {
    const offenders = SOURCES.filter((f) => /from "[^"]*imotara\/TopBar"/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("SiteHeader is mounted exactly once, in the root layout", () => {
    const mounting = SOURCES.filter((f) => /<SiteHeader\s*\/?>/.test(fs.readFileSync(f, "utf8")));
    expect(mounting.map((f) => path.relative(process.cwd(), f))).toEqual(["src/app/layout.tsx"]);
  });
});

describe("one search, one shortcut", () => {
  it("only one component registers a ⌘K handler", () => {
    // Two of these is what produced two stacked search overlays.
    const withShortcut = SOURCES.filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      return /metaKey|ctrlKey/.test(s) && /"k"/.test(s) && /addEventListener\("keydown"/.test(s);
    });
    expect(withShortcut.map((f) => path.relative(process.cwd(), f))).toEqual(["src/components/SiteHeader.tsx"]);
  });

  it("only one component renders GlobalSearch", () => {
    const rendering = SOURCES.filter((f) => /<GlobalSearch\s/.test(fs.readFileSync(f, "utf8")));
    expect(rendering.map((f) => path.relative(process.cwd(), f))).toEqual(["src/components/SiteHeader.tsx"]);
  });
});

describe("the app routes keep what they need", () => {
  it("the mobile tab bar is mounted once, globally", () => {
    const mounting = SOURCES.filter((f) => /<MobileTabBar\s*\/?>/.test(fs.readFileSync(f, "utf8")));
    expect(mounting.map((f) => path.relative(process.cwd(), f))).toEqual(["src/app/layout.tsx"]);
  });

  it("every app route has a heading element", () => {
    // /chat and /history had none at all — TopBar's title was a <span>, so
    // those two screens shipped with no h1 for a screen reader.
    for (const route of APP_ROUTES) {
      const page = `src/app${route}/page.tsx`;
      expect(read(page), `${page} has no <h1>`).toMatch(/<h1[\s>]/);
    }
  });

  it("privacy is a public page again, with no app chrome", () => {
    const s = read("src/app/privacy/page.tsx");
    expect(s).not.toMatch(/TopBar/);
    expect(s).toMatch(/<h1/);
  });
});
