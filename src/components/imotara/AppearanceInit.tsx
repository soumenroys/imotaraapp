// src/components/imotara/AppearanceInit.tsx
// Lightweight client component that applies saved accent, font size, and color mode on mount
// so there's no flash of un-themed content.
"use client";

import { useEffect } from "react";

const ACCENT_KEY   = "imotara.accent.v1";
const FONTSIZE_KEY = "imotara.fontsize.v1";
const THEME_KEY    = "imotara.theme.v1";

export default function AppearanceInit() {
  useEffect(() => {
    try {
      const accent    = localStorage.getItem(ACCENT_KEY)   || "indigo";
      const fontsize  = localStorage.getItem(FONTSIZE_KEY) || "md";
      const colorMode = localStorage.getItem(THEME_KEY)    || "dark";
      document.documentElement.setAttribute("data-accent",   accent);
      document.documentElement.setAttribute("data-fontsize", fontsize);
      document.documentElement.setAttribute("data-theme",    colorMode);
    } catch { /* ignore */ }
  }, []);
  return null;
}
