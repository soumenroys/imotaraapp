// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const base = "https://imotara.com";

    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // no disallow needed
        },
        sitemap: `${base}/sitemap.xml`,
        host: base,
    };
}
