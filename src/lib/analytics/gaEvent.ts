// src/lib/analytics/gaEvent.ts
// The two moments GA could not see: a NEW account, and someone's FIRST message.
//
// 🔑 6 Nov 2026 (#76): GA showed 0 key events — it counted page views and
// nothing else, so "how many visitors became users" had no answer. Our own
// tally says 75% of web visits send no message at all; this lets GA say the
// same per source (ChatGPT, Google, Facebook …), which our tally cannot.
//
// ⛔ NOTHING PERSONAL GOES IN AN EVENT — no text, no email, no user id. Only
// the event name and, for sign-up, the provider ("google", "email").
// ⚠️ Queued through dataLayer exactly like the page view ⇒ it is not lost if
// gtag.js has not loaded yet (see GoogleAnalytics.tsx for why that matters).

import { gaMeasurementId, isUntrackedPath } from "@/lib/analytics/ga";

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

export function gaEvent(name: "sign_up" | "login" | "first_message", params: Record<string, string> = {}): void {
  if (typeof window === "undefined") return;
  const id = gaMeasurementId();
  if (!id || isUntrackedPath(window.location.pathname)) return;
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }
  w.gtag("event", name, { ...params, send_to: id });
}

const FIRST_MESSAGE_KEY = "imotara.ga.firstMessage";

/** Once per device, ever: the visitor became a user. Storage failing ⇒ send nothing rather than repeat. */
export function noteFirstMessageForGa(): void {
  try {
    if (localStorage.getItem(FIRST_MESSAGE_KEY)) return;
    localStorage.setItem(FIRST_MESSAGE_KEY, String(Date.now()));
  } catch {
    return;
  }
  gaEvent("first_message");
}

/**
 * A sign-in that just CREATED the account is a sign-up. Supabase has no
 * "new user" flag on the session, so: created within the last 10 minutes.
 */
export function signInKind(createdAt: string | undefined, now = Date.now()): "sign_up" | "login" {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) && now - t < 10 * 60_000 ? "sign_up" : "login";
}
