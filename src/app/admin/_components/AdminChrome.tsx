"use client";

// Neutralises the consumer app's appearance settings for every admin screen.
//
// 🔴 THE BUG THIS FIXES, AND IT WAS NOT COSMETIC. A blocking script in the root
// layout writes `data-theme`, `data-fontsize` and `data-accent` onto <html> on
// every page load, from localStorage or — when the preference is "system",
// which it is for anyone who has ever used the app — from the operating
// system. globals.css then INVERTS THE WHOLE ZINC PALETTE under
// `[data-theme="light"]`: `--color-zinc-900` becomes light, `--color-zinc-100`
// becomes dark. That is right for a dark-first consumer app where those
// utilities carry text colour. It is catastrophic for the admin panel, which
// uses them for backgrounds.
//
// ⚠️ /admin, /admin/analytics and /admin/crisis-events each removed
// `data-theme` in their own useEffect. The five /admin/social/* screens did
// not — so an admin whose Mac is in Light Mode saw the social scheduler with
// every background and foreground inverted, while the rest of the panel looked
// right. "The social scheduler doesn't match the theme" was that, exactly.
//
// 🔴 AND NOBODY REMOVED `data-fontsize`, which sets the html font-size to 14,
// 16 or 18px directly. Every rem-based size in the admin therefore scaled with
// a preference the admin set once, months ago, in the consumer app. "The fonts
// are not exactly matching" was that.
//
// ⇒ One layout, one effect, every admin route. Three hand-kept copies and five
// omissions become one place that cannot be forgotten by a new page.

import { useEffect } from "react";

/** The attributes the consumer app's boot script writes onto <html>. */
const CONSUMER_APPEARANCE = ["data-theme", "data-theme-pref", "data-fontsize", "data-accent"] as const;

export function AdminChrome({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    // ⚠️ Remembered so the consumer app is handed back exactly what it had.
    // An admin who signs out and returns to /chat should not find their text
    // size reset because they visited the panel.
    const previous = CONSUMER_APPEARANCE.map((name) => [name, html.getAttribute(name)] as const);
    for (const [name] of previous) html.removeAttribute(name);
    return () => {
      for (const [name, value] of previous) if (value !== null) html.setAttribute(name, value);
    };
  }, []);

  return <>{children}</>;
}
