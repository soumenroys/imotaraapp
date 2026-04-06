import type { MetadataRoute } from "next";

const base = (() => {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return "https://imotara.com";
  return "http://localhost:3000";
})();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/blog",
          "/blog/",
          "/about",
          "/donate",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/admin",
          "/chat",
          "/history",
          "/profile",
          "/settings",
          "/feel",
          "/grow",
          "/reflect",
          "/connect",
          "/license-debug",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
