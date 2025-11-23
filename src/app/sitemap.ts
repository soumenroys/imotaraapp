import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date(); // valid Date object for lastModified

  return [
    // Core product surfaces
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/chat`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/history`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },

    // Supporting & marketing pages
    {
      url: `${base}/connect`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.6,
    },

    // Settings (low priority but still discoverable)
    {
      url: `${base}/settings`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ] satisfies MetadataRoute.Sitemap;
}
