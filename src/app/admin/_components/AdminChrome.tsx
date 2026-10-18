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
// right.
//
// 🔴 AND NOBODY REMOVED `data-fontsize`, which sets the html font-size to 14,
// 16 or 18px directly. Every rem-based size in the admin therefore scaled with
// a preference the admin set once, months ago, in the consumer app.
//
// 🔑 THE REMOVAL ITSELF NOW HAPPENS BEFORE FIRST PAINT, in a blocking script in
// layout.tsx. An effect runs after hydration, and the page had already painted
// once with the consumer theme applied — measured in production at ~85ms of
// visibly wrong colours, far longer on a cold load. This component's job is
// what the script cannot do: put the attributes back when the admin leaves.

import { useEffect } from "react";

// ⛔ Declared in a plain module, not here. A server component importing a
// value from a "use client" file gets a client reference, not the value — the
// layout's pre-paint script shipped with `undefined` everywhere because of it.
import { CONSUMER_APPEARANCE, ADMIN_APPEARANCE_KEY } from "@/app/admin/_components/appearance";

export { CONSUMER_APPEARANCE, ADMIN_APPEARANCE_KEY };

type Saved = Partial<Record<string, string | null>>;

export function AdminChrome({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const w = window as unknown as Record<string, Saved | undefined>;

    /**
     * ⚠️ PREFER WHAT THE SCRIPT SAVED. By the time this runs the attributes are
     * already gone, so reading them here would capture nulls — and restore
     * nothing on the way out, leaving every consumer page dark for somebody
     * who merely visited the panel.
     *
     * 🔑 The fallback is not dead code: on a client-side navigation back into
     * /admin the layout's HTML is not re-sent, so the script does not re-run
     * and this effect is the only thing doing the stripping.
     */
    const saved: Saved =
      w[ADMIN_APPEARANCE_KEY] ??
      Object.fromEntries(CONSUMER_APPEARANCE.map((name) => [name, html.getAttribute(name)]));

    for (const name of CONSUMER_APPEARANCE) html.removeAttribute(name);

    return () => {
      // Hand the consumer app back exactly what it had. An admin who signs out
      // and returns to /chat should not find their text size reset because
      // they visited the panel.
      for (const name of CONSUMER_APPEARANCE) {
        const value = saved[name];
        if (typeof value === "string") html.setAttribute(name, value);
      }
      delete w[ADMIN_APPEARANCE_KEY];
    };
  }, []);

  return <>{children}</>;
}
