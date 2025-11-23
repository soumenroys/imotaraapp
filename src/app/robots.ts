// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const base = "https://imotara.com";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/dev/",      // hide developer utilities
                    "/api/dev/",  // hide internal API paths
                    "/_next/",    // avoid indexing internals
                ],
                crawlDelay: 2,
            },
        ],
        sitemap: `${base}/sitemap.xml`,
        host: base,
    };
}
