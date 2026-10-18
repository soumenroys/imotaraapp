// src/app/admin/layout.tsx
//
// ⚠️ A SERVER LAYOUT, because a client component cannot export `metadata` —
// Next.js does not warn, it silently inherits the root title.
//
// 🔑 Everything under /admin inherits both the title and the appearance reset,
// so no admin page has to remember to neutralise the consumer theme and none
// can forget. That is the whole point — the five social screens forgot, and
// looked broken for any admin whose machine was in light mode.

import type { Metadata } from "next";
import { AdminChrome, ADMIN_APPEARANCE_KEY, CONSUMER_APPEARANCE } from "@/app/admin/_components/AdminChrome";

export const metadata: Metadata = {
  title: "Imotara admin",
  // ⛔ Behind a login, and nothing here should ever reach an index.
  robots: { index: false, follow: false },
};

/**
 * 🔴 THIS HAS TO RUN BEFORE THE FIRST PAINT, NOT IN AN EFFECT.
 *
 * The root layout sets `data-theme` from a blocking script in <head>, so the
 * admin's HTML painted with the CONSUMER theme applied. Stripping it in a
 * useEffect happens after hydration — measured on production: first paint at
 * 316ms, the attribute still gone only by 401ms. For that window the admin
 * rendered with `[data-theme="light"]` active, which INVERTS the zinc palette
 * it is built on. The panel flashed light-and-wrong, then snapped to dark.
 *
 * ⚠️ That is the "theme shift" between chat and the admin: not two designs
 * disagreeing, one page painting twice.
 *
 * 🔑 The originals are stashed on `window` rather than re-read later, because
 * by the time AdminChrome's effect runs they are already gone — reading the
 * attributes then would capture nulls and restore nothing, leaving every
 * consumer page dark after somebody navigated out of the panel.
 */
const RESET_BEFORE_PAINT = `(function(){try{
var d=document.documentElement,k=${JSON.stringify(CONSUMER_APPEARANCE)},s={};
for(var i=0;i<k.length;i++){s[k[i]]=d.getAttribute(k[i]);d.removeAttribute(k[i]);}
window[${JSON.stringify(ADMIN_APPEARANCE_KEY)}]=s;
}catch(e){}})();`;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <script dangerouslySetInnerHTML={{ __html: RESET_BEFORE_PAINT }} />
      <AdminChrome>{children}</AdminChrome>
    </>
  );
}
