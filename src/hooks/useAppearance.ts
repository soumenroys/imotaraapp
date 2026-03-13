// src/hooks/useAppearance.ts
// Manages theme accent and font size — persists to localStorage, applies to <html>.
"use client";

import { useEffect, useState } from "react";

const ACCENT_KEY   = "imotara.accent.v1";
const FONTSIZE_KEY = "imotara.fontsize.v1";

export type Accent   = "indigo" | "teal" | "rose" | "amber" | "emerald";
export type FontSize = "sm" | "md" | "lg";

const ACCENT_DEFAULT: Accent   = "indigo";
const FONTSIZE_DEFAULT: FontSize = "md";

function applyAccent(accent: Accent) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-accent", accent);
}

function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-fontsize", size);
}

export function useAppearance() {
  const [accent, setAccentState] = useState<Accent>(ACCENT_DEFAULT);
  const [fontSize, setFontSizeState] = useState<FontSize>(FONTSIZE_DEFAULT);

  useEffect(() => {
    try {
      const a = (localStorage.getItem(ACCENT_KEY) as Accent) || ACCENT_DEFAULT;
      const f = (localStorage.getItem(FONTSIZE_KEY) as FontSize) || FONTSIZE_DEFAULT;
      setAccentState(a);
      setFontSizeState(f);
      applyAccent(a);
      applyFontSize(f);
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

  return { accent, setAccent, fontSize, setFontSize };
}
