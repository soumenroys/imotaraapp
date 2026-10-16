// src/lib/seo/ogImage.ts
//
// The Open Graph image every page must put in its own `openGraph` block.
//
// 🔴 WHY THIS EXISTS. Next.js does NOT merge a page's `openGraph` with the
// root layout's — it REPLACES it. So a page that sets `openGraph: { title,
// description, url }` and nothing else silently loses the site-wide image.
//
// ⚠️ MEASURED IN PRODUCTION, 2026-10-16:
//     /                      og:image = og-image.png   ✅
//     /faq                   og:image = MISSING        ❌
//     /answers               og:image = MISSING        ❌
//     /compare               og:image = MISSING        ❌
//     /answers/grief-and-loss og:image = MISSING       ❌
//
// Ten page files were affected, including every page built this day FOR being
// shared. A link to any of them pasted into LinkedIn, X or WhatsApp rendered
// as a bare grey box. Nothing failed, nothing warned, and the homepage — the
// one page anyone would spot-check — was fine.
//
// ⛔ ADDING A PAGE WITH ITS OWN `openGraph`? Spread OG_IMAGE into it.
// `src/__tests__/openGraphImagePresent.test.ts` fails the build otherwise.

/** Absolute URL, because several crawlers will not resolve a relative one. */
export const OG_IMAGE_URL = "https://www.imotara.com/og-image.png";

/**
 * Spread into any page's `openGraph`: `openGraph: { ...OG_IMAGE, title, … }`
 *
 * ⚠️ NOT `as const`. Next's `OpenGraph` type wants a mutable array, and a
 * readonly one fails to typecheck at every call site.
 */
export const OG_IMAGE: { images: { url: string; width: number; height: number; alt: string }[] } = {
    images: [
        {
            url: OG_IMAGE_URL,
            width: 1200,
            height: 630,
            alt: "Imotara — a private emotional wellness companion",
        },
    ],
};
