// UX-20. AppearanceInit read the stored theme with `|| "dark"` and never once
// consulted prefers-color-scheme, so every visitor on a light OS got a dark
// site and had to go find the setting.
//
// Mirrors imotara-mobile's src/__tests__/themeMode.test.ts. The two judgement
// calls are the same on both platforms and are pinned the same way.

import { describe, it, expect } from "vitest";
import { resolveColorMode, initialThemePref, isThemePref } from "@/lib/theme/themePref";

describe("resolveColorMode", () => {
  it("follows the OS when the preference is system", () => {
    expect(resolveColorMode("system", true)).toBe("light");
    expect(resolveColorMode("system", false)).toBe("dark");
  });

  it("ignores the OS once the person has chosen", () => {
    expect(resolveColorMode("light", false)).toBe("light");
    expect(resolveColorMode("dark", true)).toBe("dark");
  });

  it("never resolves to the literal string 'system'", () => {
    // Stamping "system" onto data-theme would miss the [data-theme=\"light\"]
    // opt-out in globals.css and render dark for a light-OS visitor.
    for (const prefersLight of [true, false]) {
      expect(["light", "dark"]).toContain(resolveColorMode("system", prefersLight));
    }
  });
});

describe("initialThemePref — returning visitors must not be flipped", () => {
  it("a first-time visitor follows the OS", () => {
    expect(initialThemePref([])).toBe("system");
  });

  it("someone who has used Imotara before keeps dark", () => {
    expect(initialThemePref(["imotara.accent.v1"])).toBe("dark");
    expect(initialThemePref(["x", "imotara.fontsize.v1"])).toBe("dark");
  });

  it("other sites' keys do not count", () => {
    expect(initialThemePref(["theme", "next-auth.csrf"])).toBe("system");
  });
});

describe("isThemePref", () => {
  it("accepts only the three values", () => {
    for (const v of ["system", "light", "dark"]) expect(isThemePref(v)).toBe(true);
    for (const v of [null, undefined, "", "Dark", "auto", 1]) expect(isThemePref(v)).toBe(false);
  });
});
