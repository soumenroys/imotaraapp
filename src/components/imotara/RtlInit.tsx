// src/components/imotara/RtlInit.tsx
// P2-12 (code_review_audit_2026_08_14 finding E1): sets document.dir/lang
// from the user's stored language preference. Arabic, Hebrew, and Urdu are
// fully shipped languages here (dedicated prompt engineering, romanization
// rules, TTS voices, test scenarios) that were still always rendered
// left-to-right — every user of those 3 languages read a mirrored-wrong
// layout. Mirrors AppearanceInit's mount-time pattern (avoids a flash of
// wrong-direction content before hydration) plus a live listener on the
// same "imotara:profile-updated" event chat/page.tsx already consumes, so
// switching language in Settings applies immediately without a reload.
"use client";

import { useEffect } from "react";

const PROFILE_STORAGE_KEY = "imotara.profile.v1";
const RTL_LANGS = new Set(["ar", "he", "ur"]);

function applyDirFromLang(lang: string | undefined | null) {
  const isRtl = !!lang && RTL_LANGS.has(lang);
  document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
  if (lang) document.documentElement.setAttribute("lang", lang);
}

function readStoredLang(): string | undefined {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed?.user?.preferredLang;
  } catch {
    return undefined;
  }
}

export default function RtlInit() {
  useEffect(() => {
    applyDirFromLang(readStoredLang());

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // detail is the freshly-saved profile object (or null on reset —
      // readStoredLang() falls back to the default "en"/ltr in that case).
      applyDirFromLang(detail?.user?.preferredLang ?? readStoredLang());
    };
    window.addEventListener("imotara:profile-updated", handler);
    return () => window.removeEventListener("imotara:profile-updated", handler);
  }, []);
  return null;
}
