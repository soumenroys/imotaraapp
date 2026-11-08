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

export function gaEvent(name: "sign_up" | "login" | "first_message" | "home_mood", params: Record<string, unknown> = {}): void {
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

/**
 * Send an event and resolve once GA says it went — or after `timeoutMs`,
 * whichever is first. For events fired right before the page is left.
 *
 * 🔴 8 Nov 2026 (#76): the sign-in callback fired sign_up/login and then set
 * window.location.href on the very next line. The event sat in dataLayer
 * (gtag.js often not even loaded yet on that page) and died with the page:
 * GA showed NO sign_up and NO login since the events went live on 6 Nov.
 * ⇒ `event_callback` + beacon transport, and the caller waits for this.
 * ⛔ Never waits longer than `timeoutMs`: a sign-in must not hang on analytics.
 */
export function gaEventBeforeLeaving(
  name: "sign_up" | "login",
  params: Record<string, string> = {},
  timeoutMs = 1000,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    setTimeout(finish, timeoutMs);
    try {
      if (typeof window === "undefined" || !gaMeasurementId() || isUntrackedPath(window.location.pathname)) {
        finish();
        return;
      }
      gaEvent(name, { ...params, transport_type: "beacon", event_callback: finish });
    } catch {
      finish();
    }
  });
}
