// src/lib/theme/themePref.ts
// The two judgement calls behind the appearance setting (UX-20), kept as pure
// functions so they can be tested and so the pre-paint script, the hook and
// the settings page cannot drift apart on them.
//
// Mirrors imotara-mobile's src/theme/themeMode.ts. Same decisions, same
// reasoning, deliberately.

export type ThemePref = "system" | "light" | "dark";
export type ColorMode = "dark" | "light";

/**
 * What a preference resolves to right now.
 *
 * `prefersLight` is the result of matchMedia("(prefers-color-scheme: light)").
 * A browser that cannot tell us counts as dark, which is what the site has
 * always shown — guessing light on no information would visibly change the
 * page on the strength of nothing.
 */
export function resolveColorMode(pref: ThemePref, prefersLight: boolean): ColorMode {
  if (pref === "system") return prefersLight ? "light" : "dark";
  return pref;
}

/**
 * Which preference a visitor with nothing stored should start from.
 *
 * "system" is right for someone arriving for the first time. But flipping a
 * returning visitor's site to light because their OS happens to be light is a
 * change they never asked for — they have been reading a dark site and none of
 * their preferences moved. So any existing `imotara.*` key means "keep dark".
 */
export function initialThemePref(existingKeys: readonly string[]): ThemePref {
  return existingKeys.some((k) => k.startsWith("imotara.")) ? "dark" : "system";
}

export function isThemePref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}
