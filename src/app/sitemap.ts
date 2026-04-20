import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";

const base = (() => {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return "https://imotara.com";
  return "http://localhost:3000";
})();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const posts = getAllPosts();

  const blogPostEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: post.featured ? 0.85 : 0.75,
  }));

  return [
    // ── Core marketing / SEO pages ──────────────────────────────────────────
    { url: `${base}/`,        lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/about`,   lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/donate`,  lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${base}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.5 },

    // ── LLM / SEO landing pages ──────────────────────────────────────────────
    { url: `${base}/ai-emotional-support`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/mood-tracker-app`,     lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/ai-mental-wellness`,   lastModified: now, changeFrequency: "monthly", priority: 0.9 },

    // ── Multilingual landing pages ───────────────────────────────────────────
    { url: `${base}/hi`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/bn`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/ta`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },

    // ── Blog hub + all individual posts ─────────────────────────────────────
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    ...blogPostEntries,

    // ── Private / app-shell pages intentionally excluded:
    //    /chat /history /profile /settings /feel /grow /reflect /connect /admin
  ] satisfies MetadataRoute.Sitemap;
}
