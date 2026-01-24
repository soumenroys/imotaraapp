// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",           // Allow full indexing
                disallow: ["/api/health"], // But discourage indexing health endpoint
            },
        ],
        sitemap: "/sitemap.xml",
    };
}
