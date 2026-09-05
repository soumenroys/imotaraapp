// src/__tests__/nav/themeBootstrap.test.ts
// UX-21. AppearanceInit applies the saved theme from a useEffect, which by
// definition runs after first paint — so a light-mode user watched ~150ms of
// dark page on every navigation. Measured before the fix: 4 of 24 sampled
// frames were dark with data-theme still null.
//
// The timing itself can only be proven in a browser (and was). What this
// guards is that the pre-paint script is still there and still agrees with the
// effect, because the two silently disagreeing is how the flash comes back.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { resolveColorMode, initialThemePref } from "@/lib/theme/themePref";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const LAYOUT = read("src/app/layout.tsx");
const INIT = read("src/components/imotara/AppearanceInit.tsx");

describe("the theme is applied before first paint", () => {
  it("a bootstrap script runs in the document head", () => {
    expect(LAYOUT).toMatch(/<head>/);
    expect(LAYOUT).toMatch(/data-theme/);
  });

  it("it reads the same three keys AppearanceInit does", () => {
    // If these drift apart the script sets one thing and the effect corrects
    // it a moment later — which is the flash, back again.
    for (const key of ["imotara.theme.v1", "imotara.accent.v1", "imotara.fontsize.v1"]) {
      expect(LAYOUT, `layout is missing ${key}`).toContain(key);
      expect(INIT, `AppearanceInit is missing ${key}`).toContain(key);
    }
  });

  it("it uses the same defaults as AppearanceInit", () => {
    for (const def of ['"indigo"', '"md"']) {
      expect(LAYOUT).toContain(def);
      expect(INIT).toContain(def);
    }
  });

  it("both copies resolve the three-way preference, not just read a mode", () => {
    // UX-20. If either one treated the stored value as a colour mode it would
    // stamp the literal string "system" onto data-theme, and the page would go
    // dark for everyone following a light OS.
    for (const [name, src] of [["layout", LAYOUT], ["AppearanceInit", INIT]] as const) {
      expect(src, `${name} does not consult the OS preference`)
        .toContain("prefers-color-scheme: light");
      expect(src, `${name} does not handle the "system" value`).toContain("system");
    }
  });

  it("it cannot throw the page away in private mode", () => {
    // localStorage access throws when site data is blocked; an uncaught throw
    // in a head script would stop the document.
    const script = /dangerouslySetInnerHTML=\{\{\s*__html: `([^`]+)`/.exec(LAYOUT)?.[1] ?? "";
    expect(script).toContain("try");
    expect(script).toContain("catch");
  });

  it("html keeps suppressHydrationWarning", () => {
    // The script mutates <html> before React hydrates; without this React
    // complains on every page.
    expect(LAYOUT).toMatch(/suppressHydrationWarning/);
  });

  it("AppearanceInit is still mounted as the fallback", () => {
    // It is not redundant: if the inline script is ever blocked, this is what
    // still applies the theme.
    expect(LAYOUT).toMatch(/AppearanceInit/);
  });

  it("a returning visitor still gets dark — UX-20 must not change what they see", () => {
    // UX-20 made "system" the default, but only for someone arriving fresh.
    // Anyone who has used Imotara before keeps the dark they already had, so
    // the site does not turn light under them because their OS always was.
    expect(initialThemePref([])).toBe("system");
    expect(initialThemePref(["imotara.accent.v1"])).toBe("dark");
    expect(initialThemePref(["someotherapp.k"])).toBe("system");
  });

  it("an unreadable OS preference resolves to dark, not light", () => {
    expect(resolveColorMode("system", false)).toBe("dark");
    expect(resolveColorMode("system", true)).toBe("light");
    expect(resolveColorMode("dark", true)).toBe("dark");
    expect(resolveColorMode("light", false)).toBe("light");
  });

  it("the inline script writes the decision down so it cannot change later", () => {
    // Deciding "system vs dark" on every load would let the answer flip the
    // first time a returning visitor clears one unrelated key.
    const script = /dangerouslySetInnerHTML=\{\{\s*__html: `([^`]+)`/.exec(LAYOUT)?.[1] ?? "";
    expect(script).toMatch(/setItem\("imotara\.theme\.v1"/);
  });
});
