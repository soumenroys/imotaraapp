// src/app/admin/_components/appearance.ts
//
// ⛔ NO "use client" IN THIS FILE, AND THAT IS THE ENTIRE POINT.
//
// 🔴 These constants lived in AdminChrome.tsx, which is a client module. The
// server layout imported them to build its pre-paint script — and Next.js
// replaces a client module's exports with client REFERENCES when a server
// component imports them. So on the server both evaluated to `undefined`, and
// the script that shipped to production read:
//
//     var d=document.documentElement,k=undefined,s={};
//     for(var i=0;i<k.length;i++){ ... }
//     window[undefined]=s;
//
// ⚠️ `k.length` threw, the try/catch I had wrapped it in swallowed the error,
// and the fix did nothing at all. It looked deployed. The flash was untouched.
//
// 🔑 Values shared between a server component and a client one belong in a
// module that is neither — a plain one both can import.

/** The attributes the consumer app's boot script writes onto <html>. */
export const CONSUMER_APPEARANCE = ["data-theme", "data-theme-pref", "data-fontsize", "data-accent"] as const;

/** Where the pre-paint script leaves the originals for AdminChrome. */
export const ADMIN_APPEARANCE_KEY = "__imotaraAdminAppearance";

/**
 * The script that strips the consumer theme before the admin's first paint.
 *
 * ⚠️ Returned as a string from a real function so a test can read what will
 * actually ship. The version that silently did nothing passed a test asserting
 * the layout "contains dangerouslySetInnerHTML and removeAttribute" — both of
 * which were true of a script whose every value was `undefined`.
 */
export function resetBeforePaintScript(): string {
  return `(function(){try{
var d=document.documentElement,k=${JSON.stringify(CONSUMER_APPEARANCE)},s={};
for(var i=0;i<k.length;i++){s[k[i]]=d.getAttribute(k[i]);d.removeAttribute(k[i]);}
window[${JSON.stringify(ADMIN_APPEARANCE_KEY)}]=s;
}catch(e){}})();`;
}
