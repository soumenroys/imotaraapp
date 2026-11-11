// src/lib/imotara/landingDraft.ts — #130 D (11 Nov 2026): the first message typed on a
// landing page (/, /ai-emotional-support) is carried into the chat box.
//
// 🔑 WHY: ~7% of web visits ever send a message; people who arrive from AI assistants
// land on these pages and had to find the chat before they could say anything.
//
// ⛔ The words NEVER travel in the URL (logs, analytics, referrers would keep them).
//    They go through sessionStorage — this tab only, read once, then removed.
// ⛔ Never sent for them: the chat page only fills an EMPTY box; the person presses send.

export const LANDING_DRAFT_KEY = "imotara.landingDraft.v1";
export const LANDING_DRAFT_MAX = 2000; // same limit the chat composer enforces
/** The URL the landing box opens — a marker only, no words. */
export const LANDING_CHAT_URL = "/chat?src=landing";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(s?: Store | null): Store | null {
  if (s) return s;
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}

/** Keep what they typed for the chat page. Returns false if there is nothing to keep. */
export function saveLandingDraft(text: string, s?: Store | null): boolean {
  const t = text.trim().slice(0, LANDING_DRAFT_MAX);
  if (!t) return false;
  try { store(s)?.setItem(LANDING_DRAFT_KEY, t); return true; } catch { return false; }
}

/** Read it ONCE and forget it, so a reload or a later visit never refills the box. */
export function takeLandingDraft(s?: Store | null): string | null {
  const st = store(s);
  if (!st) return null;
  try {
    const t = (st.getItem(LANDING_DRAFT_KEY) ?? "").trim();
    st.removeItem(LANDING_DRAFT_KEY);
    return t ? t.slice(0, LANDING_DRAFT_MAX) : null;
  } catch { return null; }
}

/** Three ways in, for someone who does not know how to begin. Worldwide words, no "AI". */
export const LANDING_OPENERS: readonly string[] = [
  "I don't know where to start.",
  "Something has been on my mind all day.",
  "I just need to get this off my chest.",
];
