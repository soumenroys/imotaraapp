import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { AUDIENCE_PAGES } from "@/data/audiencePages";
import { LANG_FAQ_CODES } from "@/data/faqLang";
import { COMPARE_SLUGS } from "@/data/comparePages";
import { ANSWER_SLUGS } from "@/data/answerPages";

const base = (() => {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return "https://imotara.com";
  return "http://localhost:3000";
})();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const posts = getAllPosts();

  // The audience landing pages. Enumerated from the data so a new audience is
  // indexed the moment it is added, rather than waiting for someone to
  // remember this file.
  const audienceEntries: MetadataRoute.Sitemap = Object.keys(AUDIENCE_PAGES).map((slug) => ({
    url: `${base}/for/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  // The Indian-language question pages. Enumerated from the data for the same
  // reason as the audience pages — a twelfth language should be indexed the day
  // it is written, not whenever someone remembers this file.
  // ⚠️ Same priority as /faq: these are the question-shaped pages, in the
  // languages where the competition is thinnest.
  const langFaqEntries: MetadataRoute.Sitemap = LANG_FAQ_CODES.map((lang) => ({
    url: `${base}/faq/${lang}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  // ⚠️ Derived, like the two above, so a sixth decision page is indexed the day
  // it is written rather than whenever someone remembers this file.
  const compareEntries: MetadataRoute.Sitemap = COMPARE_SLUGS.map((slug) => ({
    url: `${base}/compare/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  // ⚠️ Derived, like the rest, so a ninth answer page indexes itself.
  const answerEntries: MetadataRoute.Sitemap = ANSWER_SLUGS.map((slug) => ({
    url: `${base}/answers/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

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
    { url: `${base}/guide`,   lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    // ⚠️ High priority on purpose. Measured 16 Oct: the site ranks for its own
    // NAME and essentially nothing else, and the only non-brand query that has
    // ever produced an impression was question-shaped. /faq is the one page
    // built in that shape.
    { url: `${base}/faq`,     lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/donate`,  lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${base}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${base}/refunds`, lastModified: now, changeFrequency: "yearly",  priority: 0.5 },

    /**
     * 🔴 ADDED 2026-10-17. These four were PUBLIC, HTTP 200 and not noindexed,
     * and had simply never been added to this hand-maintained list. They were
     * invisible to search for as long as they have existed.
     *
     * ⚠️ /pricing/corporate is the page the NGO and institutional
     * conversations send people to — the commercial driver, unlisted.
     * ⚠️ /help answers questions in the shape people actually search.
     *
     * ⇒ The guard in sitemapCoversEveryPublicPage.test.ts now fails the build
     * when a public route is added without a decision about this list.
     */
    { url: `${base}/help`,              lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tutorial`,          lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/pricing/corporate`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/careers`,           lastModified: now, changeFrequency: "monthly", priority: 0.4 },

    // ⚠️ These two the guard found, not a human: /upgrade is explicitly
    // ALLOWED in robots.txt — we were inviting crawlers to a page we had not
    // listed and had not given a title. /updates is the mailing-list page.
    { url: `${base}/upgrade`,           lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/updates`,           lastModified: now, changeFrequency: "monthly", priority: 0.5 },

    // ── LLM / SEO landing pages ──────────────────────────────────────────────
    { url: `${base}/ai-emotional-support`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/mood-tracker-app`,     lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/ai-mental-wellness`,   lastModified: now, changeFrequency: "monthly", priority: 0.9 },

    // ── Multilingual landing pages ───────────────────────────────────────────
    { url: `${base}/hi`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/bn`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/ta`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },

    // ── The question pages in the Indian languages ──────────────────────────
    // ⚠️ Not the same thing as /hi /bn /ta above. Those are brand pages; these
    // answer what people actually type.
    ...langFaqEntries,

    // ── The answer pages ────────────────────────────────────────────────────
    // ⚠️ Top priority alongside /faq. Measured 16 Oct: the ONLY non-brand query
    // this site has ever had an impression for was conversational and about the
    // reader's situation. These are that shape.
    { url: `${base}/answers`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...answerEntries,

    // ── The decision pages ──────────────────────────────────────────────────
    // ⚠️ Same priority as /faq and the language FAQs, and for the same measured
    // reason: question-shaped pages are the only shape that has ever produced a
    // non-brand impression here.
    { url: `${base}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...compareEntries,

    // ── Who it's for: the audience landing pages ────────────────────────────
    { url: `${base}/for`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...audienceEntries,

    // ── Blog hub + all individual posts ─────────────────────────────────────
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    ...blogPostEntries,

    // ── Private / app-shell pages intentionally excluded:
    //    /chat /history /profile /settings /feel /grow /reflect /connect /admin
  ] satisfies MetadataRoute.Sitemap;
}
