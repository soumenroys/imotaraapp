// src/components/imotara/AppearanceInit.tsx
// Lightweight client component that applies saved accent, font size, and color mode on mount
// so there's no flash of un-themed content.
"use client";

import { useEffect } from "react";
import { resolveColorMode, initialThemePref, isThemePref } from "@/lib/theme/themePref";

const ACCENT_KEY   = "imotara.accent.v1";
const FONTSIZE_KEY = "imotara.fontsize.v1";
const THEME_KEY    = "imotara.theme.v1";

export default function AppearanceInit() {
  useEffect(() => {
    try {
      const accent    = localStorage.getItem(ACCENT_KEY)   || "indigo";
      const fontsize  = localStorage.getItem(FONTSIZE_KEY) || "md";
      document.documentElement.setAttribute("data-accent",   accent);
      document.documentElement.setAttribute("data-fontsize", fontsize);

      // Colour mode is a three-way preference now (UX-20), so re-reading the
      // key and treating it as a mode would stamp the literal string "system"
      // onto data-theme and turn the page dark for everyone following a light
      // OS. Resolve it the same way the pre-paint script did.
      const raw = localStorage.getItem(THEME_KEY);
      const pref = isThemePref(raw) ? raw : initialThemePref(Object.keys(localStorage));
      if (!isThemePref(raw)) localStorage.setItem(THEME_KEY, pref);
      const mode = resolveColorMode(pref, window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false);
      document.documentElement.setAttribute("data-theme", mode);
      document.documentElement.setAttribute("data-theme-pref", pref);
    } catch { /* ignore */ }
  }, []);
  return null;
}
