// src/hooks/useAppearance.ts
// Manages theme accent, font size, and colour mode — persists to localStorage, applies to <html>.
"use client";

import { useEffect, useState } from "react";

const ACCENT_KEY   = "imotara.accent.v1";
const FONTSIZE_KEY = "imotara.fontsize.v1";
const THEME_KEY    = "imotara.theme.v1";

export type Accent    = "indigo" | "teal" | "rose" | "amber" | "emerald";
export type FontSize  = "sm" | "md" | "lg";
export type ColorMode = "dark" | "light";

const ACCENT_DEFAULT: Accent    = "indigo";
const FONTSIZE_DEFAULT: FontSize = "md";
const THEME_DEFAULT: ColorMode  = "dark";

function applyAccent(accent: Accent) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-accent", accent);
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

  useEffect(() => {
    try {
      const a = (localStorage.getItem(ACCENT_KEY) as Accent) || ACCENT_DEFAULT;
      const f = (localStorage.getItem(FONTSIZE_KEY) as FontSize) || FONTSIZE_DEFAULT;
      const t = (localStorage.getItem(THEME_KEY) as ColorMode) || THEME_DEFAULT;
      setAccentState(a);
      setFontSizeState(f);
      setColorModeState(t);
      applyAccent(a);
      applyFontSize(f);
      applyColorMode(t);
    } catch { /* ignore */ }
  }, []);

  function setAccent(a: Accent) {
    setAccentState(a);
    applyAccent(a);
    try { localStorage.setItem(ACCENT_KEY, a); } catch { /* ignore */ }
  }

  function setFontSize(f: FontSize) {
    setFontSizeState(f);
    applyFontSize(f);
    try { localStorage.setItem(FONTSIZE_KEY, f); } catch { /* ignore */ }
  }

  function setColorMode(m: ColorMode) {
    setColorModeState(m);
    applyColorMode(m);
    try { localStorage.setItem(THEME_KEY, m); } catch { /* ignore */ }
  }

  return { accent, setAccent, fontSize, setFontSize, colorMode, setColorMode };
}
