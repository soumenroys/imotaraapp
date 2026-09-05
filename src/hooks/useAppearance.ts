// src/hooks/useAppearance.ts
// Manages theme accent, font size, and colour mode — persists to localStorage, applies to <html>.
"use client";

import { useEffect, useState } from "react";
import {
  resolveColorMode,
  initialThemePref,
  isThemePref,
  type ThemePref,
} from "@/lib/theme/themePref";

const ACCENT_KEY   = "imotara.accent.v1";
const FONTSIZE_KEY = "imotara.fontsize.v1";
const THEME_KEY    = "imotara.theme.v1";

export type Accent    = "twilight" | "indigo" | "teal" | "rose" | "amber" | "emerald";
export type FontSize  = "sm" | "md" | "lg";
export type ColorMode = "dark" | "light";
export type { ThemePref };

const ACCENT_DEFAULT: Accent    = "twilight";
const FONTSIZE_DEFAULT: FontSize = "md";
const THEME_DEFAULT: ColorMode  = "dark";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function applyAccent(accent: Accent) {
  if (typeof document === "undefined") return;
  if (accent === "twilight") {
    // Remove override — falls back to :root twilight variables
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", accent);
  }
}

function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-fontsize", size);
}

function applyColorMode(mode: ColorMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode);
}

export function useAppearance() {
  const [accent, setAccentState] = useState<Accent>(ACCENT_DEFAULT);
  const [fontSize, setFontSizeState] = useState<FontSize>(FONTSIZE_DEFAULT);
  const [colorMode, setColorModeState] = useState<ColorMode>(THEME_DEFAULT);
  const [themePref, setThemePrefState] = useState<ThemePref>("dark");

  useEffect(() => {
    try {
      const a = (localStorage.getItem(ACCENT_KEY) as Accent | null) || ACCENT_DEFAULT;
      const f = (localStorage.getItem(FONTSIZE_KEY) as FontSize) || FONTSIZE_DEFAULT;
      setAccentState(a);
      setFontSizeState(f);
      applyAccent(a);
      applyFontSize(f);

      // The pre-paint script in layout.tsx has normally already resolved and
      // written this. Repeat the same decision here for the case where it did
      // not run, so the two can never disagree.
      const raw = localStorage.getItem(THEME_KEY);
      let pref: ThemePref;
      if (isThemePref(raw)) {
        pref = raw;
      } else {
        pref = initialThemePref(Object.keys(localStorage));
        localStorage.setItem(THEME_KEY, pref);
      }
      setThemePrefState(pref);
      const mode = resolveColorMode(pref, window.matchMedia?.(LIGHT_QUERY).matches ?? false);
      setColorModeState(mode);
      applyColorMode(mode);
    } catch { /* ignore */ }
  }, []);

  // Follow the OS while the preference is "system", rather than only at load.
  useEffect(() => {
    if (themePref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(LIGHT_QUERY);
    const onChange = () => {
      const mode = resolveColorMode("system", mq.matches);
      setColorModeState(mode);
      applyColorMode(mode);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePref]);

  function setAccent(a: Accent) {
    setAccentState(a);
    applyAccent(a);
    try {
      if (a === "twilight") {
        localStorage.removeItem(ACCENT_KEY);
      } else {
        localStorage.setItem(ACCENT_KEY, a);
      }
    } catch { /* ignore */ }
  }

  function setFontSize(f: FontSize) {
    setFontSizeState(f);
    applyFontSize(f);
    try { localStorage.setItem(FONTSIZE_KEY, f); } catch { /* ignore */ }
  }

  function setThemePref(p: ThemePref) {
    setThemePrefState(p);
    const mode = resolveColorMode(
      p,
      typeof window !== "undefined" ? (window.matchMedia?.(LIGHT_QUERY).matches ?? false) : false,
    );
    setColorModeState(mode);
    applyColorMode(mode);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme-pref", p);
    }
    try { localStorage.setItem(THEME_KEY, p); } catch { /* ignore */ }
  }

  /** Kept for callers that just want an explicit light/dark. */
  function setColorMode(m: ColorMode) {
    setThemePref(m);
  }

  return {
    accent, setAccent,
    fontSize, setFontSize,
    colorMode, setColorMode,
    themePref, setThemePref,
  };
}
