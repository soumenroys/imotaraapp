"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import BlogHero from "@/components/blog/BlogHero";
import type { BlogPost, BlogCategory } from "@/lib/blog";

// ── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<BlogCategory, string> = {
  "Mental Health": "bg-sky-500/15 text-sky-300 ring-sky-500/20",
  Mindfulness: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
  Product: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/20",
  Research: "bg-violet-500/15 text-violet-300 ring-violet-500/20",
  Stories: "bg-rose-500/15 text-rose-300 ring-rose-500/20",
};

function CategoryBadge({ category }: { category: BlogCategory }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CATEGORY_COLORS[category]}`}>
      {category}
    </span>
  );
}

function LanguageBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
      {label}
    </span>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5" aria-hidden>
      <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3 3v-3H3a1 1 0 0 1-1-1V3Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden>
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5A5.5 5.5 0 0 1 13.5 8a5.5 5.5 0 0 1-5.5 5.5V2.5ZM6.5 2.8A5.5 5.5 0 0 0 2.5 8a5.5 5.5 0 0 0 4 5.3V2.8Z" />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentComment {
  id: string;
  slug: string;
  name: string;
  message: string;
  created_at: string;
}

// ── Quick comment form ────────────────────────────────────────────────────────

function QuickCommentForm({ posts }: { posts: BlogPost[] }) {
  const [selectedSlug, setSelectedSlug] = useState(posts[0]?.slug ?? "");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim() || !selectedSlug) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/blog/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: selectedSlug, name: name.trim(), message: message.trim() }),
        });
        setStatus(res.ok ? "success" : "error");
        if (res.ok) { setName(""); setMessage(""); }
      } catch { setStatus("error"); }
    });
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
        Thanks for sharing! Your comment is under review and will appear shortly.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {posts.length > 1 && (
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-zinc-600">
            Commenting on
          </label>
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 outline-none transition focus:border-white/20"
          >
            {posts.map((p) => (
              <option key={p.slug} value={p.slug} className="bg-zinc-900">
                {p.titleEn ?? p.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text" placeholder="Your name" value={name}
          onChange={(e) => setName(e.target.value)} maxLength={80} required
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-white/20 focus:bg-white/8"
        />
        <input
          type="text" placeholder="Share your thought…" value={message}
          onChange={(e) => setMessage(e.target.value)} maxLength={300} required
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-white/20 focus:bg-white/8"
        />
      </div>
      {status === "error" && <p className="text-[11px] text-rose-400">Something went wrong — please try again.</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-zinc-600">Comments are reviewed before appearing publicly.</p>
        <button
          type="submit" disabled={isPending || !name.trim() || !message.trim()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          {isPending ? "Sending…" : "Share →"}
        </button>
      </div>
    </form>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function BlogListClient({
  posts,
  categories,
}: {
  posts: BlogPost[];
  categories: BlogCategory[];
}) {
  const featured = posts.filter((p) => p.featured);
  const rest = posts.filter((p) => !p.featured);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<RecentComment[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    if (posts.length === 0) return;
    const slugList = posts.map((p) => p.slug).join(",");
    fetch(`/api/blog/comments?slugs=${slugList}`)
      .then((r) => r.json())
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => {});

    fetch("/api/blog/comments?recent=8")
      .then((r) => r.json())
      .then((d) => setRecent(d.comments ?? []))
      .catch(() => {})
      .finally(() => setLoadingRecent(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function countBadge(slug: string) {
    const n = counts[slug] ?? 0;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
        <ChatIcon />
        {n === 0 ? "Comment" : `${n}`}
      </span>
    );
  }

  function isMultilingual(post: BlogPost) {
    return post.languageCode && post.languageCode !== "en";
  }

  return (
    <div className="flex flex-col gap-0">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section className="imotara-glass-card rounded-2xl px-6 py-8 shadow-xl backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          Imotara · Blog
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Words on feeling well
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
          Thoughts on emotional wellness, mindfulness, multilingual AI, and
          building a kinder inner world — from the Imotara team.
        </p>
        {categories.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((cat) => <CategoryBadge key={cat} category={cat} />)}
          </div>
        )}
      </section>

      {/* ── Featured posts ─────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="mt-16">
          <div className="mb-8 flex items-center gap-4">
            <h2 className="text-base font-bold uppercase tracking-[0.15em] text-zinc-200">
              Featured
            </h2>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((post) => {
              const multi = isMultilingual(post);
              return (
                <div
                  key={post.slug}
                  className="group imotara-glass-card relative flex flex-col overflow-hidden rounded-2xl shadow-lg backdrop-blur-md transition hover:ring-1 hover:ring-white/20"
                >
                  {/* Main click area — absolute overlay link */}
                  <Link
                    href={`/blog/${post.slug}`}
                    className="absolute inset-0 z-0"
                    aria-label={post.titleEn ?? post.title}
                  />
                  <BlogHero
                    category={post.category}
                    coverEmoji={post.coverEmoji}
                    coverImage={post.coverImage}
                    title={post.title}
                    compact
                  />
                  <div className="relative z-10 flex flex-1 flex-col px-5 py-5 pointer-events-none">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={post.category} />
                      {multi && post.language && <LanguageBadge label={post.language} />}
                      <span className="text-[11px] text-zinc-500">{post.readingTime} min read</span>
                      {countBadge(post.slug)}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white">
                      {post.titleEn ?? post.title}
                    </h3>
                    {multi && post.title !== (post.titleEn ?? post.title) && (
                      <p className="mt-0.5 text-[11px] leading-5 text-amber-400/80 line-clamp-1">
                        {post.title}
                      </p>
                    )}
                    <p className="mt-2 flex-1 text-xs leading-6 text-zinc-400 line-clamp-3">
                      {post.descriptionEn ?? post.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3">
                      <span className="text-[11px] text-zinc-500">{formatDate(post.date)}</span>
                      <div className="flex items-center gap-2">
                        {multi && (
                          <Link
                            href={`/blog/${post.slug}?en=1`}
                            className="pointer-events-auto relative z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GlobeIcon /> EN
                          </Link>
                        )}
                        <span className="text-xs font-medium text-indigo-400 transition group-hover:text-indigo-300">
                          Read →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── All posts (non-featured, newest first) ───────────────────── */}
      {rest.length > 0 && (
        <section className="mt-16">
          <div className="mb-8 flex items-center gap-4">
            <h2 className="text-base font-bold uppercase tracking-[0.15em] text-zinc-200">
              All posts
            </h2>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-white/20 to-transparent" />
          </div>
          <div className="space-y-4">
            {rest.map((post) => {
              const multi = isMultilingual(post);
              return (
                <div
                  key={post.slug}
                  className="group relative imotara-glass-soft rounded-2xl px-5 py-5 shadow-md backdrop-blur-md transition hover:ring-1 hover:ring-white/15"
                >
                  {/* Main click overlay */}
                  <Link
                    href={`/blog/${post.slug}`}
                    className="absolute inset-0 z-0 rounded-2xl"
                    aria-label={post.titleEn ?? post.title}
                  />
                  <div className="relative z-10 flex items-start gap-4 pointer-events-none">
                    {post.coverEmoji && (
                      <span className="mt-0.5 shrink-0 text-2xl" aria-hidden>{post.coverEmoji}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge category={post.category} />
                        {multi && post.language && <LanguageBadge label={post.language} />}
                        <span className="text-[11px] text-zinc-500">{post.readingTime} min read</span>
                        {countBadge(post.slug)}
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white sm:text-base">
                        {post.titleEn ?? post.title}
                      </h3>
                      {multi && post.title !== (post.titleEn ?? post.title) && (
                        <p className="mt-0.5 text-[11px] leading-5 text-amber-400/80 line-clamp-1">
                          {post.title}
                        </p>
                      )}
                      <p className="mt-1 text-xs leading-5 text-zinc-400 sm:text-sm">
                        {post.descriptionEn ?? post.description}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-[11px] text-zinc-500">{formatDate(post.date)}</p>
                        {multi && (
                          <Link
                            href={`/blog/${post.slug}?en=1`}
                            className="pointer-events-auto relative z-20 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-0.5 text-[10px] text-amber-300 transition hover:bg-amber-500/15"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GlobeIcon /> Read in English
                          </Link>
                        )}
                      </div>
                    </div>
                    <span className="mt-1 shrink-0 text-xs font-medium text-indigo-400 transition group-hover:text-indigo-300">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {posts.length === 0 && (
        <div className="imotara-glass-soft rounded-2xl px-5 py-10 text-center">
          <p className="text-2xl">✍️</p>
          <p className="mt-2 text-sm text-zinc-400">No posts yet — check back soon.</p>
        </div>
      )}

      {/* ── Reader Thoughts ────────────────────────────────────────────── */}
      <section className="mt-16 imotara-glass-soft rounded-2xl px-6 py-8 shadow-md backdrop-blur-md sm:px-10">
        <div className="mb-8 flex items-center gap-4">
          <h2 className="text-base font-bold uppercase tracking-[0.15em] text-zinc-200">
            Reader Thoughts
          </h2>
          <div className="h-[2px] flex-1 bg-gradient-to-r from-rose-500/30 to-transparent" />
        </div>
        <p className="mb-6 text-sm text-zinc-500">
          What our readers are saying — join the conversation.
        </p>

        {/* Recent comments */}
        {loadingRecent ? (
          <div className="mb-5 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="mb-5 text-xs text-zinc-600">
            No comments yet — be the first to share your thoughts below.
          </p>
        ) : (
          <div className="mb-6 space-y-2">
            {recent.map((c) => {
              const post = posts.find((p) => p.slug === c.slug);
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 transition hover:border-white/12 hover:bg-white/8"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-200">{c.name}</span>
                    <div className="flex items-center gap-2">
                      {post && (
                        <Link
                          href={`/blog/${c.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-indigo-500 transition hover:text-indigo-300"
                        >
                          on &ldquo;{post.titleEn ?? post.title}&rdquo;
                        </Link>
                      )}
                      <span className="text-[10px] text-zinc-600">{timeAgo(c.created_at)}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-400 line-clamp-2">{c.message}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="mb-5 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        {/* Leave a thought */}
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Share your thoughts
        </p>
        <QuickCommentForm posts={posts} />
      </section>

    </div>
  );
}
