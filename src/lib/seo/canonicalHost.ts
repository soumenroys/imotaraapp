// src/lib/seo/canonicalHost.ts
//
// #167 (owner, 21 Nov 2026): imotaraapp.vercel.app — Vercel's own address for
// the production site — served a full 200 COPY of every page, and our public
// GitHub repo listed it as the website. imotara.net/.org already 308 to
// www.imotara.com; this one did not. With Bing indexing nothing at all yet,
// one address for the site is the least we owe it.
//
// ⛔ PAGES ONLY. Older app builds and Vercel's own crons may still call
// https://imotaraapp.vercel.app/api/... — a redirect there would turn a POST
// into a cross-origin hop that DROPS the Authorization header, silently
// breaking replies and read-aloud for anyone on an old version. So /api,
// /auth (sign-in callbacks), /_next, /.well-known (app links) and any path that
// looks like a file are left exactly as they are, and only GET/HEAD move.
// Preview deployments (imotaraapp-<hash>-….vercel.app) are not touched.

export const CANONICAL_ORIGIN = "https://www.imotara.com";
export const VERCEL_PRODUCTION_HOST = "imotaraapp.vercel.app";

const UNTOUCHED_PREFIXES = ["/api/", "/auth/", "/_next/", "/.well-known/", "/monitoring"];

/** Where this request should be sent instead, or null to serve it as it is. */
export function canonicalRedirect(host: string | null, method: string, pathname: string, search: string): string | null {
    if ((host ?? "").toLowerCase().split(":")[0] !== VERCEL_PRODUCTION_HOST) return null;
    if (method !== "GET" && method !== "HEAD") return null;
    if (UNTOUCHED_PREFIXES.some((p) => pathname === p.slice(0, -1) || pathname.startsWith(p))) return null;
    if (/\.[a-z0-9]{2,12}$/i.test(pathname)) return null; // files: manifest, sw.js, txt, images
    return CANONICAL_ORIGIN + pathname + (search || "");
}
