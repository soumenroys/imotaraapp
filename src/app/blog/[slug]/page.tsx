// src/app/blog/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPostModuleBySlug,
  getRelatedPosts,
  getAllPosts,
  formatPostDate,
  type BlogCategory,
} from "@/lib/blog";
import BlogComments from "@/components/blog/BlogComments";
import BlogHero from "@/components/blog/BlogHero";

// ─── Static params ────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

// ─── Dynamic metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ en?: string }>;
}): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const mod = getPostModuleBySlug(slug);
  if (!mod) return { title: "Post not found" };

  const { meta } = mod;
  const showEnglish = sp.en === "1" && meta.languageCode && meta.languageCode !== "en";
  const title = showEnglish && meta.titleEn ? meta.titleEn : meta.title;
  const description = showEnglish && meta.descriptionEn ? meta.descriptionEn : meta.description;

  return {
    title,
    description,
    openGraph: {
      title: `${title} · Imotara Blog`,
      description,
      type: "article",
      publishedTime: meta.date,
      authors: [meta.author.name],
      tags: meta.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Imotara Blog`,
      description,
    },
  };
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<BlogCategory, string> = {
  "Mental Health": "bg-sky-500/15 text-sky-300 ring-sky-500/20",
  Mindfulness: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
  Product: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/20",
  Research: "bg-violet-500/15 text-violet-300 ring-violet-500/20",
  Stories: "bg-rose-500/15 text-rose-300 ring-rose-500/20",
};

function CategoryBadge({ category }: { category: BlogCategory }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CATEGORY_COLORS[category]}`}
    >
      {category}
    </span>
  );
}

// ─── Share buttons ────────────────────────────────────────────────────────────

function ShareButtons({ title, slug }: { title: string; slug: string }) {
  const url = `https://imotara.com/blog/${slug}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=imotara4x`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500">
        Share
      </span>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
      >
        X / Twitter
      </a>
      <a
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
      >
        LinkedIn
      </a>
    </div>
  );
}

// ─── Article JSON-LD ─────────────────────────────────────────────────────────

function ArticleJsonLd({
  meta,
  showEnglish,
}: {
  meta: ReturnType<typeof getPostModuleBySlug> extends infer M
    ? M extends { meta: infer P } ? P : never
    : never;
  showEnglish: boolean;
}) {
  const siteUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://imotara.com").replace(/\/+$/, "");
  const title = showEnglish && meta.titleEn ? meta.titleEn : meta.title;
  const description = showEnglish && meta.descriptionEn ? meta.descriptionEn : meta.description;

  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: meta.date,
    dateModified: meta.date,
    inLanguage: showEnglish ? "en" : (meta.languageCode ?? "en"),
    url: `${siteUrl}/blog/${meta.slug}`,
    image: `${siteUrl}/og-image.png`,
    author: {
      "@type": "Person",
      name: meta.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "Imotara",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/og-image.png` },
    },
    keywords: meta.tags.join(", "),
    articleSection: meta.category,
    isPartOf: {
      "@type": "Blog",
      name: "Imotara Blog",
      url: `${siteUrl}/blog`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ en?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const mod = getPostModuleBySlug(slug);
  if (!mod) notFound();

  const { meta, default: Content } = mod;
  const related = getRelatedPosts(slug);

  const isMultilingual = meta.languageCode && meta.languageCode !== "en";
  const showEnglish = isMultilingual && sp.en === "1";

  const displayTitle = showEnglish && meta.titleEn ? meta.titleEn : meta.title;
  const displayDescription = showEnglish && meta.descriptionEn ? meta.descriptionEn : meta.description;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">

      <ArticleJsonLd meta={meta} showEnglish={!!showEnglish} />

      {/* Back link */}
      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        ← All posts
      </Link>

      <article className="space-y-6">

        {/* Post header */}
        <header className="imotara-glass-card overflow-hidden rounded-2xl shadow-xl backdrop-blur-md">

          {/* Hero banner */}
          <BlogHero
            category={meta.category}
            coverEmoji={meta.coverEmoji}
            coverImage={meta.coverImage}
            title={meta.title}
          />

          <div className="px-5 py-6">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={meta.category} />
              <span className="text-[11px] text-zinc-500">
                {meta.readingTime} min read
              </span>
              {/* Language badge + toggle */}
              {isMultilingual && (
                <>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    {meta.language}
                  </span>
                  <Link
                    href={`/blog/${meta.slug}${showEnglish ? "" : "?en=1"}`}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  >
                    {showEnglish ? `← ${meta.language}` : "Read in English →"}
                  </Link>
                </>
              )}
            </div>

            <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-zinc-50 sm:text-3xl">
              {displayTitle}
            </h1>

            <p className="mt-2 text-sm leading-6 text-zinc-400 sm:text-base">
              {displayDescription}
            </p>

            {/* Author + date */}
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/8 pt-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-bold text-white">
                  {meta.author.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-200">
                    {meta.author.name === "Soumen Roy" ? (
                      <a
                        href="https://soumenroy.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition hover:text-sky-300 hover:underline underline-offset-2"
                      >
                        {meta.author.name}
                      </a>
                    ) : (
                      meta.author.name
                    )}
                  </p>
                  {meta.author.role && (
                    <p className="text-[11px] text-zinc-500">{meta.author.role}</p>
                  )}
                </div>
              </div>

              <time
                dateTime={meta.date}
                className="ml-auto text-[11px] text-zinc-500"
              >
                {formatPostDate(meta.date)}
              </time>
            </div>
          </div>
        </header>

        {/* Post body */}
        <div className="imotara-glass-soft rounded-2xl px-5 py-6 shadow-md backdrop-blur-md sm:px-8 sm:py-8">
          <Content lang={showEnglish ? "en" : undefined} />
        </div>

        {/* Tags */}
        {meta.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500">
              Tags
            </span>
            {meta.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share */}
        <ShareButtons title={displayTitle} slug={meta.slug} />

        {/* Related posts */}
        {related.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Related posts
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {related.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group imotara-glass-soft flex flex-col rounded-2xl px-4 py-4 shadow-md backdrop-blur-md transition hover:ring-1 hover:ring-white/15"
                >
                  {post.coverEmoji && (
                    <span className="mb-2 text-xl" aria-hidden>
                      {post.coverEmoji}
                    </span>
                  )}
                  <h3 className="text-xs font-semibold text-zinc-200 group-hover:text-white sm:text-sm">
                    {post.titleEn ?? post.title}
                  </h3>
                  <p className="mt-1 flex-1 text-[11px] leading-5 text-zinc-500 sm:text-xs">
                    {post.descriptionEn ?? post.description}
                  </p>
                  <span className="mt-3 text-[11px] font-medium text-indigo-400 transition group-hover:text-indigo-300">
                    Read →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Comments */}
        <div className="imotara-glass-soft rounded-2xl px-5 py-6 shadow-md backdrop-blur-md sm:px-8 sm:py-8">
          <BlogComments slug={meta.slug} />
        </div>

        {/* Back to blog */}
        <div className="pt-2">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            ← Back to all posts
          </Link>
        </div>

      </article>
    </main>
  );
}
